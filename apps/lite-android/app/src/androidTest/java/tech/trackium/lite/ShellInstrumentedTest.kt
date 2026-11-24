package tech.trackium.lite

import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Button
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ShellInstrumentedTest {
    @Test fun installedApplicationHasIsolatedIdentityAndRealJsonParser() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("tech.trackium.lite", context.packageName)
        assertEquals(0, context.applicationInfo.flags and ApplicationInfo.FLAG_ALLOW_BACKUP)
        val body = """{"format":"trackium-device-support-range-v1","observations":[]}"""
        assertEquals(body, JsonExport.parse(body)?.bytes?.toString(Charsets.UTF_8))
        assertNull(JsonExport.parse("""{"proof":{},"records":[]} trailing"""))
        assertFalse(TrustedOrigin.isWorkspace("${TrustedOrigin.ORIGIN}/app/core"))
    }

    @Test fun offlineShellKeepsSecureSettingsAndSurvivesRotation() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val arguments = InstrumentationRegistry.getArguments()
        assertEquals("true", arguments.getString("offlineEmulator"))
        assertTrue(android.os.Build.HARDWARE in setOf("ranchu", "goldfish"))
        // Launch only inside the explicitly offline emulator configured by the test job.
        fun setting(name: String): String = android.os.ParcelFileDescriptor.AutoCloseInputStream(
            instrumentation.uiAutomation.executeShellCommand("settings get global " + name)
        ).bufferedReader().use { it.readText().trim() }
        assertEquals("Disable emulator networking before this suite", "1", setting("airplane_mode_on"))
        assertEquals("Disable Wi-Fi before this suite", "0", setting("wifi_on"))
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val root = activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as ViewGroup
                val view = root.getChildAt(0) as WebView
                assertFalse(view.settings.allowFileAccess)
                assertFalse(view.settings.allowContentAccess)
                assertFalse(view.settings.javaScriptCanOpenWindowsAutomatically)
                assertFalse(view.settings.supportMultipleWindows())
                assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, view.settings.mixedContentMode)
                assertFalse(android.webkit.CookieManager.getInstance().acceptThirdPartyCookies(view))
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            }
            for (attempt in 0 until 80) {
                var retry = false
                scenario.onActivity { activity ->
                    val container = activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as ViewGroup
                    val overlay = container.getChildAt(container.childCount - 1) as ViewGroup
                    retry = overlay.isShown && (overlay.getChildAt(2) as Button).text == "Retry connection" &&
                        activity.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
                    if (retry) assertFalse(container.getChildAt(0).isShown)
                }
                if (retry) return
                Thread.sleep(250)
            }
            fail("Offline retry UI did not appear")
        }
    }
}
