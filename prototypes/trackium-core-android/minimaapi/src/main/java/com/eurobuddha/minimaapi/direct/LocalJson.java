package com.eurobuddha.minimaapi.direct;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Map;

/** Structured copies, without a JSON text/byte-array round trip. Each consumer owns its reply. */
public final class LocalJson {
    private LocalJson() {}
    public static Object copy(Object value) {
        try {
            if (value == null || value == JSONObject.NULL) return JSONObject.NULL;
            if (value instanceof JSONObject) {
                JSONObject source = (JSONObject)value, out = new JSONObject();
                java.util.Iterator<String> keys = source.keys();
                while (keys.hasNext()) { String key = keys.next(); out.put(key, copy(source.get(key))); }
                return out;
            }
            if (value instanceof Map) {
                JSONObject out = new JSONObject();
                for (Object item : ((Map<?,?>)value).entrySet()) {
                    Map.Entry<?,?> entry = (Map.Entry<?,?>)item;
                    out.put(String.valueOf(entry.getKey()), copy(entry.getValue()));
                }
                return out;
            }
            if (value instanceof JSONArray) {
                JSONArray out = new JSONArray(), source = (JSONArray)value;
                for (int i=0; i<source.length(); i++) out.put(copy(source.get(i)));
                return out;
            }
            if (value instanceof Iterable) {
                JSONArray out = new JSONArray();
                for (Object item : (Iterable<?>)value) out.put(copy(item));
                return out;
            }
            if (value instanceof String || value instanceof Number || value instanceof Boolean) return value;
            return value.toString();
        } catch (org.json.JSONException error) { throw new IllegalArgumentException("Invalid node result", error); }
    }
    public static JSONObject failure(String message) {
        JSONObject result = new JSONObject();
        try { result.put("transporterror", message); } catch (Exception impossible) { throw new IllegalStateException(impossible); }
        // A missing result must NEVER look like the node rejected a signing request.
        return result;
    }
    public static JSONObject ready(boolean ready) {
        JSONObject result = new JSONObject();
        try { result.put("status", ready); result.put("enabled", ready); result.put("admin", ready); }
        catch (Exception impossible) { throw new IllegalStateException(impossible); }
        return result;
    }
}
