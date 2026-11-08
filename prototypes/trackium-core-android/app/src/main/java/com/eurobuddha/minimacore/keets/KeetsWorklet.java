package com.eurobuddha.minimacore.keets;

import android.content.Context;

import com.eurobuddha.minimacore.utils.logger;

import org.minima.system.network.keets.KeetsManager;
import org.minima.system.params.GeneralParams;

import java.util.ArrayList;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import to.holepunch.bare.kit.Worklet;

/**
 * Hosts the keets sidecar as a bare-kit worklet — the Android replacement for the
 * desktop's ProcessBuilder("node", sidecar) path (KeetsManager stays dormant here:
 * -keets is never passed, so it spawns nothing; we only use its per-boot token).
 *
 * The worklet runs assets/keets.bundle (bare-pack of keets/sidecar/index.js — see
 * scripts/pack-keets-worklet.sh), joins the mainnet keets topic on the owner-run
 * HyperDHT bootstrap fleet, and bridges every peer stream to the node's own port
 * over loopback with the MSG_KEETS preamble (spec: keets/BRIDGE.md). The token
 * travels as a worklet argument: worklet args live in process memory, not in a
 * /proc cmdline, so this is as private as the desktop's env var.
 */
public class KeetsWorklet implements com.eurobuddha.minimacore.service.BatteryPolicy.Listener, WorkletLifecycle.Owner {

    /** V8 heap limit for the keets worklet. */
    static final int WORKLET_MEMORY_LIMIT = 128 * 1024 * 1024;

    // Shared across service instances: an old service must release its storage
    // before a replacement service can start another worklet in the same process.
    private static final ScheduledExecutorService LIFECYCLE = Executors.newSingleThreadScheduledExecutor();
    private static final WorkletLifecycle OWNERS = new WorkletLifecycle(
            retry -> LIFECYCLE.schedule(retry, 5, TimeUnit.SECONDS));
    private Worklet mWorklet;
    private Context mContext;
    private Context mRequestedContext;
    private String mDhtMode = "routing";
    /** A plug/unplug that changes the DHT mode restarts the sidecar, at most once per settle period
     *  (a loose cable must not cause a restart storm). */
    static final long DHT_MODE_SETTLE_MS = 30_000;
    private final Runnable mDhtModeRecheck = () -> LIFECYCLE.execute(this::applyDhtMode);
    private final android.os.Handler mHandler = new android.os.Handler(android.os.Looper.getMainLooper());

    /** Only the DHT relay setting (and the charger, for "when plugged in") touches the sidecar:
     *  no battery profile suspends it, so the DHT keeps relaying for the network. */
    @Override public void onBatteryPolicyChanged() {
        mHandler.removeCallbacks(mDhtModeRecheck);
        mHandler.postDelayed(mDhtModeRecheck, DHT_MODE_SETTLE_MS);
    }

    /** Restart the sidecar when the wanted DHT mode differs from the running one (plug change or a
     *  new relay choice). A restart takes seconds; mail waits in the mailbox meanwhile. */
    private void applyDhtMode() {
        if (mWorklet == null || mContext == null) return;
        String want = com.eurobuddha.minimacore.service.BatteryPolicy.dhtMode();
        if (want.equals(mDhtMode)) return;
        logger.log("KEETS dht mode " + mDhtMode + " -> " + want + ": restarting the worklet");
        OWNERS.restart(this);
    }

    public void start(Context zContext) {
        Context app = zContext.getApplicationContext();
        LIFECYCLE.execute(() -> { mRequestedContext = app; OWNERS.start(this); });
    }

    @Override public boolean startWorklet() {
        Context zContext = mRequestedContext;
        if (mWorklet != null) return true;
        // bare-kit's native runtime declares minSdk 29 (we override the manifest merge) —
        // on Android 9 the node simply runs classic-only.
        if (android.os.Build.VERSION.SDK_INT < 29) {
            logger.log("KEETS worklet needs Android 10+ .. classic transports only");
            return false;
        }
        try {
            ArrayList<String> args = new ArrayList<>();
            args.add("--port");     args.add(String.valueOf(GeneralParams.MINIMA_PORT));
            args.add("--datadir");  args.add(GeneralParams.DATA_FOLDER);
            args.add("--maxconns"); args.add(String.valueOf(GeneralParams.KEETS_MAX_CONNS));
            args.add("--token");    args.add(KeetsManager.getTokenHex());
            mDhtMode = com.eurobuddha.minimacore.service.BatteryPolicy.dhtMode();
            args.add("--dht-mode"); args.add(mDhtMode);
            if (!GeneralParams.KEETS_BOOTSTRAP.equals("")) {
                args.add("--bootstrap"); args.add(GeneralParams.KEETS_BOOTSTRAP);
            }
            if (GeneralParams.TEST_PARAMS) {
                args.add("--topic"); args.add("minima-testnet-keets-v1");
            }
            // The signed mailbox list (eurobuddha.com/keets/mailboxes.json, verified against the
            // key baked in GeneralParams, cached in data/keets). "" = the sidecar's baked defaults.
            // Never lets a list problem stop the worklet.
            try {
                String mailboxes = org.minima.system.network.keets.KeetsMailboxList.load(
                        new java.io.File(GeneralParams.DATA_FOLDER));
                if (!mailboxes.isEmpty()) {
                    args.add("--mailboxes"); args.add(mailboxes);
                }
            } catch (Throwable t) {
                logger.log("KEETS mailbox list skipped : " + t);
            }

            // 32 MB killed the whole app every ~85-90 min (2.0.40 on the Fold, 16 crashes in a row:
            // v8 FatalProcessOutOfMemory on the bare-worklet thread). Under Bare the sidecar's
            // steady working set is ~17 MB heap in use, ~20 MB reserved, ~18 MB buffers (measured
            // 2026-10-23), before the phone's contacts, peers and media drive. A V8 OOM aborts the
            // process, node included, so leave real headroom.
            Worklet.Options opts = new Worklet.Options().memoryLimit(WORKLET_MEMORY_LIMIT);
            mWorklet = new Worklet(opts);
            mWorklet.start("/keets.bundle", zContext.getAssets().open("keets.bundle"),
                    args.toArray(new String[0]));
            mContext = zContext.getApplicationContext();
            logger.log("KEETS worklet started port:" + GeneralParams.MINIMA_PORT
                    + " datadir:" + GeneralParams.DATA_FOLDER + " dht:" + mDhtMode);
            com.eurobuddha.minimacore.service.BatteryPolicy.addListener(this);
            return true;
        } catch (Throwable t) {
            // UnsatisfiedLinkError (missing ABI), missing asset, anything — the node must
            // keep running classic-only rather than die with the worklet.
            logger.log("KEETS worklet failed to start : " + t);
            return false;
        }
    }

    public void terminate() {
        LIFECYCLE.execute(() -> OWNERS.stop(this));
    }

    @Override public boolean closeWorklet() {
        com.eurobuddha.minimacore.service.BatteryPolicy.removeListener(this);
        mHandler.removeCallbacks(mDhtModeRecheck);
        if (mWorklet == null) return true;
        try {
            WorkletShutdown.close(
                    () -> mWorklet.push("close-media-v1", StandardCharsets.UTF_8, 5, TimeUnit.SECONDS),
                    () -> mWorklet.terminate());
            mWorklet = null;
            mContext = null;
            logger.log("KEETS media storage closed; worklet terminated");
            return true;
        } catch (Throwable error) {
            // Never start a second owner after a timeout or failed close. A later
            // lifecycle retry confirms this owner's shutdown; no files or identities are removed.
            logger.log("KEETS storage shutdown not confirmed; restart deferred: " + error);
            return false;
        }
    }
}
