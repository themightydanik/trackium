package com.eurobuddha.minimacore.utils;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

public class ResyncHostsTest {

    @Test public void everyPooledHostIsOfferedAndNoneIsDuplicated() {
        List<String> hosts = ResyncHosts.candidates(null, new Random(1));
        assertEquals(ResyncHosts.POOL.length, hosts.size());
        assertEquals(new HashSet<>(hosts).size(), hosts.size());
        for (String host : ResyncHosts.POOL) {
            assertTrue(host + " missing", hosts.contains(host));
        }
    }

    /** Shuffled, so one host does not carry every device's resync. */
    @Test public void theOrderVariesBetweenAttempts() {
        Set<String> orders = new HashSet<>();
        for (int seed = 0; seed < 40; seed++) {
            orders.add(String.join(",", ResyncHosts.candidates(null, new Random(seed))));
        }
        assertTrue("always produced the same order", orders.size() > 1);
    }

    /** Someone running their own MegaMMR node must not be quietly redirected to ours. */
    @Test public void aConfiguredHostLeadsAndTheRestRemainAsFallbacks() {
        List<String> hosts = ResyncHosts.candidates("my.own.node:9001", new Random(7));
        assertEquals("my.own.node:9001", hosts.get(0));
        assertEquals(ResyncHosts.POOL.length + 1, hosts.size());
    }

    /** A user host already in the pool must not appear twice. */
    @Test public void aConfiguredHostFromThePoolIsNotDuplicated() {
        String pooled = ResyncHosts.POOL[0];
        List<String> hosts = ResyncHosts.candidates(pooled, new Random(3));
        assertEquals(pooled, hosts.get(0));
        assertEquals(ResyncHosts.POOL.length, hosts.size());
        assertEquals(new HashSet<>(hosts).size(), hosts.size());
    }

    @Test public void aJunkConfiguredHostIsIgnoredRatherThanTriedFirst() {
        for (String junk : new String[]{"", "   ", "node", ":9001", "node:0", "node:9001;quit"}) {
            List<String> hosts = ResyncHosts.candidates(junk, new Random(5));
            assertEquals(junk + " was offered", ResyncHosts.POOL.length, hosts.size());
            assertFalse(hosts.contains(junk));
        }
    }

    /**
     * Only pre-flight failures may be retried elsewhere. megammrsync deletes the databases
     * before it fetches, so anything thrown after that point has already changed the node
     * and must not be looped on.
     */
    @Test public void onlyPreflightFailuresAllowAnotherHost() {
        assertTrue(ResyncHosts.canTryAnotherHost("Could not connect to Archive host! @ 1.2.3.4:9001"));
        assertTrue(ResyncHosts.canTryAnotherHost("Invalid HOST format for resync : nonsense"));

        assertFalse("thrown after the databases are deleted",
                ResyncHosts.canTryAnotherHost("Error getting MegaMMR data from host"));
        assertFalse(ResyncHosts.canTryAnotherHost(null));
        assertFalse(ResyncHosts.canTryAnotherHost(""));
        assertFalse(ResyncHosts.canTryAnotherHost("Node is not running"));
    }
}
