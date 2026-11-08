package tech.trackium.cargo

import android.app.Application
import android.content.Context
import android.os.Looper
import com.eurobuddha.minimaapi.MinimaAPI
import com.eurobuddha.minimaapi.direct.DirectNodeApi
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.*
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE, application = Application::class)
class EmbeddedCorePortTest {
    private val foreground = AtomicBoolean(true)
    private val unlocked = AtomicBoolean(true)
    private val commands = mutableListOf<String>()
    private lateinit var context: Context
    private var handler: ((String, DirectNodeApi.Request) -> Unit)? = null

    @Before fun setup() {
        context = mock(Context::class.java)
        `when`(context.packageName).thenReturn(TrackiumCoreAccess.HOST)
        TrackiumCoreAccess.install { unlocked.get() }
        DirectNodeApi.install(object : DirectNodeApi.Backend {
            override fun ready() = true
            override fun command(command: String, reply: DirectNodeApi.Request) {
                commands.add(command)
                if (handler != null) handler!!(command, reply)
                else reply.accept(JSONObject().put("status", true).put("response", JSONObject().put("version", "fixture-node")))
            }
            override fun file(a: String?, p: String?, n: String?, u: android.net.Uri?, reply: DirectNodeApi.Request) {
                fail("Trackium must never submit a file/seed/backup action")
            }
        })
    }
    @After fun cleanup() { DirectNodeApi.install(null); TrackiumCoreAccess.install { false } }
    private fun await(task: FutureTask<Any>): Any {
        val end = System.nanoTime() + TimeUnit.SECONDS.toNanos(3)
        while (!task.isDone && System.nanoTime() < end) {
            shadowOf(Looper.getMainLooper()).idle(); Thread.sleep(2)
        }
        return try { task.get(1, TimeUnit.SECONDS) }
        catch (e: java.util.concurrent.ExecutionException) { throw (e.cause ?: e) }
    }
    private fun submit(port: EmbeddedCorePort, command: String): FutureTask<Any> =
        FutureTask<Any> { port.call(command) }.also { Thread(it, "prototype-node-test").start() }

    @Test fun readsUseTheHostDirectApiWithoutExternalPairingOrBroadcasts() {
        val port = EmbeddedCorePort(context) { foreground.get() }
        assertFalse(port.admin)
        assertEquals("fixture-node", (await(submit(port, "status")) as JSONObject).getString("version"))
        assertEquals(listOf("status"), commands)
        verify(context, never()).sendBroadcast(any())
        verify(context, never()).getSharedPreferences(anyString(), anyInt())
        assertThrows(IllegalStateException::class.java) { MinimaAPI(context, null) }
        port.close()
    }
    @Test fun mutationsBatchesPrivateMaterialAndCommandParametersAreRejectedBeforeDispatch() {
        val port = EmbeddedCorePort(context) { true }
        for (command in listOf("send address:0x00", "txnsign id:x", "txnpost id:x", "seed", "keys", "vault", "backup", "getaddress", "status;balance", "status\nbalance", "status ", "balance address:0x00", "STATUS", "")) {
            assertThrows(IllegalArgumentException::class.java) { await(submit(port, command)) }
        }
        assertTrue(commands.isEmpty())
        port.close()
    }
    @Test fun wrongHostAndLockedOrBackgroundViewsFailClosed() {
        `when`(context.packageName).thenReturn("com.eurobuddha.minimablock")
        assertThrows(IllegalArgumentException::class.java) { EmbeddedCorePort(context) { true } }
        `when`(context.packageName).thenReturn(TrackiumCoreAccess.HOST)
        val port = EmbeddedCorePort(context) { foreground.get() }
        unlocked.set(false)
        assertThrows(IllegalStateException::class.java) { await(submit(port, "balance")) }
        unlocked.set(true); foreground.set(false)
        assertThrows(IllegalStateException::class.java) { await(submit(port, "status")) }
        assertTrue(commands.isEmpty())
        port.close()
    }
    @Test fun lateReadIsNotDeliveredAfterCloseOrLock() {
        var pending: DirectNodeApi.Request? = null
        handler = { _, r -> pending = r }
        val port = EmbeddedCorePort(context) { foreground.get() }
        val read = submit(port, "balance")
        val end = System.nanoTime() + TimeUnit.SECONDS.toNanos(3)
        while (pending == null && System.nanoTime() < end) { shadowOf(Looper.getMainLooper()).idle(); Thread.sleep(2) }
        assertNotNull(pending)
        unlocked.set(false)
        pending!!.accept(JSONObject().put("status", true).put("response", "private balance"))
        assertThrows(IllegalStateException::class.java) { await(read) }
        port.close()
    }
}
