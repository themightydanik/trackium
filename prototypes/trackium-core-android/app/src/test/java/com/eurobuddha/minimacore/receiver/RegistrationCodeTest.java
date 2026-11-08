package com.eurobuddha.minimacore.receiver;

import android.content.Context;
import android.content.Intent;
import com.eurobuddha.minimaapi.MinimaAPIMessages;
import org.minima.utils.json.JSONObject;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import java.util.concurrent.ExecutorService;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Security review 2026-11-07 (M-2): a new registration proves it is the package it claims with a one-time code that the
 *  node sends ONLY to that package; an unverified twin of a verified registration never runs a command. */
public class RegistrationCodeTest {
    private MinimaReceiver receiver() {
        MinimaReceiver r = mock(MinimaReceiver.class, CALLS_REAL_METHODS);
        r.mDatabase = mock(ReceiverDB.class); r.mCmdExecutor = mock(ExecutorService.class);
        doNothing().when(r).sendResponse(any(), any(), any(), any(), any());
        return r;
    }
    private Intent intent(String action, String confirm) {
        Intent i = mock(Intent.class); when(i.getAction()).thenReturn(action);
        when(i.getStringExtra(MinimaAPIMessages.MINIMA_API_PACKAGE_CLASS)).thenReturn("com.eurobuddha.dexicon");
        when(i.getStringExtra(MinimaAPIMessages.MINIMA_API_APP_UID)).thenReturn("app-uid");
        when(i.getStringExtra(MinimaAPIMessages.MINIMA_API_REGISTER_MINIMAID)).thenReturn("node-uid");
        when(i.getStringExtra(MinimaAPIMessages.MINIMA_API_CONFIRM)).thenReturn(confirm);
        when(i.getStringExtra(MinimaAPIMessages.MINIMA_API_CMD_ACTION)).thenReturn("status");
        return i;
    }
    private Context context() { Context c = mock(Context.class); when(c.getApplicationContext()).thenReturn(c); return c; }
    private JSONObject row(boolean verified, String nonce) {
        JSONObject r = new JSONObject(); r.put("penabled", 1); r.put("admin", 1); r.put("verified", verified ? 1 : 0); r.put("nonce", nonce); return r;
    }
    private String reply(MinimaReceiver r) {
        ArgumentCaptor<String> msg = ArgumentCaptor.forClass(String.class);
        verify(r).sendResponse(any(), any(), any(), any(), msg.capture());
        return msg.getValue();
    }

    @Test public void aNewRegistrationGetsItsCodeInTheReply() {
        MinimaReceiver r = receiver();
        when(r.mDatabase.selectApp("com.eurobuddha.dexicon", "app-uid", "node-uid")).thenReturn(null);
        when(r.mDatabase.insertApp("com.eurobuddha.dexicon", "app-uid", "node-uid")).thenReturn("c0de");
        r.onReceive(context(), intent(MinimaAPIMessages.MINIMA_API_REGISTER, null));
        String m = reply(r);
        assertTrue(m, m.contains("\"confirm\":\"c0de\"") && m.contains("\"verified\":false"));
    }
    @Test public void theEchoedCodeVerifiesTheRow() {
        MinimaReceiver r = receiver();
        when(r.mDatabase.selectApp("com.eurobuddha.dexicon", "app-uid", "node-uid")).thenReturn(row(false, "c0de"));
        when(r.mDatabase.verify("com.eurobuddha.dexicon", "app-uid", "node-uid", "c0de")).thenReturn(true);
        r.onReceive(context(), intent(MinimaAPIMessages.MINIMA_API_REGISTER, "c0de"));
        String m = reply(r);
        assertTrue(m, m.contains("\"verified\":true") && !m.contains("confirm"));
    }
    @Test public void anUnverifiedTwinNeverRunsACommand() {
        MinimaReceiver r = receiver();
        when(r.mDatabase.selectApp("com.eurobuddha.dexicon", "app-uid", "node-uid")).thenReturn(row(false, "c0de"));
        when(r.mDatabase.hasVerifiedTwin("com.eurobuddha.dexicon", "app-uid")).thenReturn(true);
        r.onReceive(context(), intent(MinimaAPIMessages.MINIMA_API_CMD, null));
        verify(r.mCmdExecutor, never()).execute(any());
        verify(r.mDatabase).disableRow("com.eurobuddha.dexicon", "app-uid");
        assertTrue(reply(r).contains("did not prove"));
    }
}
