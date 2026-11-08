package com.eurobuddha.minimacore.chat;

import org.minima.utils.json.JSONObject;
import org.minima.utils.json.parser.JSONParser;

import java.security.SecureRandom;

/**
 * KeetChat wire schema — Parlons-native compatible (maxima_chat_v1 field names).
 * Java twin of mds/keetchat/chatschema.js (keep in sync):
 *
 *   { "application":"maxima_chat_v1", "id":"kc-<ts>-<rand>", "body":"<text>",
 *     "name":"<sender display name>", "ref":"<optional keets:// media url>", "ts":<ms> }
 *
 * Legacy plain-text payloads decode with legacy=true. Hostile fields are bounded
 * (id capped at 80 chars) so the dedupe key can't be abused.
 */
public final class ChatSchema {

    public static final String APPLICATION = "maxima_chat_v1";
    private static final SecureRandom RAND = new SecureRandom();

    private ChatSchema() {}

    public static class Decoded {
        public String id;       // null = none on the wire (fall back to the inbox id)
        public String body = "";
        public String name = "";
        public String ref  = "";
        public long   ts   = 0; // 0 = none on the wire
        public boolean legacy = false;
        // Parlons-native extras (ChatMessage field names) — all optional
        public String state = "";    // "", image, payment, read, payaddr-req, payaddr
        public String addr  = "";    // payaddr / payment destination
        public String amt   = "";    // payment amount
        public String tok   = "";    // payment tokenid
        public String tokname = "";  // payment token name
        public String txid  = "";    // payment txpowid
    }

    /** Build an outgoing payload. Returns the JSON string; its id is readable via decode(). */
    public static String encode(String zName, String zBody, String zRef) {
        return base(zName, zBody, zRef).toString();
    }

    /** A control/typed payload: state = image | payment | read | payaddr-req | payaddr. */
    public static JSONObject base(String zName, String zBody, String zRef) {
        JSONObject m = new JSONObject();
        m.put("application", APPLICATION);
        m.put("id", "kc-" + System.currentTimeMillis() + "-" + (RAND.nextInt(900000000) + 100000000));
        m.put("body", zBody == null ? "" : zBody);
        m.put("name", zName == null ? "" : zName);
        m.put("ts", System.currentTimeMillis());
        if (zRef != null && !zRef.equals("")) m.put("ref", zRef);
        return m;
    }

    /** Parse an incoming payload (utf8 text). Never throws. */
    public static Decoded decode(String zRaw) {
        Decoded d = new Decoded();
        try {
            Object o = new JSONParser().parse(zRaw);
            if (o instanceof JSONObject) {
                JSONObject m = (JSONObject) o;
                Object body = m.get("body");
                if (body instanceof String) {
                    d.body = (String) body;
                    Object id = m.get("id");
                    if (id instanceof String && ((String) id).length() <= 80) d.id = (String) id;
                    Object name = m.get("name");
                    if (name instanceof String) d.name = (String) name;
                    Object ref = m.get("ref");
                    if (ref instanceof String) d.ref = (String) ref;
                    Object ts = m.get("ts");
                    if (ts instanceof Number) d.ts = ((Number) ts).longValue();
                    d.state   = str(m.get("state"));
                    d.addr    = str(m.get("addr"));
                    d.amt     = str(m.get("amt"));
                    d.tok     = str(m.get("tok"));
                    d.tokname = str(m.get("tokname"));
                    d.txid    = str(m.get("txid"));
                    return d;
                }
            }
        } catch (Exception exc) { /* not schema JSON */ }
        d.body = zRaw == null ? "" : zRaw;
        d.legacy = true;
        return d;
    }

    private static String str(Object o) { return o instanceof String ? (String) o : ""; }

    /** utf8 → 0x hex, for `keets action:send datahex:` (no command-quoting pitfalls). */
    public static String toDataHex(String zPayload) {
        byte[] b;
        try { b = zPayload.getBytes("UTF-8"); } catch (Exception e) { b = zPayload.getBytes(); }
        StringBuilder sb = new StringBuilder("0x");
        for (byte x : b) sb.append(String.format("%02X", x));
        return sb.toString();
    }
}
