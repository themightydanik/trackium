package tech.trackium.cargo

import java.math.BigInteger
import java.nio.charset.StandardCharsets.UTF_8
import java.security.*
import java.security.spec.*
import java.util.Base64
import org.json.JSONArray
import org.json.JSONObject

/**
 * Only Gateway creates canonical events. Preserve its exact UTF-8 bytes, never round sensor
 * numbers.
 */
object ProofProtocol {
    const val PROFILE = "blackbear-2.2.10"
    const val ENGINE = "1.1.2.31-euro4"
    const val PACKAGE = "com.eurobuddha.minimablock"
    const val MAX_ARTIFACT = 131072

    fun sha(text: String) =
        MessageDigest.getInstance("SHA-256").digest(text.toByteArray(UTF_8)).joinToString("") {
            "%02x".format(it)
        }

    fun id(value: String): String {
        require(Regex("0x[0-9a-fA-F]{64}").matches(value)) { "Invalid Minima identifier" }
        return value.lowercase()
    }

    fun artifact(value: String): String {
        require(value.length <= MAX_ARTIFACT && Regex("0x(?:[0-9a-fA-F]{2})+").matches(value)) {
            "Invalid/oversized public artifact"
        }
        return value
    }

    fun units(value: String): BigInteger {
        require(Regex("[0-9]{1,20}(?:\\.[0-9]{1,44})?").matches(value)) { "Invalid amount" }
        val p = value.split('.')
        return BigInteger(p[0]) * BigInteger.TEN.pow(44) +
            BigInteger(p.getOrElse(1) { "" }.padEnd(44, '0'))
    }

    fun amount(value: BigInteger): String {
        val n = value.toString().padStart(45, '0')
        return (n.dropLast(44) + "." + n.takeLast(44)).trimEnd('0').trimEnd('.')
    }

    fun quote(s: String): String {
        val out = StringBuilder("\"")
        var i = 0
        while (i < s.length) {
            val c = s[i]
            when (c) {
                '"' -> out.append("\\\"")
                '\\' -> out.append("\\\\")
                '\b' -> out.append("\\b")
                '\u000c' -> out.append("\\f")
                '\n' -> out.append("\\n")
                '\r' -> out.append("\\r")
                '\t' -> out.append("\\t")
                else -> {
                    if (
                        c.code < 32 ||
                            (c.isHighSurrogate() &&
                                (i + 1 == s.length || !s[i + 1].isLowSurrogate())) ||
                            (c.isLowSurrogate() && (i == 0 || !s[i - 1].isHighSurrogate()))
                    )
                        out.append("\\u%04x".format(c.code))
                    else out.append(c)
                }
            }
            i++
        }
        return out.append('"').toString()
    }

    fun canonical(v: Any?): String =
        when (v) {
            null,
            JSONObject.NULL -> "null"
            is JSONObject ->
                v.keys().asSequence().toList().sorted().joinToString(",", "{", "}") {
                    quote(it) + ":" + canonical(v.get(it))
                }
            is JSONArray ->
                (0 until v.length()).joinToString(",", "[", "]") { canonical(v.get(it)) }
            is String -> quote(v)
            is Boolean -> v.toString()
            is Number -> {
                val n = v.toString()
                require(
                    Regex("-?(0|[1-9][0-9]*)").matches(n) &&
                        BigInteger(n).abs() <= BigInteger("9007199254740991")
                ) {
                    "Noninteger envelope field: unsupported schema"
                }
                n
            }
            else -> error("Unsupported canonical value")
        }

    private fun b64url(s: String) = Base64.getUrlDecoder().decode(s)

    private fun der(raw: ByteArray): ByteArray {
        require(raw.size == 64)
        fun integer(a: ByteArray): ByteArray {
            var b = a.dropWhile { it == 0.toByte() }.toByteArray()
            if (b.isEmpty()) b = byteArrayOf(0)
            if (b[0].toInt() and 0x80 != 0) b = byteArrayOf(0) + b
            return byteArrayOf(2, b.size.toByte()) + b
        }
        val pair = integer(raw.copyOfRange(0, 32)) + integer(raw.copyOfRange(32, 64))
        return byteArrayOf(0x30, pair.size.toByte()) + pair
    }

    fun packet(packet: JSONObject, pin: String, domain: String): JSONObject {
        require(Regex("[a-f0-9]{64}").matches(pin)) {
            "Pin the Gateway issuer through the trusted owner channel first"
        }
        val issuer = packet.getJSONObject("issuer")
        require(sha(canonical(issuer)) == pin) { "Gateway signer pin mismatch" }
        require(issuer.getString("kty") == "EC" && issuer.getString("crv") == "P-256")
        val params =
            AlgorithmParameters.getInstance("EC")
                .apply { init(ECGenParameterSpec("secp256r1")) }
                .getParameterSpec(ECParameterSpec::class.java)
        val key =
            KeyFactory.getInstance("EC")
                .generatePublic(
                    ECPublicKeySpec(
                        ECPoint(
                            BigInteger(1, b64url(issuer.getString("x"))),
                            BigInteger(1, b64url(issuer.getString("y"))),
                        ),
                        params,
                    )
                )
        val payload = packet.getJSONObject("payload")
        require(payload.getString("domain") == domain) { "Wrong packet domain" }
        val ok =
            Signature.getInstance("SHA256withECDSA")
                .apply {
                    initVerify(key)
                    update(canonical(payload).toByteArray(UTF_8))
                }
                .verify(der(Base64.getDecoder().decode(packet.getString("signature"))))
        require(ok) { "Invalid Gateway signature" }
        return payload
    }

    data class Job(val payload: JSONObject, val proof: JSONObject, val records: JSONArray) {
        val id: String
            get() = proof.getString("id")

        val address: String
            get() = proof.getString("publisher_address")

        val wire: String
            get() = proof.getString("wire")

        val event: String
            get() = proof.getString("event_id")

        val maxInput: String
            get() = payload.getString("max_input")
    }

    fun job(packet: JSONObject, pin: String): Job {
        val v = ProofProtocol.packet(packet, pin, "trackium:local-core:job:v1")
        val bundle = v.getJSONObject("bundle")
        val p = bundle.getJSONObject("proof")
        val records = bundle.getJSONArray("records")
        require(
            v.getInt("schema_version") == 1 &&
                v.getString("job_id") == p.getString("id") &&
                p.getString("mode") == "live" &&
                p.getString("publisher_kind") == "local" &&
                p.getString("publisher_transport") == "android_minimaapi" &&
                v.getString("core_profile") == PROFILE &&
                p.getString("chain_id") == "0x00"
        ) {
            "Not an approved BlackBear Mainnet job"
        }
        id(p.getString("publisher_address"))
        require(
            v.getString("max_input") in listOf("0.01", "0.1", "1") &&
                v.getInt("max_attempts") == 3 &&
                records.length() in 1..2000
        )
        var previous: Any = JSONObject.NULL
        var tenant = ""
        for (i in 0 until records.length()) {
            val r = records.getJSONObject(i)
            val raw = r.getString("canonical_payload")
            val e = JSONObject(raw)
            require(raw.toByteArray(UTF_8).size <= 131072)
            val t = r.getString("tenant_id")
            if (i == 0) tenant = t
            require(
                sha(raw) == r.getString("sha256") &&
                    r.getLong("sequence") == i + 1L &&
                    e.getLong("sequence") == i + 1L &&
                    e.getInt("schema_version") == 1 &&
                    r.get("previous_hash") == previous &&
                    e.get("previous_hash") == previous &&
                    t == tenant &&
                    e.getString("tenant_id") == t &&
                    e.getString("shipment_id") == p.getString("shipment_id") &&
                    r.getString("shipment_id") == p.getString("shipment_id") &&
                    e.getString("event_id") == r.getString("id") &&
                    e.getString("event_type") == r.getString("event_type") &&
                    e.getString("source_trust") == r.getString("source_trust") &&
                    r.getString("source_trust") ==
                        p.getJSONObject("commitment").getString("source_trust")
            ) {
                "Immutable event chain mismatch"
            }
            previous = r.getString("sha256")
        }
        val last = records.getJSONObject(records.length() - 1)
        val trust = last.getString("source_trust")
        require(trust in listOf("synthetic", "unverified"))
        require(
            last.getString("id") == p.getString("event_id") &&
                p.getLong("sequence") == last.getLong("sequence")
        )
        val c =
            JSONObject()
                .put("domain", "trackium:cargo:minima-proof:v1")
                .put("schema_version", 1)
                .put("publish_mode", "live")
                .put("chain_id", "0x00")
                .put("publisher_address", p.getString("publisher_address"))
                .put("event_id", last.getString("id"))
                .put("shipment_id", p.getString("shipment_id"))
                .put("event_type", last.getString("event_type"))
                .put("sequence", last.getLong("sequence"))
                .put("canonical_sha256", last.getString("sha256"))
                .put("previous_hash", last.get("previous_hash"))
                .put("source_trust", trust)
        require(canonical(c) == canonical(p.getJSONObject("commitment"))) {
            "Commitment differs from immutable events"
        }
        require(
            p.getString("wire") ==
                "0x54524b5001" + (if (trust == "synthetic") "01" else "00") + sha(canonical(c))
        ) {
            "STATE commitment mismatch"
        }
        return Job(v, p, records)
    }

    fun transaction(tx: JSONObject, job: Job, withState: Boolean = true) {
        val input = tx.getJSONArray("inputs")
        val output = tx.getJSONArray("outputs")
        require(input.length() in 1..64 && output.length() in 1..3) { "Transaction shape rejected" }
        fun sum(coins: JSONArray): BigInteger {
            var n = BigInteger.ZERO
            for (i in 0 until coins.length()) {
                val c = coins.getJSONObject(i)
                require(
                    c.getString("address").lowercase() == job.address &&
                        c.getString("tokenid") == "0x00"
                ) {
                    "External address or token rejected"
                }
                val a = units(c.getString("amount"))
                require(a > BigInteger.ZERO)
                n += a
            }
            return n
        }
        val total = sum(input)
        require(
            total == sum(output) &&
                total <= units(job.maxInput) &&
                total >= units("0.001") &&
                (0 until output.length()).any {
                    units(output.getJSONObject(it).getString("amount")) == units("0.001")
                }
        ) {
            "Self-transfer spend cap rejected"
        }
        val state = tx.optJSONArray("state") ?: JSONArray()
        if (withState || state.length() > 0)
            require(
                state.length() == 1 &&
                    state.getJSONObject(0).getInt("port") == 250 &&
                    state.getJSONObject(0).getString("data").lowercase() == job.wire
            ) {
                "Unexpected transaction STATE"
            }
    }

    fun witness(w: JSONObject, job: Job) {
        require(w.getJSONArray("signatures").length() > 0)
        val scripts = w.getJSONArray("scripts")
        require(
            (0 until scripts.length()).any {
                val s = scripts.getJSONObject(it)
                s.getString("address").lowercase() == job.address &&
                    Regex("RETURN SIGNEDBY\\(0x[0-9a-fA-F]{64}\\)").matches(s.getString("script"))
            }
        ) {
            "Standard wallet signature witness required"
        }
    }
}
