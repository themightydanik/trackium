package com.eurobuddha.minimacore.integrated;

import android.content.Context;
import android.net.Uri;
import org.json.JSONObject;
import org.minima.system.Main;
import org.minima.system.commands.CommandRunner;
import com.eurobuddha.minimaapi.direct.DirectNodeApi;
import com.eurobuddha.minimaapi.direct.DirectNodeEvents;
import com.eurobuddha.minimaapi.direct.LocalJson;
import com.eurobuddha.minimacore.receiver.MinimaReceiver;
import com.eurobuddha.minimacore.service.MinimaService;
import com.eurobuddha.minimacore.utils.BackgroundWork;
import com.eurobuddha.minimacore.utils.SharedRequests;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.atomic.AtomicLong;

/** Shared embedded-node execution. The external bridge uses the same mutation queue. */
public final class EmbeddedNodeTransport implements DirectNodeApi.Backend {
    private static final ThreadPoolExecutor COMMANDS = BackgroundWork.pool(1, 128);
    private static final ThreadPoolExecutor READS = BackgroundWork.pool(2, 64);
    private static final AtomicLong revision = new AtomicLong();
    private static final ThreadLocal<Boolean> executing = new ThreadLocal<>();
    private final Context context;
    private final SharedRequests<ReadKey,JSONObject> sharedReads = new SharedRequests<>(READS, Runnable::run);
    private static final class ReadKey {
        final Main node;
        final long epoch;
        final String command;
        ReadKey(Main node, long epoch, String command) { this.node=node; this.epoch=epoch; this.command=command; }
        @Override public int hashCode() { return java.util.Objects.hash(System.identityHashCode(node),epoch,command); }
        @Override public boolean equals(Object value) {
            if (!(value instanceof ReadKey)) return false;
            ReadKey other=(ReadKey)value;
            return node==other.node && epoch==other.epoch && command.equals(other.command);
        }
    }
    public EmbeddedNodeTransport(Context context) { this.context = context.getApplicationContext(); }
    public static ThreadPoolExecutor commandExecutor() { return COMMANDS; }
    public static void invalidateReads() { revision.incrementAndGet(); }
    public static boolean sharedRead(String command) {
        // Never deduplicate getaddress, signing, batches or coin selection.
        return "status".equals(command) || "balance".equals(command) || "block".equals(command)
                || "network".equals(command) || "peers".equals(command);
    }
    public static boolean canExecute(Main node) {
        return node != null && node == Main.getInstance() && node.isStartUpComplete()
                && !node.isStartupError() && !MinimaService.haveStartedShutdown();
    }
    @Override public boolean ready() { return canExecute(Main.getInstance()); }
    @Override public void command(String command, DirectNodeApi.Request reply) {
        if (command == null || command.trim().isEmpty()) { reply.accept(LocalJson.failure("Empty node command. Nothing was sent.")); return; }
        final Main node = Main.getInstance();
        if (sharedRead(command)) {
            ReadKey key = new ReadKey(node, revision.get(), command);
            if (!sharedReads.request(key, () -> run(node, command), reply))
                reply.accept(LocalJson.failure("Node reads are busy. Nothing was sent."));
        } else {
            invalidateReads();
            try { COMMANDS.execute(() -> { if (reply.begin()) reply.accept(run(node, command)); }); }
            catch (java.util.concurrent.RejectedExecutionException busy) { reply.accept(LocalJson.failure("Node command queue is full. Nothing was sent.")); }
        }
    }
    private JSONObject run(Main expected, String command) {
        if (!canExecute(expected)) return LocalJson.failure("The node stopped or restarted before execution. Nothing was sent.");
        executing.set(true);
        try {
            // Same runner/admin identity as Minima.runMinimaCMD, before text encoding.
            org.minima.utils.json.JSONArray rows = CommandRunner.getRunner().runMultiCommand("0x00", command);
            if (rows.size() == 1) return (JSONObject) LocalJson.copy(rows.get(0));
            JSONObject result = new JSONObject();
            boolean success = !rows.isEmpty();
            for (Object row : rows) success &= Boolean.TRUE.equals(((org.minima.utils.json.JSONObject)row).get("status"));
            result.put("status", success); result.put("response", LocalJson.copy(rows));
            return result;
        } catch (Exception failure) { return LocalJson.failure("Node execution did not return a complete result. Outcome remains unknown."); }
        finally { executing.remove(); if (!sharedRead(command)) invalidateReads(); }
    }
    @Override public void file(String action, String path, String newPath, Uri source, DirectNodeApi.Request reply) {
        final Main node = Main.getInstance();
        invalidateReads();
        try { COMMANDS.execute(() -> {
            if (!reply.begin()) return;
            if (!canExecute(node)) { reply.accept(LocalJson.failure("The node stopped before the file action. Nothing was changed.")); return; }
            try { reply.accept((JSONObject)LocalJson.copy(MinimaReceiver.runLocalFileAction(context, action, path, newPath, source))); }
            catch (Exception error) { reply.accept(LocalJson.failure("File action failed: " + error.getMessage())); }
            finally { invalidateReads(); }
        }); } catch (java.util.concurrent.RejectedExecutionException busy) { reply.accept(LocalJson.failure("Node file queue is full. Nothing was changed.")); }
    }
    /** Existing core UI mutations use the same queue as integrated/external clients. */
    /** keets commands are HTTP calls to the sidecar - they touch no node database, and a
     *  receipt dial can take seconds, so they must never hold the command queue (2.0.38). */
    public static boolean sidecarCall(String command) {
        return command != null && (command.equals("keets") || command.startsWith("keets "));
    }
    public static org.minima.utils.json.JSONObject executeCore(String command) throws Exception {
        Main node = Main.getInstance();
        if (sharedRead(command) || sidecarCall(command) || Boolean.TRUE.equals(executing.get())) return node.runSingleMinimaCMD(command);
        invalidateReads();
        return COMMANDS.submit(() -> {
            if (!canExecute(node)) throw new IllegalStateException("Node stopped before execution");
            executing.set(true);
            try { return node.runSingleMinimaCMD(command); }
            finally { executing.remove(); if (!sharedRead(command)) invalidateReads(); }
        }).get();
    }
    public static void publish(org.minima.utils.json.JSONObject message) {
        JSONObject event = (JSONObject) LocalJson.copy(message);
        if ("NEWBLOCK".equals(event.optString("event")) || "NEWBALANCE".equals(event.optString("event"))) invalidateReads();
        DirectNodeEvents.publish(event);
    }
}
