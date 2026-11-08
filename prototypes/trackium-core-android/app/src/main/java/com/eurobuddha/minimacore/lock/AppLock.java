package com.eurobuddha.minimacore.lock;

import android.content.Context;
import android.content.SharedPreferences;

import org.minima.objects.base.MiniData;
import org.minima.utils.BaseConverter;

import java.nio.charset.StandardCharsets;

/**
 * App-open lock: an opt-in PIN (optionally fingerprint/face) gate shown before the main UI.
 *
 * <p>This is a UI-OPEN gate, not seed-at-rest encryption. The Minima node runs in its own foreground
 * service, so it keeps syncing/mining behind the lock — locking the UI never stops the node. The BIP39
 * seed stays where it has always lived ({@code main_prefs}, with {@code allowBackup=false}).
 *
 * <p>The PIN is never stored. At set-time a fixed sentinel is encrypted under the PIN with
 * {@link VaultCrypto} (PBKDF2→AES-256-GCM); a later typed PIN is correct iff that container
 * authenticates. Session state (unlocked / auto-lock timer) is process-scoped and starts LOCKED.
 */
public final class AppLock {

    private static final String PREFS        = "app_lock";
    private static final String K_PIN        = "pin_blob";          // VaultCrypto container, 0x-hex
    private static final String K_ENABLED    = "enabled";
    private static final String K_AUTOLOCK   = "autolock_minutes";

    /** Plaintext the PIN encrypts — only its authenticated decryption matters, not its value. */
    private static final byte[] SENTINEL = "minima-core-applock".getBytes(StandardCharsets.UTF_8);

    public static final int DEFAULT_AUTOLOCK_MIN = 1;
    public static final int MIN_PIN_LEN = 4;
    public static final int MAX_PIN_LEN = 8;

    // Auto-lock choices (mins == 0 means "immediately on leaving").
    public static final String[] AUTOLOCK_NAMES =
            {"Immediately", "After 1 minute", "After 5 minutes", "After 15 minutes", "After 1 hour"};
    public static final int[] AUTOLOCK_MINUTES = {0, 1, 5, 15, 60};

    private static final AppLock INSTANCE = new AppLock();
    public static AppLock get() { return INSTANCE; }
    private AppLock() {}

    // --- session (process-scoped) ----------------------------------------------------------------

    private volatile boolean mUnlocked = false;   // starts LOCKED on every process start
    private volatile long mBackgroundedAt = 0L;

    public boolean isUnlocked() { return mUnlocked; }

    public void unlock() { mUnlocked = true; mBackgroundedAt = 0L; }

    public void lock() { mUnlocked = false; }

    /** The app went to the background (its last activity stopped). */
    public void markBackgrounded() { mBackgroundedAt = System.currentTimeMillis(); }

    /**
     * The app came back to the foreground: re-lock if the auto-lock delay has elapsed. Returns true
     * iff it just transitioned unlocked→locked (so the caller knows to show the lock screen). A
     * cold start (never unlocked this process) returns false; the application lifecycle gate
     * independently checks the current locked state.
     */
    public boolean maybeRelock(Context zContext) {
        if (!mUnlocked) return false;
        long bg = mBackgroundedAt;
        mBackgroundedAt = 0L;
        if (bg == 0L) return false;                   // never actually backgrounded (e.g. internal nav)
        int minutes = autolockMinutes(zContext);
        long elapsed = System.currentTimeMillis() - bg;
        // Clock moved backwards, "Immediately", or the delay elapsed → lock.
        if (elapsed < 0 || minutes <= 0 || elapsed >= minutes * 60_000L) {
            lock();
            return true;
        }
        return false;
    }

    // --- storage ---------------------------------------------------------------------------------

    private static SharedPreferences prefs(Context zContext) {
        return zContext.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** True when the user has turned the lock on and a PIN is stored. */
    public static boolean isEnabled(Context zContext) {
        SharedPreferences p = prefs(zContext);
        return p.getBoolean(K_ENABLED, false) && p.contains(K_PIN);
    }

    public static int autolockMinutes(Context zContext) {
        return prefs(zContext).getInt(K_AUTOLOCK, DEFAULT_AUTOLOCK_MIN);
    }

    public static void setAutolockMinutes(Context zContext, int zMinutes) {
        prefs(zContext).edit().putInt(K_AUTOLOCK, zMinutes).apply();
    }

    /** Set (or change) the PIN and enable the lock. The PIN itself is never persisted. */
    public static void setPin(Context zContext, String zPin) {
        try {
            byte[] container = VaultCrypto.encrypt(zPin, SENTINEL);
            if (!prefs(zContext).edit()
                    .putString(K_PIN, BaseConverter.encode16(container))
                    .putBoolean(K_ENABLED, true)
                    .commit()) {
                throw new IllegalStateException("could not persist the PIN");
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Could not store PIN: " + e.getMessage(), e);
        }
    }

    /** True iff {@code zPin} authenticates the stored sentinel container. */
    public static boolean verifyPin(Context zContext, String zPin) {
        String hex = prefs(zContext).getString(K_PIN, null);
        if (hex == null) return false;
        try {
            byte[] container = new MiniData(hex).getBytes();
            VaultCrypto.decrypt(zPin, container);   // throws BadPassphraseException on a wrong PIN
            return true;
        } catch (Exception wrongOrCorrupt) {
            return false;
        }
    }

    /** Disable the lock entirely: clear the PIN, the enabled flag, and any biometric entry. */
    public static void disable(Context zContext) {
        prefs(zContext).edit().remove(K_PIN).remove(K_ENABLED).apply();
        BiometricUnlock.disable(zContext);
        get().unlock();   // nothing to protect any more — don't strand the user on a lock screen
    }
}
