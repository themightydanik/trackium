package com.eurobuddha.minimacore.keets;

import java.util.function.Consumer;

/** One process-wide owner; every call and retry runs on the same lifecycle executor. */
final class WorkletLifecycle {
    interface Owner {
        boolean startWorklet();
        boolean closeWorklet();
    }

    private final Consumer<Runnable> later;
    private Owner active;
    private Owner wanted;
    private boolean restarting;
    private long revision;

    WorkletLifecycle(Consumer<Runnable> later) { this.later = later; }

    void start(Owner owner) {
        wanted = owner;
        revision++;
        reconcile();
    }

    void stop(Owner owner) {
        // A late onDestroy from the old service must not stop its replacement.
        if (wanted == owner) wanted = null;
        revision++;
        reconcile();
    }

    void restart(Owner owner) {
        if (wanted != owner) return;
        restarting = true;
        revision++;
        reconcile();
    }

    private void reconcile() {
        if (active != null && (active != wanted || restarting)) {
            if (!active.closeWorklet()) { retry(); return; }
            active = null;
            restarting = false;
        }
        if (active == null && wanted != null) {
            // Record ownership before starting: even a partially started native worker
            // must release its stores before another worker can be launched.
            active = wanted;
            if (!active.startWorklet()) {
                wanted = null;
                retry();
            }
        }
    }

    private void retry() {
        long attempt = revision;
        later.accept(() -> {
            // New start/stop intent invalidates old retries; they cannot resurrect a service.
            if (attempt == revision) reconcile();
        });
    }
}
