package com.eurobuddha.minimacore.service;

import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import com.eurobuddha.minimacore.BuildConfig;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.BatteryManager;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;

import org.minima.Minima;
import org.minima.database.MinimaDB;
import org.minima.objects.TxPoW;
import org.minima.system.Main;
import org.minima.system.network.webhooks.NotifyManager;
import org.minima.system.params.ParamConfigurer;
import org.minima.utils.MinimaLogger;
import org.minima.utils.MinimaUncaughtException;
import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;
import org.minima.utils.messages.Message;
import org.minima.utils.messages.MessageListener;
import com.eurobuddha.minimaapi.MinimaAPIMessages;
import com.eurobuddha.minimacore.main.MainActivity;
import com.eurobuddha.minimacore.main.ParamsActivity;
import com.eurobuddha.minimacore.main.ResyncLauncher;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.receiver.MinimaReceiver;
import com.eurobuddha.minimacore.receiver.ReceiverDB;
import com.eurobuddha.minimacore.utils.LogBuffer;
import com.eurobuddha.minimacore.utils.logger;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;
import java.util.StringTokenizer;

/** Foreground Service for the Minima Node
 *
 *  Elias Nemr
 *
 * 23 April 2020
 * */
public class MinimaService extends Service {

    public static SimpleDateFormat DATEFORMAT       = new SimpleDateFormat("HH:mm:ss dd/MM/yyyy", Locale.ENGLISH);
    public static SimpleDateFormat DATEFORMAT_TIME  = new SimpleDateFormat("HH:mm:ss", Locale.ENGLISH);

    public static volatile boolean mHaveStartedShutdown = false;
    // Restart is safe only AFTER onDestroy releases the old node, receiver and locks.
    private static volatile boolean mShutdownComplete = true;
    public static boolean isShutdownComplete() { return mShutdownComplete; }

    //Currently Binding doesn't work as we run in a separate process..
    public class MyBinder extends Binder {
        public MinimaService getService() {
            return mService;
        }
    }
    private IBinder mBinder = new MyBinder();
    MinimaService mService;
    private boolean serviceDestroyed;
    private boolean foregroundActive;
    private final Runnable languageChanged = this::refreshLanguageNotification;

    public MinimaServiceListener mServiceListener = null;

    //The alarm to ensure Minima doesn't stop
    static boolean mCancelAlarmOnShutdown = false;
    Alarm mAlarm;

    //The Battery receiver
    BroadcastReceiver mBatteryReceiver;
    android.net.ConnectivityManager.NetworkCallback mNetCallback;
    BroadcastReceiver mScreenReceiver;

    //Minima Main Starter
    public static Minima minima;

    //keets sidecar as a bare-kit worklet (phone dialable by Noise pubkey)
    private final com.eurobuddha.minimacore.keets.KeetsWorklet mKeetsWorklet =
            new com.eurobuddha.minimacore.keets.KeetsWorklet();

    //Used to update the Notification
    Handler mHandler;

    NotificationManager mNotificationManager;
    Notification mNotification;

    //Information for the Notification
    JSONObject mTxPowJSON = null;

    public static final String CHANNEL_ID = "MinimaServiceChannel";

    NodeWake mNodeWake;

    //So we start with a seed
    String mSeed = null;

    //Receiver listening for Broadcast Messages
    private MinimaReceiver mMinimaReceiver;

    @Override
    public void onCreate() {
        super.onCreate();
        mShutdownComplete = false;

        logger.log("Minima Service Starting..");

        if(mSeed != null){
            MinimaLogger.log("onCreate Service seed provided : "+mSeed);
        }

        mServiceListener = null;

        //Catch ALL Uncaught Exceptions..
        Thread.setDefaultUncaughtExceptionHandler(new MinimaUncaughtException());

        //Have not started shutdown
        mHaveStartedShutdown    = false;
        mCancelAlarmOnShutdown  = false;

        //A (re)started node is a fresh sample: do not let a verdict from before a resync linger
        //through its dwell and re-trigger. NodeHealth.reset() had no caller before this.
        NodeHealthMonitor.health().reset();

        //Power: the CPU wakelock follows the battery policy (NodeWake), it is no longer permanent.
        //No WifiLock: WIFI_MODE_FULL is a no-op on current Android (AOSP WifiManager) and the
        //foreground service already keeps network access through Doze.
        BatteryPolicy.load(this);
        mNodeWake = new NodeWake(this);
        mNodeWake.start();

        //Start Minima
        minima = new Minima();

        mHandler = new Handler(Looper.getMainLooper());

        // Create our notification channel here & add channel to Manager's list
        mNotificationManager = getSystemService(NotificationManager.class);
        NotificationChannel serviceChannel = mNotificationManager.getNotificationChannel(CHANNEL_ID);
        if (serviceChannel == null) serviceChannel = new NotificationChannel(CHANNEL_ID,
                Language.text(this, l10n_notification_node), NotificationManager.IMPORTANCE_LOW);
        serviceChannel.setName(Language.text(this, l10n_notification_node));
        mNotificationManager.createNotificationChannel(serviceChannel);

        //Set the Alarm..
        mAlarm = new Alarm();
        mAlarm.cancelAlarm(this);
        mAlarm.setAlarm(this);

        //Store this
        mService = this;

        //Add a Minima listener..
        Main.setMinimaListener(new MessageListener() {
            @Override
            public void processMessage(Message zMessage) throws Exception {

                if(zMessage.getMessageType().equals(NotifyManager.NOTIFY_POST)){
                    //Get the JSON..
                    JSONObject notify = (JSONObject) zMessage.getObject("notify");

                    //What is the Event..
                    String event    = (String) notify.get("event");
                    JSONObject data = (JSONObject) notify.get("data");

                    // Capture locally before companion delivery: a broken recipient must
                    // not hide progress from the resync page or Logs tab.
                    if ("MINIMALOG".equals(event)) LogBuffer.append((String) data.get("message"));

                    JSONObject broadmessage = new JSONObject();
                    broadmessage.put("event",event);
                    broadmessage.put("data",data);

                    //MINIMALOG is one broadcast per log line per app - thousands during a resync.
                    //Only the terminal apps consume it and they are ADMIN anyway (they run write
                    //commands), so it goes to ADMIN apps only; every wallet app stops being woken
                    //for a stream it discards.
                    //ponytail: gated on admin rather than a per-app "logs" flag; add the flag if an
                    //admin app that does not want logs ever becomes a problem.
                    sendBroadcastNotify(broadmessage, event.equals("MINIMALOG"));

                    if(event.equals("MINING")) {
                        mNodeWake.mining(Boolean.TRUE.equals(data.get("mining")));
                    }else if(event.equals("NEWBLOCK")) {

                        //Get the TxPoW
                        mTxPowJSON = (JSONObject) data.get("txpow");

                        //The node's own heartbeat is the health check's schedule. AlarmManager
                        //is not: setInexactRepeating is subject to Doze and OEM battery
                        //management, and on a Z Fold 7 it had not fired ONCE six minutes after
                        //start, so a device could go hours with no check at all. A block
                        //arrives roughly every 50s while the node is running, and
                        //NodeHealthMonitor debounces to its own interval, so almost every call
                        //here returns immediately.
                        NodeHealthMonitor.checkAsync(MinimaService.this);

                        //Show a notification
                        mHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                //Set status Bar notification
                                setMinimaNotification();
                            }
                        });

                        if(mServiceListener != null){
                            mServiceListener.MinimaNewBlock();
                        }

                    }else if(event.equals("NEWBALANCE")){

                        //Notify the User
                        createNotification(Language.text(MinimaService.this, l10n_core_balance_changed));

                        //..and tell the UI, so the wallet can refresh and confirm in-app.
                        //This is the real "it landed" signal - a send command reply only
                        //means the transaction was built and posted, not mined.
                        if(mServiceListener != null){
                            mServiceListener.MinimaNewBalance();
                        }

                    }else if(event.equals("SHUTDOWN")){

                        MinimaLogger.log("SERVICE Received SHUTDOWN!");

                        if(!haveStartedShutdown()){
                            stopSelf();
                        }else{
                            MinimaLogger.log("SERVICE allready SHUTDOWN");
                        }

                    }else if(event.equals("LOAD_ALL_KEYS_START")){
                        //MinimaLogger.log("SERVICE received "+event, false);

                    }else if(event.equals("LOAD_ALL_KEYS_FINISH")){

                        //The wallet provably has its keys now, so the cleartext copy of the seed
                        //phrase in prefs has done its one job. The node only reads -seed when it
                        //is CREATING a wallet (Wallet.java returns early when a seed row exists),
                        //so keeping it here was a permanent second copy with weaker protection.
                        SharedPreferences sp = getSharedPreferences("main_prefs", MODE_PRIVATE);
                        if(!sp.getString("SEED","").isEmpty()){
                            sp.edit().putString("SEED","").apply();
                            MinimaLogger.log("Seed phrase cleared from preferences - wallet holds it now");
                        }

                        if(mServiceListener != null) {
                            mServiceListener.MinimaLoadKeys((int) data.get("keys"), true);
                        }
                    }else if(event.equals("LOAD_ALL_KEYS_VALUE")){
                        //MinimaLogger.log("SERVICE received "+event+" "+data.toString(), false);

                        if(mServiceListener != null) {
                            mServiceListener.MinimaLoadKeys((int)data.get("keys"), false);
                        }
                    }
                }
            }
        });

        //Start her up..
        SharedPreferences pref  = getSharedPreferences("main_prefs",MODE_PRIVATE);

        ArrayList<String> vars = new ArrayList<>();

        vars.add("-daemon");

        vars.add("-data");
        vars.add(getFilesDir().getAbsolutePath());

        vars.add("-basefolder");
        vars.add(getFilesDir().getAbsolutePath());

        vars.add("-port");
        vars.add(String.valueOf(BuildConfig.NODE_PORT));

        //Server or client - user-set toggle (ParamsActivity). Exactly ONE of the pair is
        //passed: -server and -isclient both write IS_ACCEPTING_IN_LINKS and the winner
        //would otherwise depend on param-map iteration order.
        if(pref.getBoolean("PARAM_SERVER", false)){
            vars.add("-server");
        }else{
            vars.add("-isclient");
        }
        vars.add("-mobile");
        vars.add("-limitbandwidth");

        vars.add("-allowallip");

        //keets: the worklet (not the node) runs the sidecar, but the node must still
        //know the transport exists — the `keets` command refuses without -keets, which
        //starved the chat drainer (proven on the Fold 2026-10-13). KeetsManager with no
        //-keetssidecar path spawns nothing, and its MDS poller is gated off.
        if (com.eurobuddha.minimacore.main.StartupMode.keetsEnabled(pref)) {
            vars.add("-keets");
        }

        // Pandamonium can opt into classic mode; other flavors retain their fixed policy.
        // Minima.main resets GeneralParams before applying these arguments on every restart.
        com.eurobuddha.minimacore.main.StartupMode.addArguments(vars,
                com.eurobuddha.minimacore.main.StartupMode.usesBlockKeys(pref));

        //User-set toggles (ParamsActivity)
        if(pref.getBoolean("PARAM_MEGAMMR", false)){
            vars.add("-megammr");
        }
        if(pref.getBoolean("PARAM_RPC", false)){
            vars.add("-rpcenable");
            //Never RPC without auth: HTTPServer binds every interface and CMDHandler only checks
            //credentials when a password is set, so a bare -rpcenable is unauthenticated command
            //execution for anything that can reach the port.
            vars.add("-rpcpassword");
            vars.add(ParamsActivity.ensureRpcPassword(pref));
        }

        //TESTER HACK
        //vars.add("-clean");
        //vars.add("-solo");

        vars.add("-nosyncibd");

        vars.add("-noshutdownhook");

        //Add the seed
        vars.add("-anyseed");
        String seed = pref.getString("SEED","");
        vars.add("-seed");
        vars.add(seed);

        //EXTRA params
        String prefstring       = pref.getString("minima_extra_params","");

        //Remove the wipe flags.. and USE the stripped string this boot too (previously the
        //original string was tokenized, so a -clean slipped through on the boot it was set)
        //(and the flags the Keets transport switch owns - a stored -keets would override "off")
        String newprefs = com.eurobuddha.minimacore.main.StartupMode.withoutKeetsSwitchFlags(prefstring
                .replaceAll("-clean","")
                .replaceAll("-genesis","")
                .replaceAll("-solo",""))
                .trim().replaceAll("\\s+"," ");
        if (BuildConfig.PANDAMONIUM) {
            newprefs = com.eurobuddha.minimacore.main.StartupMode.withoutManagedArguments(newprefs);
        }
        SharedPreferences.Editor edit = pref.edit();
        edit.putString("minima_extra_params",newprefs);
        edit.apply();

        //Check if Valid!
        boolean validparams = ParamConfigurer.checkParams(newprefs);

        if(validparams) {
            if (!newprefs.equals("")) {
                StringTokenizer strtok = new StringTokenizer(newprefs, " ");
                while (strtok.hasMoreTokens()) {
                    String param = strtok.nextToken();
                    vars.add(param);
                }
            }
        }else{

            //Notify User service is now running!
            Toast.makeText(this, Language.msg(l10n_core_extra_params_error), Toast.LENGTH_LONG).show();
        }

        //Another Minima node already on our port? Say so - without this the losing node just
        //dies with a bind error the user never sees. Informational only: the start proceeds
        //(the other node may be shutting down). Probe the port THIS node will actually bind -
        //the flavour's NODE_PORT (PandaBear 13001, BlackBear 21001, Pandamonium 25001), overridden
        //by a -port in extra params (last wins) - so a bear never warns about another bear's
        //node. Last-wins matches core: ParamConfigurer's -port handler sets
        //GeneralParams.MINIMA_PORT once per -port arg in parse order, so the last -port wins -
        //same order as vars here. Checked off the main thread - even a localhost connect is network I/O.
        int effectivePort = BuildConfig.NODE_PORT;
        for (int i = 0; i + 1 < vars.size(); i++)
            if ("-port".equals(vars.get(i))) {
                try { effectivePort = Integer.parseInt(vars.get(i + 1)); } catch (NumberFormatException ignore) {}
            }
        final int nodePort = effectivePort;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try (java.net.Socket s = new java.net.Socket()) {
                    s.connect(new java.net.InetSocketAddress("127.0.0.1", nodePort), 400);
                    new android.os.Handler(android.os.Looper.getMainLooper()).post(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(MinimaService.this,
                                Language.msg(l10n_core_node_port_busy, String.valueOf(nodePort)), Toast.LENGTH_LONG).show();
                        }
                    });
                } catch (java.io.IOException free) {
                    //Port free - the normal case
                }
                //Sequence startup after the probe; otherwise it can detect our own node.
                new Handler(Looper.getMainLooper()).post(() -> {
                    if (!serviceDestroyed && !mHaveStartedShutdown) {
                        //A staged chat backup lands before the node, the keets worklet or
                        //MaxChat read the identities it replaces.
                        com.eurobuddha.minimacore.main.backup.ChatBackup.applyPending(MinimaService.this);
                        minima.mainStarter(vars.toArray(new String[0]));

                        //keets: phone dialable by pubkey over HyperDHT. Started after the
                        //node so GeneralParams and the per-boot token exist; delayed so the
                        //NIO server is listening before the first bridged stream arrives.
                        SharedPreferences kp = getSharedPreferences("main_prefs", MODE_PRIVATE);
                        boolean keetsOn = com.eurobuddha.minimacore.main.StartupMode.keetsEnabled(kp);
                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            if (!serviceDestroyed && !mHaveStartedShutdown) {
                                //The ONE "Chat messages" channel serves keets AND Parlons
                                //notifications, so it must exist even with keets disabled.
                                com.eurobuddha.minimacore.chat.ChatDrainer.createChannel(MinimaService.this);
                                if (keetsOn) {
                                    mKeetsWorklet.start(MinimaService.this);
                                    TrafficLog.start();
                                    //Chat: the ONE drainer of the keets message inbox
                                    com.eurobuddha.minimacore.chat.ChatDrainer.start(MinimaService.this);
                                    //Parlons contacts in the same Chat tab: the app's own Maxima
                                    //client. Transport-independent, but the owner's call (2.2.0):
                                    //keets off = no Chat tab at all, so its relay sockets stop too.
                                    com.eurobuddha.minimacore.maxchat.MaxChat.start(MinimaService.this);
                                }
                            }
                        }, 15000);
                    }
                });
            }
        }, "minima-port-check").start();

        //Notify User service is now running!
        Toast.makeText(this, Language.msg(l10n_core_service_started), Toast.LENGTH_SHORT).show();

        //Listen to Battery Events
        addBatteryListener();

        //And the broadcast receiver
        mMinimaReceiver = new MinimaReceiver(minima, this);

        IntentFilter filter = new IntentFilter();
        filter.addAction(MinimaAPIMessages.MINIMA_API_REGISTER);
        filter.addAction(MinimaAPIMessages.MINIMA_API_CMD);
        filter.addAction(MinimaAPIMessages.MINIMA_API_FILE);

        registerReceiver(mMinimaReceiver, filter, Context.RECEIVER_EXPORTED);
    }

    public Minima getMinima(){
        return minima;
    }

    public ReceiverDB getReceiverDatabase(){
        return mMinimaReceiver.getDatabase();
    }

    public void sendBroadcastNotify(JSONObject message, boolean zAdminOnly){
        if (BuildConfig.PANDA_SHELL) com.eurobuddha.minimacore.integrated.EmbeddedNodeTransport.publish(message);
        if (mMinimaReceiver == null) return; // node can emit logs during startup
        JSONArray apps = mMinimaReceiver.getDatabase().selectAllApps();

        String zMessage = null; // Encode only if an external client actually consumes it.
        int tot=apps.size();
        for(int i=0;i<tot;i++){

            //Get the App
            JSONObject app = (JSONObject) apps.get(i);

            if((int)app.get("penabled") == 1 && (!zAdminOnly || (int)app.get("admin") == 1)){
                //Get the package
                String packageclass = app.getString("package");
                if (BuildConfig.PANDAMONIUM && getPackageName().equals(packageclass)) continue;
                String minimaid     = app.getString("minimaid");

                try {
                    if (zMessage == null) zMessage = message.toString();
                    mMinimaReceiver.sendNotify(this, packageclass, minimaid, zMessage);
                } catch (Exception exc) {
                    logger.log("Companion notification failed for " + packageclass + " : " + exc);
                }
            }
        }
    }

    public void setTopBlock(){
        try{
            //Get the Tip
            TxPoW tip =  MinimaDB.getDB().getTxPoWTree().getTip().getTxPoW();

            //Set it..
            mTxPowJSON = tip.toJSON();

            //Show a notification
            mHandler.post(new Runnable() {
                @Override
                public void run() {
                    //Set status Bar notification
                    setMinimaNotification();
                }
            });

        }catch(Exception exc){
            //MinimaLogger.log(exc);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {

        //Set status Bar notification
        setMinimaNotification();

        //Check whether the node's database has grown to the point where it needs a
        //resync. Cheap, off-thread, and a no-op until the node is actually up.
        NodeHealthMonitor.checkAsync(this);

        return START_STICKY;
    }

    private PendingIntent createDefaultPending(){
        //What to start
        PendingIntent pending =  null;
        Intent NotificationIntent = new Intent(getBaseContext(), MainActivity.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            pending = PendingIntent.getActivity(getBaseContext(), 0
                    , NotificationIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }else {
            pending = PendingIntent.getActivity(getBaseContext(), 0
                    , NotificationIntent, PendingIntent.FLAG_UPDATE_CURRENT);
        }


        return pending;
    }

    public Notification createNotification(String zText){
        mNotification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(zText)
                .setContentText(Language.text(this, l10n_core_notice_status))
                .setSilent(true)
                .setSmallIcon(R.drawable.ic_minima)
                .setContentIntent(createDefaultPending())
                .build();

        return mNotification;
    }

    public void cancelNotification(String zMiniDAPPUID){
        mNotificationManager.cancel(zMiniDAPPUID,2);
    }

    /** Render cached block evidence; a language change must not query or restart the node. */
    private String nodeStatusText() {
        if (mTxPowJSON == null) return Language.text(this, l10n_startup_starting);
        JSONObject header = (JSONObject) mTxPowJSON.get("header");
        String block = header.getString("block");
        long timestamp = Long.parseLong(header.getString("timemilli"));
        return block + " @ " + Language.date(timestamp, "yMdHms");
    }

    private void setMinimaNotification(){
        if (serviceDestroyed) return;
        startForeground(1, createNotification(nodeStatusText()));
        foregroundActive = true;
        Language.addListener(languageChanged);
    }

    @Override public void onConfigurationChanged(android.content.res.Configuration config) {
        super.onConfigurationChanged(config);
        Language.configurationChanged(this);
        refreshLanguageNotification();
    }

    private void refreshLanguageNotification() {
        if (!foregroundActive || serviceDestroyed || mNotificationManager == null) return;
        try {
            com.eurobuddha.minimacore.i18n.NotificationLabels.update(this);
            mNotificationManager.notify(1, createNotification(nodeStatusText()));
        } catch (RuntimeException unavailable) {
            // Keep the existing foreground notification if Android refuses the update.
        }
    }

    public void stopMinimaService(){
        stopSelf();
    }

    public static boolean haveStartedShutdown(){
        return mHaveStartedShutdown;
    }

    public static void cancelAlarm(){
        mCancelAlarmOnShutdown = true;
    }

    @Override
    public void onDestroy() {
        serviceDestroyed = true;
        foregroundActive = false;
        Language.removeListener(languageChanged);
        super.onDestroy();

        //Have started shutdown
        mHaveStartedShutdown = true;
        logger.log("Minima Service onDestroy start");

        //Stop the keets worklet before the node quits
        com.eurobuddha.minimacore.chat.ChatDrainer.stop();
        com.eurobuddha.minimacore.maxchat.MaxChat.stop();
        TrafficLog.stop();
        mKeetsWorklet.terminate();

        //QUIT nicely..
        try{
            String resp = minima.runMinimaCMD("quit compact:true");;

            //Do we cancel the alarm
            if(mCancelAlarmOnShutdown){
                MinimaLogger.log("SERVICE Cancel Restart Alarm");
                mAlarm.cancelAlarm(this);
            }

        }catch(Exception exc){
            MinimaLogger.log(exc);
        }

        //Unregister receiver
        try{
            unregisterReceiver(mMinimaReceiver);
        }catch(Exception exc){}

        //Close the database - null if onCreate failed before it was built; crashing here would
        //only mask the error that actually stopped the service
        if(mMinimaReceiver != null){
            mMinimaReceiver.onDestroy();
        }

        //Not listening anymore..
        Main.setMinimaListener(null);

        // Remove this notification while retaining the user's channel settings.
        if (mNotificationManager != null) mNotificationManager.cancel(1);

        //Mention..
        Toast.makeText(this, Language.text(this, l10n_core_stopped), Toast.LENGTH_SHORT).show();

        //Release the wakelocks..
        if(mNodeWake != null) mNodeWake.stop();

        if(mScreenReceiver != null){
            try { unregisterReceiver(mScreenReceiver); } catch (Exception ignored) { }
        }

        //Remove the receiver
        if(mBatteryReceiver != null){
            unregisterReceiver(mBatteryReceiver);
        }
        if(mNetCallback != null){
            try { getSystemService(android.net.ConnectivityManager.class).unregisterNetworkCallback(mNetCallback); }
            catch (Exception ignored) { }
        }

        logger.log("Minima Service onDestroy finish");
        if(mServiceListener != null){
            mServiceListener.MinimaServiceShutdown();
        }

        //NULL the main Instance..
        Main.ClearMainInstance();
        mShutdownComplete = true;

        //An automatic resync has nobody to tap Restart - bring the node back ourselves.
        ResyncLauncher.afterShutdown(getApplicationContext());
    }

    @Override
    public IBinder onBind(Intent intent) {
        return mBinder;
    }

    public static boolean isPlugged(Context context) {
        boolean isPlugged= false;
        Intent intent = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        int plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1);
        isPlugged = plugged == BatteryManager.BATTERY_PLUGGED_AC || plugged == BatteryManager.BATTERY_PLUGGED_USB || plugged == BatteryManager.BATTERY_PLUGGED_WIRELESS;

        return isPlugged;
    }

    public void addBatteryListener(){
        //Listen for Battery Events..
        mBatteryReceiver = new BroadcastReceiver() {
            public void onReceive(Context context, Intent intent) {
                int plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1);
                if (plugged >= 0) BatteryPolicy.setPlugged(plugged != 0);

                //Make sure has started up..
                if(getMinima().getMain() == null){
                    return;
                }

                //What Happened..
                if (    plugged == BatteryManager.BATTERY_PLUGGED_AC ||
                        plugged == BatteryManager.BATTERY_PLUGGED_WIRELESS ||
                        plugged == BatteryManager.BATTERY_PLUGGED_DOCK ||
                        plugged == BatteryManager.BATTERY_PLUGGED_USB) {
                    // on AC power
                    //MinimaLogger.log("BATTERY PLUGGED IN");

                    //Set PoW to regular
                    getMinima().getMain().setNormalAutoMineSpeed();

                } else if (plugged == 0) {

                    // on battery power
                    //MinimaLogger.log("BATTERY NOT PLUGGED IN");

                    //Set PoW to regular
                    getMinima().getMain().setLowPowAutoMineSpeed();


                } else {
                    // intent didnt include extra info
                    MinimaLogger.log("BATTERY PLUGGED INFO "+plugged);
                }
            }
        };
        //Screen on/off paces optional work (chat polling, keets) via BatteryPolicy.
        mScreenReceiver = new BroadcastReceiver() {
            public void onReceive(Context context, Intent intent) {
                BatteryPolicy.setScreenOn(Intent.ACTION_SCREEN_ON.equals(intent.getAction()));
            }
        };
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        BatteryPolicy.setScreenOn(pm == null || pm.isInteractive());
        IntentFilter screen = new IntentFilter(Intent.ACTION_SCREEN_ON);
        screen.addAction(Intent.ACTION_SCREEN_OFF);
        registerReceiver(mScreenReceiver, screen);

        //Wi-Fi vs mobile data drives the "DHT relay on Wi-Fi or when plugged in" choice.
        android.net.ConnectivityManager cm = getSystemService(android.net.ConnectivityManager.class);
        mNetCallback = new android.net.ConnectivityManager.NetworkCallback() {
            @Override public void onCapabilitiesChanged(android.net.Network n, android.net.NetworkCapabilities c) {
                BatteryPolicy.setWifi(c.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI)
                        || c.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET));
            }
            @Override public void onLost(android.net.Network n) { BatteryPolicy.setWifi(false); }
        };
        try { cm.registerDefaultNetworkCallback(mNetCallback); }
        catch (Exception exc) { MinimaLogger.log("ERROR adding network listener : " + exc); mNetCallback = null; }

        IntentFilter filter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);

        //Seen an error here
        try{
            registerReceiver(mBatteryReceiver, filter);
        }catch(Exception exc){
            MinimaLogger.log("ERROR adding Battery listener..");
            getMinima().getMain().setLowPowAutoMineSpeed();
        }
    }
}
