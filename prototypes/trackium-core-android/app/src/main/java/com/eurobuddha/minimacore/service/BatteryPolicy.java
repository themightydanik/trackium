package com.eurobuddha.minimacore.service;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.concurrent.CopyOnWriteArrayList;

/**
 * The one battery policy every background loop reads (all flavors).
 *
 * <p>The user picks a profile in the three-dot menu: Instant keeps today's always-on cadence,
 * Balanced (default) stays instant while the app is in use and backs off when the screen is off,
 * Saver backs off further. "Full speed while charging" lifts Balanced and Saver to Instant on power.
 *
 * <p>No profile ever pauses block validation, own transactions or the key-use counter: callers
 * only use this to pace optional work (chat polling, the keets sidecar, idle app watchers).
 */
public final class BatteryPolicy {

    public enum Profile { INSTANT, BALANCED, SAVER }

    public interface Listener { void onBatteryPolicyChanged(); }

    /** The keets DHT's routing duty. There is deliberately no "off": phones support the network. */
    public enum DhtRelay { ALWAYS, WIFI_OR_PLUGGED, PLUGGED }

    static final String PREFS = "main_prefs";
    static final String KEY_PROFILE = "battery_profile";
    static final String KEY_FULL_ON_CHARGER = "battery_full_on_charger";
    static final String KEY_DHT_RELAY = "battery_dht_relay";

    private static volatile Profile sProfile = Profile.BALANCED;
    private static volatile boolean sFullOnCharger = true;
    private static volatile DhtRelay sDhtRelay = DhtRelay.ALWAYS;
    private static volatile boolean sKeets = true;
    private static volatile boolean sScreenOn = true;
    private static volatile boolean sPlugged = false;
    private static volatile boolean sWifi = true;
    private static volatile boolean sAppVisible = false;
    private static volatile long sScreenOffSince = 0;
    private static final CopyOnWriteArrayList<Listener> LISTENERS = new CopyOnWriteArrayList<>();

    private BatteryPolicy() {
    }

    /** Load the saved choice. Safe to call more than once. */
    public static void load(Context zCtx) {
        SharedPreferences p = zCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sProfile = parse(p.getString(KEY_PROFILE, Profile.BALANCED.name()));
        sFullOnCharger = p.getBoolean(KEY_FULL_ON_CHARGER, true);
        try { sDhtRelay = DhtRelay.valueOf(p.getString(KEY_DHT_RELAY, DhtRelay.ALWAYS.name())); }
        catch (Exception e) { sDhtRelay = DhtRelay.ALWAYS; }
        sKeets = com.eurobuddha.minimacore.main.StartupMode.keetsEnabled(p);
    }

    /** The Keets transport switch (Startup Params). Off: there is no DHT, so nothing relays. */
    public static boolean keets() { return sKeets; }

    public static void setDhtRelay(Context zCtx, DhtRelay zRelay) {
        sDhtRelay = zRelay;
        zCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_DHT_RELAY, zRelay.name()).apply();
        fire();
    }

    public static DhtRelay dhtRelay() { return sDhtRelay; }

    /** The sidecar's --dht-mode right now: "routing" unless the chosen relay condition is not met. */
    public static String dhtMode() { return dhtMode(sKeets, sDhtRelay, sPlugged, sWifi); }

    static String dhtMode(boolean zKeets, DhtRelay zRelay, boolean zPlugged, boolean zWifi) {
        return zKeets ? dhtMode(zRelay, zPlugged, zWifi) : "client";
    }

    /** zWifi = the default network is Wi-Fi or Ethernet (not mobile data, where DHT traffic keeps the
     *  cellular radio at full power: 186 mAh in 2 h on the Fold, 2026-10-26). */
    static String dhtMode(DhtRelay zRelay, boolean zPlugged, boolean zWifi) {
        switch (zRelay) {
            case PLUGGED: return zPlugged ? "routing" : "client";
            case WIFI_OR_PLUGGED: return zPlugged || zWifi ? "routing" : "client";
            default: return "routing";
        }
    }

    /** Whether the node's CPU wakelock should be held right now. Released only when nothing needs the
     *  CPU: Balanced/Saver in force, screen off, and the DHT not relaying (relay "when plugged in" on
     *  battery) - a relaying DHT node must stay awake, and no profile may stop it. Mining an own
     *  transaction holds its own lock (NodeWake). */
    public static boolean nodeAwake() { return nodeAwake(effective(), sScreenOn, dhtMode()); }

    static boolean nodeAwake(Profile zEffective, boolean zScreenOn, String zDhtMode) {
        return zEffective == Profile.INSTANT || zScreenOn || "routing".equals(zDhtMode);
    }

    /** While the wakelock is released, how often the node is woken for a catch-up window. */
    public static long nodeWindowEveryMs() { return sProfile == Profile.SAVER ? 20 * 60_000L : 10 * 60_000L; }

    static Profile parse(String zName) {
        try {
            return Profile.valueOf(zName);
        } catch (Exception e) {
            return Profile.BALANCED;
        }
    }

    public static void setProfile(Context zCtx, Profile zProfile) {
        sProfile = zProfile;
        zCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_PROFILE, zProfile.name()).apply();
        fire();
    }

    public static void setFullOnCharger(Context zCtx, boolean zOn) {
        sFullOnCharger = zOn;
        zCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_FULL_ON_CHARGER, zOn).apply();
        fire();
    }

    public static Profile profile() { return sProfile; }
    public static boolean fullOnCharger() { return sFullOnCharger; }
    public static boolean screenOn() { return sScreenOn; }
    public static boolean plugged() { return sPlugged; }
    public static boolean appVisible() { return sAppVisible; }

    /** The profile in force right now: Instant whenever "full speed while charging" applies. */
    public static Profile effective() {
        return effective(sProfile, sFullOnCharger, sPlugged);
    }

    static Profile effective(Profile zChosen, boolean zFullOnCharger, boolean zPlugged) {
        return zFullOnCharger && zPlugged ? Profile.INSTANT : zChosen;
    }

    /** Milliseconds the screen has been off, 0 while it is on. */
    public static long screenOffMillis() {
        return sScreenOn ? 0 : Math.max(0, System.currentTimeMillis() - sScreenOffSince);
    }

    public static void setScreenOn(boolean zOn) {
        if (zOn == sScreenOn) return;
        sScreenOn = zOn;
        if (!zOn) sScreenOffSince = System.currentTimeMillis();
        fire();
    }

    public static void setPlugged(boolean zPlugged) {
        if (zPlugged == sPlugged) return;
        sPlugged = zPlugged;
        fire();
    }

    public static void setWifi(boolean zWifi) {
        if (zWifi == sWifi) return;
        sWifi = zWifi;
        fire();
    }

    public static void setAppVisible(boolean zVisible) {
        if (zVisible == sAppVisible) return;
        sAppVisible = zVisible;
        fire();
    }

    public static void addListener(Listener zListener) { LISTENERS.addIfAbsent(zListener); }
    public static void removeListener(Listener zListener) { LISTENERS.remove(zListener); }

    private static void fire() {
        for (Listener l : LISTENERS) {
            try {
                l.onBatteryPolicyChanged();
            } catch (RuntimeException ignored) {
                // one listener must never stop the others
            }
        }
    }
}
