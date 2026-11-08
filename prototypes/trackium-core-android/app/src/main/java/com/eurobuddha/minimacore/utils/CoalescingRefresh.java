package com.eurobuddha.minimacore.utils;

import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.function.Consumer;
import java.util.function.Supplier;

/** One read at a time, with one follow-up for any burst arriving during that read.
 * Request/close/completion run on the supplied delivery executor (the UI thread). */
public final class CoalescingRefresh<T> {
    private final Executor worker, delivery;
    private final Supplier<T> read;
    private Consumer<T> render;
    private Consumer<Exception> failure;
    private boolean running, pending, closed, invalidated;

    public CoalescingRefresh(Executor worker, Executor delivery, Supplier<T> read,
                             Consumer<T> render, Consumer<Exception> failure) {
        this.worker = worker; this.delivery = delivery; this.read = read;
        this.render = render; this.failure = failure;
    }

    /** Periodic reads must not obsolete a slow in-flight snapshot on every tick. */
    public void requestIfIdle() { if (!running) request(); }

    public void request() {
        if (closed) return;
        if (running) { pending = true; return; }
        invalidated = false;
        running = true;
        try {
            worker.execute(() -> {
                T result = null;
                Exception error = null;
                try { result = read.get(); } catch (Exception e) { error = e; }
                final T value = result;
                final Exception problem = error;
                delivery.execute(() -> complete(value, problem));
            });
        } catch (RejectedExecutionException e) {
            running = false;
            failure.accept(e);
        }
    }

    private void complete(T value, Exception error) {
        running = false;
        if (closed) return;
        // A refresh requested while reading makes this snapshot obsolete.
        if (pending) { pending = false; request(); return; }
        if (invalidated) return;
        if (error == null) render.accept(value); else failure.accept(error);
    }

    /** Drop a snapshot from a node connection that has since gone away. */
    public void invalidate() { invalidated = true; pending = false; }

    public void close() { closed = true; pending = false; render = null; failure = null; }
}
