package com.eurobuddha.minimacore.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class BatteryPolicyTest {

    @Test public void chargerLiftsAnyProfileToInstantOnlyWhenEnabled() {
        for (BatteryPolicy.Profile p : BatteryPolicy.Profile.values()) {
            assertEquals(BatteryPolicy.Profile.INSTANT, BatteryPolicy.effective(p, true, true));
            assertEquals(p, BatteryPolicy.effective(p, false, true));
            assertEquals(p, BatteryPolicy.effective(p, true, false));
        }
    }

    @Test public void unknownSavedProfileFallsBackToBalanced() {
        assertEquals(BatteryPolicy.Profile.BALANCED, BatteryPolicy.parse("bogus"));
        assertEquals(BatteryPolicy.Profile.SAVER, BatteryPolicy.parse("SAVER"));
    }

    @Test public void screenOffClockRunsOnlyWhileOff() throws Exception {
        BatteryPolicy.setScreenOn(true);
        assertEquals(0, BatteryPolicy.screenOffMillis());
        BatteryPolicy.setScreenOn(false);
        Thread.sleep(20);
        assertTrue(BatteryPolicy.screenOffMillis() >= 15);
        BatteryPolicy.setScreenOn(true);
        assertEquals(0, BatteryPolicy.screenOffMillis());
    }

    @Test public void dhtRoutesOnlyWhenTheChosenRelayConditionHolds() {
        BatteryPolicy.DhtRelay A = BatteryPolicy.DhtRelay.ALWAYS, P = BatteryPolicy.DhtRelay.PLUGGED,
                W = BatteryPolicy.DhtRelay.WIFI_OR_PLUGGED;
        for (boolean plugged : new boolean[]{false, true}) for (boolean wifi : new boolean[]{false, true}) {
            assertEquals("routing", BatteryPolicy.dhtMode(A, plugged, wifi));
            assertEquals(plugged ? "routing" : "client", BatteryPolicy.dhtMode(P, plugged, wifi));
            assertEquals(plugged || wifi ? "routing" : "client", BatteryPolicy.dhtMode(W, plugged, wifi));
        }
    }

    @Test public void nodeSleepsOnlyWhenScreenOffNotInstantAndDhtNotRelaying() {
        BatteryPolicy.Profile B = BatteryPolicy.Profile.BALANCED, S = BatteryPolicy.Profile.SAVER;
        assertTrue(!BatteryPolicy.nodeAwake(B, false, "client"));
        assertTrue(!BatteryPolicy.nodeAwake(S, false, "client"));
        assertTrue(BatteryPolicy.nodeAwake(B, false, "routing"));   // DHT relay always on: stays awake
        assertTrue(BatteryPolicy.nodeAwake(S, true, "client"));     // screen on
        assertTrue(BatteryPolicy.nodeAwake(BatteryPolicy.Profile.INSTANT, false, "client"));
    }

    @Test public void keetsOffNeverRoutes() {
        for (BatteryPolicy.DhtRelay r : BatteryPolicy.DhtRelay.values())
            for (boolean plugged : new boolean[]{false, true}) for (boolean wifi : new boolean[]{false, true}) {
                assertEquals("client", BatteryPolicy.dhtMode(false, r, plugged, wifi));
                assertEquals(BatteryPolicy.dhtMode(r, plugged, wifi), BatteryPolicy.dhtMode(true, r, plugged, wifi));
            }
    }

}
