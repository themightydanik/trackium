package tech.trackium.lite

import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import java.io.ByteArrayInputStream

/**
 * Standalone Lite shell. The existing same-origin Gateway owns customer authentication,
 * sessions, CSRF, authorization and tenant isolation. No JavaScript-to-native bridge.
 * It is intentionally NOT a Minima host/publisher or a customer-credential store.
 */
class MainActivity : Activity() {
    private lateinit var browser: WebView
    private lateinit var spinner: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(13, 23, 39)
        window.navigationBarColor = Color.rgb(13, 23, 39)
        WebView.setWebContentsDebuggingEnabled(false)

        val frame = FrameLayout(this).apply { setBackgroundColor(Color.rgb(13, 23, 39)) }
        browser = WebView(this).apply { setBackgroundColor(Color.rgb(13, 23, 39)) }
        spinner = ProgressBar(this).apply { isIndeterminate = true }

        frame.addView(browser, FrameLayout.LayoutParams(-1, -1))
        frame.addView(
            spinner,
            FrameLayout.LayoutParams(-2, -2, android.view.Gravity.CENTER)
        )
        setContentView(frame)

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser, false)
        browser.settings.apply {
            javaScriptEnabled = true // Required by the existing first-party Lite workspace.
            domStorageEnabled = true // Appearance preference; server owns authenticated state.
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = true
            setGeolocationEnabled(false) // No native GPS impersonation.
            safeBrowsingEnabled = true
        }
        // There is deliberately no addJavascriptInterface and no native wallet bridge.
        browser.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (TrustedOrigin.isTrusted(request.url.toString())) return false
                if (request.isForMainFrame) {
                    Toast.makeText(this@MainActivity, "External links are blocked in Lite", Toast.LENGTH_SHORT).show()
                }
                return true
            }

            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val url = request.url
                if (url.scheme == "https" && !TrustedOrigin.isTrusted(url.toString())) {
                    return WebResourceResponse(
                        "text/plain", "utf-8", 403, "Blocked", emptyMap(),
                        ByteArrayInputStream(ByteArray(0))
                    )
                }
                return null
            }

            override fun onPageFinished(view: WebView, url: String) {
                spinner.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError
            ) {
                if (!request.isForMainFrame) return
                spinner.visibility = View.GONE
                // Replace potentially stale tenant UI on top-level network failure.
                val html = """
                    <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                    <body style="margin:0;padding:32px;background:#0d1727;color:#f1f5f9;font:16px sans-serif">
                    <h1>Connection unavailable</h1><p>Trackium Lite requires a secure Gateway connection.
                    No device location is shown while disconnected.</p>
                    <p>Check your network and restart Trackium Lite to retry.</p></body></html>
                """.trimIndent()
                view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
            }
        }
        browser.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                spinner.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
            }
        }
        browser.setDownloadListener { url, _, _, _, _ ->
            // WebView blob exports are not supported by Android DownloadManager.
            // Never forward session cookies or proof bundles to arbitrary download services.
            val message = if (TrustedOrigin.isDownloadOrigin(url))
                "Export requires an Android-safe download flow (pending)"
            else "This download is not supported in Lite yet"
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        }
        if (savedInstanceState == null) browser.loadUrl(TrustedOrigin.HOME)
        else if (browser.restoreState(savedInstanceState) == null) browser.loadUrl(TrustedOrigin.HOME)
    }

    @Deprecated("Compatibility with API 28; replace with OnBackInvokedCallback during polish.")
    override fun onBackPressed() {
        if (browser.canGoBack()) browser.goBack() else super.onBackPressed()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        browser.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        browser.stopLoading()
        browser.destroy()
        super.onDestroy()
    }
}
