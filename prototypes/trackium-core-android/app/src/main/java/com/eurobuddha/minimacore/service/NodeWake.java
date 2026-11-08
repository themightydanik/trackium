package com.eurobuddha.minimacore.service;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.PowerManager;
import android.os.SystemClock;

import org.minima.utils.MinimaLogger;

/**
 * The node's CPU wakelock (battery step 6, 2026-10-26). It used to be held for the life of the
 * service. Now it is held whenever {@link BatteryPolicy#nodeAwake()} says so; otherwise the CPU may
 * sleep, and an idle-allowed alarm opens a short catch-up window every 10 min (Saver: 20 min) so the
 * node still syncs blocks. Mining (an own transaction or a pulse) always holds its own lock until
 * the node reports it finished, so a transaction the user sent is never left half-mined.
 */
final class NodeWake implements BatteryPolicy.Listener {

    static final String ACTION_WINDOW = "com.eurobuddha.minimacore.NODE_WAKE_WINDOW";
    static final long WINDOW_MS = 60_000;
    /** Safety cap: a lost "mining finished" event must not pin the CPU forever. */
    static final long MINING_MAX_MS = 10 * 60_000;

    private final Context mCtx;
    private final PowerManager.WakeLock mLock, mWindow, mMining;
    private final PendingIntent mWindowIntent;
    private final BroadcastReceiver mReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            mWindow.acquire(WINDOW_MS);
            MinimaLogger.log("NODEWAKE catch-up window " + (WINDOW_MS / 1000) + "s");
            apply();
        }
    };

    NodeWake(Context zCtx) {
        mCtx = zCtx;
        PowerManager pm = (PowerManager) zCtx.getSystemService(Context.POWER_SERVICE);
        mLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Minima::MiniPower");
        mWindow = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Minima::Window");
        mMining = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Minima::Mining");
        mLock.setReferenceCounted(false);
        mWindow.setReferenceCounted(false);
        mMining.setReferenceCounted(false);
        mWindowIntent = PendingIntent.getBroadcast(zCtx, 7, new Intent(ACTION_WINDOW).setPackage(zCtx.getPackageName()),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    void start() {
        mCtx.registerReceiver(mReceiver, new IntentFilter(ACTION_WINDOW), Context.RECEIVER_NOT_EXPORTED);
        BatteryPolicy.addListener(this);
        apply();
    }

    void stop() {
        BatteryPolicy.removeListener(this);
        try { mCtx.unregisterReceiver(mReceiver); } catch (Exception ignored) { }
        alarms().cancel(mWindowIntent);
        if (mLock.isHeld()) mLock.release();
        if (mWindow.isHeld()) mWindow.release();
        if (mMining.isHeld()) mMining.release();
    }

    /** From the node's MINING event. */
    void mining(boolean zStarting) {
        if (zStarting) mMining.acquire(MINING_MAX_MS);
        else if (mMining.isHeld()) mMining.release();
    }

    @Override public void onBatteryPolicyChanged() { apply(); }

    private synchronized void apply() {
        boolean want = BatteryPolicy.nodeAwake();
        if (want && !mLock.isHeld()) {
            mLock.acquire();
            alarms().cancel(mWindowIntent);
            MinimaLogger.log("NODEWAKE held");
        } else if (!want) {
            if (mLock.isHeld()) {
                mLock.release();
                MinimaLogger.log("NODEWAKE released, window every " + (BatteryPolicy.nodeWindowEveryMs() / 60_000) + " min");
            }
            alarms().setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + BatteryPolicy.nodeWindowEveryMs(), mWindowIntent);
        }
    }

    private AlarmManager alarms() { return (AlarmManager) mCtx.getSystemService(Context.ALARM_SERVICE); }
}
