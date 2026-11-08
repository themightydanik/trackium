package com.eurobuddha.minimaapi.direct;

import org.json.JSONObject;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicLong;

/** Private typed notifications with bounded, coalesced delivery and explicit owner lifetime. */
public final class DirectNodeEvents {
    public interface Listener { void onEvent(JSONObject event); }
    private static final ConcurrentHashMap<Listener,Subscription> listeners = new ConcurrentHashMap<>();
    private static volatile Executor delivery = Runnable::run;
    private static final AtomicLong dropped = new AtomicLong();
    private DirectNodeEvents() {}
    public static void install(Executor executor) { delivery = executor; }
    public static void subscribe(Listener listener, String... events) { subscribe(listener, delivery, events); }
    public static void subscribe(Listener listener, Executor executor, String... events) {
        listeners.computeIfAbsent(listener, key -> new Subscription(listener, executor, events));
    }
    public static void unsubscribe(Listener listener) {
        Subscription old = listeners.remove(listener);
        if (old != null) synchronized (old) { old.pending.clear(); }
    }
    /** Diagnostic count: old queued events dropped during overload (never command results). */
    public static long droppedEvents() { return dropped.get(); }
    public static void publish(JSONObject event) {
        JSONObject snapshot = (JSONObject) LocalJson.copy(event);
        for (Subscription subscriber : listeners.values()) subscriber.offer(snapshot);
    }
    private static final class Subscription {
        final Listener listener;
        final Executor executor;
        final Set<String> events;
        final ArrayDeque<JSONObject> pending = new ArrayDeque<>();
        boolean scheduled;
        Subscription(Listener listener, Executor executor, String[] events) {
            this.listener = listener; this.executor = executor; this.events = new HashSet<>(Arrays.asList(events));
        }
        void offer(JSONObject event) {
            String type = event.optString("event");
            if (!events.isEmpty() && !events.contains(type)) return;
            synchronized (this) {
                if (listeners.get(listener) != this) return;
                // These events request a fresh read; only the newest queued snapshot is useful.
                if ("NEWBLOCK".equals(type) || "NEWBALANCE".equals(type))
                    pending.removeIf(old -> type.equals(old.optString("event")));
                if (pending.size() == 256) { pending.removeFirst(); dropped.incrementAndGet(); }
                pending.addLast(event);
                if (scheduled) return;
                scheduled = true;
            }
            try { executor.execute(this::drain); }
            catch (RuntimeException rejected) {
                synchronized (this) { dropped.addAndGet(pending.size()); pending.clear(); scheduled = false; }
            }
        }
        void drain() {
            while (true) {
                JSONObject event;
                synchronized (this) {
                    if (listeners.get(listener) != this) { pending.clear(); scheduled = false; return; }
                    event = pending.pollFirst();
                    if (event == null) { scheduled = false; return; }
                }
                try { listener.onEvent((JSONObject) LocalJson.copy(event)); }
                catch (RuntimeException ignored) { /* Isolate subscribers without losing other deliveries. */ }
            }
        }
    }
}
