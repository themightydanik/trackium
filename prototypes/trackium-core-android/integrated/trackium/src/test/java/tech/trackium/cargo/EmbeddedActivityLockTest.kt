package tech.trackium.cargo

import android.app.Application
import android.widget.TextView
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE, application = Application::class)
class EmbeddedActivityLockTest {
    @After fun reset() { TrackiumCoreAccess.install { false } }
    @Test fun lockedActivityNeverReadsEncryptedStateOrStartsNodeObservation() {
        TrackiumCoreAccess.install { false }
        // Generic Application has no host transport or AndroidKeyStore. Reaching
        // controller/renderSafe would fail; a locked entry must avoid both.
        val controller = Robolectric.buildActivity(MainActivity::class.java).create().start().resume()
        val activity = controller.get()
        assertTrue(activity.isFinishing)
        val content = activity.findViewById<android.view.ViewGroup>(android.R.id.content)
        assertEquals("Unlock Trackium Core to continue", (content.getChildAt(0) as TextView).text)
        controller.pause().stop().destroy()
    }
}
