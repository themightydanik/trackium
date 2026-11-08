package com.eurobuddha.minimacore.maxchat;

import com.eurobuddha.minimacore.chat.ChatDb;
import com.eurobuddha.maxima.core.MaximaNode;
import com.eurobuddha.maxima.core.chat.ChatEngine;
import com.eurobuddha.maxima.core.chat.ChatMedia;
import com.eurobuddha.maxima.core.chat.ChatPay;
import com.eurobuddha.maxima.core.contacts.Contact;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

/**
 * The Parlons conversations as Chat-tab thread rows. Reuses ChatDb.Thread as
 * the row shape so the ONE list adapter renders both backends; a row is a
 * Parlons one iff {@link #isMax(String)} on its pubkey (the "max:" prefix
 * keeps the two keyspaces from ever colliding in the list).
 */
public final class MaxChatThreads {

    /** Thread-row pubkey prefix marking a Parlons conversation. */
    public static final String PREFIX = "max:";

    private MaxChatThreads() {
    }

    public static boolean isMax(String zRowKey) {
        return zRowKey != null && zRowKey.startsWith(PREFIX);
    }

    /** The Parlons identity pubkey inside a row key. */
    public static String peer(String zRowKey) {
        return zRowKey.substring(PREFIX.length());
    }

    /** One row per Parlons contact/conversation; empty while the transport is down. */
    public static ArrayList<ChatDb.Thread> list() {
        ArrayList<ChatDb.Thread> out = new ArrayList<>();
        ChatEngine chat = MaxChat.chat();
        MaximaNode node = MaxChat.node();
        if (chat == null || node == null) {
            return out;
        }
        // Newest entry per 1:1 peer (groups are not surfaced here - follow-up).
        Map<String, ChatEngine.Entry> newest = new HashMap<>();
        for (ChatEngine.Entry e : chat.allMessages()) {
            if (e.peer == null || e.peer.isEmpty()) {
                continue;
            }
            ChatEngine.Entry cur = newest.get(e.peer);
            if (cur == null || e.time > cur.time) {
                newest.put(e.peer, e);
            }
        }
        // Every contact gets a row, message history or not.
        for (Contact c : node.contacts()) {
            ChatEngine.Entry last = newest.remove(c.publicKey);
            out.add(row(c.publicKey, c.name, last, chat));
        }
        // Conversations whose contact row is gone keep their history visible.
        for (Map.Entry<String, ChatEngine.Entry> e : newest.entrySet()) {
            out.add(row(e.getKey(), "", e.getValue(), chat));
        }
        return out;
    }

    private static ChatDb.Thread row(String zPeer, String zName,
                                     ChatEngine.Entry zLast, ChatEngine zChat) {
        ChatDb.Thread t = new ChatDb.Thread();
        t.pubkey = PREFIX + zPeer;
        t.name = (zName == null || zName.isEmpty()) ? "" : zName;
        t.lastBody = zLast == null ? "" : zLast.body;
        t.lastMine = zLast != null && zLast.mine;
        t.lastTs = zLast == null ? 0 : zLast.time;
        t.unread = zChat.unread(zPeer);
        return t;
    }

    /** List preview, matching the keets rows' style. */
    public static String preview(ChatEngine.Entry zE) {
        String p = ChatMedia.isMedia(zE.body) ? ChatMedia.preview(zE.body)
                : ChatPay.isPayment(zE.body) ? "💸 Payment"
                : zE.body;
        return zE.mine ? "You: " + p : p;
    }
}
