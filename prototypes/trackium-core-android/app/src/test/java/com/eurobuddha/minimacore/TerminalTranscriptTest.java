package com.eurobuddha.minimacore;
import com.eurobuddha.minimacore.main.views.terminal.TerminalView;
import org.junit.Test;
import static org.junit.Assert.*;
public class TerminalTranscriptTest {
    @Test public void singleHugeResponseCannotBypassTheOriginalTerminalLimit() {
        String text=TerminalView.boundedAppend("status", "x".repeat(5*1024*1024)+"END",20000);
        assertTrue(text.length()<=20000);assertTrue(text.startsWith("…\n"));assertTrue(text.endsWith("END"));
    }
    @Test public void manyResponsesRetainOnlyTheTail() {
        String text="";
        for(int i=0;i<1000;i++) text=TerminalView.boundedAppend(text,"x".repeat(300)+i,20000);
        assertTrue(text.length()<=20000);assertTrue(text.endsWith("999"));
    }
    @Test public void normalLiteralResponsesAreUnchanged() {
        assertEquals("old\nnew",TerminalView.boundedAppend("old","new",20000));
    }
}
