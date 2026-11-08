package com.eurobuddha.minimacore.main;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

import org.minima.system.Main;
import com.eurobuddha.minimacore.service.Alarm;
import com.eurobuddha.minimacore.service.MinimaService;
import com.eurobuddha.minimacore.utils.Peers;

/**
 * The one way a destructive node job is started, from any screen or from the health check.
 *
 * These steps are not optional and not obvious, which is exactly why they must not exist
 * twice: the pending flag has to be committed BEFORE the destructive command so a process
 * death cannot look like success; the alarms have to be cancelled so restart stays under
 * the user's control; and MainActivity's service binding has to be released or the node's
 * stopSelf at job completion never reaches onDestroy.
 *
 * Restore and MegaMMR-from-file restart the node exactly as a host resync does, so they come
 * through here too. Anything that runs a restarting command straight from an Activity is a bug.
 */
public final class ResyncLauncher {

    public static final class Result {
        public final boolean started;
        /** Why it did not start, or null when it did. */
        public final String error;

        private Result(boolean started, String error) {
            this.started = started;
            this.error = error;
        }
    }

    private ResyncLauncher() {}

    private static Result fail(String error) { return new Result(false, error); }

    @android.annotation.SuppressLint("ApplySharedPref") // Persist before the destructive command starts.
    public static Result begin(Context context, ResyncJob job) {
        if (job == null) {
            return fail("Check the details and try again");
        }
        // A missing chain tip is precisely why a damaged node may need this, so the
        // check is "is the node process up", not "is the chain healthy".
        if (Main.getInstance() == null || MinimaService.haveStartedShutdown()) {
            return fail("The node is not running. Restart the node before continuing.");
        }

        SharedPreferences prefs = context.getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
        // Record WHICH job is pending, so a process death is reported as the operation the user
        // actually started rather than always as a resync.
        if (!prefs.edit()
                .putBoolean(SeedSyncActivity.PREF_PENDING, true)
                .putString(SeedSyncActivity.PREF_PENDING_LABEL, job.label())
                .commit()) {
            return fail("Could not save progress state. Check available storage and try again.");
        }

        // Leave restart under the user's control, including after process death - unless the
        // health monitor started this with nobody watching, in which case the alarm stays armed
        // as the fallback and afterShutdown() brings the node back itself.
        if (!job.automatic()) {
            new Alarm().cancelAlarm(context);
            MinimaService.cancelAlarm();
        }

        if (!ResyncSession.get().start(job, System.nanoTime())) {
            // Refused (already running, or already finished and awaiting restart). Do not
            // leave a pending flag behind claiming a job that never began.
            prefs.edit().putBoolean(SeedSyncActivity.PREF_PENDING, false).commit();
            return fail("Another " + job.label().toLowerCase() + " is already in progress.");
        }

        // MainActivity binds the service; release the binding on the main thread.
        final MainActivity open = MainActivity.MAIN_ACTIVITY;
        if (open != null) {
            new Handler(Looper.getMainLooper()).post(() -> {
                if (!open.isFinishing() && !open.isDestroyed()) open.finish();
            });
        }
        return new Result(true, null);
    }

    /**
     * Called by MinimaService at the very end of onDestroy.
     *
     * A resync the health monitor started has nobody on the resync screen, so the "Restart node"
     * tap that completes a manual one never comes. Without this the feature that exists to keep
     * the node healthy left it OFF until the user next opened the app. Manual jobs are untouched.
     * If the foreground-service start is refused, the hourly Alarm - deliberately left armed for
     * automatic jobs - is the fallback.
     */
    public static void afterShutdown(Context context) {
        ResyncSession session = ResyncSession.get();
        ResyncJob job = session.job();
        if (job == null || !job.automatic() || session.state() != ResyncSession.State.SUCCEEDED) return;

        final Context app = context.getApplicationContext();
        if (job.setsDefaultPeer()) Peers.setDefaultPeers(app, job.host());
        app.getSharedPreferences("main_prefs", Context.MODE_PRIVATE).edit()
                .putBoolean(SeedSyncActivity.PREF_PENDING, false)
                .remove(SeedSyncActivity.PREF_PENDING_LABEL)
                .apply();
        session.reset();

        // Belt and braces. The Handler post is the fast path but dies with the process, which
        // Android may kill the moment its last component is gone; the one-shot alarm survives
        // that and bounds the worst case to ~30s rather than the hourly alarm's full interval.
        new Alarm().setOnce(app, 30_000);
        // Same 2s the manual restart path uses, so the old instance releases its DB locks first.
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                app.startForegroundService(new Intent(app, MinimaService.class));
            } catch (Exception exc) {
                org.minima.utils.MinimaLogger.log("Automatic resync: could not restart the node now - "
                        + exc + ". The hourly alarm will.");
            }
        }, 2000);
    }
}
