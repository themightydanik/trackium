package tech.trackium.lite

import org.json.JSONObject
import org.json.JSONTokener

internal const val MAX_EXPORT_BYTES = 5 * 1024 * 1024

internal data class JsonExport(val filename: String, val bytes: ByteArray) {
    companion object {
        fun parse(text: String): JsonExport? {
            if (text.length > MAX_EXPORT_BYTES) return null
            val bytes = text.toByteArray(Charsets.UTF_8)
            if (bytes.size > MAX_EXPORT_BYTES) return null
            val json = try {
                val parser = JSONTokener(text)
                val result = parser.nextValue() as? JSONObject ?: return null
                if (parser.nextClean() != '\u0000') return null
                result
            } catch (_: Exception) {
                return null
            } catch (_: StackOverflowError) {
                return null
            }
            val proof = json.optJSONObject("proof")
            val filename = when {
                json.optString("format") == "trackium-device-support-range-v1" &&
                    json.optJSONArray("observations") != null -> "trackium-device-support-range.json"
                proof?.optString("provider") == "integritas" &&
                    json.optJSONObject("evidence") != null -> "trackium-integritas-proof.json"
                proof != null && json.optJSONArray("records") != null -> "trackium-proof.json"
                else -> return null
            }
            return JsonExport(filename, bytes)
        }
    }
}
