package com.eurobuddha.minimacore.keets;

import org.junit.Test;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.Assert.*;

public class WorkletShutdownTest {
    @Test public void releasedStorageIsRequiredBeforeTermination() throws Exception {
        AtomicBoolean released = new AtomicBoolean();
        AtomicBoolean terminated = new AtomicBoolean();
        WorkletShutdown.close(() -> { released.set(true); return "media-closed-v1"; },
                () -> { assertTrue(released.get()); terminated.set(true); });
        assertTrue(terminated.get());
    }
    @Test public void timeoutUnknownReplyAndFailureMustNotTerminateOwner() throws Exception {
        for (String reply : new String[] {null, "wrong"}) {
            try { WorkletShutdown.close(() -> reply, () -> fail("terminated without shutdown")); fail(); }
            catch (IOException expected) { }
        }
        try {
            WorkletShutdown.close(() -> { throw new IOException("close failed"); },
                    () -> fail("terminated after close failure"));
            fail();
        } catch (IOException expected) { assertEquals("close failed", expected.getMessage()); }
    }
}
