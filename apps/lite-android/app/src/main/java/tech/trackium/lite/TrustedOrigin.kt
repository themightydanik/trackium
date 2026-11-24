package tech.trackium.lite

import java.net.URI

/** One production origin. Entry documents and subresources have separate policies. */
object TrustedOrigin {
    const val HOST = "trackium-gateway-production.up.railway.app"
    const val ORIGIN = "https://$HOST"
    const val HOME = "$ORIGIN/app/"

    private fun parse(url: String): URI? = runCatching { URI(url) }.getOrNull()?.takeIf {
        it.scheme == "https" && it.rawAuthority == HOST && it.host == HOST &&
            it.port == -1 && it.rawUserInfo == null
    }

    private val routes = setOf("main", "dashboard", "shipments", "devices", "map", "events", "proofs", "settings")

    fun isWorkspace(url: String): Boolean {
        val uri = parse(url) ?: return false
        return uri.rawPath in setOf("/app", "/app/") && uri.rawQuery == null &&
            (uri.rawFragment == null || uri.rawFragment in routes)
    }

    fun isMessageOrigin(url: String): Boolean = url == ORIGIN || url == "$ORIGIN/"

    fun isResource(url: String): Boolean {
        val uri = parse(url) ?: return false
        val path = uri.rawPath
        if (path.any { it == '%' || it == '\\' } || path.contains("//") ||
            path.split('/').any { it == "." || it == ".." }) return false
        return isWorkspace(url) || path.startsWith("/app/assets/") || path.startsWith("/v1/") || path == "/app/icon.png"
    }
}
