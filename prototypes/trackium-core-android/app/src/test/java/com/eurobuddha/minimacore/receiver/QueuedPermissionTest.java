package com.eurobuddha.minimacore.receiver;

import android.content.Context;
import android.content.Intent;
import com.eurobuddha.minimaapi.MinimaAPIMessages;
import com.eurobuddha.minimacore.integrated.EmbeddedNodeTransport;
import org.minima.Minima;
import org.minima.utils.json.JSONObject;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import java.lang.reflect.Field;
import java.util.concurrent.ExecutorService;
import static org.mockito.Mockito.*;

public class QueuedPermissionTest {
    private JSONObject permission(boolean enabled, boolean admin) {
        JSONObject row = new JSONObject(); row.put("penabled", enabled ? 1 : 0); row.put("admin", admin ? 1 : 0); return row;
    }
    private void queued(String action, boolean wasAdmin, JSONObject after, boolean executes) throws Exception {
        MinimaReceiver receiver = mock(MinimaReceiver.class, CALLS_REAL_METHODS);
        receiver.mDatabase = mock(ReceiverDB.class); receiver.mCmdExecutor = mock(ExecutorService.class);
        Minima node = mock(Minima.class); Field field = MinimaReceiver.class.getDeclaredField("mMinima");
        field.setAccessible(true); field.set(receiver, node);
        when(node.runMinimaCMD(anyString(), anyBoolean(), anyString())).thenReturn("{}");
        doNothing().when(receiver).sendResponse(any(), any(), any(), any(), any());
        Context context = mock(Context.class); when(context.getApplicationContext()).thenReturn(context);
        Intent intent = mock(Intent.class); when(intent.getAction()).thenReturn(action);
        when(intent.getStringExtra(MinimaAPIMessages.MINIMA_API_PACKAGE_CLASS)).thenReturn("fixture.app");
        when(intent.getStringExtra(MinimaAPIMessages.MINIMA_API_APP_UID)).thenReturn("fixture-id");
        when(intent.getStringExtra(MinimaAPIMessages.MINIMA_API_REGISTER_MINIMAID)).thenReturn("fixture-node");
        when(intent.getStringExtra(MinimaAPIMessages.MINIMA_API_CMD_ACTION)).thenReturn("status");
        when(receiver.mDatabase.selectApp("fixture.app", "fixture-id", "fixture-node")).thenReturn(permission(true, wasAdmin));
        try (MockedStatic<EmbeddedNodeTransport> transport = mockStatic(EmbeddedNodeTransport.class)) {
            transport.when(() -> EmbeddedNodeTransport.canExecute(any())).thenReturn(true);
            receiver.onReceive(context, intent);
            ArgumentCaptor<Runnable> work = ArgumentCaptor.forClass(Runnable.class);
            verify(receiver.mCmdExecutor).execute(work.capture());
            when(receiver.mDatabase.selectApp("fixture.app", "fixture-id", "fixture-node")).thenReturn(after);
            work.getValue().run();
            if (executes) verify(node).runMinimaCMD("status", false, wasAdmin ? "0x00" : "0xFF");
            else { verifyNoInteractions(node); verify(context, never()).getFilesDir(); }
            verify(receiver.mDatabase, times(2)).selectApp("fixture.app", "fixture-id", "fixture-node");
        }
    }
    @Test public void disabledDeletedAndDemotedQueuedCommandsAreRefused() throws Exception {
        for (JSONObject row : new JSONObject[]{null, permission(false, true), permission(true, false)})
            queued(MinimaAPIMessages.MINIMA_API_CMD, true, row, false);
    }
    @Test public void revokedFileAccessNeverTouchesFiles() throws Exception {
        for (JSONObject row : new JSONObject[]{null, permission(false, true), permission(true, false)})
            queued(MinimaAPIMessages.MINIMA_API_FILE, true, row, false);
    }
    @Test public void validRequestsRetainTheirOriginalAuthority() throws Exception {
        queued(MinimaAPIMessages.MINIMA_API_CMD, true, permission(true, true), true);
        queued(MinimaAPIMessages.MINIMA_API_CMD, false, permission(true, true), true);
        queued(MinimaAPIMessages.MINIMA_API_CMD, false, permission(true, false), true);
    }
}
