package tech.trackium.cargo

import android.app.Application
import android.os.Handler
import android.os.Looper
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONArray
import org.json.JSONObject

object TrackiumRuntime {
    @Volatile private var controller: AppController? = null
    @Synchronized fun get(app: Application): AppController =
        controller ?: AppController(app).also { controller = it }
}

class AppController(private val app: Application) {
    val secure = SecureStore(app)
    val gateway = NativeGateway(secure)
    val store = DiskPublisherStore(secure)
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    val busy = AtomicBoolean(false)
    @Volatile
    var foreground = false
        private set

    @Volatile private var epoch = 0L
    @Volatile private var grant = -1L
    @Volatile
    var core: CorePort? = null
        private set

    @Volatile
    var coreState = "Embedded Core not observed yet"
        private set

    @Volatile
    var message = "Observe the embedded Core; pair Gateway separately to read tenant data."
        private set

    @Volatile
    var data: JSONObject? = null
        private set

    @Volatile
    var updated: Long = 0
        private set

    @Volatile
    var wallet: JSONObject? = null
        private set

    @Volatile var listener: (() -> Unit)? = null

    fun lifecycle(active: Boolean) {
        foreground = active
        epoch++
        grant = -1L
        if (!active) {
            (core as? EmbeddedCorePort)?.close()
            core = null
            coreState =
                "Embedded Core view disconnected in background; the node keeps its own lifecycle"
        }
    }

    fun changed() {
        main.post { listener?.invoke() }
    }

    fun task(action: () -> String) {
        if (!busy.compareAndSet(false, true)) {
            message = "An operation is already running; no second command was queued."
            changed()
            return
        }
        changed()
        io.execute {
            try {
                message = action()
            } catch (e: Exception) {
                message = NativePublisher.safeError(e)
                data = null
                updated = 0
            } finally {
                busy.set(false)
                grant = -1L
                changed()
            }
        }
    }

    fun connectCore() = task {
        (core as? EmbeddedCorePort)?.close()
        val node = EmbeddedCorePort(app) { foreground }
        val status = try { node.call("status") as JSONObject }
            catch (e: Exception) { node.close(); throw e }
        core = node
        val peers = status.optJSONObject("network")?.optString("connected", "unknown") ?: "unknown"
        val block = status.optJSONObject("chain")?.optString("block", "unknown / no chain tip") ?: "unknown / no chain tip"
        coreState = "Embedded Minima ${status.getString("version")} · $peers peers · block $block"
        "Connected to this APK's embedded Core. Status is an observation, not proof of synchronization. Wallet commands are disabled in this prototype."
    }

    fun walletOverview() = task {
        val node = core ?: error("Observe the embedded Core first")
        check(node.enabled) { "Embedded Core view must be foreground and unlocked" }
        val status = node.call("status") as JSONObject
        check(status.getString("version") == ProofProtocol.ENGINE)
        val balance = node.call("balance")
        wallet =
            JSONObject()
                .put("version", status.getString("version"))
                .put("peers", status.getJSONObject("network").getInt("connected"))
                .put("block", status.getJSONObject("chain").getLong("block"))
                .put("address", "See the host Wallet tab; no address creation from Trackium")
                .put("balance", balance)
                .put("observed_at", System.currentTimeMillis())
        "Core wallet observation loaded. Default address may differ from the approved publisher; inspect sync in Core."
    }

    fun refresh() = task {
        val session = gateway.read("/v1/native/session")
        val shipments = gateway.read("/v1/shipments?limit=25").getJSONArray("shipments")
        val devices = gateway.read("/v1/devices?limit=25").getJSONArray("devices")
        val publisher = gateway.read("/v1/proof-publisher")
        val proofs = JSONArray()
        for (i in 0 until shipments.length()) {
            val id = shipments.getJSONObject(i).getString("id")
            val list = gateway.read("/v1/shipments/$id/proofs?limit=50").getJSONArray("proofs")
            for (j in 0 until list.length()) proofs.put(list.get(j))
        }
        data =
            JSONObject()
                .put("shipments", shipments)
                .put("devices", devices)
                .put("publisher", publisher)
                .put("proofs", proofs)
                .put("session", JSONObject().put("expires_at", session.getString("expires_at")))
        updated = System.currentTimeMillis()
        "Authenticated Gateway data refreshed. Last reported samples are not physical-device verification."
    }

    fun loadJob(id: String, then: (JSONObject) -> Unit) = task {
        requirePublication()
        val config = secure.config()
        val pin = config.optString("gateway_pin")
        check(pin.isNotEmpty()) {
            "Verify and pin the Gateway signer fingerprint in Settings first"
        }
        val packet = gateway.signedJob(id)
        val job = ProofProtocol.job(packet, pin)
        check(job.records.getJSONObject(0).getString("tenant_id") == gateway.tenant)
        val state = store.load(id) ?: JSONObject().put("proof_id", id).put("phase", "JOB_LOADED")
        state.put("job", packet)
        store.save(id, state)
        main.post { then(packet) }
        "Signed embedded Core job verified and reserved. Review its provenance and wallet limits."
    }

    fun readiness(packet: JSONObject, then: (JSONObject) -> Unit) = task {
        requirePublication()
        val job = ProofProtocol.job(packet, secure.config().getString("gateway_pin"))
        val c = core ?: error("Connect embedded Core first")
        val p = NativePublisher(store, c, gateway) { foreground }
        val r = p.readiness(job)
        main.post { then(r) }
        "Core readiness observed; inspect synchronization in embedded Core before Mainnet approval."
    }

    fun publish(packet: JSONObject, confirmation: String) = task {
        requirePublication()
        val e = epoch
        grant = e
        check(foreground)
        val config = secure.config()
        val id = packet.getJSONObject("payload").getString("job_id")
        val loaded = store.load(id)
        // JOB_LOADED is a UI cache, not a persisted signing state.
        if (loaded?.optString("phase") == "JOB_LOADED") store.save(id, JSONObject())
        check(config.optBoolean("exclusive_core")) {
            "Confirm that only trusted apps can access this Core, including READ apps, and no other wallet copy is running."
        }
        val result =
            NativePublisher(store, core ?: error("Connect embedded Core first"), gateway) {
                    foreground && grant == e && epoch == e
                }
                .run(
                    packet,
                    config.getString("gateway_pin"),
                    confirmation,
                    config.optBoolean("live"),
                    config.optBoolean("mainnet"),
                    config.optInt("local_limit", 1),
                )
        "Proof ${result.optString("phase")} · ${result.optString("txpow_id")} · independent Gateway result, not an elapsed-time confirmation."
    }

    private fun requirePublication() {
        error("Wallet publication and job reservation are unavailable in Trackium Core prototype #1")
    }
}
