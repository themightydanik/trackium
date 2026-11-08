package com.eurobuddha.minimacore;

import android.content.Context;
import android.view.View;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import com.eurobuddha.minimacore.main.ResyncSession;
import com.eurobuddha.minimacore.main.SeedSyncActivity;
import static org.junit.Assert.*;

/** No node or network operation: verifies recovery UI after a lost command result. */
@RunWith(AndroidJUnit4.class)
public class ResyncScreenTest {
    @Test public void interruptedResyncRemainsHonestAfterActivityRecreation() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ResyncSession.get().reset();
        context.getSharedPreferences("main_prefs", Context.MODE_PRIVATE).edit()
                .putBoolean(SeedSyncActivity.PREF_PENDING, true).commit();
        try (ActivityScenario<SeedSyncActivity> screen = ActivityScenario.launch(SeedSyncActivity.class)) {
            screen.onActivity(this::assertInterrupted);
            screen.recreate();
            screen.onActivity(this::assertInterrupted);
        } finally {
            ResyncSession.get().reset();
            context.getSharedPreferences("main_prefs", Context.MODE_PRIVATE).edit()
                    .remove(SeedSyncActivity.PREF_PENDING).commit();
        }
    }

    private void assertInterrupted(SeedSyncActivity activity) {
        TextView status = activity.findViewById(R.id.seed_sync_status);
        assertTrue(status.getText().toString().contains("Completion is unknown"));
        assertTrue(((TextView) activity.findViewById(R.id.seed_sync_log)).getText().toString().contains("Completion is unknown"));
        assertEquals(View.GONE, activity.findViewById(R.id.seed_sync_progress).getVisibility());
        assertEquals(View.VISIBLE, activity.findViewById(R.id.seed_sync_restart).getVisibility());
        assertTrue(activity.findViewById(R.id.seed_sync_restart).isEnabled());
        assertEquals(ResyncSession.State.FAILED, ResyncSession.get().state());
    }
}
