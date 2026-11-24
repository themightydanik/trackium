package tech.trackium.lite

import org.junit.Assert.*
import org.junit.Test

class JsonExportTest {
    @Test fun preservesApprovedEvidenceVerbatim() {
        val integritas = """{"proof":{"provider":"integritas"},"evidence":{"value":"°C"}}"""
        val native = """{"schema_version":1,"proof":{},"records":[]}"""
        val diagnostics = """{"format":"trackium-device-support-range-v1","observations":[]}"""
        for ((input, name) in listOf(
            integritas to "trackium-integritas-proof.json",
            native to "trackium-proof.json",
            diagnostics to "trackium-device-support-range.json"
        )) {
            val output = requireNotNull(JsonExport.parse(input))
            assertEquals(name, output.filename)
            assertArrayEquals(input.toByteArray(Charsets.UTF_8), output.bytes)
        }
    }

    @Test fun rejectsUnknownMalformedAndOversizedFiles() {
        assertNull(JsonExport.parse("""{"token":"unsupported"}"""))
        assertNull(JsonExport.parse("""{"proof":{"provider":"integritas"}}"""))
        assertNull(JsonExport.parse("""{"proof":{},"records":[]} garbage"""))
        assertNull(JsonExport.parse("x".repeat(MAX_EXPORT_BYTES + 1)))
    }
}
