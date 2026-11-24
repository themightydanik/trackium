package tech.trackium.lite

import org.junit.Assert.*
import org.junit.Test

class TrustedOriginTest {
    @Test fun trustedWorkspaceAndApis() {
        assertTrue(TrustedOrigin.isTrusted(TrustedOrigin.HOME))
        assertTrue(TrustedOrigin.isTrusted("https://${TrustedOrigin.HOST}/v1/devices?limit=25"))
        assertTrue(TrustedOrigin.isTrusted("https://${TrustedOrigin.HOST}/assets/v2/cargo.css"))
    }

    @Test fun rejectUnsafeAndLookalikeOrigins() {
        val bad = listOf(
            "http://${TrustedOrigin.HOST}/app/",
            "https://${TrustedOrigin.HOST}.evil.invalid/app/",
            "https://evil.invalid/app/",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "https://user@${TrustedOrigin.HOST}/app/",
            "https://${TrustedOrigin.HOST}:8443/app/",
            "https://${TrustedOrigin.HOST}/_cms/private"
        )
        for (url in bad) assertFalse(url, TrustedOrigin.isTrusted(url))
    }

    @Test fun downloadsAreRestrictedToFirstPartyApis() {
        assertTrue(TrustedOrigin.isDownloadOrigin("https://${TrustedOrigin.HOST}/v1/proofs/123/export"))
        assertFalse(TrustedOrigin.isDownloadOrigin("https://evil.invalid/v1/proofs"))
        assertFalse(TrustedOrigin.isDownloadOrigin("blob:https://${TrustedOrigin.HOST}/foo"))
    }
}
