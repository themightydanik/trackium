package com.eurobuddha.minimaapi;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Hashtable;
import java.security.SecureRandom;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MinimaAPI {

    public static boolean LOGGING_ENABLED = false;

    /**
     * Minima Receiver will need to check The MinimaID
     *
     * Call this from your Main Minima Receiver
     */
    private static String RECEIVER_MINIMA_ID = "";
    public static boolean checkMinimaID(Context zContext, Intent zIntent){

        if (zIntent == null) return false;

        //Is Minima ID set..
        if(RECEIVER_MINIMA_ID.equals("")){
            SharedPreferences prefs = zContext.getSharedPreferences("minima_api_prefs", zContext.MODE_PRIVATE);
            RECEIVER_MINIMA_ID      = prefs.getString("minima_uid", "");
        }

        //Now get the sent ID - keyed by whichever core sent it
        try {
            String minimaid = zIntent.getStringExtra(MinimaAPIMessages.key(prefixOrBears(zIntent), "REGISTER_MINIMAID"));
            return minimaid != null && !minimaid.isEmpty() && minimaid.equals(RECEIVER_MINIMA_ID);
        } catch (RuntimeException malformedExtras) {
            return false;
        }
    }

    /** The NOTIFY payload of a core's NOTIFY broadcast (bears or official). */
    public static String notifyData(Intent zIntent){
        if (zIntent == null) return null;
        try {
            return zIntent.getStringExtra(MinimaAPIMessages.key(prefixOrBears(zIntent), "NOTIFY_DATA"));
        } catch (RuntimeException malformedExtras) {
            return null;
        }
    }

    /** Listen for NOTIFY from every core (bears and official) - use instead of new IntentFilter(MINIMA_API_NOTIFY). */
    public static IntentFilter notifyFilter(){
        IntentFilter filter = new IntentFilter();
        for (String prefix : MinimaAPIMessages.PREFIXES) filter.addAction(MinimaAPIMessages.key(prefix, "NOTIFY"));
        return filter;
    }

    /** True for any core's NOTIFY action. */
    public static boolean isNotify(String zAction){
        String prefix = MinimaAPIMessages.prefixOfAction(zAction);
        return prefix != null && MinimaAPIMessages.key(prefix, "NOTIFY").equals(zAction);
    }

    /** Launch intent for whichever Minima Core is installed (bears first, then official), or null. */
    public static Intent launchNode(Context zContext){
        for (String[] node : MinimaAPIMessages.NODES) {
            Intent launch = zContext.getPackageManager().getLaunchIntentForPackage(node[0]);
            if (launch != null) return launch;
        }
        return null;
    }

    private static String prefixOrBears(Intent zIntent){
        String prefix = MinimaAPIMessages.prefixOfAction(zIntent.getAction());
        return prefix == null ? MinimaAPIMessages.MINIMA_BASE_CLASS : prefix;
    }

    //Details used by the CMD receiver
    private String mPackage;
    private String MY_APP_ID;
    private static String MINIMA_ID;

    private volatile boolean destroyed;
    // Discover only by REGISTER; commands (including writes) always target ONE pinned node.
    private final android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
    private final java.util.Map<String, JSONObject> registrations = new java.util.LinkedHashMap<>();
    private final java.util.List<Runnable> awaitingNode = new java.util.ArrayList<>();
    private String nodePackage;
    private boolean discovering;
    private boolean ambiguous;
    private int discoveryGeneration;
    public static final String BLOCK_PACKAGE = MinimaAPIMessages.BLOCK_PACKAGE;
    public static final String PANDAMONIUM_PACKAGE = MinimaAPIMessages.PANDAMONIUM_PACKAGE;
    //A core that predates the FILE bridge never answers it - fail the request instead of hanging
    static final long FILE_REPLY_TIMEOUT_MS = 15000;
    Context mContext;

    Hashtable<String, MinimaAPIListener> mResponseHandlers = new Hashtable<>();

    MinimaAPIReceive mMinimaAPIReceiver;

    //Large responses arrive as a content:// URI - read the file OFF the main
    //thread (ResponseReceived runs in a BroadcastReceiver on main)
    ExecutorService mFileExecutor = Executors.newSingleThreadExecutor();

    public MinimaAPI(Context zContext, MinimaAPIListener zRegisterListener){
        mContext = zContext;
        mPackage = zContext.getPackageName();
        if ("com.eurobuddha.pandamonium".equals(mPackage))
            throw new IllegalStateException("Bundled apps must use DirectNodeApi; internal IPC is disabled");

        //Create the 2 IDs
        SharedPreferences prefs = zContext.getSharedPreferences("minima_api_prefs", zContext.MODE_PRIVATE);
        MY_APP_ID = prefs.getString("myapp_uid", "");
        MINIMA_ID = prefs.getString("minima_uid", "");
        if(MY_APP_ID.equals("")){

            //Need to set these..
            MY_APP_ID = getRandomString();
            MINIMA_ID = getRandomString();

            //And store..
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("myapp_uid", MY_APP_ID);
            editor.putString("minima_uid", MINIMA_ID);
            editor.commit();
        }

        //Create a Receiver..
        mMinimaAPIReceiver = new MinimaAPIReceive(this);

        IntentFilter filter = new IntentFilter();
        for (String prefix : MinimaAPIMessages.PREFIXES) {
            filter.addAction(MinimaAPIMessages.key(prefix, "RESPONSE"));
        }

        zContext.registerReceiver(mMinimaAPIReceiver, filter, Context.RECEIVER_EXPORTED);

        //Always send the Resgister broadcast
        Register(zRegisterListener);
    }

    private String getRandomString() {
        //These IDs are the only thing authenticating broadcast replies to our EXPORTED
        //receiver, so they must be unguessable - never java.util.Random here.
        String SALTCHARS = "ABCDEF1234567890";
        StringBuilder salt = new StringBuilder();
        SecureRandom rnd = new SecureRandom();
        while (salt.length() < 32) { // length of the random string.
            salt.append(SALTCHARS.charAt(rnd.nextInt(SALTCHARS.length())));
        }
        return "0x"+salt.toString();
    }

    public void onDestroy(){
        destroyed = true;
        main.removeCallbacksAndMessages(null);
        awaitingNode.clear();
        mResponseHandlers.clear();
        try{
            mContext.unregisterReceiver(mMinimaAPIReceiver);
        }catch(Exception exc){}
        try{
            mFileExecutor.shutdown();
        }catch(Exception exc){}
    }

    public void ResponseReceived(Intent zIntent){
        if (destroyed || zIntent == null) return;
        final String responseid, uristr, result;
        try {
            //Each core keys its reply extras with its own prefix
            String prefix = MinimaAPIMessages.prefixOfAction(zIntent.getAction());
            if (prefix == null || !MinimaAPIMessages.key(prefix, "RESPONSE").equals(zIntent.getAction())) return;
            String minimaid = zIntent.getStringExtra(MinimaAPIMessages.key(prefix, "REGISTER_MINIMAID"));
            if (minimaid == null || minimaid.isEmpty() || !minimaid.equals(MINIMA_ID)) return;
            responseid = zIntent.getStringExtra(MinimaAPIMessages.key(prefix, "RESPONSE_ID"));
            if (responseid == null || responseid.isEmpty() || !mResponseHandlers.containsKey(responseid)) return;
            uristr = zIntent.getStringExtra(MinimaAPIMessages.key(prefix, "RESPONSE_URI"));
            result = zIntent.getStringExtra(MinimaAPIMessages.key(prefix, "RESPONSE_RESULT"));
            if (uristr == null && (result == null || result.isEmpty())) return;
            if (uristr != null && (!"content".equals(Uri.parse(uristr).getScheme())
                    || Uri.parse(uristr).getAuthority() == null)) return;
        } catch (RuntimeException malformedExtras) {
            return;
        }
        if (uristr != null) {
            try {
                mFileExecutor.execute(() -> {
                    if (destroyed) return;
                    String payload;
                    try { payload = readResponseUri(uristr); }
                    catch (Exception exc) {
                        payload = failure("Failed to read large response: " + exc).toString();
                    }
                    deliverResult(responseid, payload);
                });
            } catch (java.util.concurrent.RejectedExecutionException ignored) {
                // Owner was destroyed between validation and scheduling.
            }
        } else {
            deliverResult(responseid, result);
        }
    }

    private static JSONObject failure(String message) {
        JSONObject result = new JSONObject();
        try { result.put("status", false); result.put("error", message); }
        catch (JSONException impossible) { throw new IllegalStateException(impossible); }
        return result;
    }

    private String readResponseUri(String zUriStr) throws Exception {
        InputStream is = mContext.getContentResolver().openInputStream(Uri.parse(zUriStr));
        if (is == null) throw new java.io.IOException("Response file unavailable");
        try{
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buf = new byte[65536];
            int read;
            while((read = is.read(buf)) != -1){
                baos.write(buf, 0, read);
            }
            return new String(baos.toByteArray(), StandardCharsets.UTF_8);
        }finally{
            is.close();
        }
    }

    private void deliverResult(String zResponseID, String zResult){

        if (destroyed || zResponseID == null || zResult == null) return;
        //Convert the Result to a JSON
        JSONObject json;
        try {
            json = new JSONObject(zResult);
        } catch (JSONException e) {
            json = failure("Node returned an invalid JSON response");
        }

        //Find the Listener..
        MinimaAPIListener listener = mResponseHandlers.remove(zResponseID);

        if(MinimaAPI.LOGGING_ENABLED){
            MinimaAPILogger.log("MinimaAPI - RECEIVED respID:"+zResponseID+" resp:"+zResult);
        }

        //Did we find it..
        if(listener == null){
            MinimaAPILogger.log("Received Invalid ResponseID.. not found : "+zResponseID);
        }else{
            // Atomic removal above guarantees one delivery even for duplicate replies.
            if (!destroyed) listener.response(json);
        }
    }

    private String addResponseHandler(Intent zIntent, String zTarget, MinimaAPIListener zListener){

        //Create a random string
        String randomid = getRandomString();

        //Add this to the message
        zIntent.putExtra(MinimaAPIMessages.key(MinimaAPIMessages.prefixOf(zTarget), "RESPONSE_ID"), randomid);

        if(MinimaAPI.LOGGING_ENABLED){
            MinimaAPILogger.log("MinimaAPI - ADD respID:"+randomid);
        }

        //Add to the table..
        mResponseHandlers.put(randomid, zListener);
        return randomid;
    }

    /** An intent for zName (REGISTER, CMD, FILE..) in the dialect of the target core. */
    private Intent getBaseIntent(String zName, String zTarget){
        String prefix = MinimaAPIMessages.prefixOf(zTarget);

        //Create Intent
        Intent intent = new Intent(MinimaAPIMessages.key(prefix, zName));

        //ALWAYS say who you are..
        intent.putExtra(MinimaAPIMessages.key(prefix, "PACKAGE_CLASS"), mPackage);

        //Add the PRIVATE app uid
        intent.putExtra(MinimaAPIMessages.key(prefix, "APP_UID"), MY_APP_ID);

        //Add the PRIVATE Minima uid
        intent.putExtra(MinimaAPIMessages.key(prefix, "REGISTER_MINIMAID"), MINIMA_ID);

        //Set to send ONLY to that Minima Core APK
        intent.setPackage(zTarget);

        return intent;
    }

    private void Register(MinimaAPIListener zListener){
        discovering = true;
        registrations.clear();
        final int generation = ++discoveryGeneration;
        final java.util.List<String> requestIds = new java.util.ArrayList<>();
        for (String[] node : MinimaAPIMessages.NODES) {
            final String target = node[0];
            Intent intent = getBaseIntent("REGISTER", target);
            requestIds.add(addResponseHandler(intent, target, reply -> main.post(() -> {
                if (destroyed || !discovering || generation != discoveryGeneration
                        || !reply.optBoolean("status", false)) return;
                registrations.put(target, reply);
            })));
            mContext.sendBroadcast(intent);
        }
        main.postDelayed(() -> {
            if (destroyed || generation != discoveryGeneration) return;
            for (String id : requestIds) mResponseHandlers.remove(id);
            discovering = false;
            ambiguous = registrations.size() > 1;
            nodePackage = registrations.size() == 1 ? registrations.keySet().iterator().next() : null;
            JSONObject result = nodePackage == null ? routingFailure() : registrations.get(nodePackage);
            java.util.List<Runnable> waiting = new java.util.ArrayList<>(awaitingNode);
            awaitingNode.clear();
            if (zListener != null) zListener.response(result);
            for (Runnable request : waiting) request.run();
        }, 1500);
    }

    private JSONObject routingFailure() {
        return failure(ambiguous
                ? "Multiple Minima Core builds are running. Keep one running and reopen this companion. No command was sent."
                : "No Minima node replied. Start Minima Core (PandaBear, BlackBear, Pandamonium or the official Minima Core) and try again. No command was sent.");
    }

    private void withNode(Runnable request, MinimaAPIListener listener) {
        if (destroyed) return;
        if (nodePackage != null) { request.run(); return; }
        awaitingNode.add(() -> {
            if (nodePackage != null) request.run();
            else if (listener != null) listener.response(routingFailure());
        });
        if (!discovering) Register(null);
    }

    public void Command(String zCommand, MinimaAPIListener zListener){
        main.post(() -> withNode(() -> sendCommand(zCommand, zListener), zListener));
    }

    private void sendCommand(String zCommand, MinimaAPIListener zListener){
        if (destroyed) return;

        String prefix = MinimaAPIMessages.prefixOf(nodePackage);

        //Create the register Intent
        Intent intent = getBaseIntent("CMD", nodePackage);

        //What you expect from Minima responses
        intent.putExtra(MinimaAPIMessages.key(prefix, "CMD_ACTION"), zCommand);

        //We can consume oversized results as a content:// file (old nodes ignore this)
        intent.putExtra(MinimaAPIMessages.key(prefix, "CMD_FILERESP"), true);

        //Create the Reponse UID
        addResponseHandler(intent, nodePackage, zListener);

        //And broadcast
        mContext.sendBroadcast(intent);
    }

    /**
     * File bridge - operate on files inside the node's base folder. ADMIN-gated on the node.
     *
     * @param zAction  list | get | put | mkdir | move | delete
     * @param zPath    path relative to the node's base folder ("/" = root)
     * @param zNewPath move only - the destination path (relative), otherwise null
     * @param zUri     put only - a content:// uri this app has granted the node read on, otherwise null
     */
    public void FileCommand(String zAction, String zPath, String zNewPath, Uri zUri, MinimaAPIListener zListener){
        main.post(() -> withNode(() -> sendFileCommand(zAction, zPath, zNewPath, zUri, zListener), zListener));
    }

    private void sendFileCommand(String zAction, String zPath, String zNewPath, Uri zUri, MinimaAPIListener zListener){
        if (destroyed) return;

        String prefix = MinimaAPIMessages.prefixOf(nodePackage);

        Intent intent = getBaseIntent("FILE", nodePackage);

        intent.putExtra(MinimaAPIMessages.key(prefix, "FILE_ACTION"), zAction);
        intent.putExtra(MinimaAPIMessages.key(prefix, "FILE_PATH"), zPath);

        if(zNewPath != null){
            intent.putExtra(MinimaAPIMessages.key(prefix, "FILE_NEWPATH"), zNewPath);
        }

        if(zUri != null){
            intent.putExtra(MinimaAPIMessages.key(prefix, "FILE_URI"), zUri.toString());

            //Belt and braces - the caller should ALSO grantUriPermission to the node package,
            //but a ClipData grant travels with the Intent on newer Android
            intent.setClipData(android.content.ClipData.newRawUri("minima_file", zUri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }

        //Oversized results (huge directory listings) may come back as a content:// file
        intent.putExtra(MinimaAPIMessages.key(prefix, "CMD_FILERESP"), true);

        final String responseid = addResponseHandler(intent, nodePackage, zListener);

        mContext.sendBroadcast(intent);

        //The bears always answer FILE. Another core may not have the bridge (yet) - never hang the caller.
        if (!MinimaAPIMessages.MINIMA_BASE_CLASS.equals(prefix)) {
            main.postDelayed(() -> {
                MinimaAPIListener waiting = mResponseHandlers.remove(responseid);
                if (waiting != null && !destroyed) {
                    waiting.response(failure("This Minima Core did not answer the file request - it may not support file access."));
                }
            }, FILE_REPLY_TIMEOUT_MS);
        }
    }
}
