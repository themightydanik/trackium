package com.eurobuddha.minimacore.utils;

import java.util.LinkedHashMap;
import java.util.function.LongSupplier;

/** Small bounded cache, using an injected monotonic clock for retry/expiry decisions. */
public final class ExpiringCache<K,V> {
    private static final class Entry<V> {
        final V value; final long expires;
        Entry(V value, long expires) { this.value = value; this.expires = expires; }
    }
    private final LinkedHashMap<K,Entry<V>> entries = new LinkedHashMap<>(16, .75f, true);
    private final int limit;
    private final LongSupplier clock;
    public ExpiringCache(int limit, LongSupplier clock) { this.limit = limit; this.clock = clock; }
    public synchronized V get(K key) {
        Entry<V> entry = entries.get(key);
        if (entry == null) return null;
        if (clock.getAsLong() >= entry.expires) { entries.remove(key); return null; }
        return entry.value;
    }
    public synchronized void put(K key, V value, long ttlMs) {
        entries.put(key, new Entry<>(value, clock.getAsLong() + ttlMs));
        while (entries.size() > limit) entries.remove(entries.keySet().iterator().next());
    }
}
