package tech.trackium.cargo

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.WindowManager
import android.widget.*
import java.text.DateFormat
import java.util.Date
import org.json.JSONArray
import org.json.JSONObject

/** Native views only. No WebView or JavaScript-to-wallet bridge. Gateway owns business rules. */
class MainActivity : Activity() {
    private val bg = Color.rgb(10, 20, 35)
    private val panel = Color.rgb(17, 31, 49)
    private val mint = Color.rgb(67, 215, 189)
    private val text = Color.rgb(220, 232, 245)
    private val muted = Color.rgb(145, 164, 184)
    private val amber = Color.rgb(244, 194, 112)
    private val c: AppController
        get() = TrackiumRuntime.get(application)

    private lateinit var shell: LinearLayout
    private lateinit var content: LinearLayout
    private var tab = "Dashboard"
    private var sessionStarted = false
    private var draftGateway: String? = null
    private var draftTenant: String? = null

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        tab = state?.getString("tab") ?: "Dashboard"
        render()
    }

    override fun onSaveInstanceState(out: Bundle) {
        out.putString("tab", tab)
        super.onSaveInstanceState(out)
    }

    override fun onResume() {
        super.onResume()
        if (!TrackiumCoreAccess.authorized()) {
            setContentView(TextView(this).apply { text = "Unlock Trackium Core to continue" })
            finish()
            return
        }
        sessionStarted = true
        c.lifecycle(true)
        c.listener = { render() }
        render()
        if (c.core == null && !c.busy.get()) c.connectCore()
    }

    override fun onPause() {
        if (sessionStarted) {
            c.listener = null
            c.lifecycle(false)
            sessionStarted = false
        }
        super.onPause()
    }

    private fun dp(n: Int) = (resources.displayMetrics.density * n).toInt()

    private fun label(
        value: String,
        size: Float = 14f,
        color: Int = text,
        bold: Boolean = false,
    ): TextView =
        TextView(this).apply {
            this.text = value
            textSize = size
            setTextColor(color)
            setPadding(0, dp(5), 0, dp(5))
            if (bold) setTypeface(null, Typeface.BOLD)
            setTextIsSelectable(true)
        }

    private fun box(parent: LinearLayout, title: String): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(14), dp(18), dp(14))
            background =
                GradientDrawable().apply {
                    setColor(panel)
                    cornerRadius = dp(16).toFloat()
                }
            parent.addView(
                this,
                LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, dp(8), 0, dp(8)) },
            )
            addView(label(title, 18f, text, true))
        }

    private fun button(
        parent: LinearLayout,
        title: String,
        enabled: Boolean = true,
        action: () -> Unit,
    ) =
        Button(this).apply {
            text = title
            isAllCaps = false
            setTextColor(bg)
            backgroundTintList = android.content.res.ColorStateList.valueOf(mint)
            isEnabled = enabled && !c.busy.get()
            parent.addView(this, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) })
            setOnClickListener { action() }
        }

    private fun input(parent: LinearLayout, title: String, value: String = ""): EditText {
        parent.addView(label(title, 13f, muted))
        return EditText(this).apply {
            setSingleLine()
            setTextColor(this@MainActivity.text)
            setHintTextColor(muted)
            setText(value)
            parent.addView(this, LinearLayout.LayoutParams(-1, -2))
        }
    }

    private fun dialog(title: String, message: String) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Close", null)
            .show()
    }

    private fun detail(title: String, value: JSONObject) {
        val body =
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(20), dp(12), dp(20), dp(12))
                setBackgroundColor(panel)
            }
        fun fields(v: Any?, depth: Int = 0) {
            if (depth > 5) return
            when (v) {
                is JSONObject ->
                    v.keys().forEach { k ->
                        body.addView(label(k.replace('_', ' '), 12f, mint, true))
                        fields(v.get(k), depth + 1)
                    }
                is JSONArray -> {
                    if (v.length() == 0) body.addView(label("No records", 13f, muted))
                    for (i in 0 until minOf(v.length(), 50)) fields(v.get(i), depth + 1)
                }
                else ->
                    body.addView(
                        label(if (v == JSONObject.NULL) "Not available" else v.toString(), 14f)
                    )
            }
        }
        fields(value)
        AlertDialog.Builder(this)
            .setTitle(title)
            .setView(ScrollView(this).apply { addView(body) })
            .setPositiveButton("Close", null)
            .show()
    }

    private fun async(title: String, call: () -> JSONObject) {
        c.task {
            val r = call()
            runOnUiThread {
                if (sessionStarted && TrackiumCoreAccess.authorized()) detail(title, r)
            }
            "$title observed now. Check timestamps and provenance."
        }
    }

    private fun render() {
        if (!TrackiumCoreAccess.authorized()) {
            setContentView(TextView(this).apply { text = "Unlock Trackium Core to continue" })
            return
        }
        try {
            renderSafe()
        } catch (_: Exception) {
            c.lifecycle(false)
            setContentView(
                LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    setBackgroundColor(bg)
                    setPadding(dp(24), dp(32), dp(24), dp(24))
                    addView(label("Recovery review required", 25f, amber, true))
                    addView(
                        label(
                            "Encrypted local state is unavailable. Wallet actions are disabled. Preserve Gateway checkpoints and Core backups; do not clear/reinstall to bypass an unknown transaction. Restore trusted storage/session with the operator.",
                            16f,
                        )
                    )
                }
            )
        }
    }

    private fun renderSafe() {
        shell =
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(bg)
                setPadding(dp(16), dp(16), dp(16), dp(8))
            }
        setContentView(shell)
        shell.setOnApplyWindowInsetsListener { v, insets ->
            v.setPadding(
                dp(16),
                dp(16) + insets.systemWindowInsetTop,
                dp(16),
                dp(8) + insets.systemWindowInsetBottom,
            )
            insets
        }
        shell.requestApplyInsets()
        shell.addView(label("TRACKIUM  /  CARGO", 12f, mint, true))
        shell.addView(label(tab, 29f, text, true))
        shell.addView(label(c.coreState, 12f, muted))
        shell.addView(label(c.message, 12f, if (c.data == null) amber else muted))
        if (c.busy.get())
            shell.addView(
                ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
                    isIndeterminate = true
                },
                LinearLayout.LayoutParams(-1, dp(4)),
            )
        val scroll = ScrollView(this)
        content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroll.addView(content)
        shell.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        when (tab) {
            "Dashboard" -> dashboard()
            "Shipments" -> shipments()
            "Devices" -> devices()
            "Proofs" -> proofs()
            "Settings" -> settings()
        }
        val nav = LinearLayout(this)
        for (name in listOf("Dashboard", "Shipments", "Devices", "Proofs", "Settings")) nav.addView(
            TextView(this).apply {
                this.text = name
                textSize = 10f
                gravity = Gravity.CENTER
                setTextColor(if (name == tab) mint else muted)
                setPadding(0, dp(18), 0, dp(14))
                setOnClickListener {
                    tab = name
                    render()
                }
            },
            LinearLayout.LayoutParams(0, -2, 1f),
        )
        shell.addView(nav)
    }

    private fun freshness(parent: LinearLayout) {
        parent.addView(
            label(
                if (c.updated == 0L)
                    "No authenticated Gateway data loaded. Demo fixtures are not used."
                else
                    "Gateway observation: " +
                        DateFormat.getDateTimeInstance().format(Date(c.updated)) +
                        " · first 25 shipments/devices",
                12f,
                muted,
            )
        )
        button(parent, "Refresh Gateway", secureReady()) { c.refresh() }
    }

    private fun secureReady() = c.secure.config().has("session")

    private fun dashboard() {
        val card = box(content, "Your cargo workspace")
        freshness(card)
        val data = c.data
        if (data != null) {
            card.addView(
                label(
                    "${data.getJSONArray("shipments").length()} shipments  ·  ${data.getJSONArray("devices").length()} devices",
                    21f,
                    mint,
                    true,
                )
            )
            card.addView(
                label(
                    "${data.getJSONArray("proofs").length()} proof records · status from Gateway observations",
                    14f,
                )
            )
            val p = data.getJSONObject("publisher")
            card.addView(
                label(
                    "Network: Mainnet\nPublication enabled: ${p.optBoolean("enabled")}\nAutomatic backlog: false\nNative wallet keys remain in embedded Core.",
                    14f,
                )
            )
        }
        val safety = box(content, "Built for accountable delivery")
        safety.addView(
            label(
                "Synthetic / unverified readings keep their provenance. A blockchain commitment validates recorded bytes, not the physical sensor. Pending and submitted records are never called verified.",
                14f,
                muted,
            )
        )
        button(safety, "Observe Core wallet & synchronization", c.core != null) {
            c.walletOverview()
        }
        c.wallet?.let { w ->
            safety.addView(
                label(
                    "Core ${w.getString("version")} · ${w.getInt("peers")} peers · block ${w.getLong("block")}\nDefault wallet address: ${w.getString("address")}\nObservation: ${DateFormat.getDateTimeInstance().format(Date(w.getLong("observed_at")))}",
                    12f,
                    muted,
                )
            )
            button(safety, "Inspect reported wallet balance") {
                dialog("Core-reported balance (not reserved funds)", w.get("balance").toString())
            }
        }
        button(safety, "Observe embedded node") { c.connectCore() }
        button(safety, "Return to node") { finish() }

    }

    private fun shipments() {
        freshness(content)
        val list = c.data?.optJSONArray("shipments") ?: JSONArray()
        if (list.length() == 0)
            box(content, "No shipments loaded")
                .addView(
                    label(
                        "Pair with your tenant and refresh. Shipment creation and transitions remain on Gateway."
                    )
                )
        for (i in 0 until list.length()) {
            val s = list.getJSONObject(i)
            val card = box(content, s.optString("name", "Shipment"))
            card.addView(
                label(s.optString("status") + "  ·  " + s.optString("source_trust"), 14f, mint)
            )
            card.addView(label(s.getString("id"), 11f, muted))
            button(card, "Route & checkpoints") {
                async("Shipment route") { c.gateway.read("/v1/shipments/" + s.getString("id")) }
            }
        }
    }

    private fun devices() {
        freshness(content)
        val list = c.data?.optJSONArray("devices") ?: JSONArray()
        if (list.length() == 0)
            box(content, "No devices loaded")
                .addView(label("Only devices belonging to the authenticated tenant are shown."))
        for (i in 0 until list.length()) {
            val d = list.getJSONObject(i)
            val card = box(content, d.optString("label", "Device"))
            card.addView(
                label(d.optString("identity_kind") + "  ·  " + d.optString("mode"), 14f, mint)
            )
            card.addView(label(d.getString("id"), 11f, muted))
            button(card, "Coordinates, sensors & status") {
                async("Latest reported telemetry") {
                    JSONObject()
                        .put("status", c.gateway.read("/v1/devices/${d.getString("id")}/status"))
                        .put(
                            "location",
                            c.gateway.read("/v1/devices/${d.getString("id")}/location"),
                        )
                        .put(
                            "history",
                            c.gateway.read("/v1/devices/${d.getString("id")}/events?limit=10"),
                        )
                }
            }
        }
    }

    private fun proofs() {
        freshness(content)
        val controls = box(content, "Native Mainnet Publisher")
        controls.addView(
            label(
                "Embedded Core · read-only prototype. Publication is unavailable; private keys and key-use counters belong only to the node.",
                14f,
                muted,
            )
        )
        val config = c.secure.config()
        controls.addView(
            label(
                "Local live: ${config.optBoolean("live")}  /  Mainnet: ${config.optBoolean("mainnet")}\nLocal reservation limit: ${config.optInt("local_limit",1)}",
                14f,
                amber,
            )
        )
        val p = c.data?.optJSONObject("publisher")
        val pending = p?.optJSONArray("pending_events") ?: JSONArray()
        if (pending.length() > 0) {
            val waiting = box(content, "Awaiting Gateway owner approval")
            for (i in 0 until minOf(pending.length(), 5)) {
                val e = pending.getJSONObject(i)
                waiting.addView(
                    label(
                        "${e.getString("event_type")} · ${e.getString("source_trust")}\n${e.getString("id")}",
                        12f,
                        muted,
                    )
                )
            }
            waiting.addView(
                label(
                    "Owner approves one event on the trusted Gateway host. Native sessions cannot approve events.",
                    12f,
                    amber,
                )
            )
        }
        val list = c.data?.optJSONArray("proofs") ?: JSONArray()
        for (i in 0 until list.length()) {
            val proof = list.getJSONObject(i)
            val card = box(content, proof.getJSONObject("commitment").getString("event_type"))
            card.addView(
                label(
                    proof.getJSONObject("commitment").getString("source_trust") +
                        "  ·  " +
                        proof.getString("mode"),
                    14f,
                    amber,
                    true,
                )
            )
            card.addView(
                label(
                    "${proof.getString("state")} · depth ${proof.optInt("confirmations")}/${proof.optInt("required_depth")}\nChecked: ${proof.optString("last_checked_at","never")}",
                    13f,
                )
            )
            card.addView(
                label(
                    if (proof.isNull("txpow_id")) "No blockchain TXID"
                    else proof.getString("txpow_id"),
                    11f,
                    muted,
                )
            )
            val id = proof.getString("id")
            button(card, "Verify with independent Gateway reader") {
                async("Fresh verification") { c.gateway.verify(id) }
            }
            button(card, "Export proof bundle") {
                c.task {
                    val bundle = c.gateway.bundle(id)
                    runOnUiThread { share(bundle) }
                    "Export contains cargo data; share only with authorized verifiers."
                }
            }
            if (
                proof.optString("publisher_transport") == "android_minimaapi" &&
                    proof.getString("mode") == "live"
            )
                button(card, "Review approved Native Core job") {
                    c.loadJob(id) { packet -> jobDialog(packet) }
                }
        }
        val saved = config.optJSONArray("proof_ids") ?: JSONArray()
        if (saved.length() > 0) {
            val recovery = box(content, "Device recovery checkpoints")
            for (i in 0 until saved.length()) {
                val id = saved.getString(i)
                val s = c.store.load(id) ?: continue
                recovery.addView(label(s.optString("phase") + " · " + id, 12f, muted))
                if (s.has("job"))
                    button(recovery, "Review saved job ${id.take(8)}") {
                        jobDialog(s.getJSONObject("job"))
                    }
            }
        }
    }

    private fun share(value: JSONObject) {
        val id = "trackium-proof-${System.currentTimeMillis()}.json"
        val file = java.io.File(cacheDir, id)
        file.writeText(value.toString(2))
        val uri = android.net.Uri.parse("content://$packageName.trackium.exports/$id")
        startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND)
                    .setType("application/json")
                    .putExtra(Intent.EXTRA_STREAM, uri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),
                "Share sensitive proof bundle",
            )
        )
    }

    private fun jobDialog(packet: JSONObject) {
        try {
            val job = ProofProtocol.job(packet, c.secure.config().getString("gateway_pin"))
            val parent =
                LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(dp(16), dp(8), dp(16), dp(8))
                    setBackgroundColor(panel)
                }
            val view = ScrollView(this).apply { addView(parent) }
            parent.addView(
                label(
                    "Mainnet · ${job.proof.getJSONObject("commitment").getString("source_trust")}",
                    16f,
                    amber,
                    true,
                )
            )
            parent.addView(
                label(
                    "Event: ${job.event}\nShipment: ${job.proof.getString("shipment_id")}\nWallet: ${job.address}\nInput cap: ${job.maxInput} MIN\n0.001 self-transfer, zero requested burn. PoW/signing-key uses and temporary input locking apply.",
                    13f,
                )
            )
            parent.addView(label("STATE: ${job.wire}", 11f, muted))
            button(parent, "Check Core wallet & Mainnet readiness") {
                c.readiness(packet) { r -> detail("Core readiness observation", r) }
            }
            val agree =
                CheckBox(this).apply {
                    text =
                        "I checked Core sync, wallet, provenance and input cap; all enabled Core apps are trusted and no wallet clone is running. I authorize this Mainnet event."
                    setTextColor(textColor())
                    parent.addView(this)
                }
            val typed = input(parent, "Type PUBLISH MAINNET ${job.event}")
            AlertDialog.Builder(this)
                .setTitle("Approve this immutable event")
                .setView(view)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Publish / reconcile") { _, _ ->
                    if (!agree.isChecked)
                        dialog("Approval required", "Explicit Mainnet consent is required.")
                    else c.publish(packet, typed.text.toString().trim())
                }
                .show()
        } catch (e: Exception) {
            dialog("Job unavailable", NativePublisher.safeError(e))
        }
    }

    private fun textColor() = text

    private fun settings() {
        val core = box(content, "embedded Core · your built-in wallet")
        core.addView(label(c.coreState, 14f, muted))
        core.addView(
            label(
                "In-process Pandamonium DirectNodeApi adapter. Only exact status/balance/network/peers/block reads are allowed. No external APK discovery, wallet write, seed import or WebView bridge.",
                12f,
            )
        )
        button(core, "Observe embedded node") { c.connectCore() }
        button(core, "Return to node settings") { finish() }
        val config = c.secure.config()
        val gateway = box(content, "Gateway · limited native session")
        val url =
            input(gateway, "HTTPS Gateway origin", draftGateway ?: config.optString("gateway"))
        val tenant =
            input(gateway, "Tenant UUID (public)", draftTenant ?: config.optString("tenant"))
        url.addTextChangedListener(watch { draftGateway = it })
        tenant.addTextChangedListener(watch { draftTenant = it })
        button(gateway, "Save connection") {
            val u = url.text.toString()
            val t = tenant.text.toString()
            c.task {
                val base = NativeAuth.origin(u)
                require(Regex("[0-9a-f-]{36}").matches(t))
                c.secure.updateConfig {
                    if (it.optString("gateway") != base || it.optString("tenant") != t) {
                        it.remove("session")
                        it.remove("challenge")
                        it.remove("gateway_pin")
                    }
                    it.put("gateway", base).put("tenant", t)
                }
                "Gateway profile saved. No owner key or browser cookie imported."
            }
        }
        button(gateway, "Create owner approval challenge") {
            c.task {
                val r = c.gateway.challenge()
                "Owner approval required: ${r.getString("id")} · expires ${r.getString("expires_at")}. Use the native-approve CLI on the trusted Gateway host."
            }
        }
        val challenge = config.optJSONObject("challenge")
        if (challenge != null)
            gateway.addView(
                label(
                    "Challenge UUID:\n${challenge.getString("id")}\nApprove on Gateway with read/publish scope. Device proof stays in Android Keystore-protected storage.",
                    12f,
                    amber,
                )
            )
        button(gateway, "Complete owner pairing") {
            c.task {
                val s = c.gateway.claim()
                "Native read/publish session active until ${s.getString("expires_at")}. Refresh data."
            }
        }
        button(gateway, "Refresh authenticated data", secureReady()) { c.refresh() }
        button(gateway, "Disconnect / revoke session", secureReady()) {
            c.task {
                c.gateway.disconnect()
                "Native session revoked and removed from device."
            }
        }
        val issuer = c.data?.optJSONObject("publisher")?.optString("signer_fingerprint")
        gateway.addView(
            label("Job signer pin: ${config.optString("gateway_pin","not pinned")}", 11f, muted)
        )
        if (!issuer.isNullOrBlank() && issuer != "null")
            button(gateway, "Verify & pin Gateway issuer") {
                AlertDialog.Builder(this)
                    .setTitle("Verify through the trusted owner channel")
                    .setMessage(
                        "Fingerprint:\n$issuer\n\nConfirm it independently. Unknown job files cannot select their own trust key."
                    )
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Pin verified issuer") { _, _ ->
                        c.task {
                            c.secure.updateConfig { it.put("gateway_pin", issuer) }
                            "Gateway issuer pinned. Key rotation requires explicit owner review."
                        }
                    }
                    .show()
            }
        val safety = box(content, "Wallet publication unavailable · prototype #1")
        for ((key, title) in
            listOf(
                "live" to "Allow live wallet preparation",
                "mainnet" to "Allow Mainnet publication",
                "exclusive_core" to "Only trusted Core apps (including READ); one wallet copy",
            )) {
            val check =
                CheckBox(this).apply {
                    text = title
                    setTextColor(textColor())
                    isChecked = config.optBoolean(key)
                }
            check.isEnabled = false
            safety.addView(check)
            check.setOnCheckedChangeListener { _, value ->
                c.task {
                    c.secure.updateConfig { it.put(key, value) }
                    "$title = $value. Each event still needs typed confirmation."
                }
            }
        }
        val cap =
            input(
                safety,
                "Local lifetime reservation cap (first transaction: 1)",
                config.optInt("local_limit", 1).toString(),
            )
        cap.inputType = android.text.InputType.TYPE_CLASS_NUMBER
        button(safety, "Set explicit local cap") {
            val value = cap.text.toString()
            c.task {
                val n = value.toInt()
                require(n in 1..100)
                c.secure.updateConfig { it.put("local_limit", n) }
                "Local cap set to $n; Gateway limits and owner event approval also apply."
            }
        }
        safety.addView(
            label(
                "No automatic backlog or background publishing. In-flight commands accepted by Core may finish after the app closes. Keep one copy of this Core wallet running; Trackium never manages one-time indices.",
                12f,
                amber,
            )
        )
    }

    private fun watch(change: (String) -> Unit) =
        object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                change(s.toString())
            }

            override fun afterTextChanged(s: Editable?) {}
        }
}
