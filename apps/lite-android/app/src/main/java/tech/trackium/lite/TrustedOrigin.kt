package tech.trackium.lite

import java.net.URI

/**
 * A Lite session belongs only to the operator-approved first-party HTTPS Gateway.
 * No arbitrary URL, localhost, file scheme, or alternate hostname is privileged.
 */
object TrustedOrigin {
    const val HOST = "trackium-gateway-production.up.railway.app"
    const val HOME = "https://$HOST/app/"

    fun isTrusted(url: String): Boolean = try {
        val uri = URI(url)
        uri.scheme.equals("https", ignoreCase = true) &&
            uri.host.equals(HOST, ignoreCase = true) &&
            uri.port == -1 &&
            uri.rawUserInfo == null &&
            (uri.rawPath == "/app" || uri.rawPath.startsWith("/app/") ||
                uri.rawPath.startsWith("/assets/") || uri.rawPath.startsWith("/v1/") ||
                uri.rawPath == "/mds.js")
    } catch (_: Exception) {
        false
    }

    fun isDownloadOrigin(url: String): Boolean = try {
        val uri = URI(url)
        uri.scheme.equals("https", ignoreCase = true) &&
            uri.host.equals(HOST, ignoreCase = true) &&
            uri.port == -1 && uri.rawUserInfo == null &&
            uri.rawPath.startsWith("/v1/")
    } catch (_: Exception) {
        false
    }
}
