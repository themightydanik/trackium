package tech.trackium.cargo

import java.util.concurrent.locks.ReentrantLock
import org.json.JSONArray
import org.json.JSONObject

interface CorePort {
    val binding: String
    val enabled: Boolean
    val admin: Boolean

    fun call(command: String): Any
}

class CoreMissing(message: String) : Exception(message)

class UnknownOutcome(message: String) : Exception(message)

interface GatewayPort {
    val origin: String
    val tenant: String

    fun checkpoint(id: String, input: JSONObject): JSONObject

    fun result(id: String, input: JSONObject): JSONObject
}

interface PublisherStore {
    fun load(id: String): JSONObject?

    fun save(id: String, state: JSONObject)

    fun reserve(id: String, limit: Int)

    fun release(id: String)
}

/** No key-use/index API exists here. All signing and counters belong to BlackBear. */
class NativePublisher(
    private val store: PublisherStore,
    private val core: CorePort,
    private val gateway: GatewayPort,
    private val foreground: () -> Boolean,
) {
    private val lock = ReentrantLock()

    private fun json(c: String) =
        core.call(c) as? JSONObject ?: error("Core object response required")

    private fun consent(job: ProofProtocol.Job, text: String, live: Boolean, mainnet: Boolean) {
        check(foreground()) { "Wallet action paused: foreground confirmation required" }
        require(live && mainnet && text == "PUBLISH MAINNET ${job.event}") {
            "Explicit live/Mainnet and event-specific user approval required"
        }
    }

    fun readiness(job: ProofProtocol.Job): JSONObject {
        check(core.enabled && core.admin) {
            "Enable Trackium and grant ADMIN in BlackBear Apps, then reconnect. No wallet command sent."
        }
        val status = json("status")
        require(status.getString("version") == ProofProtocol.ENGINE) {
            "Unsupported BlackBear engine version"
        }
        require(status.getJSONObject("network").getInt("connected") > 0) {
            "Core has no connected peers"
        }
        val height = status.getJSONObject("chain").getLong("block")
        require(height > 0)
        val tip = json("txpow block:$height")
        val header = tip.getJSONObject("header")
        val age = System.currentTimeMillis() - header.getString("timemilli").toLong()
        require(
            header.getString("chainid").lowercase() == "0x00" &&
                ProofProtocol.id(tip.getString("txpowid")) ==
                    ProofProtocol.id(status.getJSONObject("chain").getString("hash")) &&
                age in -120000..600000
        ) {
            "Mainnet tip stale/inconsistent; verify Core synchronization"
        }
        val script = json("scripts address:${job.address}")
        require(
            script.getString("address").lowercase() == job.address &&
                script.getBoolean("simple") &&
                Regex("RETURN SIGNEDBY\\(0x[0-9a-fA-F]{64}\\)").matches(script.getString("script"))
        ) {
            "Approved publisher is not a standard wallet script in this Core"
        }
        val coins =
            core.call(
                "coins relevant:true sendable:true checkmempool:true tokenid:0x00 address:${job.address}"
            ) as? JSONArray ?: error("Core coin array required")
        require(coins.length() <= 1000)
        var balance = java.math.BigInteger.ZERO
        for (i in 0 until coins.length()) {
            val c = coins.getJSONObject(i)
            require(
                c.getString("address").lowercase() == job.address &&
                    c.getString("tokenid") == "0x00"
            )
            balance += ProofProtocol.units(c.getString("amount"))
        }
        require(balance >= ProofProtocol.units("0.001")) { "Insufficient spendable balance" }
        return JSONObject()
            .put("network", "Mainnet")
            .put("block", height)
            .put("address", job.address)
            .put("spendable_minima", ProofProtocol.amount(balance))
            .put("input_cap", job.maxInput)
            .put("checked_at", System.currentTimeMillis())
            .put(
                "warning",
                "Recent tip/peers are not a global sync oracle. Check Core sync. 0.001 self-transfer, zero requested burn, temporary input locking, PoW and signing-key uses.",
            )
    }

    fun run(
        packet: JSONObject,
        pin: String,
        text: String,
        live: Boolean,
        mainnet: Boolean,
        localLimit: Int,
    ): JSONObject {
        check(lock.tryLock()) { "A publication is already running" }
        var jobId: String? = null
        var state: JSONObject? = null
        try {
            val job = ProofProtocol.job(packet, pin)
            jobId = job.id
            require(job.records.getJSONObject(0).getString("tenant_id") == gateway.tenant) {
                "Native session tenant differs from signed job"
            }
            consent(job, text, live, mainnet)
            val expiry = java.time.Instant.parse(job.payload.getString("expires_at")).toEpochMilli()
            state =
                store.load(job.id)
                    ?: JSONObject()
                        .put("schema_version", 1)
                        .put("phase", "APPROVED")
                        .put("proof_id", job.id)
                        .put("wire", job.wire)
                        .put("pin", pin)
                        .put("origin", gateway.origin)
                        .put("tenant_id", gateway.tenant)
                        .put("binding", core.binding)
                        .put("attempts", 0)
                        .put("job", packet)
            val s = state
            require(
                s.getString("wire") == job.wire &&
                    s.getString("pin") == pin &&
                    s.getString("origin") == gateway.origin &&
                    s.getString("tenant_id") == gateway.tenant &&
                    s.getString("binding") == core.binding
            ) {
                "Recovery identity/Core installation mismatch: manual review"
            }
            require(s.getInt("attempts") in 0..3)
            if (s.optBoolean("completed") || s.optString("phase") == "CONFIRMED") {
                val refreshed =
                    gateway.result(job.id, JSONObject().put("txpow_id", s.getString("txpow_id")))
                val verified = refreshed.getJSONObject("verification")
                s.put("verification", verified).put("completed", true)
                if (verified.optBoolean("verified")) {
                    checkAck(refreshed.getJSONObject("ack"), pin, job, s, "confirmed")
                    s.put("phase", "CONFIRMED")
                } else s.put("phase", "AWAITING_VERIFICATION")
                store.save(job.id, s)
                return s
            }
            store.reserve(job.id, localLimit)
            store.save(job.id, s)
            readiness(job)
            val custom = "trk_" + job.wire.substring(14)
            if (!s.has("mined_data")) {
                check(System.currentTimeMillis() < expiry) {
                    "Approval expired; retain identity for manual review"
                }
                require(job.proof.isNull("txpow_id") || job.proof.optString("txpow_id").isEmpty()) {
                    "Gateway knows a final ID; restore its original local artifact, never replace it"
                }
                var row: JSONObject
                try {
                    row = json("txnlist id:$custom")
                } catch (e: CoreMissing) {
                    if (s.has("signed_data")) {
                        consent(job, text, live, mainnet)
                        json(
                            "txnimport id:$custom data:${ProofProtocol.artifact(s.getString("signed_data"))}"
                        )
                    } else {
                        check(!s.optBoolean("sign_requested")) {
                            "Signing outcome unknown and Core row missing: manual review, never re-sign"
                        }
                        consent(job, text, live, mainnet)
                        json("txncreate id:$custom")
                    }
                    row = json("txnlist id:$custom")
                }
                if (!s.has("signed_data")) {
                    val tx = row.getJSONObject("transaction")
                    if (
                        tx.getJSONArray("inputs").length() == 0 &&
                            tx.getJSONArray("outputs").length() == 0
                    ) {
                        consent(job, text, live, mainnet)
                        json(
                            "txnaddamount id:$custom amount:0.001 address:${job.address} fromaddress:${job.address} tokenid:0x00 burn:0 storestate:true"
                        )
                        row = json("txnlist id:$custom")
                    }
                    ProofProtocol.transaction(row.getJSONObject("transaction"), job, false)
                    if (!s.optBoolean("sign_requested")) {
                        consent(job, text, live, mainnet)
                        json("txnstate id:$custom port:250 value:${job.wire}")
                        json("txnbasics id:$custom")
                        ProofProtocol.transaction(
                            json("txnlist id:$custom").getJSONObject("transaction"),
                            job,
                        )
                        s.put("phase", "SIGN_REQUESTED").put("sign_requested", true)
                        store.save(job.id, s)
                        consent(job, text, live, mainnet)
                        json("txnsign id:$custom publickey:auto")
                    }
                    val checked = json("txncheck id:$custom")
                    check(
                        checked.optBoolean("validtransaction") &&
                            checked.optBoolean("allsignaturesvalid")
                    ) {
                        "Signing did not yield a valid transaction: inspect Core, no automatic re-sign"
                    }
                    val exported = json("txnexport id:$custom showtxn:true")
                    val txn = exported.getJSONObject("txn")
                    ProofProtocol.transaction(txn.getJSONObject("transaction"), job)
                    ProofProtocol.witness(txn.getJSONObject("witness"), job)
                    s.put("signed_data", ProofProtocol.artifact(exported.getString("data")))
                        .put(
                            "transaction_id",
                            ProofProtocol.id(
                                txn.getJSONObject("transaction").getString("transactionid")
                            ),
                        )
                        .put("phase", "SIGNED_SAVED")
                    store.save(job.id, s)
                } else {
                    ProofProtocol.transaction(row.getJSONObject("transaction"), job)
                    ProofProtocol.witness(row.getJSONObject("witness"), job)
                    require(
                        ProofProtocol.id(
                            row.getJSONObject("transaction").getString("transactionid")
                        ) == s.getString("transaction_id")
                    ) {
                        "Recovered transaction changed"
                    }
                }
                val checked = json("txncheck id:$custom")
                check(
                    checked.optBoolean("validtransaction") &&
                        checked.optBoolean("allsignaturesvalid")
                ) {
                    "Recovered signatures/MMR invalid: manual review"
                }
                consent(job, text, live, mainnet)
                s.put("phase", "MINING_REQUESTED")
                store.save(job.id, s)
                val mined = json("txnmine id:$custom")
                s.put("mined_data", ProofProtocol.artifact(mined.getString("data")))
                    .put("txpow_id", ProofProtocol.id(mined.getString("txpowid")))
                    .put("mined_sha256", ProofProtocol.sha(mined.getString("data")))
                    .put("phase", "MINED_SAVED")
                store.save(job.id, s)
            }
            require(
                ProofProtocol.sha(ProofProtocol.artifact(s.getString("mined_data"))) ==
                    s.getString("mined_sha256")
            ) {
                "Corrupt mined artifact"
            }
            if (!s.has("checkpoint_ack")) {
                val ack =
                    gateway.checkpoint(
                        job.id,
                        JSONObject()
                            .put("txpow_id", s.getString("txpow_id"))
                            .put("transaction_id", s.getString("transaction_id"))
                            .put("mined_data", s.getString("mined_data")),
                    )
                checkAck(ack, pin, job, s, "checkpoint")
                s.put("checkpoint_ack", ack).put("phase", "CHECKPOINT_ACKED")
                store.save(job.id, s)
            }
            checkAck(s.getJSONObject("checkpoint_ack"), pin, job, s, "checkpoint")
            consent(job, text, live, mainnet)
            var known = false
            try {
                val found = json("txpow txpowid:${s.getString("txpow_id")}")
                require(ProofProtocol.id(found.getString("txpowid")) == s.getString("txpow_id"))
                ProofProtocol.transaction(found.getJSONObject("body").getJSONObject("txn"), job)
                known = true
            } catch (e: CoreMissing) {
                /* Only explicit not-found permits identical-blob retry. */
            }
            if (!known) {
                check(System.currentTimeMillis() < expiry) {
                    "Approval expired; query/reconcile only"
                }
                check(s.getInt("attempts") < 3) { "Broadcast budget exhausted; manual review" }
                consent(job, text, live, mainnet)
                s.put("attempts", s.getInt("attempts") + 1).put("phase", "POST_REQUESTED")
                store.save(job.id, s)
                val response =
                    json("txnminepost data:${s.getString("mined_data")}").getJSONObject("data")
                require(
                    ProofProtocol.id(response.getString("txpowid")) == s.getString("txpow_id")
                ) {
                    "Post result ID mismatch"
                }
                ProofProtocol.transaction(response.getJSONObject("body").getJSONObject("txn"), job)
            }
            s.put("phase", "SUBMITTED").remove("error")
            store.save(job.id, s)
            val result =
                gateway.result(job.id, JSONObject().put("txpow_id", s.getString("txpow_id")))
            val verification = result.getJSONObject("verification")
            s.put("verification", verification)
            if (verification.optBoolean("verified")) {
                checkAck(result.getJSONObject("ack"), pin, job, s, "confirmed")
                s.put("phase", "CONFIRMED").put("completed", true)
                store.save(job.id, s)
                store.release(job.id)
            } else {
                s.put("phase", "AWAITING_VERIFICATION")
                store.save(job.id, s)
            }
            return s
        } catch (e: Exception) {
            if (state != null && jobId != null) {
                state
                    .put("error", safeError(e))
                    .put(
                        "phase",
                        if (e is UnknownOutcome) "RECONCILIATION_REQUIRED" else "PAUSED_REVIEW",
                    )
                store.save(jobId, state)
            }
            throw e
        } finally {
            lock.unlock()
        }
    }

    private fun checkAck(
        packet: JSONObject,
        pin: String,
        job: ProofProtocol.Job,
        s: JSONObject,
        stage: String,
    ) {
        val ack = ProofProtocol.packet(packet, pin, "trackium:local-core:ack:v1")
        require(
            ack.getString("job_id") == job.id &&
                ack.getString("wire") == job.wire &&
                ack.getString("txpow_id") == s.getString("txpow_id") &&
                ack.getString("stage") == stage
        ) {
            "Gateway acknowledgement identity mismatch"
        }
        if (stage == "checkpoint")
            require(ack.getString("mined_sha256") == s.getString("mined_sha256"))
    }

    companion object {
        fun safeError(e: Exception): String =
            when (e) {
                is UnknownOutcome ->
                    "Command outcome unknown. Keep the saved identity and reconcile."
                is CoreMissing ->
                    "Core data not found. Preserve the job; inspect its recovery state."
                else ->
                    e.message?.takeIf {
                        it.length < 240 &&
                            !it.contains("Bearer") &&
                            !it.contains("trk_native_") &&
                            !it.contains("PRIVATE KEY")
                    } ?: "Operation unavailable; preserve the checkpoint and review configuration"
            }
    }
}
