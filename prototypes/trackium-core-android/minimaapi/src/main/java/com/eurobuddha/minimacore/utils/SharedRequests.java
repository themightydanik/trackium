package com.eurobuddha.minimacore.utils;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.function.Consumer;
import java.util.function.Supplier;

/** WebValidate's single-flight pattern extended to notify multiple weak subscribers.
 * Callers retain their callback while interested; queued work never owns a screen. */
public final class SharedRequests<K,V> {
    private final Map<K,List<WeakReference<Consumer<V>>>> pending = new HashMap<>();
    private final Executor worker, delivery;
    public SharedRequests(Executor worker, Executor delivery) { this.worker = worker; this.delivery = delivery; }

    public synchronized boolean request(K key, Supplier<V> fetch, Consumer<V> callback) {
        List<WeakReference<Consumer<V>>> listeners = pending.get(key);
        if (listeners != null) {
            listeners.removeIf(ref -> ref.get() == null);
            for (WeakReference<Consumer<V>> ref : listeners) if (ref.get() == callback) return true;
            listeners.add(new WeakReference<>(callback));
            return true;
        }
        listeners = new ArrayList<>();
        listeners.add(new WeakReference<>(callback));
        pending.put(key, listeners);
        try {
            worker.execute(() -> {
                V value = null;
                try { value = fetch.get(); } catch (Exception ignored) { }
                final V result = value;
                // Keep the key in-flight until delivery, so cache-fill callbacks cannot race a new fetch.
                delivery.execute(() -> finish(key, result));
            });
            return true;
        } catch (RejectedExecutionException e) {
            pending.remove(key);
            return false;
        }
    }

    private void finish(K key, V value) {
        List<WeakReference<Consumer<V>>> listeners;
        synchronized (this) { listeners = pending.remove(key); }
        if (listeners == null) return;
        for (WeakReference<Consumer<V>> ref : listeners) {
            Consumer<V> callback = ref.get();
            if (callback != null) {
                try { callback.accept(value); } catch (RuntimeException ignored) { }
            }
        }
    }
}
