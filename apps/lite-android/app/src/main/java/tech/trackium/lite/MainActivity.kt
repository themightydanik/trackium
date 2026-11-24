package tech.trackium.lite

import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.SafeBrowsingResponse
import android.webkit.ServiceWorkerController
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import android.window.OnBackInvokedDispatcher
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.ByteArrayInputStream

class MainActivity : Activity() {
    private var browser: WebView? = null
    private lateinit var frame: FrameLayout
    private lateinit var spinner: ProgressBar
    private lateinit var offline: LinearLayout
    private var exporting: JsonExport? = null
    private var workspaceForeground = false
    private var revalidateOnResume = false
    private var resumeEpoch = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        val dark = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        setTheme(if (dark) R.style.TrackiumLiteDark else R.style.TrackiumLiteTheme)
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(false)
        if (Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false)
        val background = Color.parseColor(if (dark) "#0B1220" else "#F5F8FC")
        frame = FrameLayout(this).apply { setBackgroundColor(background) }
        spinner = ProgressBar(this)
        offline = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            val padding = (24 * resources.displayMetrics.density).toInt()
            setPadding(padding, padding, padding, padding)
            setBackgroundColor(background)
            addView(TextView(context).apply { text = "Connection unavailable"; textSize = 24f })
            addView(TextView(context).apply {
                text = "Check your connection to the secure Gateway and try again."
                setPadding(0, padding / 2, 0, padding)
            })
            addView(Button(context).apply { text = "Retry connection"; setOnClickListener { connect() } })
            visibility = View.GONE
        }
        frame.addView(spinner, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER))
        frame.addView(offline, FrameLayout.LayoutParams(-1, -1))
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
            frame.setOnApplyWindowInsetsListener { view, insets ->
                val safe = insets.getInsets(WindowInsets.Type.systemBars() or
                    WindowInsets.Type.displayCutout() or WindowInsets.Type.ime())
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
                WindowInsets.CONSUMED
            }
        }
        setContentView(frame)
        if (Build.VERSION.SDK_INT >= 33) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, ::navigateBack)
        }
        connect()
    }

    private fun connect() {
        offline.visibility = View.GONE
        spinner.visibility = View.VISIBLE
        val view = browser ?: newBrowser().also {
            browser = it
            frame.addView(it, 0, FrameLayout.LayoutParams(-1, -1))
        }
        view.visibility = View.INVISIBLE
        view.loadUrl(TrustedOrigin.HOME)
    }

    private fun newBrowser(): WebView = WebView(this).apply {
        isSaveEnabled = false
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
        settings.apply {
            userAgentString += " TrackiumLiteAndroid/0.1"
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = true
            setGeolocationEnabled(false)
            safeBrowsingEnabled = true
        }
        ServiceWorkerController.getInstance().serviceWorkerWebSettings.apply {
            allowFileAccess = false
            allowContentAccess = false
            blockNetworkLoads = true
        }
        webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.isForMainFrame && TrustedOrigin.isWorkspace(request.url.toString())) return false
                if (request.isForMainFrame) notify("Only the Lite workspace can open here.")
                return true
            }

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val url = request.url.toString()
                val permitted = if (request.isForMainFrame) TrustedOrigin.isWorkspace(url)
                    else TrustedOrigin.isResource(url)
                return if (permitted) null else WebResourceResponse(
                    "text/plain", "utf-8", 403, "Blocked", emptyMap(),
                    ByteArrayInputStream(ByteArray(0)))
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                if (!TrustedOrigin.isWorkspace(url)) {
                    view.stopLoading()
                    showUnavailable(view)
                }
            }

            override fun onPageCommitVisible(view: WebView, url: String) {
                if (browser === view && TrustedOrigin.isWorkspace(url) && offline.visibility != View.VISIBLE) {
                    if (workspaceForeground) {
                        view.visibility = View.VISIBLE
                        spinner.visibility = View.GONE
                    } else {
                        view.visibility = View.INVISIBLE
                        revalidateOnResume = true
                    }
                }
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showUnavailable(view)
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, error: WebResourceResponse) {
                if (request.isForMainFrame) showUnavailable(view)
            }

            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                handler.cancel()
                if (error.url == view.url || TrustedOrigin.isWorkspace(error.url)) showUnavailable(view)
            }

            override fun onSafeBrowsingHit(view: WebView, request: WebResourceRequest, threat: Int, callback: SafeBrowsingResponse) {
                callback.backToSafety(true)
                if (request.isForMainFrame) showUnavailable(view)
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                showUnavailable(view)
                frame.removeView(view)
                browser = null
                view.destroy()
                return true
            }
        }
        webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) = request.deny()
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) WebViewCompat.addWebMessageListener(this, "TrackiumLiteExport", setOf(TrustedOrigin.ORIGIN)) {
            view, message, origin, mainFrame, _ ->
            if (!mainFrame || !TrustedOrigin.isMessageOrigin(origin.toString()) ||
                browser !== view || view.visibility != View.VISIBLE ||
                !TrustedOrigin.isWorkspace(view.url.orEmpty()) || exporting != null) return@addWebMessageListener
            val data = runCatching { message.data }.getOrNull() ?: return@addWebMessageListener
            val export = JsonExport.parse(data)
            if (export == null) {
                notify("Unsupported or oversized evidence file.")
            } else {
                save(export)
            }
        }
        setDownloadListener { _, _, _, _, _ ->
            notify("This download requires the current Lite workspace and Android System WebView.")
        }
    }

    private fun showUnavailable(view: WebView) {
        if (browser !== view) return
        view.visibility = View.GONE
        spinner.visibility = View.GONE
        offline.visibility = View.VISIBLE
    }

    private fun save(export: JsonExport) {
        exporting = export
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_TITLE, export.filename)
        }
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(intent, SAVE_JSON)
        } catch (_: android.content.ActivityNotFoundException) {
            exporting = null
            notify("No document picker is available.")
        }
    }

    @Deprecated("Used for ACTION_CREATE_DOCUMENT on API 28 and later")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != SAVE_JSON) return
        val export = exporting
        exporting = null
        val uri = data?.data
        if (export == null || resultCode != RESULT_OK || uri?.scheme != "content") return
        Thread {
            val saved = runCatching {
                requireNotNull(contentResolver.openOutputStream(uri, "w")).use { it.write(export.bytes) }
            }.isSuccess
            runOnUiThread { if (!isDestroyed) notify(if (saved) "Evidence saved." else "Could not save evidence.") }
        }.start()
    }

    private fun navigateBack() {
        val view = browser
        if (view == null || view.visibility != View.VISIBLE || !TrustedOrigin.isWorkspace(view.url.orEmpty())) {
            finish()
            return
        }
        view.evaluateJavascript("""(() => {
            const dialog = document.querySelector('#detail-dialog[open]')
            if (dialog) { dialog.close(); return true }
            const drawer = document.querySelector('#sidebar.open #nav-close')
            if (drawer) { drawer.click(); return true }
            return false
        })()""") { handled ->
            if (isDestroyed || browser !== view || handled == "true") return@evaluateJavascript
            val history = view.copyBackForwardList()
            val prior = history.currentIndex - 1
            if (prior >= 0 && TrustedOrigin.isWorkspace(history.getItemAtIndex(prior).url))
                view.goBack()
            else finish()
        }
    }

    @Deprecated("Used on API 28–32")
    override fun onBackPressed() = navigateBack()

    override fun onPause() {
        browser?.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onStop() {
        workspaceForeground = false
        resumeEpoch++
        browser?.let { view ->
            if (view.visibility == View.VISIBLE) view.visibility = View.INVISIBLE
            if (view.visibility == View.INVISIBLE) revalidateOnResume = true
        }
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        workspaceForeground = true
        browser?.onResume()
        if (revalidateOnResume) {
            revalidateOnResume = false
            spinner.visibility = View.VISIBLE
            browser?.let(::resumeWorkspace)
        }
    }

    private fun resumeWorkspace(view: WebView) {
        val epoch = ++resumeEpoch
        fun current() = !isDestroyed && workspaceForeground && browser === view && epoch == resumeEpoch
        fun awaitValidation(attempt: Int) {
            if (!current()) return
            if (attempt == 60) {
                view.reload()
                return
            }
            view.evaluateJavascript("window.trackiumResumeSettled === true") { settled ->
                if (!current()) return@evaluateJavascript
                if (settled == "true") {
                    view.visibility = View.VISIBLE
                    spinner.visibility = View.GONE
                } else view.postDelayed({ awaitValidation(attempt + 1) }, 250)
            }
        }
        // A compatible workspace verifies authorization before revealing its
        // existing DOM. Older Gateway versions retain the safe full reload.
        if (!TrustedOrigin.isWorkspace(view.url.orEmpty())) {
            connect()
            return
        }
        view.evaluateJavascript("""(() => {
            if (typeof window.TrackiumResume !== 'function') return false;
            window.trackiumResumeSettled = false;
            window.TrackiumResume().then(() => { window.trackiumResumeSettled = true; });
            return true;
        })()""") { handled ->
            if (!current()) return@evaluateJavascript
            if (handled == "true") awaitValidation(0) else view.reload()
        }
    }

    override fun onDestroy() {
        resumeEpoch++
        exporting = null
        browser?.let { frame.removeView(it); it.stopLoading(); it.destroy() }
        browser = null
        super.onDestroy()
    }

    private fun notify(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()

    private companion object { const val SAVE_JSON = 41 }
}
