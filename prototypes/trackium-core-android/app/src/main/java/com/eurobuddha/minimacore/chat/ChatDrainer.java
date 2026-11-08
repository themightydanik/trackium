package com.eurobuddha.minimacore.chat;

import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationCompat;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.service.MinimaService;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.logger;

import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;

import java.util.Base64;

/**
 * The ONE drainer of this node's keets message inbox (`keets action:inbox`). Every
 * message is stored to ChatDb FIRST, acked after, then fanned out:
 *  - a HIGH-importance notification (tap opens the chat thread),
 *  - a {"event":"KEETS"} NOTIFY broadcast to enabled companion APKs (the Android
 *    equivalent of the MDS KEETS event — companions store their own copy, never ack),
 *  - the in-app UI listener (ChatView refresh).
 * The node's own MDS-event poller is gated off on this line (no MDS), so inbox
 * messages wait here until this drainer runs — nothing is lost while the app is off:
 * offline messages additionally sit at the keets fleet mailboxes.
 *
 * Known, accepted half-mirror (reverse of the Parlons no-mirror rule): this app
 * stores EVERY inbound keets message, including from contacts the user "owns" in
 * the Parlons app — so those threads show inbound-only here. A chat lives in the
 * app where the user added the contact; this app is the node and keeps the
 * durable copy regardless.
 */
public class ChatDrainer {

    /** KeetChat channel: the "keet" cheep (res/raw/keet.wav). Android freezes a channel's
     *  sound after creation, so a sound change always means a new id; superseded ids are
     *  deleted in createChannel. */
    public static final String CHANNEL_ID = "KeetChatChannel_v1";
    /** Parlons channel (MaxChatNotifier): the Parlons pssst (res/raw/pssst.wav). */
    public static final String PARLONS_CHANNEL_ID = "MinimaChatChannel_v2";
    private static final String CHANNEL_ID_V1 = "MinimaChatChannel";
    private static final long POLL_MS = 1500;   // loopback node command; the sidecar pushes, we must not lag it
    static final long POLL_SCREEN_OFF_MS = 30_000;
    static final long POLL_IDLE_MS = 5 * 60_000;
    static final long SCREEN_OFF_FAST_MS = 60_000;      // first minute after screen-off stays instant
    static final long SCREEN_OFF_MEDIUM_MS = 10 * 60_000;

    /** Wakes the poll loop early when the battery policy changes (screen on, profile switch). */
    private static final Object WAKE = new Object();
    private static final com.eurobuddha.minimacore.service.BatteryPolicy.Listener POLICY = () -> {
        synchronized (WAKE) { WAKE.notifyAll(); }
    };

    /**
     * How long to wait before the next inbox poll. The sidecar stores pushed mail in its inbox
     * at once, so a longer poll only delays the NOTIFICATION, never loses a message.
     * Instant, or the app/screen in use: 1.5 s (the owner's 1-2 s delivery). Balanced with the
     * screen off: 1.5 s for the first minute, 30 s until 10 min, then 5 min. Saver: 30 s with the
     * screen on but the app in the background, 5 min with the screen off.
     */
    static long nextPollMs(com.eurobuddha.minimacore.service.BatteryPolicy.Profile zProfile,
                           boolean zAppVisible, boolean zScreenOn, long zScreenOffMs) {
        if (zProfile == com.eurobuddha.minimacore.service.BatteryPolicy.Profile.INSTANT || zAppVisible) return POLL_MS;
        if (zProfile == com.eurobuddha.minimacore.service.BatteryPolicy.Profile.SAVER)
            return zScreenOn ? POLL_SCREEN_OFF_MS : POLL_IDLE_MS;
        if (zScreenOn || zScreenOffMs < SCREEN_OFF_FAST_MS) return POLL_MS;
        return zScreenOffMs < SCREEN_OFF_MEDIUM_MS ? POLL_SCREEN_OFF_MS : POLL_IDLE_MS;
    }

    private static boolean waitNextPoll() {
        long ms = nextPollMs(com.eurobuddha.minimacore.service.BatteryPolicy.effective(),
                com.eurobuddha.minimacore.service.BatteryPolicy.appVisible(),
                com.eurobuddha.minimacore.service.BatteryPolicy.screenOn(),
                com.eurobuddha.minimacore.service.BatteryPolicy.screenOffMillis());
        try {
            synchronized (WAKE) { WAKE.wait(ms); }
            return true;
        } catch (InterruptedException e) {
            return false;
        }
    }

    /** UI refresh hooks — ChatView / ChatThreadActivity register while alive; run on a
     *  background thread, so listeners post to main themselves. */
    public static final java.util.concurrent.CopyOnWriteArraySet<Runnable> UI_LISTENERS =
            new java.util.concurrent.CopyOnWriteArraySet<>();

    private static java.lang.Thread mThread = null;
    private static volatile boolean mStop = false;
    private static String mLastErr = null;
    //payaddr auto-responder guard: a peer gets one address reply per 10 minutes
    private static final java.util.HashMap<String, Long> mPayAddrReplied = new java.util.HashMap<>();
    /** Receipts dial the peer (up to the sidecar's 15 s dial timeout) - never on the drainer
     *  thread, or a slow peer would delay the notification for the message we just stored. */
    private static final java.util.concurrent.ExecutorService RECEIPTS =
            java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
                java.lang.Thread t = new java.lang.Thread(r, "keets-chat-receipts");
                t.setDaemon(true);
                return t;
            });

    public static synchronized void start(MinimaService zService) {
        if (mThread != null) return;
        mStop = false;

        createChannel(zService);

        com.eurobuddha.minimacore.service.BatteryPolicy.addListener(POLICY);
        mThread = new java.lang.Thread(() -> runLoop(zService), "keets-chat-drainer");
        mThread.setDaemon(true);
        mThread.start();
    }

    /** The two chat channels: KeetChat (keet cheep) and Parlons (pssst) - two channels because a
     *  channel has exactly one sound. Both HIGH, vibrate, badge. Sound URIs are NAME-based
     *  because a numeric resource id is only stable within one build and the channel keeps
     *  the URI forever. Logs the permission/channel state once so a logcat can answer
     *  "why no notification" without a debug build. */
    public static void createChannel(Context zCtx) {
        NotificationManager nm = (NotificationManager) zCtx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        ensureChannel(zCtx, nm, CHANNEL_ID, l10n_notification_chat, l10n_notification_chat_help, "keet");
        ensureChannel(zCtx, nm, PARLONS_CHANNEL_ID, l10n_notification_parlons, l10n_notification_parlons_help, "pssst");
        try { nm.deleteNotificationChannel(CHANNEL_ID_V1); } catch (Exception ignored) {}
        NotificationChannel now = nm.getNotificationChannel(CHANNEL_ID);
        logger.log("[CHAT] notifications enabled=" + nm.areNotificationsEnabled()
                + " channel importance=" + (now == null ? "none" : now.getImportance())
                + " sound=" + (now == null ? "none" : now.getSound()));
    }

    private static void ensureChannel(Context zCtx, NotificationManager zNm, String zId, int zName, int zHelp, String zRawSound) {
        NotificationChannel ch = zNm.getNotificationChannel(zId);
        if (ch != null) {
            //labels follow the selected language; sound/importance stay the user's
            ch.setName(Language.text(zCtx, zName));
            ch.setDescription(Language.text(zCtx, zHelp));
            zNm.createNotificationChannel(ch);
            return;
        }
        ch = new NotificationChannel(zId, Language.text(zCtx, zName), NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription(Language.text(zCtx, zHelp));
        ch.enableVibration(true);
        ch.setShowBadge(true);
        ch.setSound(android.net.Uri.parse("android.resource://" + zCtx.getPackageName() + "/raw/" + zRawSound),
                new android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
        zNm.createNotificationChannel(ch);
    }

    public static synchronized void stop() {
        ChatFileDelivery.close();
        mStop = true;
        com.eurobuddha.minimacore.service.BatteryPolicy.removeListener(POLICY);
        if (mThread != null) { mThread.interrupt(); mThread = null; }
    }

    private static void runLoop(MinimaService zService) {
        ChatDb db = ChatDb.get(zService);
        ChatFileDelivery.get(zService);
        while (!mStop) {
            if (!waitNextPoll()) break;
            if (!MinimaCMD.checkMinimaStarted()) continue;
            try {
                JSONObject res = MinimaCMD.execute("keets action:inbox");
                if (!(Boolean) res.getOrDefault("status", false)) {
                    //sidecar starting is normal — but log a CHANGED error so a wedged
                    //command path is never silent (the 401 token bug cost a device test)
                    String err = "" + res.get("error");
                    if (!err.equals(mLastErr)) { mLastErr = err; logger.log("[CHAT] inbox unavailable: " + err); }
                    continue;
                }
                mLastErr = null;
                JSONArray inbox = (JSONArray) res.get("response");
                int fresh = 0;
                boolean allOnScreen = true;   // every fresh message is from the thread being read
                java.util.ArrayList<String> toAck = new java.util.ArrayList<>();   // stored messages, acked AFTER notify
                String lastFrom = null, lastName = null, lastBody = null;
                for (Object o : inbox) {
                    JSONObject msg = (JSONObject) o;
                    String from = (String) msg.get("from");
                    String raw;
                    try { raw = new String(Base64.getDecoder().decode((String) msg.get("payload")), "UTF-8"); }
                    catch (Exception e) { raw = "" + msg.get("message"); }
                    ChatSchema.Decoded d = ChatSchema.decode(raw);

                    // File controls retain transport-authenticated sender and fan out to Parlons.
                    if (d.state.equals("file-control")) {
                        ChatFileDelivery.get(zService).inbound(from,d.body);
                        fanout(zService,msg,d,from);
                        MinimaCMD.execute("keets action:ack id:" + msg.get("id"));
                        continue;
                    }
                    //Control messages: consumed, never stored or notified
                    if (d.state.equals("read")) {
                        //prefer the referenced message's own timestamp (peer clocks drift)
                        long upto = d.ts != 0 ? d.ts : System.currentTimeMillis();
                        if (!d.ref.equals("")) {
                            long t = db.messageTs(d.ref);
                            if (t != 0) upto = t;
                        }
                        db.markPeerRead(from, upto);
                        fanout(zService, msg, d, from);
                        MinimaCMD.execute("keets action:ack id:" + msg.get("id"));
                        for (Runnable l : UI_LISTENERS) { try { l.run(); } catch (Exception e) {} }
                        continue;
                    }
                    if (d.state.equals("delivered")) {
                        //the peer stored our message: single tick -> double tick (2.0.35+)
                        if (!d.ref.equals("")) db.setVia(d.ref, "delivered");
                        MinimaCMD.execute("keets action:ack id:" + msg.get("id"));
                        for (Runnable l : UI_LISTENERS) { try { l.run(); } catch (Exception e) {} }
                        continue;
                    }
                    if (d.state.equals("payaddr")) {
                        //contacts only: a control message must never create a contact,
                        //or any stranger can plant a payee row with their address
                        if (db.hasContact(from) && d.addr.matches("(0x|Mx)[0-9A-Za-z]+")) {
                            db.setContactPayAddr(from, d.addr);
                            fanout(zService, msg, d, from);
                        }
                        MinimaCMD.execute("keets action:ack id:" + msg.get("id"));
                        for (Runnable l : UI_LISTENERS) { try { l.run(); } catch (Exception e) {} }
                        continue;
                    }
                    if (d.state.equals("payaddr-req")) {
                        MinimaCMD.execute("keets action:ack id:" + msg.get("id"));
                        //contacts only: answering strangers links the chat identity to the wallet
                        //(control messages never create contacts, so a cold caller gets nothing)
                        Long last = mPayAddrReplied.get(from);
                        if (db.hasContact(from) && (last == null || System.currentTimeMillis() - last > 10 * 60 * 1000)) {
                            mPayAddrReplied.put(from, System.currentTimeMillis());
                            JSONObject ga = MinimaCMD.execute("getaddress");
                            if ((Boolean) ga.getOrDefault("status", false)) {
                                String myaddr = (String) ((JSONObject) ga.get("response")).get("miniaddress");
                                org.minima.utils.json.JSONObject reply = ChatSchema.base("", "", "");
                                reply.put("state", "payaddr");
                                reply.put("addr", myaddr);
                                MinimaCMD.execute("keets action:send to:" + from +
                                        " datahex:" + ChatSchema.toDataHex(reply.toString()));
                            }
                        }
                        continue;
                    }

                    //Unknown states: a future control type must never become a
                    //garbage chat row (the keetchat 0.2.1 lesson) - ack + consume
                    if (!d.state.equals("") && !d.state.equals("image")
                            && !d.state.equals("audio") && !d.state.equals("payment") && !d.state.equals("file")) {
                        MinimaCMD.execute("keets action:ack id:" + msg.get("id"));
                        continue;
                    }

                    if(d.state.equals("file")) {
                        try {
                            com.eurobuddha.maxima.core.chat.ChatFile file=com.eurobuddha.maxima.core.chat.ChatFile.parse(d.ref);
                            com.eurobuddha.maxima.files.KeetsFiles.validate(file);
                            d.body=file.name;
                        }catch(Exception invalid){MinimaCMD.execute("keets action:ack id:"+msg.get("id"));continue;}
                    }

                    ChatDb.Msg m = new ChatDb.Msg();
                    m.msgid = d.id != null ? d.id : (String) msg.get("id");
                    m.pubkey = from;
                    m.incoming = true;
                    m.body = d.body;
                    m.name = d.name;
                    m.ref = d.ref;
                    m.ts = d.ts != 0 ? d.ts : envTs(msg);
                    m.via = (String) msg.get("via");
                    m.state = d.state; m.amt = d.amt; m.tokname = d.tokname; m.txid = d.txid;
                    boolean isNew = db.addMessage(m);
                    if (isNew) {
                        db.ensureContact(from, d.name);
                        sendDelivered(from, m.msgid);
                        fresh++;
                        if (!from.equals(ChatThreadActivity.sForegroundPubkey)) allOnScreen = false;
                        lastFrom = from;
                        lastName = db.contactName(from);
                        lastBody = d.state.equals("image") ? Language.text(zService, l10n_media_photo)
                                 : d.state.equals("audio") ? Language.text(zService, l10n_media_voice)
                                 : d.state.equals("payment") ? "💸 " + d.amt + " " + (d.tokname.equals("") ? "Minima" : d.tokname)
                                 : d.body;

                        // companion fan-out — the Android twin of the MDS KEETS event
                        fanout(zService, msg, d, from);
                    }
                    // ack ONLY after the durable store write - and only after the user has
                    // been told (below): node commands serialise behind the receipt dial,
                    // and a stored-but-unacked message simply dedupes on the next poll.
                    toAck.add("" + msg.get("id"));
                }
                if (fresh > 0) {
                    //a message landing in the conversation you are looking at stays silent
                    if (!allOnScreen) notifyUser(zService, fresh, lastFrom, lastName, lastBody);
                    for (Runnable l : UI_LISTENERS) { try { l.run(); } catch (Exception e) {} }
                }
                for (String id : toAck) MinimaCMD.execute("keets action:ack id:" + id);
            } catch (Exception exc) {
                logger.log("[CHAT] drainer: " + exc);
            }
        }
    }

    /** The envelope ts, or now when absent/garbled — a bad peer timestamp must
     *  never abort the drain batch (the message would sit unacked and redeliver,
     *  blocking everything behind it). */
    private static long envTs(JSONObject zMsg) {
        try { return Long.parseLong("" + zMsg.get("ts")); }
        catch (Exception e) { return System.currentTimeMillis(); }
    }

    /** Companion fan-out — the Android twin of the MDS KEETS event. Real messages
     *  AND the read/payaddr controls go out (a companion chat app needs ticks and
     *  pay addresses); payaddr-req stays node-answered only, or two apps would
     *  both reply. Controls are forwarded, never stored. */
    private static void fanout(MinimaService zService, JSONObject zMsg, ChatSchema.Decoded zD, String zFrom) {
        try {
            JSONObject ev = new JSONObject();
            ev.put("event", "KEETS");
            JSONObject data = new JSONObject();
            data.put("id", zD.id != null ? zD.id : (String) zMsg.get("id"));
            data.put("from", zFrom);
            data.put("ts", zD.ts != 0 ? zD.ts : envTs(zMsg));
            data.put("payload", zMsg.get("payload"));
            data.put("message", zD.body);
            data.put("name", zD.name);
            data.put("ref", zD.ref);
            data.put("state", zD.state);
            data.put("via", zMsg.get("via"));
            ev.put("data", data);
            zService.sendBroadcastNotify(ev, false);
        } catch (Exception e) { /* fan-out must never break the drain */ }
    }

    /** Tell the sender we stored their message (their single tick becomes a double tick).
     *  Fire-and-forget: a failed receipt only leaves their tick single. */
    private static void sendDelivered(String zTo, String zMsgId) {
        RECEIPTS.execute(() -> {
            try {
                org.minima.utils.json.JSONObject r = ChatSchema.base("", "", "");
                r.put("state", "delivered");
                r.put("ref", zMsgId);
                JSONObject res = MinimaCMD.execute("keets action:send to:" + zTo + " datahex:" + ChatSchema.toDataHex(r.toString()));
                logger.log("[CHAT] delivered receipt for " + zMsgId + " -> " + zTo + " via "
                        + ((Boolean) res.getOrDefault("status", false) ? ((JSONObject) res.get("response")).get("delivered") : "FAILED " + res.get("error")));
            } catch (Exception e) {
                logger.log("[CHAT] delivered receipt: " + e);
            }
        });
    }

    private static void notifyUser(MinimaService zService, int zFresh, String zFrom, String zName, String zBody) {
        try {
            Pssst.ensureAudible(zService);
            Intent it = new Intent(zService, ChatThreadActivity.class);
            it.putExtra("pubkey", zFrom);
            it.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(zService, 3, it,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Notification n = new NotificationCompat.Builder(zService, CHANNEL_ID)
                    .setContentTitle(zFresh > 1 ? Language.join("KeetChat — ", Language.count(
                            com.eurobuddha.minimacore.i18n.R.plurals.l10n_chat_new_messages, zFresh)) : zName)
                    .setContentText(zFresh > 1 ? Language.msg(l10n_chat_tap_open) : zBody)
                    .setSmallIcon(R.drawable.ic_minima)
                    .setAutoCancel(true)
                    .setContentIntent(pi)
                    .build();
            NotificationManager nm = (NotificationManager) zService.getSystemService(Context.NOTIFICATION_SERVICE);
            nm.notify("keetchat", 3, n);
            logger.log("[CHAT] notify posted from=" + zFrom + " fresh=" + zFresh);
        } catch (Exception exc) {
            logger.log("[CHAT] notify: " + exc);
        }
    }
}
