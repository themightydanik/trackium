package tech.trackium.cargo

import java.net.URI
import java.net.URL
import java.security.SecureRandom
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import javax.net.ssl.HttpsURLConnection
import org.json.JSONObject

object NativeAuth {
    fun origin(value: String): String {
        val u = URI(value.trim())
        require(
            u.scheme == "https" &&
                u.host != null &&
                u.rawUserInfo == null &&
                u.rawQuery == null &&
                u.rawFragment == null &&
                (u.rawPath.isNullOrEmpty() || u.rawPath == "/") &&
                u.port in -1..65535 &&
                u.port != 0
        ) {
            "Gateway must be a credential-free HTTPS origin"
        }
        return URI(
                "https",
                null,
                u.host.lowercase(),
                if (u.port == 443) -1 else u.port,
                null,
                null,
                null,
            )
            .toASCIIString()
    }

    fun random(bytes: Int) =
        ByteArray(bytes)
            .also { SecureRandom().nextBytes(it) }
            .joinToString("") { "%02x".format(it) }

    fun key(proof: String, challenge: String, token: String) =
        hex(ProofProtocol.sha("trackium:native:pop:v1\u0000$proof\u0000$challenge\u0000$token"))

    fun hex(value: String): ByteArray {
        require(Regex("[a-f0-9]{64}").matches(value))
        return value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    }

    fun mac(
        key: ByteArray,
        method: String,
        path: String,
        time: String,
        nonce: String,
        body: String,
    ): String {
        val m = Mac.getInstance("HmacSHA256")
        m.init(SecretKeySpec(key, "HmacSHA256"))
        return m.doFinal(
                listOf("v1", method, path, time, nonce, ProofProtocol.sha(body))
                    .joinToString("\n")
                    .toByteArray(Charsets.UTF_8)
            )
            .joinToString("") { "%02x".format(it) }
    }
}

class NativeGateway(private val secure: SecureStore) : GatewayPort {
    override val origin: String
        get() = NativeAuth.origin(secure.config().getString("gateway"))

    override val tenant: String
        get() = secure.config().getString("tenant")

    private fun request(
        path: String,
        method: String = "GET",
        input: JSONObject? = null,
        authenticated: Boolean = true,
    ): JSONObject {
        require(
            path.startsWith("/v1/") &&
                !path.contains('#') &&
                !path.contains('\n') &&
                !path.contains('\r')
        )
        val body = input?.toString() ?: ""
        val bytes = body.toByteArray(Charsets.UTF_8)
        val c = URL(origin + path).openConnection() as HttpsURLConnection
        c.instanceFollowRedirects = false
        c.connectTimeout = 10000
        c.readTimeout = 20000
        c.useCaches = false
        c.requestMethod = method
        c.setRequestProperty("Accept", "application/json")
        if (authenticated) {
            val s = secure.config().getJSONObject("session")
            require(
                s.getString("tenant_id") == tenant &&
                    s.getString("audience") == "trackium:native:v1:$origin"
            ) {
                "Session audience/tenant mismatch"
            }
            check(
                java.time.Instant.parse(s.getString("expires_at")).toEpochMilli() >
                    System.currentTimeMillis()
            ) {
                "Native session expired: owner re-pairing required"
            }
            val time = System.currentTimeMillis().toString()
            val nonce = NativeAuth.random(16)
            c.setRequestProperty("Authorization", "Bearer " + s.getString("token"))
            c.setRequestProperty("X-Trackium-Client", "android-native-v1")
            c.setRequestProperty("X-Trackium-Audience", s.getString("audience"))
            c.setRequestProperty("X-Trackium-Time", time)
            c.setRequestProperty("X-Trackium-Nonce", nonce)
            c.setRequestProperty(
                "X-Trackium-Mac",
                NativeAuth.mac(
                    NativeAuth.hex(s.getString("pop_key")),
                    method,
                    path,
                    time,
                    nonce,
                    body,
                ),
            )
        }
        try {
            if (input != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json")
                c.setFixedLengthStreamingMode(bytes.size)
                c.outputStream.use { it.write(bytes) }
            }
            val status = c.responseCode
            require(status in 200..299) {
                "Gateway HTTP $status: check session/approval and preserve the proof identity"
            }
            val out = java.io.ByteArrayOutputStream()
            c.inputStream.use { stream ->
                val b = ByteArray(16384)
                while (true) {
                    val n = stream.read(b)
                    if (n < 0) break
                    check(out.size() + n <= 5_000_000) { "Gateway response exceeds safe limit" }
                    out.write(b, 0, n)
                }
            }
            return JSONObject(out.toString("UTF-8"))
        } finally {
            c.disconnect()
        }
    }

    fun challenge(): JSONObject {
        val secret = "0x" + NativeAuth.random(32)
        val hash = ProofProtocol.sha(secret)
        val r =
            request(
                "/v1/native/challenges",
                "POST",
                JSONObject()
                    .put("tenant_id", tenant)
                    .put("proof_hash", hash)
                    .put("label", "Trackium Android"),
                false,
            )
        require(r.getString("audience") == "trackium:native:v1:$origin")
        secure.updateConfig {
            it.put(
                "challenge",
                JSONObject()
                    .put("id", r.getString("id"))
                    .put("proof", secret)
                    .put("origin", origin)
                    .put("expires_at", r.getString("expires_at")),
            )
        }
        return r
    }

    fun claim(): JSONObject {
        val challenge = secure.config().getJSONObject("challenge")
        require(challenge.getString("origin") == origin)
        val s =
            request(
                "/v1/native/claim",
                "POST",
                JSONObject()
                    .put("challenge_id", challenge.getString("id"))
                    .put("proof", challenge.getString("proof")),
                false,
            )
        require(
            s.getString("tenant_id") == tenant &&
                s.getString("audience") == "trackium:native:v1:$origin"
        )
        val key =
            NativeAuth.key(
                challenge.getString("proof"),
                challenge.getString("id"),
                s.getString("token"),
            )
        s.put("pop_key", key.joinToString("") { "%02x".format(it) })
        secure.updateConfig {
            it.put("session", s)
            it.remove("challenge")
        }
        return JSONObject()
            .put("expires_at", s.getString("expires_at"))
            .put("scopes", s.getJSONArray("scopes"))
    }

    fun disconnect() {
        try {
            request("/v1/native/session", "DELETE", JSONObject())
        } finally {
            secure.updateConfig { it.remove("session") }
        }
    }

    fun read(path: String) = request(path)

    fun signedJob(id: String): JSONObject {
        require(Regex("[0-9a-f-]{36}").matches(id))
        return request("/v1/proofs/$id/local-job")
    }

    override fun checkpoint(id: String, input: JSONObject) =
        request("/v1/proofs/$id/local-checkpoint", "POST", input)

    override fun result(id: String, input: JSONObject) =
        request("/v1/proofs/$id/local-result", "POST", input)

    fun verify(id: String) = request("/v1/proofs/$id/verify", "POST", JSONObject())

    fun bundle(id: String) = request("/v1/proofs/$id/bundle")
}
