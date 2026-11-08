package com.eurobuddha.minimacore.utils;

import org.minima.database.MinimaDB;
import org.minima.objects.TxPoW;
import org.minima.system.Main;
import org.minima.utils.json.JSONObject;

public class MinimaCMD {
    private static final java.util.concurrent.Executor READS = BackgroundWork.pool(3, 64);

    public static java.util.concurrent.Executor readExecutor() { return READS; }

    /** Synchronous command body, called only from a background worker. */
    public static JSONObject execute(String command) {
        try {
            Main node = Main.getInstance();
            if (node == null) throw new IllegalStateException("Node is not running");
            if (com.eurobuddha.minimacore.BuildConfig.PANDAMONIUM)
                return com.eurobuddha.minimacore.integrated.EmbeddedNodeTransport.executeCore(command);
            return node.runSingleMinimaCMD(command);
        } catch (Exception exc) {
            return error(exc.getMessage() == null ? exc.toString() : exc.getMessage());
        }
    }

    private static JSONObject error(String message) {
        JSONObject result = new JSONObject();
        result.put("status", false);
        result.put("error", message);
        return result;
    }

    public static void runMinima(String zCommand){
        runMinima(zCommand, new MinimaCMDListener() {
            @Override
            public void cmdResult(JSONObject zResult) {}
        });
    }

    public static void runMinima(String zCommand, MinimaCMDListener zListener){

        Runnable rr = new Runnable() {
            @Override
            public void run() {
                JSONObject res = execute(zCommand);
                //logger.log("Run Minima CMD: "+res.toString());
                zListener.cmdResult(res);
            }
        };

        String command = zCommand == null ? "" : zCommand.trim();
        // Strict read allowlist: long-running writes/resync never occupy the read pool.
        if (command.equals("balance") || command.equals("keys") || command.equals("peers")
                || command.equals("network") || command.equals("coins") || command.startsWith("coins ")) {
            try { READS.execute(rr); }
            catch (java.util.concurrent.RejectedExecutionException e) {
                zListener.cmdResult(error("Node reads are busy. Please retry."));
            }
        } else {
            new Thread(rr, "Minima-command").start();
        }
    }

    public static boolean checkMinimaStarted(){
        if (Main.getInstance() == null) return false;
        //Update the Values..
        MinimaDB mdb = MinimaDB.getDB();
        if(mdb == null){
            return false;
        }

        //Current TxPoW
        var tip = mdb.getTxPoWTree().getTip();
        if(tip == null){
            return false;
        }

        TxPoW txp = tip.getTxPoW();
        if(txp == null){
            return false;
        }

        return true;
    }
}
