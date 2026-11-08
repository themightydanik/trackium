package com.eurobuddha.minimacore.chat;

import static org.junit.Assert.assertEquals;

import com.eurobuddha.minimacore.service.BatteryPolicy.Profile;

import org.junit.Test;

public class ChatPollCadenceTest {

    @Test public void instantAndVisibleAppAlwaysPollEveryOneAndAHalfSeconds() {
        assertEquals(1500, ChatDrainer.nextPollMs(Profile.INSTANT, false, false, 3_600_000));
        for (Profile p : Profile.values()) assertEquals(1500, ChatDrainer.nextPollMs(p, true, true, 0));
    }

    @Test public void balancedBacksOffOnlyAfterTheScreenIsOff() {
        assertEquals(1500, ChatDrainer.nextPollMs(Profile.BALANCED, false, true, 0));
        assertEquals(1500, ChatDrainer.nextPollMs(Profile.BALANCED, false, false, 59_000));
        assertEquals(30_000, ChatDrainer.nextPollMs(Profile.BALANCED, false, false, 61_000));
        assertEquals(30_000, ChatDrainer.nextPollMs(Profile.BALANCED, false, false, 9 * 60_000));
        assertEquals(300_000, ChatDrainer.nextPollMs(Profile.BALANCED, false, false, 11 * 60_000));
    }

    @Test public void saverWaitsLongest() {
        assertEquals(30_000, ChatDrainer.nextPollMs(Profile.SAVER, false, true, 0));
        assertEquals(300_000, ChatDrainer.nextPollMs(Profile.SAVER, false, false, 0));
    }
}
