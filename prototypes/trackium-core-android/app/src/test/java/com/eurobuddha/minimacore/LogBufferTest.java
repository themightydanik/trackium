package com.eurobuddha.minimacore;

import org.junit.Test;
import com.eurobuddha.minimacore.utils.LogBuffer;
import java.util.ArrayList;
import static org.junit.Assert.*;

public class LogBufferTest {
    @Test public void removingOldScreenDoesNotRemoveNewScreenOrResync() {
        ArrayList<String> screen = new ArrayList<>(), progress = new ArrayList<>();
        LogBuffer.Sink old = line -> { throw new IllegalStateException("old screen"); };
        LogBuffer.Sink current = screen::add, resync = progress::add;
        try {
            LogBuffer.setSink(old);
            LogBuffer.addObserver(resync);
            LogBuffer.append("one"); // a failed screen must not swallow progress
            LogBuffer.setSink(current);
            LogBuffer.clearSink(old);
            LogBuffer.append("two");
            assertEquals(1, screen.size());
            assertEquals(2, progress.size());
            LogBuffer.removeObserver(resync);
            LogBuffer.append("three");
            assertEquals(2, progress.size());
        } finally {
            LogBuffer.clearSink(old);
            LogBuffer.clearSink(current);
            LogBuffer.removeObserver(resync);
            LogBuffer.clear();
        }
    }

    @Test public void boundedTailDropsWholeEntriesAndCopiesSnapshot() {
        LogBuffer.Tail tail = new LogBuffer.Tail();
        for (int i = 0; i < 700; i++) tail.append("entry " + i);
        assertEquals(600, tail.snapshot().size());
        assertEquals("entry 100", tail.snapshot().get(0));
        assertEquals("entry 699", tail.snapshot().get(599));
        tail.snapshot().clear();
        assertEquals(600, tail.snapshot().size());
        long before = tail.revision();
        tail.clear();
        assertTrue(tail.revision() > before);
    }
}
