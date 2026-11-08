package com.eurobuddha.minimacore;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.lifecycle.Lifecycle;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import com.eurobuddha.minimacore.testing.StartupHarnessActivity;
import static org.junit.Assert.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.matcher.ViewMatchers.withText;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.matcher.RootMatchers.isDialog;

@RunWith(AndroidJUnit4.class)
public class StartupLifecycleTest {
    @Before public void reset() { StartupHarnessActivity.reset(); }
    private void settle() { android.os.SystemClock.sleep(650); InstrumentationRegistry.getInstrumentation().waitForIdleSync(); }

    @Test public void leavingBeforeConnectionUnbindsAndStopsPolling() {
        ActivityScenario<StartupHarnessActivity> screen = ActivityScenario.launch(StartupHarnessActivity.class);
        settle();
        screen.close();
        int checks = StartupHarnessActivity.checks;
        settle();
        assertEquals(1, StartupHarnessActivity.binds);
        assertEquals(1, StartupHarnessActivity.unbinds);
        assertEquals(checks, StartupHarnessActivity.checks);
        assertEquals(0, StartupHarnessActivity.navigations);
    }

    @Test public void rotationAndBackgroundDoNotAccumulatePollers() {
        try (ActivityScenario<StartupHarnessActivity> screen = ActivityScenario.launch(StartupHarnessActivity.class)) {
            settle(); screen.recreate(); settle();
            assertEquals(2, StartupHarnessActivity.binds); assertEquals(1, StartupHarnessActivity.unbinds);
            screen.moveToState(Lifecycle.State.CREATED);
            int checks = StartupHarnessActivity.checks;
            settle(); assertEquals(checks, StartupHarnessActivity.checks);
            screen.moveToState(Lifecycle.State.RESUMED);
            settle(); assertTrue(StartupHarnessActivity.checks > checks);
        }
        assertEquals(2, StartupHarnessActivity.unbinds);
    }

    @Test public void slowStartupOffersWaitWithoutRestartingService() {
        StartupHarnessActivity.waitMs = 0;
        try (ActivityScenario<StartupHarnessActivity> screen = ActivityScenario.launch(StartupHarnessActivity.class)) {
            onView(withText("Startup is taking longer")).inRoot(isDialog()).check(matches(isDisplayed()));
            StartupHarnessActivity.waitMs = 120_000;
            onView(withText("Keep waiting")).inRoot(isDialog()).perform(click());
            settle();
            assertEquals(1, StartupHarnessActivity.starts);
            assertEquals(1, StartupHarnessActivity.binds);
            assertEquals(0, StartupHarnessActivity.navigations);
        }
    }

    @Test public void reportedStartupFailureDoesNotNavigateWithoutUserAction() {
        StartupHarnessActivity.failed = true;
        try (ActivityScenario<StartupHarnessActivity> screen = ActivityScenario.launch(StartupHarnessActivity.class)) {
            onView(withText("Startup error")).inRoot(isDialog()).check(matches(isDisplayed()));
            assertEquals(0, StartupHarnessActivity.navigations);
            onView(withText("Open Minima")).inRoot(isDialog()).perform(click());
            assertEquals(1, StartupHarnessActivity.navigations);
        }
    }
}
