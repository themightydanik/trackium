package com.eurobuddha.minimacore.service;

import org.minima.utils.json.JSONObject;

/**
 * Is the node heading for the state that took it down on 2026-09-11?
 *
 * That incident ran for weeks with no signal at all: the node stayed alive, on-chain and
 * a healthy foreground service while its heap pinned at the ceiling and companion apps
 * timed out. Nothing in the app watched anything, so nobody knew until apps broke.
 *
 * The cause was database growth, not memory - a coin-set pollution bug marked strangers'
 * coins relevant, and TxPoWSqlDB never deletes relevant rows - so the store is the LEADING
 * signal and the heap is only the backstop. By the time heap moves the node is already
 * struggling, and a routine restart hides it without fixing anything.
 *
 * Measured reference, zfold7 after a megammrsync resync (2026-09-11): disk 29.0 MB,
 * txpowdb 10.1 MB / 2,050 rows, archivedb 2.3 MB, ram 87.3 MB. The gap between that and a
 * sick node is orders of magnitude, not percent, so the thresholds below are deliberately
 * generous - they exist to catch a runaway, not to police a busy node.
 *
 * Everything here is pure except {@link #read}: classify() takes numbers and returns a
 * verdict, so the thresholds can be tested without a node.
 */
public final class NodeHealth {

    public enum State {
        /** Nothing to do. */
        OK,
        /** Growing. Worth a resync at the user's convenience, not urgent. */
        WATCH,
        /** Already struggling, or about to be. Recommend a resync now. */
        DEGRADED
    }

    /**
     * Store thresholds watch the txpow table ONLY, and are deliberately loose.
     *
     * Total disk is not a trigger and neither is the archive. A field check on
     * R58M307HEEN read 712 MB of store, of which 558 MB was archive - and the archive is
     * SUPPOSED to grow, to MAX_KEEP_BLOCKS (100,000 blocks, ~50 days, ArchiveManager.java:28,
     * no CLI override). Triggering on total disk would tell every node older than fifty days
     * to wipe and refetch its chain, which would not help: the archive simply grows back.
     * Only the txpow table carries the pollution a resync actually clears.
     *
     * PROVISIONAL. Two data points: a resynced node at 2,050 rows / 10.1 MB, and a
     * long-running one at 22,530 rows / 135 MB that was NOT complaining. These sit far above
     * both, because the cost of a false positive here is telling someone to rebuild the chain
     * on a node that was fine.
     */
    static final long TXPOW_ROWS_WATCH     = 250_000L;
    static final long TXPOW_ROWS_DEGRADED  = 1_000_000L;
    static final long TXPOW_BYTES_WATCH    = 400L * 1024 * 1024;
    static final long TXPOW_BYTES_DEGRADED = 900L * 1024 * 1024;

    /**
     * Heap is the PRIMARY signal: it is what actually broke on 2026-09-11 (501,501 KB of a
     * 524,288 KB ceiling) and it measures the harm directly rather than inferring it from a
     * database that has several legitimate reasons to be large.
     *
     * Thresholds are FRACTIONS of Runtime.maxMemory(), never absolute MB.
     * dalvik.vm.heapgrowthlimit is 256m on two of the three test devices and 512m on the
     * third, so "warn at 400 MB" is not portable. 0.60/0.80 land on ~307 MB / ~410 MB of a
     * 512 MB heap.
     */
    static final double HEAP_WATCH_FRACTION    = 0.60d;
    static final double HEAP_DEGRADED_FRACTION = 0.80d;

    /**
     * The node's own definition of "nearly out", reused so the app and the node agree:
     * MMR.java and MegaMMR.java abort below max(32MB, maxMemory/20).
     */
    static final long HEAP_WATERMARK_FLOOR = 32L * 1024 * 1024;

    /**
     * Blocking garbage collections per hour.
     *
     * The heap thresholds above are right about WHAT matters and wrong about HOW it is read: they
     * sample Runtime at one instant, hourly, and a struggling node's heap is not a level, it is a
     * sawtooth. Measured 2026-09-22 over 21 hours on a Galaxy S10+ serving seven companion apps,
     * sampled every 10 minutes: the post-GC floor sat at 55-76 MB the whole time while peaks
     * climbed 92 MB -> 411 MB. An hourly instant reading mostly catches the floor, so the node
     * reported WATCH on store size while it was in fact thrashing - 1104 blocking GC waits - and
     * never reached the DEGRADED that would have triggered the auto-resync.
     *
     * art.gc.blocking-gc-count is the honest signal: a cumulative counter, so it cannot be missed
     * between samples, and it measures the harm directly - a blocking GC is precisely the pause
     * that makes a companion app's 30 s read time out. Thresholds are deliberately loose, per the
     * rule for the store thresholds above: they exist to catch a runaway, not to police a busy
     * node.
     *
     * CALIBRATED, not guessed. Two healthy nodes on 1.6.35, 2026-09-22, both following the chain:
     * 27/hr on the S10+ (freshly resynced, 2112 rows) and 24/hr on the zfold7 (194 MB store,
     * 22202 rows). So ~25/hr is what "fine" looks like here, across very different store sizes.
     * WATCH at 200 is 8x that. The first draft used 60, which is barely 2x and would have nagged
     * a merely busy node - exactly what the rule above forbids. The observed fault ran to
     * hundreds and thousands per hour, so the separation is ample either way.
     */
    static final long BLOCKING_GC_WATCH_PER_HOUR    = 200L;
    static final long BLOCKING_GC_DEGRADED_PER_HOUR = 600L;

    /** A state must hold this long before it is reported, so a spike cannot flip it. */
    static final long DWELL_MILLIS = 10L * 60 * 1000;

    /** What the node reported, plus this process's heap. Immutable. */
    public static final class Metrics {
        public final long txpowRows;
        public final long txpowBytes;
        public final long diskBytes;
        public final long archiveBytes;
        public final long mempool;
        public final long heapMax;
        public final long heapUsed;
        /** Blocking GCs per hour since the previous sample; -1 when not yet known. */
        public final long blockingGcPerHour;

        public Metrics(long txpowRows, long txpowBytes, long diskBytes, long archiveBytes,
                       long mempool, long heapMax, long heapUsed) {
            this(txpowRows, txpowBytes, diskBytes, archiveBytes, mempool, heapMax, heapUsed, -1);
        }

        public Metrics(long txpowRows, long txpowBytes, long diskBytes, long archiveBytes,
                       long mempool, long heapMax, long heapUsed, long blockingGcPerHour) {
            this.txpowRows = txpowRows;
            this.txpowBytes = txpowBytes;
            this.diskBytes = diskBytes;
            this.archiveBytes = archiveBytes;
            this.mempool = mempool;
            this.heapMax = heapMax;
            this.heapUsed = heapUsed;
            this.blockingGcPerHour = blockingGcPerHour;
        }

        public long heapHeadroom() { return Math.max(0, heapMax - heapUsed); }
        public double heapFraction() { return heapMax <= 0 ? 0d : (double) heapUsed / (double) heapMax; }
    }

    /** A verdict plus the number that produced it, so the user is told what is actually wrong. */
    public static final class Assessment {
        public final State state;
        public final String reason;

        Assessment(State state, String reason) {
            this.state = state;
            this.reason = reason;
        }
    }

    private State reported = State.OK;
    private State candidate = State.OK;
    private long candidateSince;
    private String reason = "";

    /** Pure: no hysteresis, no clock. The raw verdict for one sample. */
    public static Assessment classify(Metrics m) {
        if (m == null) return new Assessment(State.OK, "");

        long watermark = Math.max(HEAP_WATERMARK_FLOOR, m.heapMax / 20);

        if (m.heapMax > 0 && m.heapHeadroom() < watermark) {
            return new Assessment(State.DEGRADED,
                    "only " + mb(m.heapHeadroom()) + " of heap left out of " + mb(m.heapMax));
        }
        if (m.heapFraction() >= HEAP_DEGRADED_FRACTION) {
            return new Assessment(State.DEGRADED,
                    "heap " + mb(m.heapUsed) + " of " + mb(m.heapMax) + " used");
        }
        // Ahead of the store thresholds: this is the harm, they are only a leading indicator.
        if (m.blockingGcPerHour >= BLOCKING_GC_DEGRADED_PER_HOUR) {
            return new Assessment(State.DEGRADED,
                    "the node is stalling on memory - " + m.blockingGcPerHour
                    + " blocking collections an hour");
        }
        if (m.txpowRows >= TXPOW_ROWS_DEGRADED) {
            return new Assessment(State.DEGRADED,
                    "the transaction table holds " + m.txpowRows + " rows");
        }
        if (m.txpowBytes >= TXPOW_BYTES_DEGRADED) {
            return new Assessment(State.DEGRADED,
                    "the transaction table is " + mb(m.txpowBytes));
        }
        if (m.txpowRows >= TXPOW_ROWS_WATCH) {
            return new Assessment(State.WATCH,
                    "the transaction table holds " + m.txpowRows + " rows");
        }
        if (m.txpowBytes >= TXPOW_BYTES_WATCH) {
            return new Assessment(State.WATCH, "the transaction table is " + mb(m.txpowBytes));
        }
        if (m.blockingGcPerHour >= BLOCKING_GC_WATCH_PER_HOUR) {
            return new Assessment(State.WATCH,
                    "the node is pausing for memory - " + m.blockingGcPerHour
                    + " blocking collections an hour");
        }
        if (m.heapFraction() >= HEAP_WATCH_FRACTION) {
            return new Assessment(State.WATCH,
                    "heap " + mb(m.heapUsed) + " of " + mb(m.heapMax) + " used");
        }

        return new Assessment(State.OK, "");
    }

    /**
     * Apply one sample. A new verdict only becomes the reported state once it has held for
     * DWELL_MILLIS - in BOTH directions, so the node cannot be declared healthy on a single
     * quiet sample any more than it can be declared sick on a single spike.
     */
    public synchronized State update(Metrics m, long nowMillis) {
        Assessment raw = classify(m);
        if (raw.state == reported) {
            candidate = reported;
            candidateSince = nowMillis;
            reason = raw.reason;
            return reported;
        }
        if (raw.state != candidate) {
            candidate = raw.state;
            candidateSince = nowMillis;
        } else if (nowMillis - candidateSince >= DWELL_MILLIS) {
            reported = candidate;
            reason = raw.reason;
        }
        return reported;
    }

    public synchronized State state() { return reported; }
    public synchronized String reason() { return reason; }

    /** Wipe the dwell machinery - used after a resync, so the old verdict cannot linger. */
    public synchronized void reset() {
        reported = candidate = State.OK;
        candidateSince = 0;
        reason = "";
    }

    /**
     * Read one sample from the node.
     *
     * Runs `status complete:true` SYNCHRONOUSLY, so call it from a background worker -
     * MinimaCMD.readExecutor() is the pool the other read paths use. Deliberately not
     * MinimaCMD.runMinima(): `status` is not in its read allowlist, so that route would
     * spawn a fresh unpooled thread for every poll.
     *
     * Returns null when the node is not up or the reply is unusable - an unknown node is
     * not an unhealthy node, and must never trigger a resync.
     */
    public static Metrics read(JSONObject statusReply) {
        return read(statusReply, -1);
    }

    /** As {@link #read(JSONObject)}, carrying a measured blocking-GC rate (-1 when unknown). */
    public static Metrics read(JSONObject statusReply, long blockingGcPerHour) {
        if (statusReply == null || !Boolean.TRUE.equals(statusReply.get("status"))) return null;

        Object responseObj = statusReply.get("response");
        if (!(responseObj instanceof JSONObject)) return null;
        JSONObject response = (JSONObject) responseObj;

        JSONObject memory = obj(response, "memory");
        JSONObject files = memory == null ? null : obj(memory, "files");
        JSONObject txpow = obj(response, "txpow");
        if (memory == null || files == null) return null;

        Runtime rt = Runtime.getRuntime();
        return new Metrics(
                num(txpow, "txpowdb"),
                bytes(str(files, "txpowdb")),
                bytes(str(memory, "disk")),
                bytes(str(files, "archivedb")),
                num(txpow, "mempool"),
                rt.maxMemory(),
                rt.totalMemory() - rt.freeMemory(),
                blockingGcPerHour);
    }

    /**
     * Parse the node's own size strings - MiniFormat.formatSize emits "123 bytes",
     * "1.5 KB", "10.1 MB", "1.2 GB", or a decimal comma under ru/uk.
     * Returns 0 for anything unrecognised, so a format
     * change degrades to "looks fine" rather than to a spurious resync prompt.
     */
    static long bytes(String formatted) {
        if (formatted == null) return 0;
        String s = formatted.trim();
        if (s.isEmpty()) return 0;
        int space = s.indexOf(' ');
        if (space <= 0) return 0;
        double value;
        try {
            String number = s.substring(0, space);
            // MiniFormat uses %.1f with the node's locale, without grouping. Accept
            // that exact comma form too; do not reinterpret grouped/mixed numbers.
            if (number.matches("[0-9]+,[0-9]")) number = number.replace(',', '.');
            value = Double.parseDouble(number);
        } catch (NumberFormatException exc) {
            return 0;
        }
        String unit = s.substring(space + 1).trim().toUpperCase(java.util.Locale.ROOT);
        long multiplier;
        switch (unit) {
            case "BYTES": case "B": multiplier = 1L; break;
            case "KB": multiplier = 1024L; break;
            case "MB": multiplier = 1024L * 1024; break;
            case "GB": multiplier = 1024L * 1024 * 1024; break;
            case "TB": multiplier = 1024L * 1024 * 1024 * 1024; break;
            default: return 0;
        }
        return (long) (value * multiplier);
    }

    static String mb(long bytes) {
        if (bytes >= 1024L * 1024 * 1024) {
            return String.format(java.util.Locale.ROOT, "%.1f GB", bytes / (1024d * 1024 * 1024));
        }
        return String.format(java.util.Locale.ROOT, "%.0f MB", bytes / (1024d * 1024));
    }

    private static JSONObject obj(JSONObject parent, String key) {
        if (parent == null) return null;
        Object value = parent.get(key);
        return (value instanceof JSONObject) ? (JSONObject) value : null;
    }

    private static String str(JSONObject parent, String key) {
        if (parent == null) return null;
        Object value = parent.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private static long num(JSONObject parent, String key) {
        if (parent == null) return 0;
        Object value = parent.get(key);
        if (value instanceof Number) return ((Number) value).longValue();
        if (value == null) return 0;
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (NumberFormatException exc) {
            return 0;
        }
    }
}
