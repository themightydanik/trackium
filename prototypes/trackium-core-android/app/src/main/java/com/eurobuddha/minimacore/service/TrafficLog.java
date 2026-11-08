package com.eurobuddha.minimacore.service;

import com.eurobuddha.minimacore.utils.logger;

import org.minima.system.network.keets.KeetsManager;
import org.minima.system.params.GeneralParams;

/**
 * Every 10 minutes logs where the app's network traffic goes (battery diagnosis, 2026-10-26):
 * the whole app's cumulative packets/bytes from TrafficStats, and the keets sidecar's exact
 * UDP counters per DHT node from its loopback /info. The Parlons relay sockets carry the
 * traffic tag 0x4D41 (netstats reports them apart); the Minima node is the remainder.
 * One line, "[TRAFFIC] ...", read with logcat.
 */
public final class TrafficLog {

    private static final long PERIOD_MS = 10 * 60_000;
    private static Thread sThread;

    private TrafficLog() {
    }

    public static synchronized void start() {
        if (sThread != null) return;
        sThread = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try { Thread.sleep(PERIOD_MS); } catch (InterruptedException e) { return; }
                try { logger.log(line()); } catch (Throwable t) { logger.log("[TRAFFIC] failed: " + t); }
            }
        }, "traffic-log");
        sThread.setDaemon(true);
        sThread.start();
    }

    public static synchronized void stop() {
        if (sThread != null) { sThread.interrupt(); sThread = null; }
    }

    static String line() {
        int uid = android.os.Process.myUid();
        StringBuilder sb = new StringBuilder("[TRAFFIC] app rxp=").append(android.net.TrafficStats.getUidRxPackets(uid))
                .append(" txp=").append(android.net.TrafficStats.getUidTxPackets(uid))
                .append(" rxb=").append(android.net.TrafficStats.getUidRxBytes(uid))
                .append(" txb=").append(android.net.TrafficStats.getUidTxBytes(uid));
        sb.append(" | keets ").append(keetsTraffic());
        return sb.toString();
    }

    private static String keetsTraffic() {
        java.net.HttpURLConnection c = null;
        try {
            c = (java.net.HttpURLConnection) new java.net.URL(
                    "http://127.0.0.1:" + (GeneralParams.MINIMA_PORT + 5) + "/info").openConnection();
            c.setRequestProperty("x-keets-token", KeetsManager.getTokenHex());
            c.setConnectTimeout(5000);
            c.setReadTimeout(5000);
            try (java.io.InputStream in = c.getInputStream()) {
                String body = new String(readAll(in), java.nio.charset.StandardCharsets.UTF_8);
                org.json.JSONObject dht = new org.json.JSONObject(body).optJSONObject("dht");
                if (dht == null) return "n/a";
                return "mode=" + dht.optString("mode") + " routing=" + dht.optBoolean("routing")
                        + " traffic=" + dht.optJSONObject("traffic")
                        + " diag=" + dht.optJSONObject("diag");
            }
        } catch (Exception e) {
            return "unavailable (" + e.getClass().getSimpleName() + ")";
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static byte[] readAll(java.io.InputStream in) throws java.io.IOException {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
        return out.toByteArray();
    }
}
