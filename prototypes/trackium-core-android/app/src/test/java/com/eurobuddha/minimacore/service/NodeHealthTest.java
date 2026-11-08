package com.eurobuddha.minimacore.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;
import org.minima.utils.json.JSONObject;

/**
 * The thresholds, and the parsing they depend on.
 *
 * The healthy fixture is the real zfold7 reply captured after its resync on 2026-09-11 -
 * disk 29.0 MB, txpowdb 10.1 MB / 2050 rows, archivedb 2.3 MB. A checker that calls that
 * node unhealthy would nag every working install, so it is the first thing asserted.
 */
public class NodeHealthTest {

    private static final long MB = 1024L * 1024;

    private static NodeHealth.Metrics metrics(long rows, long txpowBytes, long diskBytes,
                                              long heapMax, long heapUsed) {
        return new NodeHealth.Metrics(rows, txpowBytes, diskBytes, 2 * MB, 0, heapMax, heapUsed);
    }

    private static NodeHealth.Metrics gcMetrics(long heapUsed, long blockingGcPerHour) {
        return new NodeHealth.Metrics(2050, (long) (10.1 * MB), 29 * MB, 2 * MB, 0,
                512 * MB, heapUsed, blockingGcPerHour);
    }

    /**
     * The case that made this signal necessary. Measured on a Galaxy S10+ over 21 hours,
     * sampled every 10 minutes: the post-GC floor never left 55-76 MB while peaks reached
     * 411 MB and blocking GCs ran past 1000. An hourly instantaneous heap reading mostly
     * catches the floor, so heap fraction alone called this node healthy while every
     * companion app was timing out.
     */
    @Test public void aThrashingNodeIsDegradedEvenWhenTheHeapSampleLooksFine() {
        NodeHealth.Metrics m = gcMetrics(70 * MB, 1100);
        NodeHealth.Assessment a = NodeHealth.classify(m);
        assertEquals(NodeHealth.State.DEGRADED, a.state);
        assertTrue(a.reason, a.reason.contains("1100"));
    }

    @Test public void aModestlyPausingNodeOnlyWarns() {
        assertEquals(NodeHealth.State.WATCH, NodeHealth.classify(gcMetrics(70 * MB, 250)).state);
    }

    /**
     * A busy node is not a sick one. Both measured healthy nodes sat at 24-27/hr on 1.6.35
     * (S10+ freshly resynced at 2112 rows, zfold7 at 194 MB / 22202 rows), so the rate a real
     * working node produces must stay silent with room to spare.
     */
    @Test public void aMeasuredHealthyCollectionRateIsNotAFault() {
        assertEquals(NodeHealth.State.OK, NodeHealth.classify(gcMetrics(70 * MB, 27)).state);
        assertEquals(NodeHealth.State.OK, NodeHealth.classify(gcMetrics(70 * MB, 24)).state);
        // and a node several times busier than that is still not a fault
        assertEquals(NodeHealth.State.OK, NodeHealth.classify(gcMetrics(70 * MB, 150)).state);
    }

    /**
     * -1 is "not measured yet" - the first check after a restart has no previous count to
     * difference against. Unknown must never read as good news, nor as a fault.
     */
    @Test public void anUnmeasuredCollectionRateIsNoSignalEitherWay() {
        assertEquals(NodeHealth.State.OK, NodeHealth.classify(gcMetrics(70 * MB, -1)).state);
        // and it must not mask a real fault found by another signal
        NodeHealth.Metrics big = new NodeHealth.Metrics(2050, 950 * MB, 1000 * MB, 2 * MB, 0,
                512 * MB, 70 * MB, -1);
        assertEquals(NodeHealth.State.DEGRADED, NodeHealth.classify(big).state);
    }

    /** The old constructor must keep working, and must mean "unknown". */
    @Test public void theRateDefaultsToUnknownOnTheOlderConstructor() {
        assertEquals(-1, metrics(2050, 10 * MB, 29 * MB, 512 * MB, 87 * MB).blockingGcPerHour);
    }

    /** A real healthy node must be silent, or the feature is worse than useless. */
    @Test public void measuredHealthyNodeIsOk() {
        NodeHealth.Metrics m = metrics(2050, (long) (10.1 * MB), 29 * MB, 512 * MB, 87 * MB);
        assertEquals(NodeHealth.State.OK, NodeHealth.classify(m).state);
        assertEquals("", NodeHealth.classify(m).reason);
    }

    @Test public void aGrowingTxpowTableWarnsBeforeTheHeapEverMoves() {
        // Heap is untouched at 60 MB: the txpow table alone has to raise this.
        NodeHealth.Metrics m = metrics(300_000, 120 * MB, 400 * MB, 512 * MB, 60 * MB);
        NodeHealth.Assessment a = NodeHealth.classify(m);
        assertEquals(NodeHealth.State.WATCH, a.state);
        assertTrue(a.reason, a.reason.contains("300000"));
    }

    /**
     * The check that stops this nagging healthy installs.
     *
     * Real reading from R58M307HEEN: 712 MB of store, 558 MB of it archive, and the node was
     * running perfectly. The archive is MEANT to grow to MAX_KEEP_BLOCKS (~50 days), and a
     * resync would not shrink it for long - so a big store on a small heap is not a fault.
     */
    @Test public void anArchiveDominatedStoreOnAHealthyNodeIsNotAFault() {
        NodeHealth.Metrics m = new NodeHealth.Metrics(
                22_530, 135 * MB, 712 * MB, 558 * MB, 0, 512 * MB, 90 * MB);
        NodeHealth.Assessment a = NodeHealth.classify(m);
        assertEquals(a.reason, NodeHealth.State.OK, a.state);
    }

    @Test public void aRunawayTxpowTableIsDegradedOnAQuietHeap() {
        NodeHealth.Metrics m = metrics(1_500_000, 950 * MB, 2000 * MB, 512 * MB, 60 * MB);
        assertEquals(NodeHealth.State.DEGRADED, NodeHealth.classify(m).state);
    }

    /**
     * Heap thresholds must be fractions. dalvik.vm.heapgrowthlimit is 256m on two of the
     * three test devices, so the same absolute number cannot serve both.
     */
    @Test public void heapThresholdsScaleWithTheDevicesCap() {
        // 320 MB of a 512 MB heap = 62% -> WATCH, and the store is small.
        assertEquals(NodeHealth.State.WATCH,
                NodeHealth.classify(metrics(100, MB, 20 * MB, 512 * MB, 320 * MB)).state);
        // The same 320 MB on a 256 MB-cap device is impossible; 160 MB of 256 is the same 62%.
        assertEquals(NodeHealth.State.WATCH,
                NodeHealth.classify(metrics(100, MB, 20 * MB, 256 * MB, 160 * MB)).state);
        // And 80% is DEGRADED on both.
        assertEquals(NodeHealth.State.DEGRADED,
                NodeHealth.classify(metrics(100, MB, 20 * MB, 512 * MB, 420 * MB)).state);
        assertEquals(NodeHealth.State.DEGRADED,
                NodeHealth.classify(metrics(100, MB, 20 * MB, 256 * MB, 210 * MB)).state);
    }

    /** The node's own watermark: below max(32MB, max/20) free, it is already aborting work. */
    @Test public void headroomBelowTheNodesOwnWatermarkIsDegraded() {
        NodeHealth.Metrics m = metrics(100, MB, 20 * MB, 512 * MB, 512 * MB - (20 * MB));
        NodeHealth.Assessment a = NodeHealth.classify(m);
        assertEquals(NodeHealth.State.DEGRADED, a.state);
        assertTrue(a.reason, a.reason.contains("heap left"));
    }

    /** A spike must not flip the state, and neither must a single quiet sample. */
    @Test public void aStateOnlyCountsOnceItHasHeld() {
        NodeHealth health = new NodeHealth();
        NodeHealth.Metrics sick = metrics(1_500_000, 950 * MB, 2000 * MB, 512 * MB, 60 * MB);
        NodeHealth.Metrics well = metrics(2050, (long) (10.1 * MB), 29 * MB, 512 * MB, 87 * MB);

        assertEquals(NodeHealth.State.OK, health.update(sick, 0));
        assertEquals("one sample is not a diagnosis", NodeHealth.State.OK, health.update(sick, 60_000));
        assertEquals(NodeHealth.State.DEGRADED, health.update(sick, NodeHealth.DWELL_MILLIS + 1));

        // Recovery has to hold for the same dwell, timed from the first healthy sample.
        long firstHealthy = NodeHealth.DWELL_MILLIS + 60_000;
        assertEquals("recovery needs to hold too",
                NodeHealth.State.DEGRADED, health.update(well, firstHealthy));
        assertEquals("still inside the dwell window",
                NodeHealth.State.DEGRADED, health.update(well, firstHealthy + NodeHealth.DWELL_MILLIS - 1));
        assertEquals(NodeHealth.State.OK, health.update(well, firstHealthy + NodeHealth.DWELL_MILLIS));
    }

    @Test public void aTransientSpikeNeverBecomesTheVerdict() {
        NodeHealth health = new NodeHealth();
        NodeHealth.Metrics well = metrics(2050, 10 * MB, 29 * MB, 512 * MB, 87 * MB);
        NodeHealth.Metrics spike = metrics(2050, 10 * MB, 29 * MB, 512 * MB, 450 * MB);
        health.update(well, 0);
        health.update(spike, 1000);
        health.update(well, 2000);
        assertEquals(NodeHealth.State.OK, health.update(well, NodeHealth.DWELL_MILLIS * 3));
    }

    // --- parsing -------------------------------------------------------------------

    @Test public void parsesTheNodesOwnSizeStrings() {
        assertEquals(512, NodeHealth.bytes("512 bytes"));
        assertEquals(1536, NodeHealth.bytes("1.5 KB"));
        assertEquals((long) (10.1 * MB), NodeHealth.bytes("10.1 MB"));
        assertEquals((long) (1.2 * 1024 * MB), NodeHealth.bytes("1.2 GB"));
    }

    @Test public void nodeSizeFormattingKeepsHealthSignalsInEverySupportedLocale() {
        java.util.Locale original = java.util.Locale.getDefault();
        try {
            for (String tag : new String[]{"en-GB", "zh-Hans-CN", "ru-RU", "uk-UA"}) {
                java.util.Locale.setDefault(java.util.Locale.forLanguageTag(tag));
                JSONObject reply = zfoldStatus();
                JSONObject response = (JSONObject) reply.get("response");
                JSONObject memory = (JSONObject) response.get("memory");
                JSONObject files = (JSONObject) memory.get("files");
                files.put("txpowdb", org.minima.utils.MiniFormat.formatSize(950 * MB));
                files.put("archivedb", org.minima.utils.MiniFormat.formatSize(2 * MB));
                memory.put("disk", org.minima.utils.MiniFormat.formatSize(1024 * MB));
                NodeHealth.Metrics read = NodeHealth.read(reply);
                assertNotNull(read);
                assertEquals(tag, 950 * MB, read.txpowBytes);
                assertEquals(tag, 2 * MB, read.archiveBytes);
                assertEquals(tag, 1024 * MB, read.diskBytes);
                assertEquals(tag, NodeHealth.State.DEGRADED,
                        NodeHealth.classify(metrics(read.txpowRows, read.txpowBytes,
                                read.diskBytes, 512 * MB, 60 * MB)).state);
                for (long value : new long[]{512, 1536, 10 * MB, 1024 * MB}) {
                    assertEquals(tag, value, NodeHealth.bytes(org.minima.utils.MiniFormat.formatSize(value)));
                }
            }
        } finally {
            java.util.Locale.setDefault(original);
        }
    }

    @Test public void acceptsOnlyTheNodesSingleDecimalCommaForm() {
        assertEquals((long) (10.1 * MB), NodeHealth.bytes("10,1 MB"));
        assertEquals(1536, NodeHealth.bytes("1,5 KB"));
        for (String invalid : new String[]{"1,024 MB", "1,024,0 MB", "1.024,0 MB", "1,0.0 MB", "1,5e3 MB", ",5 MB"}) {
            assertEquals(invalid, 0, NodeHealth.bytes(invalid));
        }
    }

    /** An unreadable size must read as "fine", never as a reason to wipe the chain. */
    @Test public void unparseableSizesAreTreatedAsHarmless() {
        assertEquals(0, NodeHealth.bytes(null));
        assertEquals(0, NodeHealth.bytes(""));
        assertEquals(0, NodeHealth.bytes("lots"));
        assertEquals(0, NodeHealth.bytes("10.1 PARSECS"));
        assertEquals(0, NodeHealth.bytes("MB"));
    }

    @Test public void readsARealStatusReply() {
        NodeHealth.Metrics m = NodeHealth.read(zfoldStatus());
        assertNotNull(m);
        assertEquals(2050, m.txpowRows);
        assertEquals((long) (10.1 * MB), m.txpowBytes);
        assertEquals(29 * MB, m.diskBytes);
        assertEquals(1, m.mempool);
        assertTrue(m.heapMax > 0);
    }

    /** A node that did not answer is unknown, not unhealthy - it must never trigger anything. */
    @Test public void anUnusableReplyYieldsNoMetrics() {
        assertNull(NodeHealth.read(null));

        JSONObject failed = new JSONObject();
        failed.put("status", false);
        failed.put("error", "Node is not running");
        assertNull(NodeHealth.read(failed));

        JSONObject empty = new JSONObject();
        empty.put("status", true);
        assertNull(NodeHealth.read(empty));

        JSONObject noMemory = new JSONObject();
        noMemory.put("status", true);
        noMemory.put("response", new JSONObject());
        assertNull(NodeHealth.read(noMemory));
    }

    /** Shaped exactly like `status complete:true` from the zfold on 2026-09-11. */
    private static JSONObject zfoldStatus() {
        JSONObject files = new JSONObject();
        files.put("txpowdb", "10.1 MB");
        files.put("archivedb", "2.3 MB");
        files.put("wallet", "96.0 KB");

        JSONObject memory = new JSONObject();
        memory.put("ram", "87.3 MB");
        memory.put("disk", "29.0 MB");
        memory.put("files", files);

        JSONObject txpow = new JSONObject();
        txpow.put("mempool", 1);
        txpow.put("ramdb", 976);
        txpow.put("txpowdb", 2050);

        JSONObject response = new JSONObject();
        response.put("memory", memory);
        response.put("txpow", txpow);

        JSONObject reply = new JSONObject();
        reply.put("status", true);
        reply.put("response", response);
        return reply;
    }
}
