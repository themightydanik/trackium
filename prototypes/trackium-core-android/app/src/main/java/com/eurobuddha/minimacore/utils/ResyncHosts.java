package com.eurobuddha.minimacore.utils;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Which MegaMMR nodes to resync from, and in what order.
 *
 * A resync needs a host running -megammr. Picking one fixed host means one outage blocks
 * every recovery, so the pool is shuffled per attempt and the caller falls through on a
 * pre-flight failure. The user's own host, if they have set one, always wins - they may be
 * running their own node, and we should not override that with ours.
 */
public final class ResyncHosts {

    /** Public MegaMMR nodes, tried in random order so no single host carries everything. */
    static final String[] POOL = {
            "eurobuddha.com:9001",
            "spartacusrex.com:9001",
            "megammr.minima.global:9001"
    };

    private ResyncHosts() {}

    /**
     * Hosts to try, best first. The user's configured host leads when they have set one;
     * the rest of the pool follows in random order as fallbacks.
     */
    public static List<String> candidates(Context context) {
        return candidates(userHost(context), new java.util.Random());
    }

    /** Seam for tests: deterministic ordering with a seeded Random. */
    static List<String> candidates(String userHost, java.util.Random random) {
        List<String> pool = new ArrayList<>();
        Collections.addAll(pool, POOL);
        Collections.shuffle(pool, random);

        List<String> ordered = new ArrayList<>();
        if (userHost != null && com.eurobuddha.minimacore.main.ResyncSession.validHost(userHost)) {
            ordered.add(userHost);
        }
        for (String host : pool) {
            if (!ordered.contains(host)) ordered.add(host);
        }
        return ordered;
    }

    /**
     * The host the user actually chose, or null.
     *
     * Read straight from prefs with a null default rather than via Peers.getDefaultPeers(),
     * which substitutes its own built-in host - that would make "never configured" look
     * identical to "deliberately chose spartacusrex" and pin every device to one host.
     */
    static String userHost(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
        String host = prefs.getString("default_peers", null);
        if (host == null) return null;
        host = host.trim();
        return host.isEmpty() ? null : host;
    }

    /**
     * Did the resync fail BEFORE it changed anything, so another host can be tried?
     *
     * megammrsync pre-flights the host with archive.sendArchiveReq and throws before it
     * touches the databases. Only those failures are safe to retry automatically.
     *
     * "Error getting MegaMMR data from host" is deliberately NOT in this set: it is thrown
     * after Main.archiveResetReady() has already deleted txpow.mv.db and archive.mv.db, so
     * the node state has changed. Recovery from there is a real decision for the user, not
     * something to loop on.
     */
    public static boolean canTryAnotherHost(String error) {
        if (error == null) return false;
        String e = error.toLowerCase(java.util.Locale.ROOT);
        return e.contains("could not connect to archive host")
                || e.contains("invalid host format");
    }

}
