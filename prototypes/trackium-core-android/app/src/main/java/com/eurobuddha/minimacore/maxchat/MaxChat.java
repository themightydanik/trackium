package com.eurobuddha.minimacore.maxchat;

import android.content.Context;
import android.content.SharedPreferences;

import com.eurobuddha.maxima.core.MaximaNode;
import com.eurobuddha.maxima.core.chat.ChatEngine;
import com.eurobuddha.maxima.core.codec.MiniData;
import com.eurobuddha.maxima.core.contacts.Contact;
import com.eurobuddha.maxima.core.crypto.Hashes;
import com.eurobuddha.maxima.core.identity.MaximaIdentity;
import com.eurobuddha.maxima.core.store.FileStore;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Parlons contacts in the Chat tab: this app as its own Maxima client.
 *
 * The embedded node fork has NO Maxima (keets replaced it), and Parlons' IPC
 * surface is another app's door - so, exactly like mininotes, this app carries
 * the clean-room transport core itself (vendored under maxima-core/) and IS a
 * Maxima node: its own RSA identity, attached to the family relays, chatting
 * maxima_chat_v1 with any Parlons user. ChatEngine brings the whole dialect -
 * receipts, the resend ladder, payments - so a Parlons peer sees a first-class
 * citizen, not a half-speaker.
 *
 * Add a contact by their MAX#... permanent address or a live Mx...@host:port.
 * This identity is SEPARATE from the node's keets key and from any Parlons app
 * on the same phone: the chat lives in the app where the contact was added.
 */
public final class MaxChat {

    /** What this build calls itself on the wire. */
    private static final String VERSION = "minimacore";
    /** Relays held at once - one is a single point of failure. */
    private static final int RELAYS = 2;
    private static final int START_TIMEOUT_MS = 30000;
    /** maintain() cadence: keep-alives are due every 2 min, relays drop at 10 quiet min. */
    private static final int BEAT_SECONDS = 60;

    private static volatile MaximaNode sNode;
    private static volatile ChatEngine sChat;
    private static volatile com.eurobuddha.maxima.core.media.MediaService sMedia;
    private static ScheduledExecutorService sKeeper;
    private static volatile boolean sStarting;
    /** Bumped by stop(); the start thread refuses to publish into a newer epoch. */
    private static volatile int sEpoch;

    /** UI refresh hooks, called on arbitrary threads after chat activity. */
    public static final List<Runnable> UI_LISTENERS = new CopyOnWriteArrayList<>();

    public static final List<MaximaNode.MessageListener> APPLICATION_LISTENERS = new CopyOnWriteArrayList<>();

    private MaxChat() {
    }

    /** The engine, or null while the transport is still coming up. */
    public static ChatEngine chat() {
        return sChat;
    }

    /** The node, or null while starting. */
    public static MaximaNode node() {
        return sNode;
    }

    /** The media mesh service, or null while starting. */
    public static com.eurobuddha.maxima.core.media.MediaService media() {
        return sMedia;
    }

    /** Android traffic tag for the Parlons relay sockets ("MA"), so netstats reports them apart. */
    public static final int TRAFFIC_TAG = 0x4D41;

    /**
     * Boot the transport off the caller's thread. Safe to call repeatedly -
     * one node per process. The engine exists (and loads history) before the
     * network is up, so the Chat tab can render immediately.
     */
    public static synchronized void start(Context zCtx) {
        com.eurobuddha.maxima.core.net.HostConnection.BEFORE_CONNECT =
                () -> android.net.TrafficStats.setThreadStatsTag(TRAFFIC_TAG);
        com.eurobuddha.maxima.core.net.HostConnection.AFTER_CONNECT =
                android.net.TrafficStats::clearThreadStatsTag;
        if (sNode != null || sStarting) {
            return;
        }
        sStarting = true;
        final int epoch = sEpoch;
        final Context app = zCtx.getApplicationContext();
        new Thread(() -> {
            try {
                Hashes.setSha3(Sha3::of);
                MaximaNode node = new MaximaNode(identity(app), VERSION, RELAYS);
                node.setStore(new FileStore(new File(app.getFilesDir(), "maxchat/node")));
                // The name Parlons peers see - the same one the keets chat shows.
                String myName = app.getSharedPreferences("main_prefs", Context.MODE_PRIVATE)
                        .getString("chat_name", "");
                if (!myName.isEmpty()) {
                    node.setName(myName);
                }

                // photos/voice notes: the Parlons media mesh (bounded local shelf;
                // the peer's relays hold replicas while this phone sleeps)
                com.eurobuddha.maxima.core.store.BlobStore blobs =
                        new com.eurobuddha.maxima.core.store.BlobStore(
                                new File(app.getFilesDir(), "maxchat/media"),
                                256L * 1024 * 1024);
                com.eurobuddha.maxima.core.media.MediaService media =
                        new com.eurobuddha.maxima.core.media.MediaService(node, blobs);
                node.setLocalBlobs(blobs);

                ChatEngine chat = new ChatEngine(node);
                chat.setMediaService(media);
                chat.setStoreAsync(FileStore.coalescing(
                        new File(app.getFilesDir(), "maxchat/chat"), 2000), () -> fire());
                chat.setSendReadReceipts(readReceipts(app));
                chat.setListener(new ChatEngine.Listener() {
                    public void onMessage(ChatEngine.Entry e) {
                        if (!e.mine) {
                            MaxChatNotifier.onInbound(app, node, e);
                        }
                        fire();
                    }

                    public void onStateChanged(ChatEngine.Entry e) {
                        fire();
                    }

                    public void onGroupChanged(com.eurobuddha.maxima.core.chat.Group g) {
                        fire();
                    }
                });
                node.setMessageListener((msg, msgid) -> dispatch(node, epoch, chat, msg, msgid));
                node.setEventListener(new MaximaNode.EventListener() {
                    @Override public void onContactsChanged(Contact contact, boolean removed) {
                        if (epoch == sEpoch && sNode == node) fire();
                    }
                    @Override public void onHostsChanged(String hostPort, boolean connected) {
                        if (epoch == sEpoch && sNode == node) fire();
                    }
                });
                // The core's own diagnostics (attach failures, MLS lookups, resends):
                // on a phone with no console this is the only window into them.
                node.setLogListener(l -> android.util.Log.i("MaxChat", l));
                synchronized (MaxChat.class) {
                    if (epoch != sEpoch) {
                        // stop() ran while we were building - this node is an orphan.
                        node.stop();
                        return;
                    }
                    sChat = chat;
                    sNode = node;
                    sMedia = media;
                }

                // The pool only dials hosts it is handed (an empty floor attaches to
                // nothing - mininotes feeds relays per-round instead). Hand it the
                // compiled-in family relays.
                int attached = node.start(
                        com.eurobuddha.maxima.core.session.SeedRelays.compose(
                                null, null, true, null), START_TIMEOUT_MS);
                android.util.Log.i("MaxChat", "up: " + attached + " relay(s), identity "
                        + node.publicKeyHex());
                fire();

                synchronized (MaxChat.class) {
                    if (epoch != sEpoch) {
                        // stop() ran during the (up to 30s) relay attach.
                        node.stop();
                        return;
                    }
                    ScheduledExecutorService keeper =
                            Executors.newSingleThreadScheduledExecutor(r -> {
                        Thread t = new Thread(r, "maxchat-upkeep");
                        t.setDaemon(true);
                        return t;
                    });
                    keeper.scheduleWithFixedDelay(MaxChat::beat, BEAT_SECONDS, BEAT_SECONDS,
                            TimeUnit.SECONDS);
                    sKeeper = keeper;
                }
            } catch (Throwable t) {
                android.util.Log.w("MaxChat", "start failed: " + t);
            } finally {
                sStarting = false;
            }
        }, "maxchat-start").start();
    }

    /** Deliver on the core's ordered background lane without replacing normal chat. */
    static void dispatch(MaximaNode node, int epoch, ChatEngine chat,
            com.eurobuddha.maxima.core.msg.MaximaMessage msg, MiniData msgid) {
        if (epoch != sEpoch || sNode != node) return;
        try { chat.onInbound(msg, msgid == null ? "" : msgid.to0xString()); }
        finally {
            for (MaximaNode.MessageListener listener : APPLICATION_LISTENERS) {
                try { listener.onMessage(msg, msgid); }
                catch (Exception failure) { android.util.Log.w("MaxChat", "Application message intake failed"); }
            }
        }
    }

    /** One upkeep round: keep-alives, relay health, address refresh. */
    private static void beat() {
        MaximaNode node = sNode;
        if (node == null) {
            return;
        }
        try {
            node.maintain(START_TIMEOUT_MS);
            if (sNode == node) fire();
        } catch (Throwable t) {
            android.util.Log.w("MaxChat", "upkeep: " + t.getClass().getSimpleName());
        }
    }

    public static synchronized void stop() {
        sEpoch++;
        if (sKeeper != null) {
            sKeeper.shutdownNow();
            sKeeper = null;
        }
        MaximaNode node = sNode;
        sNode = null;
        sChat = null;
        sMedia = null;
        fire();
        if (node != null) {
            new Thread(node::stop, "maxchat-stop").start();
        }
    }

    /**
     * Add a Parlons contact: a MAX#... permanent address or a live
     * Mx...@host:port. Blocking (resolves + dials) - never on the main thread.
     * The contact appears via the transport's own exchange, named by the peer.
     */
    public static void addContact(String zAddress) throws Exception {
        MaximaNode node = sNode;
        if (node == null) {
            throw new IllegalStateException("Parlons transport still starting - try again in a moment");
        }
        String addr = zAddress.trim();
        if (addr.regionMatches(true, 0, "MAX#", 0, 4)) {
            addr = node.resolvePermanent(addr);
        }
        // The FULL address, always - a truncated identifier in a log is a defect (RULE 1).
        android.util.Log.i("MaxChat", "introduce -> " + addr);
        try {
            node.introduce(addr, true);
            android.util.Log.i("MaxChat", "introduce sent ok");
        } catch (Exception e) {
            android.util.Log.w("MaxChat", "introduce failed: " + e);
            throw e;
        }
    }

    /** Clear a conversation but KEEP the contact (it stays in the new-chat picker).
     *  This is "Delete chat" for a Parlons row; {@link #removeContact} is the
     *  explicit "Delete contact". Blocking - off the main thread. */
    public static void clearConversation(String zPubkey) throws Exception {
        ChatEngine chat = sChat;
        if (chat == null) {
            throw new IllegalStateException("Parlons transport not running");
        }
        chat.clearConversation(zPubkey);
        fire();
    }

    /** Remove a Parlons contact and its conversation (notifies the peer).
     *  Blocking - off the main thread. */
    public static void removeContact(String zPubkey) throws Exception {
        MaximaNode node = sNode;
        ChatEngine chat = sChat;
        if (node == null || chat == null) {
            throw new IllegalStateException("Parlons transport not running");
        }
        chat.clearConversation(zPubkey);
        node.removeContact(zPubkey);
        fire();
    }

    /** Our permanent MAX# address ("" until a relay with a directory holds us). */
    public static String permanentAddress() {
        MaximaNode node = sNode;
        return node == null ? "" : node.permanentAddress();
    }

    /** Our live Mx...@host:port addresses - empty while no relay is attached. */
    public static List<String> myAddresses() {
        MaximaNode node = sNode;
        return node == null ? new ArrayList<>() : node.myAddresses();
    }

    public static List<Contact> contacts() {
        MaximaNode node = sNode;
        return node == null ? new ArrayList<>() : node.contacts();
    }

    // ---- prefs ------------------------------------------------------------

    private static MaximaIdentity identity(Context zCtx) {
        SharedPreferences p = zCtx.getSharedPreferences("maxchat", Context.MODE_PRIVATE);
        String seed = p.getString("seed", "");
        if (!seed.isEmpty()) {
            return MaximaIdentity.fromSeed(new MiniData(seed));
        }
        MaximaIdentity.Created made = MaximaIdentity.create();
        // This ONE write is the identity: lose it and a shared MAX# dies. Synchronous.
        p.edit().putString("seed", made.identity.seed().to0xString()).commit();
        return made.identity;
    }

    public static boolean readReceipts(Context zCtx) {
        return zCtx.getSharedPreferences("maxima_chat", Context.MODE_PRIVATE)
                .getBoolean("read_receipts", false);
    }

    private static void fire() {
        for (Runnable l : UI_LISTENERS) {
            try {
                l.run();
            } catch (Exception ignored) {
            }
        }
    }
}
