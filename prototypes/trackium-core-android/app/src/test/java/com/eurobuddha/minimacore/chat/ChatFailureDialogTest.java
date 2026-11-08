package com.eurobuddha.minimacore.chat;

import android.app.Application;
import android.content.ClipboardManager;
import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import java.lang.reflect.Method;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static com.eurobuddha.minimacore.i18n.R.string.*;

/** Real dialog and clipboard, long synthetic diagnostic, no node or outgoing message. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=34,application=Application.class,shadows=ChatFailureDialogTest.FragmentHost.class)
public class ChatFailureDialogTest {
    // Like MainResumeRefreshTest: exercise the real screen cleanup without starting
    // its node/chat in onCreate. There is deliberately no FragmentManager to destroy.
    @org.robolectric.annotation.Implements(androidx.fragment.app.FragmentActivity.class)
    public static class FragmentHost extends org.robolectric.shadows.ShadowActivity {
        @org.robolectric.annotation.Implementation protected void onDestroy() { }
    }
    private static final String ERROR="java.lang.Exception: keets api POST /media/chat/test.jpg -> HTTP 500\n"
            + "Long synthetic diagnostic 中文 Україна $1 {error}\n".repeat(200) + "END OF FULL ERROR";
    @Before public void setup() { Language.initialize(RuntimeEnvironment.getApplication(), () -> false); }
    @After public void reset() { Language.select(RuntimeEnvironment.getApplication(), "en"); }
    private static ScrollView scroll(View v) {
        if(v instanceof ScrollView) return (ScrollView)v;
        if(v instanceof ViewGroup) for(int i=0;i<((ViewGroup)v).getChildCount();i++) {
            ScrollView found=scroll(((ViewGroup)v).getChildAt(i)); if(found!=null) return found;
        }
        return null;
    }
    @Test public void fullErrorIsSelectableScrollableAndCopyDoesNotCloseInAllLanguages() {
        AppCompatActivity activity=Robolectric.buildActivity(AppCompatActivity.class).get();
        activity.setTheme(com.eurobuddha.minimacore.R.style.Theme_MinimaCore);
        for(String language:new String[]{"en","zh-Hans","ru","uk"}) {
            Language.select(RuntimeEnvironment.getApplication(),language);
            String expected=Language.text(activity,l10n_chat_photo_failed,ERROR);
            AlertDialog dialog=ChatFailureDialog.show(activity,new LanguageDialog(activity),Language.msg(l10n_chat_photo_failed,ERROR));
            ScrollView view=scroll(dialog.getWindow().getDecorView());assertNotNull(view);
            TextView text=(TextView)view.getChildAt(0);
            assertEquals(expected,text.getText().toString());assertTrue(text.isTextSelectable());assertNull(text.getEllipsize());
            assertTrue(text.getMaxLines()>200);
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).performClick();
            ClipboardManager clipboard=(ClipboardManager)activity.getSystemService(Context.CLIPBOARD_SERVICE);
            assertEquals(expected,clipboard.getPrimaryClip().getItemAt(0).getText().toString());
            assertTrue(dialog.isShowing());
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
            Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertFalse(dialog.isShowing());
        }
    }
    @Test public void finishedActivityDoesNotCreateADialog() {
        AppCompatActivity activity=mock(AppCompatActivity.class);when(activity.isFinishing()).thenReturn(true);
        LanguageDialog builder=mock(LanguageDialog.class);
        assertNull(ChatFailureDialog.show(activity,builder,ERROR));verifyNoInteractions(builder);
        when(activity.isFinishing()).thenReturn(false);when(activity.isDestroyed()).thenReturn(true);
        assertNull(ChatFailureDialog.show(activity,builder,ERROR));verifyNoInteractions(builder);
    }
    @Test public void bothChatScreensTrackAndDismissFailureDialogs() throws Exception {
        for(Class<? extends AppCompatActivity> type:new Class[]{ChatThreadActivity.class,
                com.eurobuddha.minimacore.maxchat.MaxThreadActivity.class}) {
            AppCompatActivity activity=Robolectric.buildActivity(type).get();
            activity.setTheme(com.eurobuddha.minimacore.R.style.Theme_MinimaCore);
            Method failure=type.getDeclaredMethod("showFailure",CharSequence.class);failure.setAccessible(true);
            failure.invoke(activity,ERROR);
            java.lang.reflect.Field field=type.getDeclaredField("dialogs");field.setAccessible(true);
            java.util.Set<?> dialogs=(java.util.Set<?>)field.get(activity);assertEquals(1,dialogs.size());
            AlertDialog dialog=(AlertDialog)dialogs.iterator().next();assertTrue(dialog.isShowing());
            Method destroy=type.getDeclaredMethod("onDestroy");destroy.setAccessible(true);destroy.invoke(activity);
            assertFalse(dialog.isShowing());assertTrue(dialogs.isEmpty());
        }
    }
}
