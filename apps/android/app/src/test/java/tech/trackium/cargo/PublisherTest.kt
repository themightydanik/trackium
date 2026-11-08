package tech.trackium.cargo

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class PublisherTest {
    private fun f() = JSONObject(javaClass.getResource("/protocol.json")!!.readText())

    private class Store : PublisherStore {
        var state: JSONObject? = null
        var released = false

        override fun load(id: String) = state?.let { JSONObject(it.toString()) }

        override fun save(id: String, state: JSONObject) {
            this.state = JSONObject(state.toString())
        }

        override fun reserve(id: String, limit: Int) {
            check(limit == 1)
        }

        override fun release(id: String) {
            released = true
        }
    }

    private class Core(val f: JSONObject) : CorePort {
        override val binding = "reviewed-installation"
        override var enabled = true
        override var admin = true
        val calls = mutableListOf<String>()
        var exists = false
        var signed = false
        var lostSign = false
        var lostPost = false
        var posted = false
        val tx
            get() = JSONObject(f.getJSONObject("transaction").toString())

        override fun call(command: String): Any {
            calls.add(command)
            return when (command.substringBefore(' ')) {
                "status" ->
                    JSONObject()
                        .put("version", ProofProtocol.ENGINE)
                        .put("network", JSONObject().put("connected", 2))
                        .put(
                            "chain",
                            JSONObject().put("block", 100).put("hash", f.getString("txpow")),
                        )
                "txpow" ->
                    if (command.contains("block:"))
                        JSONObject()
                            .put("txpowid", f.getString("txpow"))
                            .put(
                                "header",
                                JSONObject()
                                    .put("timemilli", System.currentTimeMillis().toString())
                                    .put("chainid", "0x00"),
                            )
                    else {
                        if (!posted) throw CoreMissing("not found")
                        JSONObject()
                            .put("txpowid", f.getString("txpow"))
                            .put("body", JSONObject().put("txn", tx))
                    }
                "scripts" ->
                    JSONObject()
                        .put(
                            "address",
                            tx.getJSONArray("inputs").getJSONObject(0).getString("address"),
                        )
                        .put("simple", true)
                        .put(
                            "script",
                            f.getJSONObject("witness")
                                .getJSONArray("scripts")
                                .getJSONObject(0)
                                .getString("script"),
                        )
                "coins" -> tx.getJSONArray("inputs")
                "txnlist" -> {
                    if (!exists) throw CoreMissing("missing")
                    JSONObject().put("transaction", tx).put("witness", f.getJSONObject("witness"))
                }
                "txncreate",
                "txnimport" -> {
                    exists = true
                    JSONObject()
                }
                "txnstate",
                "txnbasics",
                "txnaddamount" -> JSONObject()
                "txnsign" -> {
                    signed = true
                    if (lostSign) {
                        lostSign = false
                        throw UnknownOutcome("lost")
                    }
                    JSONObject()
                }
                "txncheck" ->
                    JSONObject().put("validtransaction", signed).put("allsignaturesvalid", signed)
                "txnexport" ->
                    JSONObject()
                        .put("data", "0x4567")
                        .put(
                            "txn",
                            JSONObject()
                                .put("transaction", tx)
                                .put("witness", f.getJSONObject("witness")),
                        )
                "txnmine" ->
                    JSONObject()
                        .put("data", f.getString("mined"))
                        .put("txpowid", f.getString("txpow"))
                "txnminepost" -> {
                    posted = true
                    if (lostPost) {
                        lostPost = false
                        throw UnknownOutcome("lost post")
                    }
                    JSONObject()
                        .put(
                            "data",
                            JSONObject()
                                .put("txpowid", f.getString("txpow"))
                                .put("body", JSONObject().put("txn", tx)),
                        )
                }
                else -> error("Unexpected command")
            }
        }
    }

    private class Gateway(val f: JSONObject) : GatewayPort {
        override val origin = "https://gateway.test"
        override val tenant = "33333333-3333-4333-8333-333333333333"
        var verified = true
        var down = false

        override fun checkpoint(id: String, input: JSONObject): JSONObject {
            if (down) throw Exception("offline")
            assertEquals(f.getString("mined"), input.getString("mined_data"))
            return f.getJSONObject("checkpoint")
        }

        override fun result(id: String, input: JSONObject) =
            JSONObject()
                .put("verification", JSONObject().put("verified", verified))
                .put("ack", f.getJSONObject("confirmed"))
    }

    private fun run(f: JSONObject, s: Store, c: Core, g: Gateway, fg: () -> Boolean = { true }) =
        NativePublisher(s, c, g, fg)
            .run(
                f.getJSONObject("job"),
                f.getString("pin"),
                "PUBLISH MAINNET 11111111-1111-4111-8111-111111111111",
                true,
                true,
                1,
            )

    private fun fails(block: () -> Unit) {
        try {
            block()
            fail("Expected failure")
        } catch (e: Exception) {}
    }

    @Test
    fun nodeGoldenCommitmentAndAuthentication() {
        val f = f()
        assertEquals(78, ProofProtocol.job(f.getJSONObject("job"), f.getString("pin")).wire.length)
        val a = f.getJSONObject("auth")
        val key =
            NativeAuth.key(a.getString("proof"), a.getString("challenge"), a.getString("token"))
        assertArrayEquals(NativeAuth.hex(a.getString("key")), key)
        assertEquals(
            a.getString("mac"),
            NativeAuth.mac(
                key,
                "POST",
                a.getString("path"),
                a.getString("time"),
                a.getString("nonce"),
                a.getString("body"),
            ),
        )
        assertEquals("https://gateway.test", NativeAuth.origin("https://GATEWAY.test:443/"))
        fails { NativeAuth.origin("http://gateway.test") }
        fails { NativeAuth.origin("https://a@host") }
    }

    @Test
    fun tamperedJobAndPinFailClosed() {
        val f = f()
        fails { ProofProtocol.job(f.getJSONObject("job"), "00".repeat(32)) }
        f.getJSONObject("job").getJSONObject("payload").put("max_input", "1")
        fails { ProofProtocol.job(f.getJSONObject("job"), f.getString("pin")) }
    }

    @Test
    fun walletSpendRestrictions() {
        val f = f()
        val job = ProofProtocol.job(f.getJSONObject("job"), f.getString("pin"))
        val tx = f.getJSONObject("transaction")
        ProofProtocol.transaction(tx, job)
        tx.getJSONArray("outputs").getJSONObject(0).put("address", "0x" + "ff".repeat(32))
        fails { ProofProtocol.transaction(tx, job) }
        assertEquals(
            "0.00000000000000000000000000000000000000000001",
            ProofProtocol.amount(
                ProofProtocol.units("0.00000000000000000000000000000000000000000001")
            ),
        )
        fails { ProofProtocol.units("1e-3") }
    }

    @Test
    fun duplicateAndReorgNeverResign() {
        val f = f()
        val s = Store()
        val c = Core(f)
        val g = Gateway(f)
        assertEquals("CONFIRMED", run(f, s, c, g).getString("phase"))
        assertTrue(s.released)
        run(f, s, c, g)
        assertEquals(1, c.calls.count { it.startsWith("txnsign ") })
        assertEquals(1, c.calls.count { it.startsWith("txnminepost ") })
        g.verified = false
        assertEquals("AWAITING_VERIFICATION", run(f, s, c, g).getString("phase"))
        assertEquals(1, c.calls.count { it.startsWith("txnsign ") })
    }

    @Test
    fun lostSignatureReplyRecoversExistingSignature() {
        val f = f()
        val s = Store()
        val c = Core(f).apply { lostSign = true }
        val g = Gateway(f)
        fails { run(f, s, c, g) }
        assertTrue(s.state!!.getBoolean("sign_requested"))
        run(f, s, c, g)
        assertEquals(1, c.calls.count { it.startsWith("txnsign ") })
    }

    @Test
    fun lostSignatureAndMissingRowNeedsManualReview() {
        val f = f()
        val s = Store()
        val c = Core(f).apply { lostSign = true }
        val g = Gateway(f)
        fails { run(f, s, c, g) }
        c.exists = false
        fails { run(f, s, c, g) }
        assertEquals(1, c.calls.count { it.startsWith("txnsign ") })
        assertFalse(c.calls.any { it.startsWith("txnmine ") })
    }

    @Test
    fun lostPostReconcilesKnownId() {
        val f = f()
        val s = Store()
        val c = Core(f).apply { lostPost = true }
        val g = Gateway(f)
        fails { run(f, s, c, g) }
        assertTrue(s.state!!.has("mined_data"))
        run(f, s, c, g)
        assertEquals(1, c.calls.count { it.startsWith("txnminepost ") })
        assertEquals(1, c.calls.count { it.startsWith("txnsign ") })
    }

    @Test
    fun gatewayOfflineKeepsArtifactWithoutPosting() {
        val f = f()
        val s = Store()
        val c = Core(f)
        val g = Gateway(f).apply { down = true }
        fails { run(f, s, c, g) }
        assertTrue(s.state!!.has("mined_data"))
        assertFalse(c.calls.any { it.startsWith("txnminepost ") })
        g.down = false
        run(f, s, c, g)
        assertEquals(1, c.calls.count { it.startsWith("txnmine ") })
    }

    @Test
    fun lifecycleAndPermissionsBlockWrites() {
        val f = f()
        val s = Store()
        val c = Core(f)
        val g = Gateway(f)
        fails { run(f, s, c, g) { false } }
        assertTrue(c.calls.isEmpty())
        c.admin = false
        fails { run(f, s, c, g) }
        assertFalse(c.calls.any { it.startsWith("txncreate ") })
    }
}
