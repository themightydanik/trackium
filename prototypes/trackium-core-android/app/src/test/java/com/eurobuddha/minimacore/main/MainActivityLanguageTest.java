package com.eurobuddha.minimacore.main;

import android.app.ProgressDialog;
import android.widget.TextView;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import org.junit.Test;
import org.minima.system.params.GeneralParams;
import org.minima.utils.json.JSONObject;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class MainActivityLanguageTest {
    private static Object field(Object value, Class<?> owner, String name) throws Exception {
        Field field = owner.getDeclaredField(name); field.setAccessible(true); return field.get(value);
    }
    @Test public void footerKeepsExactClassicOrBlockCounterAndDoesNotIssueCommands() throws Exception {
        MainActivity activity = mock(MainActivity.class, CALLS_REAL_METHODS);
        doReturn(false).when(activity).isFinishing(); doReturn(false).when(activity).isDestroyed();
        Field visible = MainActivity.class.getDeclaredField("hostVisible"); visible.setAccessible(true); visible.set(activity, true);
        TextView view = mock(TextView.class); activity.mFooterLeft = view;
        JSONObject response = new JSONObject(); response.put("maxuses", "000268435455");
        JSONObject result = new JSONObject(); result.put("response", response);
        Method render = MainActivity.class.getDeclaredMethod("renderFooterKeys", JSONObject.class); render.setAccessible(true);
        boolean previous = GeneralParams.USE_BLOCK_AS_KEYUSES;
        try (MockedStatic<MinimaCMD> node = mockStatic(MinimaCMD.class);
             MockedStatic<Language> language = mockStatic(Language.class, CALLS_REAL_METHODS)) {
            node.when(MinimaCMD::checkMinimaStarted).thenReturn(true);
            language.when(() -> Language.setText(eq(view), any())).thenAnswer(call -> null);
            for (boolean blockMode : new boolean[]{false, true}) {
                GeneralParams.USE_BLOCK_AS_KEYUSES = blockMode;
                language.clearInvocations(); render.invoke(activity, result);
                ArgumentCaptor<CharSequence> label = ArgumentCaptor.forClass(CharSequence.class);
                language.verify(() -> Language.setText(same(view), label.capture()));
                assertEquals(blockMode ? l10n_core_last_key_block : l10n_core_key_uses,
                        field(label.getValue(), Language.Message.class, "resource"));
                assertArrayEquals(new Object[]{"000268435455"}, (Object[])field(label.getValue(), Language.Message.class, "arguments"));
            }
            node.verify(MinimaCMD::checkMinimaStarted, times(2)); node.verifyNoMoreInteractions();
        } finally { GeneralParams.USE_BLOCK_AS_KEYUSES = previous; }
    }
    @Test public void shutdownLabelRefreshRetainsDialogAndDoesNotRestartOrDismissIt() throws Exception {
        MainActivity activity = mock(MainActivity.class, CALLS_REAL_METHODS);
        ProgressDialog dialog = mock(ProgressDialog.class); activity.mShutdownDialog = dialog;
        Method refresh = MainActivity.class.getDeclaredMethod("refreshShutdownLabels"); refresh.setAccessible(true);
        try (MockedStatic<Language> language = mockStatic(Language.class)) {
            for (String code : new String[]{"en", "zh-Hans", "ru", "uk"}) {
                language.when(() -> Language.text(activity, l10n_core_shutting_down)).thenReturn(code + " shutdown");
                language.when(() -> Language.text(activity, l10n_core_wait)).thenReturn(code + " wait");
                refresh.invoke(activity);
                assertSame(dialog, activity.mShutdownDialog);
                verify(dialog).setTitle(code + " shutdown"); verify(dialog).setMessage(code + " wait");
            }
            verify(dialog, never()).show(); verify(dialog, never()).dismiss();
            verify(activity, never()).shutdownMinima(); verify(activity, never()).startMinimaService();
        }
    }
}
