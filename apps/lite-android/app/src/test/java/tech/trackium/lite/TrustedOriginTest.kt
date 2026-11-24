package tech.trackium.lite

import org.junit.Assert.*
import org.junit.Test

class TrustedOriginTest {
    private val origin = TrustedOrigin.ORIGIN

    @Test fun onlyLiteIsAMainDocument() {
        assertTrue(TrustedOrigin.isWorkspace(TrustedOrigin.HOME))
        assertTrue(TrustedOrigin.isWorkspace("$origin/app/#map"))
        assertFalse(TrustedOrigin.isWorkspace("$origin/app/?return=elsewhere"))
        assertFalse(TrustedOrigin.isWorkspace("$origin/app/core"))
        assertFalse(TrustedOrigin.isWorkspace("$origin/v1/session"))
        assertFalse(TrustedOrigin.isWorkspace("$origin/app/#unknown"))
    }

    @Test fun resourcesUseActualGatewayMount() {
        assertTrue(TrustedOrigin.isResource("$origin/v1/devices?limit=25"))
        assertTrue(TrustedOrigin.isResource("$origin/app/assets/v2/cargo.css"))
        assertFalse(TrustedOrigin.isResource("$origin/app/assets/../core"))
        assertFalse(TrustedOrigin.isResource("$origin/app/assets/%2e%2e/core"))
        assertFalse(TrustedOrigin.isResource("$origin/app//assets/v2/cargo.css"))
    }

    @Test fun rejectUnsafeAndLookalikeOrigins() {
        val bad = listOf(
            "http://${TrustedOrigin.HOST}/app/",
            "https://${TrustedOrigin.HOST}.evil.invalid/app/",
            "https://evil.invalid/app/", "file:///etc/passwd", "javascript:alert(1)",
            "https://user@${TrustedOrigin.HOST}/app/", "$origin:443/app/",
            "$origin/_cms/private", "$origin/app/core", "intent://app/"
        )
        for (url in bad) assertFalse(url, TrustedOrigin.isResource(url))
    }

    @Test fun exportChannelRequiresExactFirstPartyOrigin() {
        assertTrue(TrustedOrigin.isMessageOrigin(origin))
        assertFalse(TrustedOrigin.isMessageOrigin("$origin/app/"))
        assertFalse(TrustedOrigin.isMessageOrigin("https://evil.invalid"))
    }
}
