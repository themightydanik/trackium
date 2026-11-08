package com.eurobuddha.minimacore.service;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.Before;

/**
 * The debounce that stopped the hourly tick sampling twice.
 *
 * The Alarm both starts the service and asks for a check, and starting a running service
 * delivers onStartCommand, which asks again - two identical samples milliseconds apart,
 * which is exactly what the field log showed on the first release.
 */
public class NodeHealthMonitorTest {

    /** Static state is shared across tests in one JVM - start each from a clean slate. */
    @Before public void resetDebounce() throws Exception {
        Field f = NodeHealthMonitor.class.getDeclaredField("LAST_CHECK");
        f.setAccessible(true);
        ((AtomicLong) f.get(null)).set(0);
    }

    private static boolean claim(long now) throws Exception {
        Method m = NodeHealthMonitor.class.getDeclaredMethod("claimCheck", long.class);
        m.setAccessible(true);
        return (Boolean) m.invoke(null, now);
    }

    @Test public void twoCallersAtTheSameTickRunOnlyOneCheck() throws Exception {
        long t = 5_000_000L;
        assertTrue("first caller should win", claim(t));
        assertFalse("the duplicate 7ms later must be dropped", claim(t + 7));
        assertFalse(claim(t + NodeHealthMonitor.MIN_CHECK_INTERVAL_MILLIS - 1));
    }

    /** A clock correction must not silently suppress every check until it catches up. */
    @Test public void aClockJumpBackwardsStillRunsAcheck() throws Exception {
        long t = 5_000_000L;
        assertTrue(claim(t));
        assertTrue("time moved backwards - re-baseline and run",
                claim(t - (60L * 60 * 1000)));
    }

    @Test public void theNextRealTickStillRuns() throws Exception {
        long t = 9_000_000L;
        assertTrue(claim(t));
        assertTrue("the next scheduled check must not be debounced away",
                claim(t + NodeHealthMonitor.MIN_CHECK_INTERVAL_MILLIS));
    }

    /**
     * The interval IS the schedule now: the node asks on every block (~50s) because
     * AlarmManager proved unreliable under OEM battery management. Almost every one of those
     * calls must be turned away, or a `status complete:true` would run every block.
     */
    /** A failed status read must not cost a whole interval - a starting node needs a retry. */
    @Test public void aFailedReadIsRetriedLongBeforeTheNextScheduledCheck() throws Exception {
        long t = 3_000_000L;
        assertTrue(claim(t));
        retrySooner(t);
        assertFalse("not instantly - the node may still be starting", claim(t + 1_000));
        assertTrue("but well inside the normal interval",
                claim(t + NodeHealthMonitor.RETRY_AFTER_FAILURE_MILLIS));
    }

    private static void retrySooner(long now) throws Exception {
        Method m = NodeHealthMonitor.class.getDeclaredMethod("retrySooner", long.class);
        m.setAccessible(true);
        m.invoke(null, now);
    }

    @Test public void aBlockEverySoOftenStillOnlyYieldsScheduledChecks() throws Exception {
        long blockInterval = 50_000L;
        long t = 1_000_000L;
        int ran = 0;
        for (long elapsed = 0; elapsed <= 60L * 60 * 1000; elapsed += blockInterval) {
            if (claim(t + elapsed)) ran++;
        }
        // One hour of blocks at the 15-minute schedule: the first, then one per interval.
        assertTrue("ran " + ran + " checks in an hour of blocks", ran >= 4 && ran <= 5);
    }
}
