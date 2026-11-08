package com.eurobuddha.minimaapi.direct;

import android.content.Context;
import android.os.Handler;
import org.json.JSONObject;
import org.junit.Test;
import org.mockito.MockedConstruction;
import com.eurobuddha.minimaapi.MinimaAPI;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

public class DirectNodeApiTest {
    @Test public void sessionInvalidationInTheSharedQueuePreventsExecution() {
        java.util.concurrent.atomic.AtomicBoolean valid = new java.util.concurrent.atomic.AtomicBoolean(true);
        List<JSONObject> replies = new ArrayList<>();
        DirectNodeApi.Request r = new DirectNodeApi.Request(replies::add, Runnable::run, valid::get);
        valid.set(false);
        assertFalse(r.begin()); assertFalse(r.active());
        assertEquals(1, replies.size()); assertFalse(replies.get(0).has("status"));
    }
    @Test public void invalidGuardFailsClosedButCannotCancelAnExecutingWrite() {
        DirectNodeApi.Request missing = new DirectNodeApi.Request(j->{}, Runnable::run, null);
        assertFalse(missing.begin());
        DirectNodeApi.Request broken = new DirectNodeApi.Request(j->{}, Runnable::run, ()->{throw new IllegalStateException();});
        assertFalse(broken.begin());
        java.util.concurrent.atomic.AtomicBoolean valid = new java.util.concurrent.atomic.AtomicBoolean(true);
        List<JSONObject> replies = new ArrayList<>();
        DirectNodeApi.Request active = new DirectNodeApi.Request(replies::add, Runnable::run, valid::get);
        assertTrue(active.begin()); valid.set(false); assertFalse(active.begin());
        assertTrue(active.active()); active.accept(LocalJson.ready(true));
        assertEquals(1, replies.size()); assertTrue(replies.get(0).optBoolean("status"));
    }
    @Test public void queuedCancellationPreventsExecutionAndCannotClaimRejection() {
        List<JSONObject> replies = new ArrayList<>();
        DirectNodeApi.Request r = new DirectNodeApi.Request(replies::add, Runnable::run);
        r.cancelQueued(); assertFalse(r.begin()); r.accept(LocalJson.ready(true));
        assertEquals(1, replies.size()); assertTrue(replies.get(0).has("transporterror"));
        assertFalse(replies.get(0).has("status")); assertFalse(replies.get(0).has("enabled"));
    }
    @Test public void startedWritesKeepTheirLateReplyAndCompleteExactlyOnce() throws Exception {
        List<JSONObject> replies = new ArrayList<>();
        DirectNodeApi.Request r = new DirectNodeApi.Request(replies::add, Runnable::run);
        assertTrue(r.begin()); r.cancelQueued(); assertTrue(replies.isEmpty());
        r.accept(new JSONObject().put("status",true).put("txpowid","0xabc")); r.accept(LocalJson.failure("duplicate"));
        assertEquals(1,replies.size()); assertEquals("0xabc",replies.get(0).getString("txpowid"));
    }
    @Test public void responseSnapshotIsIsolatedAndExceedsFormerFourMbTransportLimit() throws Exception {
        List<Runnable> delivery = new ArrayList<>(); List<JSONObject> replies = new ArrayList<>();
        JSONObject data = new JSONObject().put("text","x".repeat(5*1024*1024));
        JSONObject original = new JSONObject().put("status",true).put("data",data);
        DirectNodeApi.Request r = new DirectNodeApi.Request(replies::add, delivery::add);
        r.accept(original); data.put("text","changed"); delivery.remove(0).run();
        assertEquals(5*1024*1024,replies.get(0).getJSONObject("data").getString("text").length());
    }
    @Test public void completeNodeRejectionIsPreservedButAbsentReplyRemainsUnknown() throws Exception {
        List<JSONObject> replies = new ArrayList<>();
        new DirectNodeApi.Request(replies::add,Runnable::run).accept(new JSONObject().put("status",false).put("error","node rejected"));
        new DirectNodeApi.Request(replies::add,Runnable::run).accept(null);
        assertEquals(Boolean.FALSE,replies.get(0).get("status")); assertFalse(replies.get(1).has("status"));
    }
    @Test public void callbackFailureCannotBreakSharedWorker() {
        DirectNodeApi.Request r = new DirectNodeApi.Request(j->{throw new IllegalStateException("consumer");},Runnable::run);
        r.accept(LocalJson.ready(true)); assertFalse(r.active());
    }
    @Test public void callbacksRacingWithCancelOrExpiryCompleteOnce() throws Exception {
        for (int i=0;i<100;i++) {
            AtomicInteger calls = new AtomicInteger(); DirectNodeApi.Request r = new DirectNodeApi.Request(j->calls.incrementAndGet(),Runnable::run);
            Thread a=new Thread(()->r.accept(LocalJson.ready(true))), b=new Thread(r::cancelQueued);
            a.start(); b.start(); a.join(); b.join(); assertEquals(1,calls.get());
        }
    }
    @Test public void apiUsesNoBroadcastsOrPairingAndPreservesExecutingResultsAfterClose() {
        Context context=mock(Context.class); when(context.getPackageName()).thenReturn("com.eurobuddha.pandamonium");
        List<DirectNodeApi.Request> work=new ArrayList<>(); List<JSONObject> replies=new ArrayList<>();
        DirectNodeApi.install(new DirectNodeApi.Backend() {
            public boolean ready(){return true;}
            public void command(String c,DirectNodeApi.Request r){work.add(r);}
            public void file(String a,String p,String n,android.net.Uri u,DirectNodeApi.Request r){work.add(r);}
        });
        try (MockedConstruction<Handler> handlers=mockConstruction(Handler.class,(h,c)->{
            when(h.post(any())).thenAnswer(i->{((Runnable)i.getArgument(0)).run();return true;});
        })) {
            DirectNodeApi api=new DirectNodeApi(context,replies::add);
            assertTrue(replies.remove(0).optBoolean("enabled"));
            api.Command("status",replies::add); api.Command("sign",replies::add);
            assertTrue(work.get(1).begin()); api.onDestroy();
            assertFalse(work.get(0).begin()); assertEquals(1,replies.size());
            work.get(1).accept(LocalJson.ready(true)); assertEquals(2,replies.size());
            api.Command("after-close",replies::add); assertEquals(2,work.size());assertFalse(replies.get(2).has("status"));
            verify(context,never()).sendBroadcast(any()); verify(context,never()).getSharedPreferences(anyString(),anyInt());
            assertThrows(IllegalStateException.class,()->new MinimaAPI(context,j->{}));
        } finally {DirectNodeApi.install(null);}
    }
    @Test public void overloadAndBackendFailureNeverBecomeNodeRejection() {
        Context context=mock(Context.class); when(context.getPackageName()).thenReturn("com.eurobuddha.pandamonium");
        AtomicInteger submitted=new AtomicInteger(); List<JSONObject> replies=new ArrayList<>();
        DirectNodeApi.install(new DirectNodeApi.Backend() {
            public boolean ready(){return true;}
            public void command(String c,DirectNodeApi.Request r){submitted.incrementAndGet();}
            public void file(String a,String p,String n,android.net.Uri u,DirectNodeApi.Request r){throw new IllegalStateException();}
        });
        try (MockedConstruction<Handler> handlers=mockConstruction(Handler.class,(h,c)->{
            when(h.post(any())).thenAnswer(i->{((Runnable)i.getArgument(0)).run();return true;});
        })) {
            DirectNodeApi api=new DirectNodeApi(context,j->{});
            api.FileCommand("list","/",null,null,replies::add); assertFalse(replies.remove(0).has("status"));
            for(int i=0;i<129;i++)api.Command("status",replies::add);
            assertEquals(128,submitted.get()); assertEquals(1,replies.size()); assertFalse(replies.get(0).has("status"));
            api.onDestroy(); assertEquals(129,replies.size());
        } finally {DirectNodeApi.install(null);}
    }
}
