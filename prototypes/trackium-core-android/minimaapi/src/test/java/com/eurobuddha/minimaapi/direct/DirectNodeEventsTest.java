package com.eurobuddha.minimaapi.direct;
import org.json.JSONObject;
import org.junit.Test;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;
public class DirectNodeEventsTest {
    private JSONObject event(String type,int n) throws Exception {return new JSONObject().put("event",type).put("data",new JSONObject().put("n",n));}
    @Test public void refreshesCoalesceAndUnsubscribeDropsAlreadyQueuedCallbacks() throws Exception {
        List<Runnable> tasks=new ArrayList<>();List<JSONObject> seen=new ArrayList<>();
        DirectNodeEvents.Listener listener=seen::add;
        DirectNodeEvents.subscribe(listener,tasks::add,"NEWBLOCK");
        try {
            for(int i=0;i<500;i++)DirectNodeEvents.publish(event("NEWBLOCK",i));
            DirectNodeEvents.publish(event("MINIMALOG",1)); assertEquals(1,tasks.size());tasks.remove(0).run();
            assertEquals(1,seen.size());assertEquals(499,seen.get(0).getJSONObject("data").getInt("n"));
            DirectNodeEvents.publish(event("NEWBLOCK",501)); DirectNodeEvents.unsubscribe(listener);
            DirectNodeEvents.subscribe(listener,tasks::add,"NEWBLOCK");tasks.remove(0).run();assertEquals(1,seen.size());
        } finally {DirectNodeEvents.unsubscribe(listener);}
    }
    @Test public void subscribersCannotMutateOthersAndFailureDoesNotStopDelivery() throws Exception {
        AtomicInteger count=new AtomicInteger();List<JSONObject> seen=new ArrayList<>();
        DirectNodeEvents.Listener broken=j->{count.incrementAndGet();j.optJSONObject("data").remove("n");throw new RuntimeException();};
        DirectNodeEvents.Listener good=seen::add;
        DirectNodeEvents.subscribe(broken,Runnable::run);DirectNodeEvents.subscribe(good,Runnable::run);
        try {JSONObject e=event("NEWBALANCE",7);DirectNodeEvents.publish(e);assertEquals(7,e.getJSONObject("data").getInt("n"));assertEquals(7,seen.get(0).getJSONObject("data").getInt("n"));assertEquals(1,count.get());}
        finally {DirectNodeEvents.unsubscribe(broken);DirectNodeEvents.unsubscribe(good);}
    }
    @Test public void stalledLogConsumerHasBoundedQueueWithVisibleOverflowCount() throws Exception {
        List<Runnable> tasks=new ArrayList<>();List<JSONObject> seen=new ArrayList<>();DirectNodeEvents.Listener listener=seen::add;
        long before=DirectNodeEvents.droppedEvents();DirectNodeEvents.subscribe(listener,tasks::add,"MINIMALOG");
        try {for(int i=0;i<1000;i++)DirectNodeEvents.publish(event("MINIMALOG",i));assertEquals(1,tasks.size());tasks.get(0).run();assertEquals(256,seen.size());assertEquals(744,DirectNodeEvents.droppedEvents()-before);assertEquals(999,seen.get(255).getJSONObject("data").getInt("n"));}
        finally {DirectNodeEvents.unsubscribe(listener);}
    }
}
