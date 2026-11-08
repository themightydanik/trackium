package com.eurobuddha.minimacore.service;

import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import org.minima.system.Main;
import org.minima.utils.MinimaLogger;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.main.ResyncLauncher;
import com.eurobuddha.minimacore.main.ResyncSession;
import com.eurobuddha.minimacore.main.SeedSyncActivity;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.ResyncHosts;

import java.util.List;

/**
 * Polls the node's own status and tells the user when it needs a resync.
 *
 * Deliberately cheap and rare: this watches something that degrades over weeks, so it runs
 * at service start and on the existing hourly Alarm. No WorkManager, no JobScheduler, no
 * new scheduling dependency - the app has none today and does not need one for this.
 */
public final class NodeHealthMonitor {

    public static final String CHANNEL_ID = "MinimaHealthChannel";
    private static final int NOTIFICATION_ID = 7;

    /** Owned by the Startup Params screen - one definition, not two. */
    static final String PREF_AUTORESYNC = com.eurobuddha.minimacore.main.ParamsActivity.PREF_AUTORESYNC;
    static final String PREF_LAST_AUTORESYNC = "node_autoresync_last";
    static final String PREF_LAST_NOTIFIED = "node_health_notified";

    /** One automatic resync a day at most, however bad it looks. */
    static final long AUTORESYNC_MIN_INTERVAL_MILLIS = 24L * 60 * 60 * 1000;

    /** How long to keep watching for a fast pre-flight failure before leaving it alone. */
    static final int FAILOVER_POLL_MILLIS = 10_000;
    static final int FAILOVER_WINDOW_MILLIS = 3 * 60 * 1000;

    /**
     * How often a check actually runs. This IS the schedule, not just a debounce.
     *
     * Callers ask far more often than this - every new block, at service start, and on the
     * hourly Alarm - and all but one are turned away. Driving it from the node's own block
     * heartbeat rather than from AlarmManager is deliberate: setInexactRepeating is subject
     * to Doze and OEM battery management, and on a Z Fold 7 it had not fired once six minutes
     * after start, which would have left that device with no health check for hours. A block
     * arrives roughly every 50 seconds while the node is running.
     *
     * It also collapses the original duplicate: the Alarm both starts the service AND asks
     * for a check, and starting a running service delivers onStartCommand, which asks again.
     */
    static final long MIN_CHECK_INTERVAL_MILLIS = 15L * 60 * 1000;

    /**
     * A check whose status read FAILED retries this soon, not after the full interval.
     *
     * `status complete:true` throws during early startup - the wallet's seed row is not
     * loaded yet, so it NPEs on SeedRow.getSeed() - and the first check after a restart lands
     * squarely in that window. Spending the whole interval on it left a freshly started node
     * unmonitored for fifteen minutes; observed on a Z Fold 7 as no health line at all.
     */
    static final long RETRY_AFTER_FAILURE_MILLIS = 60_000L;

    private static final NodeHealth HEALTH = new NodeHealth();

    /** Previous cumulative blocking-GC count + when it was read, for the per-hour rate. */
    private static long sLastGcCount = -1;
    private static long sLastGcAt    = 0;
    private static final java.util.concurrent.atomic.AtomicLong LAST_CHECK =
            new java.util.concurrent.atomic.AtomicLong(0);

    private NodeHealthMonitor() {}

    public static NodeHealth health() { return HEALTH; }

    /** Run a check off the UI/service thread. Safe to call often; does nothing if the node is down. */
    public static void checkAsync(Context context) {
        final Context app = context.getApplicationContext();
        try {
            MinimaCMD.readExecutor().execute(() -> checkNow(app, System.currentTimeMillis()));
        } catch (java.util.concurrent.RejectedExecutionException exc) {
            // Reads are saturated. A health poll is the least urgent thing in the queue.
        }
    }

    /** Synchronous body. Visible for testing the plumbing; the decisions live in NodeHealth. */
    static void checkNow(Context context, long nowMillis) {
        if (Main.getInstance() == null || MinimaService.haveStartedShutdown()) return;
        // A node that exists is not a node that is READY. Until startup completes the wallet is
        // not loaded and `status complete:true` throws inside the node (SeedRow.getSeed() on a
        // null), which the reader reports as "could not read node status" - an alarming line on
        // every single restart for a node that is merely still booting. Reproduced on both test
        // phones, every time, during the 1.6.35 upgrade. claimCheck() below already worried
        // about this ("the check fired at service start - before the node had finished coming
        // up"); asking the node directly is the guard that actually holds.
        if (!Main.getInstance().isStartUpComplete()) return;
        // A node that exists is not a node that is READY. Until startup completes the wallet is
        // not loaded and `status complete:true` throws inside the node
        // (SeedRow.getSeed() on null), which the reader reports as "could not read node status"
        // - an alarming line on every single restart, for a node that is merely still booting.
        // Reproduced on both test phones, every time, on the 1.6.35 upgrade. claimCheck() below
        // already worried about this ("the check fired at service start - before the node had
        // finished coming up"); asking the node directly is the guard that actually holds.
        if (!Main.getInstance().isStartUpComplete()) return;
        // Never diagnose a node that is mid-resync - it is supposed to look wrong.
        if (ResyncSession.get().state() == ResyncSession.State.RUNNING) return;
        // Claim the slot only once a real sample is about to happen. Claiming earlier meant
        // the check fired at service start - before the node had finished coming up - burned
        // the minute doing nothing, and suppressed the next trigger that could have sampled.
        if (!claimCheck(nowMillis)) return;

        JSONObject reply = MinimaCMD.execute("status complete:true");
        NodeHealth.Metrics metrics = NodeHealth.read(reply, blockingGcPerHour(nowMillis));
        if (metrics == null) {
            // Say so. A health check that fails silently is worse than no health check: it
            // looks exactly like a healthy node.
            String error = com.eurobuddha.minimacore.utils.Feedback.errorOf(reply);
            MinimaLogger.log("Node health: could not read node status - "
                    + (error != null ? error : "reply was not in the expected shape")
                    + " (retrying shortly)");
            retrySooner(nowMillis);
            return;
        }

        NodeHealth.Assessment raw = NodeHealth.classify(metrics);
        NodeHealth.State state = HEALTH.update(metrics, nowMillis);

        // Log every check, including the healthy ones. A check that says nothing when all
        // is well is indistinguishable from a check that never ran - and this feature
        // exists precisely because the node degraded for weeks with nothing to look at.
        // Hourly, so this is ~24 lines a day. Goes through MinimaLogger rather than
        // LogBuffer directly: MinimaService echoes MINIMALOG events into LogBuffer, so one
        // call lands in both the Logs tab and logcat, where it can actually be verified.
        // Name the pending verdict too. Otherwise the first sample of a sick node logs a
        // reassuring "OK" - the dwell has not elapsed yet - right next to the numbers that
        // say otherwise, which is exactly the kind of quietly misleading line this whole
        // feature exists to replace.
        String verdict = raw.state == state ? state.toString() : state + " (" + raw.state + " pending)";
        MinimaLogger.log("Node health: " + verdict + " - " + summarise(metrics));

        if (state == NodeHealth.State.OK) {
            clear(context);
            return;
        }

        String reason = HEALTH.reason();

        if (state == NodeHealth.State.DEGRADED && autoResyncEnabled(context)
                && mayAutoResync(context, metrics, nowMillis)) {
            startAutoResync(context, nowMillis, reason);
            return;
        }
        notify(context, state, reason);
    }

    /**
     * True if this caller won the right to run a check now.
     *
     * The wall clock can move BACKWARDS - an NTP correction, or the user changing the time -
     * and a naive `now - last` would then be negative, read as "too soon", and silently
     * suppress every check until the clock caught up again. A jump backwards re-baselines
     * and runs instead.
     */
    private static boolean claimCheck(long nowMillis) {
        while (true) {
            long last = LAST_CHECK.get();
            boolean tooSoon = last != 0
                    && nowMillis >= last
                    && nowMillis - last < MIN_CHECK_INTERVAL_MILLIS;
            if (tooSoon) return false;
            if (LAST_CHECK.compareAndSet(last, nowMillis)) return true;
        }
    }

    /** Give back most of the interval, so a failed read is retried on a following block. */
    private static void retrySooner(long nowMillis) {
        LAST_CHECK.set(nowMillis - (MIN_CHECK_INTERVAL_MILLIS - RETRY_AFTER_FAILURE_MILLIS));
    }

    /** The numbers behind the verdict, so a trend is readable straight from the Logs tab. */
    private static String summarise(NodeHealth.Metrics m) {
        return "store " + NodeHealth.mb(m.diskBytes)
                + ", txpow " + NodeHealth.mb(m.txpowBytes) + " / " + m.txpowRows + " rows"
                + ", archive " + NodeHealth.mb(m.archiveBytes)
                + ", heap " + NodeHealth.mb(m.heapUsed) + " of " + NodeHealth.mb(m.heapMax)
                + (m.blockingGcPerHour < 0 ? "" : ", blocking GC " + m.blockingGcPerHour + "/hr")
                + ", mempool " + m.mempool;
    }

    /**
     * Blocking GCs per hour since the previous check.
     *
     * art.gc.blocking-gc-count is cumulative and process-wide, so unlike an instantaneous heap
     * reading it cannot miss what happened between two samples - which is the whole reason this
     * exists. A struggling node's heap is a sawtooth (measured: floor 55-76 MB, peaks to 411 MB,
     * over 21 hours), so hourly snapshots of Runtime mostly catch the floor and report a healthy
     * number while companion apps are timing out.
     *
     * Returns -1 on the first call (no previous sample to difference against) and on anything
     * unexpected. -1 means "unknown", and NodeHealth.classify treats unknown as no signal rather
     * than as good news.
     */
    private static synchronized long blockingGcPerHour(long nowMillis) {
        try {
            String raw = android.os.Debug.getRuntimeStat("art.gc.blocking-gc-count");
            if (raw == null) return -1;

            long count   = Long.parseLong(raw.trim());
            long prev    = sLastGcCount;
            long prevAt  = sLastGcAt;
            sLastGcCount = count;
            sLastGcAt    = nowMillis;

            //First sample, or a counter that went backwards (process restarted under us)
            if (prev < 0 || count < prev) return -1;

            long elapsed = nowMillis - prevAt;
            //A clock that jumped, or two checks in the same instant - no usable rate
            if (elapsed < 60_000L) return -1;

            return ((count - prev) * 3_600_000L) / elapsed;

        } catch (Exception e) {
            return -1;
        }
    }

    // --- automatic path -------------------------------------------------------------

    static boolean autoResyncEnabled(Context context) {
        return prefs(context).getBoolean(PREF_AUTORESYNC, false);
    }

    /**
     * Guards that have nothing to do with how sick the node looks.
     *
     * The mempool check matters: a resync drops anything not yet mined, so a node with a
     * transaction in flight is left alone even when it is struggling. It will still be
     * struggling at the next poll.
     */
    static boolean mayAutoResync(Context context, NodeHealth.Metrics metrics, long nowMillis) {
        if (metrics.mempool > 0) return false;
        if (ResyncSession.get().state() != ResyncSession.State.IDLE) return false;
        long last = prefs(context).getLong(PREF_LAST_AUTORESYNC, 0L);
        return last <= 0 || (nowMillis - last) >= AUTORESYNC_MIN_INTERVAL_MILLIS;
    }

    private static void startAutoResync(Context context, long nowMillis, String reason) {
        List<String> hosts = new java.util.ArrayList<>(ResyncHosts.candidates(context));
        if (hosts.isEmpty()) return;

        // Count the attempt once, up front. A day's budget is spent on trying, not on
        // succeeding - otherwise a host outage would let it retry around the clock.
        prefs(context).edit().putLong(PREF_LAST_AUTORESYNC, nowMillis).apply();
        attempt(context, hosts, reason);
    }

    /** Try the next host, then watch briefly in case it never gets past the pre-flight. */
    private static void attempt(Context context, List<String> remaining, String reason) {
        if (remaining.isEmpty()) {
            MinimaLogger.log("Node health: no MegaMMR host could be reached for an automatic resync");
            notify(context, NodeHealth.State.DEGRADED, reason);
            return;
        }
        String host = remaining.remove(0);
        MinimaLogger.log("Node health: starting an automatic resync from " + host + " (" + reason + ")");

        // automatic: nobody is watching, so the node must bring itself back afterwards.
        ResyncLauncher.Result result = ResyncLauncher.begin(context,
                com.eurobuddha.minimacore.main.ResyncJob.hostResync(host, true));
        if (!result.started) {
            MinimaLogger.log("Node health: automatic resync did not start - " + result.error);
            notify(context, NodeHealth.State.DEGRADED, reason);
            return;
        }
        notifyAuto(context, host, reason);
        watchForConnectFailure(context, remaining, reason, 0);
    }

    /**
     * megammrsync pre-flights the host before it touches anything, so a host that is simply
     * down fails fast - and that failure alone is safe to retry elsewhere. Anything later
     * has already deleted the databases, so it is reported and left to the user.
     *
     * Bounded: a real resync stays RUNNING well past this window and is then left alone.
     */
    private static void watchForConnectFailure(Context context, List<String> remaining,
                                               String reason, int elapsedMillis) {
        if (elapsedMillis > FAILOVER_WINDOW_MILLIS) return;

        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            ResyncSession session = ResyncSession.get();
            if (session.state() == ResyncSession.State.RUNNING
                    || session.state() == ResyncSession.State.SUCCEEDED) {
                return;
            }
            if (session.state() == ResyncSession.State.FAILED) {
                String error = session.result();
                if (ResyncHosts.canTryAnotherHost(error) && !remaining.isEmpty()) {
                    MinimaLogger.log("Node health: " + error + " - trying the next host");
                    session.reset();
                    attempt(context, remaining, reason);
                } else {
                    MinimaLogger.log("Node health: automatic resync failed - " + error);
                    notify(context, NodeHealth.State.DEGRADED, reason);
                }
                return;
            }
            watchForConnectFailure(context, remaining, reason, elapsedMillis + FAILOVER_POLL_MILLIS);
        }, FAILOVER_POLL_MILLIS);
    }

    // --- notifications --------------------------------------------------------------

    private static void ensureChannel(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        // IMPORTANCE_DEFAULT, unlike the silent LOW service channel: the whole problem in
        // the 2026-09-11 incident was that nothing ever said anything was wrong.
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, Language.text(context, l10n_notification_health), NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription(Language.text(context, l10n_notification_health_help));
        manager.createNotificationChannel(channel);
    }

    private static PendingIntent resyncScreen(Context context) {
        Intent intent = new Intent(context, SeedSyncActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(context, 0, intent, flags);
    }

    private static void notify(Context context, NodeHealth.State state, String reason) {
        // One notification per state change, not one per poll.
        SharedPreferences prefs = prefs(context);
        String key = state.name() + "|" + reason;
        if (key.equals(prefs.getString(PREF_LAST_NOTIFIED, ""))) return;
        prefs.edit().putString(PREF_LAST_NOTIFIED, key).apply();

        String title = state == NodeHealth.State.DEGRADED
                ? "Minima node needs a resync"
                : "Minima node is growing";
        String text = state == NodeHealth.State.DEGRADED
                ? reason + ". Apps may start timing out. Tap to resync."
                : reason + ". A resync will clear it. Tap when convenient.";
        post(context, title, text);
    }

    private static void notifyAuto(Context context, String host, String reason) {
        prefs(context).edit().putString(PREF_LAST_NOTIFIED, "AUTO|" + reason).apply();
        post(context, "Minima is resyncing itself",
                reason + ". Rebuilding from " + host + ". Tap to watch progress.");
    }

    private static void post(Context context, String title, String text) {
        ensureChannel(context);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setSmallIcon(R.drawable.ic_minima)
                .setContentIntent(resyncScreen(context))
                .setAutoCancel(true)
                .build();
        manager.notify(NOTIFICATION_ID, notification);
    }

    /** Healthy again - take the warning down and allow it to fire afresh later. */
    private static void clear(Context context) {
        SharedPreferences prefs = prefs(context);
        if (!prefs.getString(PREF_LAST_NOTIFIED, "").isEmpty()) {
            prefs.edit().putString(PREF_LAST_NOTIFIED, "").apply();
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) manager.cancel(NOTIFICATION_ID);
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
    }
}
