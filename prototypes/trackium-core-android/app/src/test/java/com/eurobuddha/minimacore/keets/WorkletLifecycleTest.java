package com.eurobuddha.minimacore.keets;

import java.util.ArrayDeque;
import java.util.Queue;
import org.junit.Test;
import static org.junit.Assert.*;

public class WorkletLifecycleTest {
    static class Owner implements WorkletLifecycle.Owner {
        int starts, closes;
        boolean released = true, startOK = true;
        @Override public boolean startWorklet() { starts++; return startOK; }
        @Override public boolean closeWorklet() { closes++; return released; }
    }
    final Queue<Runnable> retries = new ArrayDeque<>();
    final WorkletLifecycle lifecycle = new WorkletLifecycle(retries::add);
    void retry() { assertFalse(retries.isEmpty()); retries.remove().run(); }

    @Test public void slowPolicyRestartRecoversWithoutAnotherPolicyEvent() {
        Owner a = new Owner(); lifecycle.start(a);
        a.released = false; lifecycle.restart(a);
        assertEquals(1, a.starts);
        retry(); assertEquals(1, a.starts);
        a.released = true; retry();
        assertEquals(2, a.starts); assertTrue(retries.isEmpty());
    }
    @Test public void replacementWaitsForOldStorageAndLateOldStopCannotStopNewOwner() {
        Owner a = new Owner(), b = new Owner(); lifecycle.start(a);
        a.released = false; lifecycle.start(b);
        assertEquals(0, b.starts);
        a.released = true; retry();
        assertEquals(1, b.starts);
        lifecycle.stop(a); assertEquals(0, b.closes); assertEquals(1, a.starts);
    }
    @Test public void stopDuringSlowRestartNeverResurrectsService() {
        Owner a = new Owner(); lifecycle.start(a);
        a.released = false; lifecycle.restart(a); lifecycle.stop(a);
        a.released = true;
        while (!retries.isEmpty()) retry();
        assertEquals(1, a.starts);
    }
    @Test public void newestReplacementWinsAndCancelledWaitingServiceNeverStarts() {
        Owner a = new Owner(), b = new Owner(), c = new Owner(); lifecycle.start(a);
        a.released = false; lifecycle.start(b); lifecycle.stop(b); lifecycle.start(c);
        a.released = true;
        while (!retries.isEmpty()) retry();
        assertEquals(0, b.starts); assertEquals(1, c.starts); assertEquals(1, a.starts);
    }
    @Test public void failedStartStillOwnsStorageUntilCloseConfirmed() {
        Owner a = new Owner(), b = new Owner(); a.startOK = false; a.released = false;
        lifecycle.start(a); lifecycle.start(b); retry();
        assertEquals(0, b.starts);
        a.released = true;
        while (!retries.isEmpty()) retry();
        assertEquals(1, b.starts);
    }
    @Test public void duplicateStartDoesNotCreateAnotherWorklet() {
        Owner a = new Owner(); lifecycle.start(a); lifecycle.start(a);
        assertEquals(1, a.starts); assertEquals(0, a.closes);
    }
}
