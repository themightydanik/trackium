package com.eurobuddha.minimaapi;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import org.json.JSONObject;
import org.junit.Test;
import org.mockito.MockedConstruction;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Exercise the public SDK with simulated Android broadcast delivery, without a live wallet. */
public class NodeRoutingTest {
    static final String CLASSIC = MinimaAPIMessages.MINIMA_BASE_CLASS;
    static final String BLOCK = MinimaAPI.BLOCK_PACKAGE;
    static final String OFFICIAL = MinimaAPIMessages.OFFICIAL_PACKAGE;
    static final String LEGACY = MinimaAPIMessages.LEGACY_PACKAGE;
    static final int NODES = MinimaAPIMessages.NODES.length;

    @Test public void pandamoniumOnlyReceivesQueuedCommand() throws Exception { route(Collections.singleton(MinimaAPI.PANDAMONIUM_PACKAGE), MinimaAPI.PANDAMONIUM_PACKAGE); }
    @Test public void pandamoniumAndClassicRefuseCommand() throws Exception { route(new HashSet<>(Arrays.asList(CLASSIC, MinimaAPI.PANDAMONIUM_PACKAGE)), null); }
    @Test public void allThreeRefuseCommand() throws Exception { route(new HashSet<>(Arrays.asList(CLASSIC, BLOCK, MinimaAPI.PANDAMONIUM_PACKAGE)), null); }
    @Test public void blockOnlyReceivesQueuedCommand() throws Exception { route(Collections.singleton(BLOCK), BLOCK); }
    @Test public void classicOnlyReceivesQueuedCommand() throws Exception { route(Collections.singleton(CLASSIC), CLASSIC); }
    @Test public void twoNodesRefuseCommand() throws Exception { route(new HashSet<>(Arrays.asList(CLASSIC, BLOCK)), null); }
    @Test public void noNodesRefuseCommand() throws Exception { route(Collections.emptySet(), null); }
    @Test public void officialOnlyReceivesQueuedCommand() throws Exception { route(Collections.singleton(OFFICIAL), OFFICIAL); }
    @Test public void legacyOnlyReceivesQueuedCommand() throws Exception { route(Collections.singleton(LEGACY), LEGACY); }
    @Test public void officialAndClassicRefuseCommand() throws Exception { route(new HashSet<>(Arrays.asList(CLASSIC, OFFICIAL)), null); }

    @Test public void dialects() {
        assertEquals("com.eurobuddha.minimacore", MinimaAPIMessages.prefixOf(BLOCK));
        assertEquals("com.eurobuddha.minimacore", MinimaAPIMessages.prefixOf(MinimaAPI.PANDAMONIUM_PACKAGE));
        assertEquals("org.minima.core", MinimaAPIMessages.prefixOf(OFFICIAL));
        assertEquals("org.minimarex.minimacore", MinimaAPIMessages.prefixOf(LEGACY));
        assertEquals("org.minima.core", MinimaAPIMessages.prefixOfAction("org.minima.core.RESPONSE"));
        assertEquals("org.minimarex.minimacore", MinimaAPIMessages.prefixOfAction("org.minimarex.minimacore.NOTIFY"));
        assertEquals("com.eurobuddha.minimacore", MinimaAPIMessages.prefixOfAction(MinimaAPIMessages.MINIMA_API_RESPONSE));
        assertNull(MinimaAPIMessages.prefixOfAction("org.minima.core.evil.RESPONSE"));
        assertNull(MinimaAPIMessages.prefixOfAction("reply"));
        assertTrue(MinimaAPI.isNotify("org.minima.core.NOTIFY"));
        assertTrue(MinimaAPI.isNotify(MinimaAPIMessages.MINIMA_API_NOTIFY));
        assertFalse(MinimaAPI.isNotify("org.minima.core.RESPONSE"));
        assertFalse(MinimaAPI.isNotify("evil.NOTIFY"));
        // The bears' own constants must never move - their node receiver uses them
        assertEquals("com.eurobuddha.minimacore.CMD", MinimaAPIMessages.MINIMA_API_CMD);
        assertEquals(MinimaAPIMessages.key("com.eurobuddha.minimacore", "RESPONSE_ID"), MinimaAPIMessages.MINIMA_API_RESPONSE_ID);
    }

    private void route(Set<String> responders, String expected) throws Exception {
        List<Runnable> timers = new ArrayList<>();
        List<Intent> broadcasts = new ArrayList<>();
        Context context = mock(Context.class);
        SharedPreferences prefs = mock(SharedPreferences.class);
        when(context.getPackageName()).thenReturn("test.companion");
        when(context.getSharedPreferences(anyString(), anyInt())).thenReturn(prefs);
        when(prefs.getString(eq("myapp_uid"), anyString())).thenReturn("app-secret");
        when(prefs.getString(eq("minima_uid"), anyString())).thenReturn("node-secret");
        doAnswer(i -> { broadcasts.add(i.getArgument(0)); return null; }).when(context).sendBroadcast(any());
        try (MockedConstruction<Handler> handlers = mockConstruction(Handler.class, (h, c) -> {
            when(h.post(any())).thenAnswer(i -> { ((Runnable)i.getArgument(0)).run(); return true; });
            when(h.postDelayed(any(), anyLong())).thenAnswer(i -> { timers.add(i.getArgument(0)); return true; });
        }); MockedConstruction<Intent> intents = mockConstruction(Intent.class, (intent, construction) -> {
            Map<String, String> extras = new HashMap<>();
            String[] target = {null};
            when(intent.getAction()).thenReturn(construction.arguments().isEmpty() ? "" : (String)construction.arguments().get(0));
            when(intent.setPackage(anyString())).thenAnswer(i -> { target[0] = i.getArgument(0); return intent; });
            when(intent.getPackage()).thenAnswer(i -> target[0]);
            when(intent.putExtra(anyString(), anyString())).thenAnswer(i -> { extras.put(i.getArgument(0), i.getArgument(1)); return intent; });
            when(intent.getStringExtra(anyString())).thenAnswer(i -> extras.get(i.getArgument(0)));
        })) {
            MinimaAPI api = new MinimaAPI(context, null);
            try {
                List<JSONObject> replies = new ArrayList<>();
                api.Command("send address:TEST amount:1", replies::add);
                assertEquals("Only registration may fan out", NODES, broadcasts.size());
                for (Intent request : new ArrayList<>(broadcasts)) {
                    String prefix = MinimaAPIMessages.prefixOf(request.getPackage());
                    assertEquals(MinimaAPIMessages.key(prefix, "REGISTER"), request.getAction());
                    if (responders.contains(request.getPackage())) {
                        Intent reply = new Intent(MinimaAPIMessages.key(prefix, "RESPONSE"));
                        reply.putExtra(MinimaAPIMessages.key(prefix, "REGISTER_MINIMAID"), "node-secret");
                        reply.putExtra(MinimaAPIMessages.key(prefix, "RESPONSE_ID"), request.getStringExtra(MinimaAPIMessages.key(prefix, "RESPONSE_ID")));
                        reply.putExtra(MinimaAPIMessages.key(prefix, "RESPONSE_RESULT"), "{\"status\":true}");
                        api.ResponseReceived(reply);
                    }
                }
                timers.remove(0).run();
                if (expected == null) {
                    assertEquals(NODES, broadcasts.size());
                    assertEquals(1, replies.size());
                    assertFalse(replies.get(0).getBoolean("status"));
                } else {
                    String prefix = MinimaAPIMessages.prefixOf(expected);
                    assertEquals(NODES + 1, broadcasts.size());
                    assertEquals(expected, broadcasts.get(NODES).getPackage());
                    assertEquals(MinimaAPIMessages.key(prefix, "CMD"), broadcasts.get(NODES).getAction());
                    assertEquals("send address:TEST amount:1", broadcasts.get(NODES).getStringExtra(MinimaAPIMessages.key(prefix, "CMD_ACTION")));
                    assertEquals("test.companion", broadcasts.get(NODES).getStringExtra(MinimaAPIMessages.key(prefix, "PACKAGE_CLASS")));
                    api.FileCommand("list", "/", null, null, replies::add);
                    assertEquals(NODES + 2, broadcasts.size());
                    assertEquals(expected, broadcasts.get(NODES + 1).getPackage());
                    assertEquals(MinimaAPIMessages.key(prefix, "FILE"), broadcasts.get(NODES + 1).getAction());
                    if (!MinimaAPIMessages.MINIMA_BASE_CLASS.equals(prefix)) {
                        // A core without the FILE bridge stays silent: the caller gets a failure, not a hang
                        assertEquals(1, timers.size());
                        timers.remove(0).run();
                        assertEquals(1, replies.size());
                        assertFalse(replies.get(0).getBoolean("status"));
                    } else {
                        assertTrue(timers.isEmpty());
                    }
                }
                int count = broadcasts.size();
                api.onDestroy();
                api.Command("send address:TEST amount:1", replies::add);
                assertEquals("Destroyed owner cannot send", count, broadcasts.size());
            } finally { api.onDestroy(); }
        }
    }
}
