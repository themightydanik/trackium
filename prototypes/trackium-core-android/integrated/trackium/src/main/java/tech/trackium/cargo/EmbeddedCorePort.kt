package tech.trackium.cargo

import android.content.Context
import android.os.Looper
import com.eurobuddha.minimaapi.direct.DirectNodeApi
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONObject

/** Read-only capability of trusted bundled Kotlin code, never an exported RPC/JS bridge.
 * All libraries share the host UID; this is an allowlist boundary, not a sandbox. */
object TrackiumCoreAccess {
    const val HOST = "tech.trackium.core.prototype"
    @Volatile private var unlocked: () -> Boolean = { false }
    @JvmStatic fun install(guard: java.util.function.BooleanSupplier) { unlocked = { guard.asBoolean } }
    fun authorized(): Boolean = try { unlocked() } catch (_: Exception) { false }
    fun allowed(command: String): Boolean = command in setOf("status", "balance", "network", "peers", "block")
}

class EmbeddedCorePort(context: Context, private val foreground: () -> Boolean) : CorePort {
    @Volatile private var closed = false
    private val api: DirectNodeApi
    init {
        require(context.packageName == TrackiumCoreAccess.HOST) { "Wrong embedded host" }
        api = DirectNodeApi(context, null)
    }
    override val binding = "${TrackiumCoreAccess.HOST}:prototype-read-only-v1"
    override val enabled get() = !closed && foreground() && TrackiumCoreAccess.authorized()
    // Never grant the standalone publisher wallet capabilities in prototype #1.
    override val admin = false
    override fun call(command: String): Any {
        require(TrackiumCoreAccess.allowed(command)) { "Prototype permits fixed node observations only" }
        check(Looper.myLooper() != Looper.getMainLooper()) { "Core reads must run off the UI thread" }
        check(enabled) { "Embedded Core access requires a visible unlocked host" }
        val latch = CountDownLatch(1)
        var reply: JSONObject? = null
        api.Command(command, { enabled }) { response ->
            // Shared reads in the upstream queue may already be executing: never deliver
            // their data after pause/lock/close even when they cannot be cancelled.
            if (enabled) reply = response
            latch.countDown()
        }
        check(latch.await(15, TimeUnit.SECONDS) && enabled) { "Node unavailable or view closed; retry observation" }
        val value = reply ?: error("No authorized node response")
        check(value.optBoolean("status")) { "Embedded node is starting, stopped or unavailable" }
        return value.get("response")
    }
    fun close() { closed = true; api.onDestroy() }
}
