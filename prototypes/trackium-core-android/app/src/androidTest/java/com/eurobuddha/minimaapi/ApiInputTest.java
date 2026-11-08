package com.eurobuddha.minimaapi;

import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class ApiInputTest {
    static class Capture extends ContextWrapper {
        Intent last;
        Capture() { super(InstrumentationRegistry.getInstrumentation().getTargetContext()); }
        @Override public void sendBroadcast(Intent intent) { last = intent; } // never contact a node
        Intent reply() {
            Intent i = new Intent(MinimaAPIMessages.MINIMA_API_RESPONSE);
            i.putExtra(MinimaAPIMessages.MINIMA_API_REGISTER_MINIMAID,
                    last.getStringExtra(MinimaAPIMessages.MINIMA_API_REGISTER_MINIMAID));
            i.putExtra(MinimaAPIMessages.MINIMA_API_RESPONSE_ID,
                    last.getStringExtra(MinimaAPIMessages.MINIMA_API_RESPONSE_ID));
            return i;
        }
    }
    @Test public void malformedRepliesAreIgnoredAndValidReplyDeliveredOnce() {
        Capture context = new Capture(); AtomicInteger replies = new AtomicInteger();
        MinimaAPI api = new MinimaAPI(context, result -> replies.incrementAndGet());
        try {
            MinimaAPIReceive receiver = new MinimaAPIReceive(api);
            receiver.onReceive(context, null);
            receiver.onReceive(context, new Intent(MinimaAPIMessages.MINIMA_API_RESPONSE));
            assertFalse(MinimaAPI.checkMinimaID(context, new Intent()));
            Intent wrong = context.reply().putExtra(MinimaAPIMessages.MINIMA_API_REGISTER_MINIMAID, "");
            api.ResponseReceived(wrong);
            Intent missingId = context.reply(); missingId.removeExtra(MinimaAPIMessages.MINIMA_API_RESPONSE_ID);
            api.ResponseReceived(missingId);
            api.ResponseReceived(context.reply()); // no payload
            api.ResponseReceived(context.reply().putExtra(MinimaAPIMessages.MINIMA_API_RESPONSE_URI, "file:///private"));
            api.ResponseReceived(context.reply().putExtra(MinimaAPIMessages.MINIMA_API_RESPONSE_RESULT, 7));
            assertEquals(0, replies.get());
            Intent valid = context.reply().putExtra(MinimaAPIMessages.MINIMA_API_RESPONSE_RESULT, "{\"status\":true}");
            receiver.onReceive(context, valid); receiver.onReceive(context, valid);
            assertEquals(1, replies.get());
        } finally { api.onDestroy(); }
    }

    @Test public void invalidJsonBecomesExplicitFailureAndDestroyDropsCallbacks() {
        Capture context = new Capture(); AtomicReference<JSONObject> reply = new AtomicReference<>();
        MinimaAPI api = new MinimaAPI(context, reply::set);
        api.ResponseReceived(context.reply().putExtra(MinimaAPIMessages.MINIMA_API_RESPONSE_RESULT, "{invalid"));
        assertNotNull(reply.get()); assertFalse(reply.get().optBoolean("status", true));
        api.Command("status", result -> fail("callback after destroy"));
        Intent late = context.reply().putExtra(MinimaAPIMessages.MINIMA_API_RESPONSE_RESULT, "{}");
        api.onDestroy(); api.ResponseReceived(late);
        assertTrue(api.mResponseHandlers.isEmpty());
    }

    @Test public void authenticatedContentUriStillDeliversExactlyOnce() throws Exception {
        Capture context = new Capture(); CountDownLatch done = new CountDownLatch(1);
        AtomicInteger replies = new AtomicInteger(); AtomicReference<JSONObject> result = new AtomicReference<>();
        MinimaAPI api = new MinimaAPI(context, value -> { result.set(value); replies.incrementAndGet(); done.countDown(); });
        File dir = new File(context.getCacheDir(), "ipcresponses"); dir.mkdirs();
        File file = new File(dir, "api-input-test.json");
        try {
            Files.write(file.toPath(), "{\"status\":true,\"response\":\"large\"}".getBytes(StandardCharsets.UTF_8));
            String uri = FileProvider.getUriForFile(context, "com.eurobuddha.minimacore.ipcresponses", file).toString();
            Intent response = context.reply().putExtra(MinimaAPIMessages.MINIMA_API_RESPONSE_URI, uri);
            api.ResponseReceived(response); api.ResponseReceived(response);
            assertTrue(done.await(5, TimeUnit.SECONDS));
            api.mFileExecutor.submit(() -> { }).get(5, TimeUnit.SECONDS);
            assertEquals(1, replies.get()); assertEquals("large", result.get().optString("response"));
        } finally { api.onDestroy(); file.delete(); }
    }
}
