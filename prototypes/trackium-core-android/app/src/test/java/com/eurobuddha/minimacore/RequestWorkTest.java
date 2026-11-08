package com.eurobuddha.minimacore;

import org.junit.Test;
import com.eurobuddha.minimacore.utils.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import static org.junit.Assert.*;

public class RequestWorkTest {
    static class Queue implements Executor {
        final ArrayDeque<Runnable> tasks = new ArrayDeque<>();
        public void execute(Runnable task) { tasks.add(task); }
        void next() { tasks.remove().run(); }
    }

    @Test public void refreshBurstDiscardsObsoleteResultAndRunsOneFollowUp() {
        Queue worker = new Queue(), ui = new Queue();
        AtomicInteger reads = new AtomicInteger();
        List<Integer> rendered = new ArrayList<>();
        CoalescingRefresh<Integer> refresh = new CoalescingRefresh<>(worker, ui,
                reads::incrementAndGet, rendered::add, e -> fail(e.toString()));
        refresh.request();
        for (int i=0; i<100; i++) refresh.request();
        assertEquals(1, worker.tasks.size());
        worker.next(); ui.next();
        assertTrue(rendered.isEmpty());
        assertEquals(1, worker.tasks.size());
        worker.next(); ui.next();
        assertEquals(Arrays.asList(2), rendered);
        assertEquals(2, reads.get());
    }

    @Test public void closedRefreshIgnoresLateReplyAndPendingWork() {
        Queue worker = new Queue(), ui = new Queue();
        CoalescingRefresh<Integer> refresh = new CoalescingRefresh<>(worker, ui, () -> 1,
                n -> fail("late render"), e -> fail("late failure"));
        refresh.request(); refresh.request(); refresh.close();
        worker.next(); ui.next(); refresh.request();
        assertTrue(worker.tasks.isEmpty());
    }

    @Test public void disconnectedSnapshotIsDiscardedAndReconnectCanRefresh() {
        Queue worker = new Queue(), ui = new Queue();
        AtomicInteger reads = new AtomicInteger(); List<Integer> rendered = new ArrayList<>();
        CoalescingRefresh<Integer> refresh = new CoalescingRefresh<>(worker, ui,
                reads::incrementAndGet, rendered::add, e -> fail());
        refresh.request(); refresh.invalidate();
        worker.next(); ui.next();
        assertTrue(rendered.isEmpty());
        refresh.request(); worker.next(); ui.next();
        assertEquals(Arrays.asList(2), rendered);
    }

    @Test public void hideDropsQueuedFollowUpAndLateDelivery() {
        Queue worker = new Queue(), ui = new Queue();
        List<Integer> rendered = new ArrayList<>();
        CoalescingRefresh<Integer> refresh = new CoalescingRefresh<>(worker, ui,
                () -> 1, rendered::add, e -> fail());
        refresh.request(); refresh.request();
        worker.next(); // Reply is already queued when the screen is hidden.
        refresh.invalidate(); ui.next();
        assertTrue(rendered.isEmpty());
        assertTrue(worker.tasks.isEmpty());
    }

    @Test public void rapidHideShowReconcilesOnceAfterOldReadCompletes() {
        Queue worker = new Queue(), ui = new Queue();
        AtomicInteger reads = new AtomicInteger(); List<Integer> rendered = new ArrayList<>();
        CoalescingRefresh<Integer> refresh = new CoalescingRefresh<>(worker, ui,
                reads::incrementAndGet, rendered::add, e -> fail());
        refresh.request();
        for (int i = 0; i < 20; i++) { refresh.invalidate(); refresh.request(); }
        worker.next(); ui.next();
        assertTrue(rendered.isEmpty());
        assertEquals(1, worker.tasks.size());
        worker.next(); ui.next();
        assertEquals(Arrays.asList(2), rendered);
        assertTrue(worker.tasks.isEmpty());
    }

    @Test public void refreshCanRecoverFromReadFailureAndOverload() {
        AtomicInteger failures = new AtomicInteger();
        CoalescingRefresh<Integer> refresh = new CoalescingRefresh<>(Runnable::run, Runnable::run,
                () -> { throw new IllegalStateException("test"); }, n -> fail(), e -> failures.incrementAndGet());
        refresh.request(); refresh.request();
        assertEquals(2, failures.get());
        CoalescingRefresh<Integer> rejected = new CoalescingRefresh<>(task -> { throw new RejectedExecutionException(); },
                Runnable::run, () -> 1, n -> fail(), e -> failures.incrementAndGet());
        rejected.request(); rejected.request();
        assertEquals(4, failures.get());
    }

    @Test public void sharedFetchServesAllSubscribersOnce() {
        Queue worker = new Queue(), ui = new Queue();
        SharedRequests<String,Integer> requests = new SharedRequests<>(worker, ui);
        List<Integer> a = new ArrayList<>(), b = new ArrayList<>();
        Consumer<Integer> ca = a::add, cb = b::add;
        AtomicInteger fetches = new AtomicInteger();
        requests.request("icon", fetches::incrementAndGet, ca);
        for (int i=0; i<100; i++) requests.request("icon", fetches::incrementAndGet, ca);
        worker.next();
        requests.request("icon", fetches::incrementAndGet, cb); // worker done, UI still pending
        ui.next();
        assertEquals(Arrays.asList(1), a); assertEquals(Arrays.asList(1), b);
        assertEquals(1, fetches.get()); assertTrue(worker.tasks.isEmpty());
    }

    @Test public void rejectedAndFailedSharedRequestsCanRetry() {
        AtomicInteger attempts = new AtomicInteger();
        Executor worker = task -> { if (attempts.getAndIncrement() == 0) throw new RejectedExecutionException(); task.run(); };
        SharedRequests<String,Integer> requests = new SharedRequests<>(worker, Runnable::run);
        List<Integer> results = new ArrayList<>(); Consumer<Integer> callback = results::add;
        assertFalse(requests.request("url", () -> 1, callback));
        assertTrue(requests.request("url", () -> { throw new IllegalStateException(); }, callback));
        assertTrue(requests.request("url", () -> 2, callback));
        assertEquals(Arrays.asList(null, 2), results);
    }

    @Test public void expiryAllowsRetryAndBoundsEntries() {
        long[] now = {100};
        ExpiringCache<String,Boolean> cache = new ExpiringCache<>(2, () -> now[0]);
        cache.put("offline", false, 30);
        assertEquals(Boolean.FALSE, cache.get("offline"));
        now[0] = 130; assertNull(cache.get("offline"));
        cache.put("offline", true, 300);
        assertEquals(Boolean.TRUE, cache.get("offline"));
        cache.put("second", true, 300); cache.put("third", true, 300);
        assertNull(cache.get("offline"));
        now[0] = 430; assertNull(cache.get("third"));
    }

    @Test public void backgroundPoolCapsThreadsAndQueueWithoutRunningOnCaller() throws Exception {
        ThreadPoolExecutor pool = BackgroundWork.pool(1, 1);
        CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        try {
            pool.execute(() -> { entered.countDown(); try { release.await(); } catch (InterruptedException ignored) { } });
            assertTrue(entered.await(2, TimeUnit.SECONDS));
            pool.execute(() -> { });
            try { pool.execute(() -> fail("caller ran queued task")); fail("overload accepted"); }
            catch (RejectedExecutionException expected) { }
            assertEquals(1, pool.getPoolSize()); assertEquals(1, pool.getQueue().size());
        } finally { release.countDown(); pool.shutdownNow(); }
    }
    @Test public void periodicTicksCannotStarveASlowBalanceRead() {
        Queue worker=new Queue(),ui=new Queue();List<Integer> rendered=new ArrayList<>();
        CoalescingRefresh<Integer> refresh=new CoalescingRefresh<>(worker,ui,()->7,rendered::add,e->fail());
        refresh.requestIfIdle();
        for(int i=0;i<100;i++)refresh.requestIfIdle();
        worker.next();ui.next();
        assertEquals(Arrays.asList(7),rendered);assertTrue(worker.tasks.isEmpty());
        refresh.requestIfIdle();assertEquals(1,worker.tasks.size());
    }

}
