package com.eurobuddha.minimacore.utils;

import android.app.Activity;
import android.widget.Toast;

import org.minima.utils.json.JSONObject;

/**
 * Truthful feedback about what the node actually did.
 *
 * Exists because getting this right by hand at each call site does not work: commands
 * report failure under DIFFERENT keys - `send` uses "message" (send.java:369,378 -
 * "Insufficient funds.. you only have X require:Y"), while the command framework's own
 * catch path uses "error". Reading only one of them turns a precise, actionable node
 * message into a shrug. Every call site should go through errorOf().
 */
public class Feedback {

    private Feedback(){}

    /** Toast from any thread - MinimaCMD callbacks arrive on a bare worker thread. */
    public static void toast(Activity zActivity, String zMessage){
        if(zActivity == null || zActivity.isFinishing() || zActivity.isDestroyed()){
            return;
        }
        zActivity.runOnUiThread(() -> Toast.makeText(zActivity, zMessage, Toast.LENGTH_SHORT).show());
    }

    public static void longToast(Activity zActivity, String zMessage){
        if(zActivity == null || zActivity.isFinishing() || zActivity.isDestroyed()){
            return;
        }
        zActivity.runOnUiThread(() -> Toast.makeText(zActivity, zMessage, Toast.LENGTH_LONG).show());
    }

    /** True when the node accepted the command. */
    public static boolean ok(JSONObject zReply){
        return zReply != null && Boolean.TRUE.equals(zReply.get("status"));
    }

    /**
     * Why the command failed, or null when it succeeded.
     *
     * Checks "message" and "error" - see the class note. Never returns an empty string,
     * so a caller can always show what it gets back.
     */
    public static String errorOf(JSONObject zReply){
        if(zReply == null){
            return "no reply from the node";
        }
        if(ok(zReply)){
            return null;
        }

        String msg = str(zReply.get("message"));
        if(msg != null){
            return msg;
        }

        msg = str(zReply.get("error"));
        if(msg != null){
            return msg;
        }

        return "the node rejected the command";
    }

    /**
     * The txpowid of a transaction the node just built, or null.
     *
     * NOTE: having one means the transaction was CREATED and posted - it does not mean it
     * is on chain. It still has to be mined and land in a block, which is why nothing here
     * ever says "sent" on the strength of a command reply alone.
     */
    public static String txpowIdOf(JSONObject zReply){
        try{
            Object resp = zReply.get("response");
            if(resp instanceof JSONObject){
                return str(((JSONObject) resp).get("txpowid"));
            }
        }catch(Exception exc){}
        return null;
    }

    private static String str(Object zValue){
        if(zValue == null){
            return null;
        }
        String s = String.valueOf(zValue).trim();
        return (s.isEmpty() || "null".equals(s)) ? null : s;
    }
}
