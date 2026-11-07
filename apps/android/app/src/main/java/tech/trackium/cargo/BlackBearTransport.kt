package tech.trackium.cargo

import android.app.BroadcastOptions
import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Looper
import com.eurobuddha.minimaapi.MinimaAPI
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

object BlackBearPolicy {
    const val APK_SHA = "8428f694b509172f5f0b7a7c2f12596f31350a5755660ee7af508228f023bd0e"
    const val CERT_SHA = "eca1383c9d27683a281fbe6355356267877dc2dd14d963d7cc289ca0700e517f"

    data class Node(val binding: String, val apkPath: String, val version: String)

    fun installed(context: Context, fullHash: Boolean): Node {
        val p =
            context.packageManager.getPackageInfo(
                ProofProtocol.PACKAGE,
                PackageManager.GET_SIGNING_CERTIFICATES,
            )
        require(p.versionName == "2.2.10-BlackBear" && p.longVersionCode == 280L) {
            "Only the reviewed BlackBear 2.2.10 release is supported"
        }
        val signatures =
            p.signingInfo?.apkContentsSigners ?: error("Core signing identity unavailable")
        require(signatures.size == 1)
        val cert =
            MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray()).joinToString(
                ""
            ) {
                "%02x".format(it)
            }
        require(cert == CERT_SHA) { "BlackBear APK signer differs from reviewed release" }
        val path = p.applicationInfo?.sourceDir ?: error("Core APK missing")
        if (fullHash) {
            val digest = MessageDigest.getInstance("SHA-256")
            File(path).inputStream().use { stream ->
                val chunk = ByteArray(65536)
                while (true) {
                    val n = stream.read(chunk)
                    if (n < 0) break
                    digest.update(chunk, 0, n)
                }
            }
            require(digest.digest().joinToString("") { "%02x".format(it) } == APK_SHA) {
                "Installed BlackBear binary is not the reviewed release"
            }
        }
        return Node(
            "${ProofProtocol.PACKAGE}:$cert:${p.firstInstallTime}:${p.lastUpdateTime}",
            path,
            p.versionName!!,
        )
    }
}

/** Restricts the unchanged SDK to the selected package and encrypts its private IPC pairing IDs. */
private class PinnedSdkContext(
    base: Context,
    private val secure: SecureStore,
    private val mayWrite: () -> Boolean,
) : ContextWrapper(base) {
    private val receivers = mutableMapOf<BroadcastReceiver, BroadcastReceiver>()

    override fun getSharedPreferences(name: String, mode: Int): SharedPreferences =
        if (name == "minima_api_prefs") secure.sdkPreferences()
        else super.getSharedPreferences(name, mode)

    override fun sendBroadcast(intent: Intent) {
        if (intent.`package` != ProofProtocol.PACKAGE)
            return // SDK discovery remains REGISTER-only; other nodes are never contacted.
        require(
            intent.action in
                listOf("com.eurobuddha.minimacore.REGISTER", "com.eurobuddha.minimacore.CMD")
        ) {
            "No file/key/backup IPC bridge is exposed"
        }
        if (intent.action?.endsWith(".CMD") == true) {
            val verb =
                (intent.getStringExtra("com.eurobuddha.minimacore.CMD_ACTION") ?: "")
                    .substringBefore(' ')
            if (
                verb in
                    setOf(
                        "txncreate",
                        "txnaddamount",
                        "txnstate",
                        "txnbasics",
                        "txnsign",
                        "txnimport",
                        "txnmine",
                        "txnminepost",
                    ) && !mayWrite()
            )
                return
        }
        if (Build.VERSION.SDK_INT >= 34)
            super.sendBroadcast(
                intent,
                null,
                BroadcastOptions.makeBasic().setShareIdentityEnabled(true).toBundle(),
            )
        else super.sendBroadcast(intent)
    }

    override fun registerReceiver(
        receiver: BroadcastReceiver?,
        filter: IntentFilter,
        flags: Int,
    ): Intent? {
        require(receiver != null)
        val guarded =
            object : BroadcastReceiver() {
                override fun onReceive(c: Context, i: Intent) {
                    if (i.action != "com.eurobuddha.minimacore.RESPONSE") return
                    if (Build.VERSION.SDK_INT >= 34) {
                        val sender = sentFromPackage
                        if (sender != null && sender != ProofProtocol.PACKAGE) return
                    }
                    try {
                        val uri = i.getStringExtra("com.eurobuddha.minimacore.RESPONSE_URI")
                        if (uri != null) {
                            val u = Uri.parse(uri)
                            require(
                                u.scheme == "content" &&
                                    u.authority == "${ProofProtocol.PACKAGE}.ipcresponses"
                            )
                            val provider =
                                packageManager.resolveContentProvider(u.authority!!, 0)
                                    ?: error("Missing Core response provider")
                            val node = packageManager.getApplicationInfo(ProofProtocol.PACKAGE, 0)
                            require(provider.applicationInfo.uid == node.uid)
                            contentResolver.openFileDescriptor(u, "r")!!.use {
                                require(it.statSize in 1..2097152)
                            }
                        } else {
                            val raw =
                                i.getStringExtra("com.eurobuddha.minimacore.RESPONSE_RESULT")
                                    ?: return
                            require(raw.toByteArray(Charsets.UTF_8).size <= 2097152)
                        }
                        receiver.onReceive(this@PinnedSdkContext, i)
                    } catch (_: Exception) {
                        /* Malformed/foreign/oversized response becomes a bounded unknown outcome, never an accepted result. */
                    }
                }
            }
        receivers[receiver] = guarded
        return super.registerReceiver(guarded, filter, flags)
    }

    override fun unregisterReceiver(receiver: BroadcastReceiver) {
        super.unregisterReceiver(receivers.remove(receiver) ?: receiver)
    }
}

class BlackBearTransport(
    private val context: Context,
    secure: SecureStore,
    private val mayWrite: () -> Boolean,
    private val onState: (String) -> Unit,
) : CorePort {
    private val selected = BlackBearPolicy.installed(context, true)
    override val binding = selected.binding
    @Volatile
    override var enabled = false
        private set

    @Volatile
    override var admin = false
        private set

    @Volatile private var registered = false
    @Volatile private var closed = false
    private val pending = java.util.concurrent.CopyOnWriteArrayList<CountDownLatch>()
    private val api: MinimaAPI

    init {
        MinimaAPI.LOGGING_ENABLED = false
        api =
            MinimaAPI(PinnedSdkContext(context, secure, mayWrite)) { r ->
                registered = r.optBoolean("status")
                enabled = r.optBoolean("enabled")
                admin = r.optBoolean("admin")
                onState(
                    if (!registered) "BlackBear did not reply. Start Core and reconnect."
                    else if (!enabled || !admin)
                        "Registered with BlackBear. Grant enabled + ADMIN in its Apps screen, then reconnect."
                    else "BlackBear IPC enabled · ADMIN granted"
                )
            }
    }

    override fun call(command: String): Any {
        check(Looper.myLooper() != Looper.getMainLooper()) { "Core I/O must not block UI" }
        require(!closed && registered && enabled) { "BlackBear is not enabled/connected" }
        require(BlackBearPolicy.installed(context, false).binding == binding) {
            "Core installation changed: manual recovery required"
        }
        val verb = command.substringBefore(' ')
        require(
            command.length <= 150000 &&
                !command.contains(';') &&
                !command.contains('\n') &&
                !command.contains('\r') &&
                verb in
                    setOf(
                        "getaddress",
                        "balance",
                        "status",
                        "getaddress",
                        "scripts",
                        "coins",
                        "txnlist",
                        "txncreate",
                        "txnaddamount",
                        "txnstate",
                        "txnbasics",
                        "txnsign",
                        "txncheck",
                        "txnexport",
                        "txnimport",
                        "txnmine",
                        "txnminepost",
                        "txpow",
                    )
        ) {
            "Command not allowed by Trackium transport"
        }
        if (
            verb in
                setOf(
                    "txncreate",
                    "txnaddamount",
                    "txnstate",
                    "txnbasics",
                    "txnsign",
                    "txnimport",
                    "txnmine",
                    "txnminepost",
                )
        )
            check(admin) { "BlackBear ADMIN permission is required" }
        val latch = CountDownLatch(1)
        val complete = AtomicBoolean(false)
        var reply: JSONObject? = null
        pending.add(latch)
        api.Command(command) { r ->
            if (complete.compareAndSet(false, true)) {
                reply = r
                latch.countDown()
            }
        }
        if (!latch.await(if (verb == "txnmine") 135 else 20, TimeUnit.SECONDS)) {
            pending.remove(latch)
            complete.set(true)
            throw UnknownOutcome("Core response timeout")
        }
        pending.remove(latch)
        val r = reply ?: throw UnknownOutcome("Core response unavailable")
        if (!r.optBoolean("status")) {
            val e = r.optString("error")
            if (
                Regex("^(Transaction not found|TxPoW not found)", RegexOption.IGNORE_CASE)
                    .containsMatchIn(e)
            )
                throw CoreMissing("Core data not found")
            throw UnknownOutcome("Core rejected or lost command: $verb")
        }
        return r.opt("response") ?: throw UnknownOutcome("Core response missing")
    }

    fun close() {
        closed = true
        enabled = false
        admin = false
        api.onDestroy()
        pending.forEach { it.countDown() }
        pending.clear()
    }
}
