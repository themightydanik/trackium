package com.eurobuddha.minimacore.main.views.balance.tokens;

import org.minima.utils.json.JSONObject;
import org.minima.utils.json.parser.JSONParser;

import java.net.URLDecoder;

/**
 * Parsed token metadata (ported from the utxoWallet/Minima wallet, adapted to Minima's JSON).
 *
 * A Minima token "name" can be a plain string or a JSON object {name, url, description, ticker, ...},
 * and icon/description/webvalidate may live at either level — so we dig defensively. The balance
 * command hands the token field back as a stringified JSON for custom tokens, so we parse when needed.
 */
public class TokenMeta {

    public String name = "Token";
    /** True only for a nonempty supplied name (or the native Minima brand). */
    public boolean nameProvided = false;
    public String ticker = "";
    public String iconUrl = "";
    public String description = "";
    public String owner = "";
    public String webvalidate = "";
    public String externalUrl = "";

    public static boolean isMinima(String tokenid) {
        return tokenid == null || "0x00".equals(tokenid);
    }

    /** Parse from a balance entry's tokenid + raw "token" value (String, JSONObject, or stringified JSON). */
    public static TokenMeta parse(Object token, String tokenid) {
        TokenMeta m = new TokenMeta();
        if (isMinima(tokenid)) {
            m.name = "Minima";
            m.nameProvided = true;
            m.ticker = "MINIMA";
            return m;
        }

        JSONObject t = asObject(token);
        if (t == null) {
            //Plain string name (or nothing useful)
            if (token != null) { m.name = token.toString(); m.nameProvided = !m.name.isEmpty(); }
            return m;
        }

        JSONObject meta = null;
        Object nameNode = t.get("name");
        if (nameNode instanceof JSONObject) {
            meta = (JSONObject) nameNode;
            m.name = optStr(meta, "name", "Token");
            m.nameProvided = meta.get("name") != null && !m.name.isEmpty();
        } else if (nameNode != null) {
            m.name = nameNode.toString();
            m.nameProvided = !m.name.isEmpty();
        }

        // Canonical icon location is token.url; resolve it (artimage / data / http / svg / base64).
        String resolved = IconResolver.resolve(first(
                meta != null ? optStr(meta, "url", "") : "",
                optStr(t, "url", ""),
                meta != null ? optStr(meta, "icon", "") : "",
                optStr(t, "icon", "")));
        m.iconUrl = resolved == null ? "" : resolved;

        m.description = first(
                meta != null ? optStr(meta, "description", "") : "",
                optStr(t, "description", ""));
        m.ticker = first(
                meta != null ? optStr(meta, "ticker", "") : "",
                optStr(t, "ticker", ""));
        m.owner = first(
                meta != null ? optStr(meta, "owner", "") : "",
                optStr(t, "owner", ""));
        m.webvalidate = first(
                meta != null ? optStr(meta, "webvalidate", "") : "",
                optStr(t, "webvalidate", ""));
        m.externalUrl = decode(first(
                meta != null ? optStr(meta, "external_url", "") : "",
                optStr(t, "external_url", "")));
        return m;
    }

    /** Coerce the balance "token" field into a JSONObject when it holds structured metadata.
     *  Minima can hand the token back as its own JSONObject, a String, or another map type — so,
     *  like the original TokenUtils, we fall back to toString()+parse for anything non-native. */
    private static JSONObject asObject(Object token) {
        if (token == null) return null;
        if (token instanceof JSONObject) return (JSONObject) token;   // fast path (already Minima's)
        String s = token.toString().trim();
        if (s.startsWith("{")) {
            try {
                Object p = new JSONParser().parse(s);
                if (p instanceof JSONObject) return (JSONObject) p;
            } catch (Exception ignore) {}
        }
        return null;
    }

    private static String optStr(JSONObject o, String key, String def) {
        if (o == null) return def;
        Object v = o.get(key);
        return (v == null) ? def : v.toString();
    }

    private static String first(String... vals) {
        for (String v : vals) if (v != null && !v.isEmpty()) return v;
        return "";
    }

    /** URL-decode http(s) urls (token urls are often percent-encoded); leave data: URIs intact. */
    private static String decode(String url) {
        if (url == null || url.isEmpty()) return "";
        if (url.startsWith("data:")) return url;
        if (url.indexOf('%') < 0) return url;
        try { return URLDecoder.decode(url, "UTF-8"); } catch (Exception e) { return url; }
    }
}
