package com.eurobuddha.minimacore.main.views.balance.tokens;
import org.junit.Test;
import static org.junit.Assert.*;
public class NetFetchTest {
    @Test public void refusesLocalAndPrivateNetworkTargets() {
        for (String host : new String[]{"127.0.0.1", "::1", "10.1.2.3", "192.168.1.1", "169.254.169.254", "fc00::1", "100.64.0.1", "0.1.2.3", "224.0.0.1"})
            assertTrue(host, NetFetch.isBlockedHost(host));
        assertFalse(NetFetch.isBlockedHost("8.8.8.8"));
    }
    @Test public void refusesNonHttpSchemesBeforeOpeningConnection() throws Exception {
        assertNull(NetFetch.get("file:///etc/passwd", 10, 100, 100, false));
        assertNull(NetFetch.get("http://127.0.0.1:9005/status", 10, 100, 100, false));
    }

    private static final class Response extends java.net.HttpURLConnection {
        final int code; final String location; final byte[] body;
        boolean disconnected;
        Response(java.net.URL u, int code, String location, String body) {
            super(u); this.code = code; this.location = location;
            this.body = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        }
        public int getResponseCode() { return code; }
        public String getHeaderField(String key) { return location; }
        public java.io.InputStream getInputStream() { return new java.io.ByteArrayInputStream(body); }
        public void disconnect() { disconnected = true; }
        public boolean usingProxy() { return false; }
        public void connect() { }
    }

    @Test public void refusesRedirectToPrivateHostBeforeConnecting() throws Exception {
        java.util.List<Response> opened = new java.util.ArrayList<>();
        assertNull(NetFetch.get("https://8.8.8.8/icon", 100, 100, 100, false, u -> {
            Response r = new Response(u, 302, "http://127.0.0.1:9005/status", "");
            opened.add(r); return r;
        }));
        assertEquals(1, opened.size());
        assertTrue(opened.get(0).disconnected);
        assertFalse(opened.get(0).getInstanceFollowRedirects());
    }

    @Test public void followsRelativeRedirectsAndCapsTheirCount() throws Exception {
        java.util.List<String> urls = new java.util.ArrayList<>();
        byte[] data = NetFetch.get("https://8.8.8.8/icon", 100, 100, 100, false, u -> {
            urls.add(u.toString());
            return new Response(u, urls.size() == 1 ? 302 : 200, "/final", "image");
        });
        assertEquals("image", new String(data, java.nio.charset.StandardCharsets.UTF_8));
        assertEquals("https://8.8.8.8/final", urls.get(1));
        urls.clear();
        assertNull(NetFetch.get("https://8.8.8.8/icon", 100, 100, 100, false, u -> {
            urls.add(u.toString()); return new Response(u, 302, "/loop", "");
        }));
        assertEquals(4, urls.size());
    }

    @Test public void rejectsRedirectSchemeAndEnforcesByteCaps() throws Exception {
        assertNull(NetFetch.get("https://8.8.8.8/icon", 3, 100, 100, false,
                u -> new Response(u, 302, "file:///private", "")));
        assertNull(NetFetch.get("https://8.8.8.8/icon", 3, 100, 100, false,
                u -> new Response(u, 200, null, "1234")));
        assertArrayEquals(new byte[]{49,50,51}, NetFetch.get("https://8.8.8.8/icon", 3, 100, 100, true,
                u -> new Response(u, 200, null, "1234")));
    }
}
