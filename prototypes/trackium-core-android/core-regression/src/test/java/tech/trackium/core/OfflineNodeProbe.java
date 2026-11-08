package tech.trackium.core;

import java.net.ServerSocket;
import java.nio.file.Files;
import java.nio.file.Path;
import org.minima.Minima;
import org.minima.database.MinimaDB;
import org.minima.system.Main;
import org.minima.system.params.GeneralParams;

/** Separate disposable JVM: no peers, genesis, automining, RPC or wallet commands. */
public final class OfflineNodeProbe {
    public static void main(String[] args) throws Exception {
        int port;
        try (ServerSocket socket = new ServerSocket(0)) { port = socket.getLocalPort(); }
        new Minima().mainStarter(new String[]{"-data", args[0], "-port", Integer.toString(port),
                "-host", "127.0.0.1", "-nop2p", "-noconnect", "-nosyncibd", "-mobile",
                "-noshutdownhook", "-blockaskeyuses", "-lowram", "-hashtest", "0"});
        long deadline = System.currentTimeMillis() + 90_000;
        Main node;
        while ((node = Main.getInstance()) == null || !node.isStartUpComplete()
                || MinimaDB.getDB().getWallet().getAllKeys().isEmpty()) {
            if (node != null && node.isStartupError()) throw new IllegalStateException("Disposable node startup error");
            if (System.currentTimeMillis() > deadline) throw new IllegalStateException("Disposable node startup deadline");
            Thread.sleep(100);
        }
        var status = node.runSingleMinimaCMD("status");
        if (!Boolean.TRUE.equals(status.get("status")) || !GeneralParams.USE_BLOCK_AS_KEYUSES
                || !GeneralParams.USE_SQL_COINDB || !GeneralParams.USE_SQL_TXBLOCKDB)
            throw new IllegalStateException("Node status/block mode failed");
        // Public key only; never emit seed/private keys or raw startup logs as build artifacts.
        String publicKey = MinimaDB.getDB().getWallet().getAllKeys().get(0).getPublicKey();
        // Unsigned scratch row only: exercise the actual overwrite gate before
        // blob parsing, without signing, mining or broadcasting a transaction.
        String id = "trackium-readonly-import-probe";
        var txns = MinimaDB.getDB().getCustomTxnDB();
        if (txns.getTransactionRow(id) == null) txns.createTransaction(id);
        var existing = txns.getTransactionRow(id);
        var denied = org.minima.system.commands.CommandRunner.getRunner()
                .runMultiCommand("0x01", "txnimport id:" + id + " data:0x00");
        if (denied.isEmpty() || !denied.toString().contains("ADMIN") || txns.getTransactionRow(id) != existing)
            throw new IllegalStateException("Non-ADMIN import must not overwrite a transaction row");
        Files.writeString(Path.of(args[1]), publicKey);
        node.shutdown();
        if (Main.getInstance() != null) throw new IllegalStateException("Node did not complete shutdown");
        System.out.println("TRACKIUM_OFFLINE_NODE_READY_AND_STOPPED");
        System.exit(0);
    }
}
