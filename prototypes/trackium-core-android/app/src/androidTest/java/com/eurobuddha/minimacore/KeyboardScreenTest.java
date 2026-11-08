package com.eurobuddha.minimacore;

import android.app.Activity;
import android.content.Context;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.appcompat.widget.Toolbar;
import androidx.viewpager.widget.PagerAdapter;
import androidx.viewpager.widget.ViewPager;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;
import com.eurobuddha.minimacore.launcher.newwallet.NewWalletRestoreActivity;
import com.eurobuddha.minimacore.launcher.restore.RestoreWalletSyncActivity;
import com.eurobuddha.minimacore.main.ParamsActivity;
import com.eurobuddha.minimacore.main.SeedSyncActivity;
import com.eurobuddha.minimacore.main.views.send.SendActivity;
import com.eurobuddha.minimacore.main.views.terminal.TerminalActivity;
import com.eurobuddha.minimacore.main.views.logs.LogsActivity;
import com.eurobuddha.minimacore.utils.KeyboardInsets;

import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Predicate;
import static org.junit.Assert.*;

/** Real IME tests on a disposable emulator. Never presses send, restore, resync or save. */
@RunWith(AndroidJUnit4.class)
public class KeyboardScreenTest {
    private static final String INPUT = "keyboard visibility test";

    @Test public void paramsButtonsRemainReachable() {
        check(ParamsActivity.class, R.id.params_main, R.id.params_extra, false,
                R.id.params_button_save, R.id.params_button_save_restart);
    }

    @Test public void sendButtonRemainsReachable() {
        check(SendActivity.class, R.id.send_main, R.id.wallet_send_address, false, R.id.wallet_send_sendbutton);
    }

    @Test public void ukrainianSendButtonRemainsReachable() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("true", InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"));
        assertEquals("ranchu", android.os.Build.HARDWARE);
        assertNull(org.minima.system.Main.getInstance());
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() ->
                com.eurobuddha.minimacore.i18n.Language.select(context, "uk"));
        try {
            check(SendActivity.class, R.id.send_main, R.id.wallet_send_address, false, R.id.wallet_send_sendbutton);
        } finally {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() ->
                    com.eurobuddha.minimacore.i18n.Language.select(context, "en"));
        }
    }

    @Test public void resyncButtonRemainsReachable() {
        check(SeedSyncActivity.class, R.id.sync_main, R.id.seed_sync_host, false, R.id.seed_sync_proceed);
    }

    @Test public void restoreButtonsRemainReachable() {
        check(RestoreWalletSyncActivity.class, R.id.restorewallet_main, R.id.restorewallet_seed, false,
                R.id.restorewallet_button_check, R.id.restorewallet_button_proceed);
    }

    @Test public void newWalletButtonsRemainReachable() {
        check(NewWalletRestoreActivity.class, R.id.restorewallet_main, R.id.restorewallet_seed, false,
                R.id.restorewallet_button_check, R.id.restorewallet_button_proceed);
    }

    @Test public void logsFilterAndActionsRemainReachable() {
        check(LogsActivity.class, R.id.logs_main, R.id.logs_filter, false,
                R.id.logs_pause, R.id.logs_clear, R.id.logs_share);
    }

    @Test public void terminalInputAndRunStayAboveKeyboard() {
        check(TerminalActivity.class, R.id.sync_main, R.id.terminal_input, false, R.id.terminal_send);
    }

    @Test public void landscapeKeepsAppControlsAndDismissalVisible() {
        check(TerminalActivity.class, R.id.sync_main, R.id.terminal_input, true, R.id.terminal_send);
    }

    @Test public void mainTabsMakeRoomInLandscapeAndReturnAfterDismissal() {
        check(TerminalActivity.class, R.id.main, R.id.terminal_input, true, true, R.id.terminal_send);
    }

    private <A extends Activity> void check(Class<A> screen, int rootId, int fieldId,
                                           boolean landscape, int... actionIds) {
        check(screen, rootId, fieldId, landscape, false, actionIds);
    }

    private <A extends Activity> void check(Class<A> screen, int rootId, int fieldId,
                                           boolean landscape, boolean mainTabs, int... actionIds) {
        try (ActivityScenario<A> scenario = ActivityScenario.launch(screen)) {
            scenario.onActivity(a -> a.setRequestedOrientation(landscape
                    ? ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
            await(scenario, a -> a.hasWindowFocus() && (a.getResources().getConfiguration().orientation ==
                    (landscape ? android.content.res.Configuration.ORIENTATION_LANDSCAPE
                            : android.content.res.Configuration.ORIENTATION_PORTRAIT)), "Screen not ready");
            if (mainTabs) scenario.onActivity(a -> {
                // Inflate the real main/tab/terminal layouts without starting a node service.
                TerminalActivity host = (TerminalActivity) a;
                host.setContentView(R.layout.activity_main);
                Toolbar toolbar = host.findViewById(R.id.toolbar);
                host.setSupportActionBar(toolbar);
                KeyboardInsets.install(host, host.findViewById(R.id.main), toolbar,
                        host.findViewById(R.id.tabs), host.findViewById(R.id.main_footer));
                ViewPager pager = host.findViewById(R.id.main_pager);
                pager.setAdapter(new PagerAdapter() {
                    @Override public int getCount() { return 1; }
                    @Override public boolean isViewFromObject(View v, Object o) { return v == o; }
                    @Override public Object instantiateItem(ViewGroup container, int position) {
                        View terminal = host.getLayoutInflater().inflate(R.layout.view_terminal, container, false);
                        container.addView(terminal);
                        return terminal;
                    }
                    @Override public void destroyItem(ViewGroup container, int position, Object item) {
                        container.removeView((View) item);
                    }
                });
            });
            if (mainTabs) await(scenario, a -> a.findViewById(fieldId) != null, "Terminal layout not ready");
            scenario.onActivity(a -> ((EditText) a.findViewById(fieldId)).setText(INPUT));
            showKeyboard(scenario, fieldId);
            await(scenario, a -> keyboardVisible(a, rootId), "Keyboard did not open");
            SystemClock.sleep(500); // Insets visibility precedes completion of the IME animation.
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();

            for (int actionId : actionIds) {
                scenario.onActivity(a -> {
                    View action = a.findViewById(actionId);
                    action.requestRectangleOnScreen(new Rect(0, 0, action.getWidth(), action.getHeight()), true);
                });
                InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                capture(screen.getSimpleName() + (landscape ? "-landscape" : "") + "-keyboard.png");
                scenario.onActivity(a -> assertAboveKeyboard(a, rootId, actionId));
            }
            scenario.onActivity(a -> {
                assertAboveKeyboard(a, rootId, R.id.keyboard_dismiss);
                assertTrue(( ((EditText) a.findViewById(fieldId)).getImeOptions()
                        & EditorInfo.IME_FLAG_NO_EXTRACT_UI) != 0);
            });
            capture(screen.getSimpleName() + (landscape ? "-landscape" : "") + "-keyboard.png");
            scenario.onActivity(a -> a.findViewById(R.id.keyboard_dismiss).performClick());
            await(scenario, a -> !keyboardVisible(a, rootId), "Toolbar did not dismiss keyboard");
            SystemClock.sleep(500);
            scenario.onActivity(a -> {
                assertEquals(INPUT, ((EditText) a.findViewById(fieldId)).getText().toString());
                assertEquals(View.GONE, a.findViewById(R.id.keyboard_dismiss).getVisibility());
                if (mainTabs) {
                    assertEquals(View.VISIBLE, a.findViewById(R.id.tabs).getVisibility());
                    assertEquals(View.VISIBLE, a.findViewById(R.id.main_footer).getVisibility());
                }
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(a.findViewById(rootId));
                assertEquals(insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom,
                        a.findViewById(rootId).getPaddingBottom());
            });

            showKeyboard(scenario, fieldId);
            await(scenario, a -> keyboardVisible(a, rootId), "Keyboard did not reopen");
            SystemClock.sleep(500); // Let Android install the IME's Back callback before pressing Back.
            InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
            await(scenario, a -> !keyboardVisible(a, rootId), "Back did not dismiss keyboard");
            scenario.onActivity(a -> {
                assertFalse(a.isFinishing());
                assertEquals(INPUT, ((EditText) a.findViewById(fieldId)).getText().toString());
            });
        }
    }

    private <A extends Activity> void showKeyboard(ActivityScenario<A> scenario, int fieldId) {
        scenario.onActivity(a -> {
            EditText field = a.findViewById(fieldId);
            field.requestFocus();
            field.requestRectangleOnScreen(new Rect(0, 0, field.getWidth(), field.getHeight()), true);
            ((InputMethodManager) a.getSystemService(Context.INPUT_METHOD_SERVICE))
                    .showSoftInput(field, InputMethodManager.SHOW_IMPLICIT);
        });
    }

    private static boolean keyboardVisible(Activity a, int rootId) {
        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(a.findViewById(rootId));
        return insets != null && insets.isVisible(WindowInsetsCompat.Type.ime());
    }

    private static void assertAboveKeyboard(Activity a, int rootId, int viewId) {
        View view = a.findViewById(viewId);
        assertTrue("Control missing", view.isShown());
        Rect visible = new Rect();
        assertTrue(view.getGlobalVisibleRect(visible));
        assertEquals("Control clipped vertically", view.getHeight(), visible.height());
        assertEquals("Control clipped horizontally", view.getWidth(), visible.width());
        View decor = a.getWindow().getDecorView();
        int[] origin = new int[2];
        decor.getLocationOnScreen(origin);
        int imeHeight = ViewCompat.getRootWindowInsets(a.findViewById(rootId))
                .getInsets(WindowInsetsCompat.Type.ime()).bottom;
        int[] position = new int[2];
        view.getLocationOnScreen(position);
        assertTrue("Control covered by keyboard", position[1] + view.getHeight() <= origin[1] + decor.getHeight() - imeHeight);
    }

    private <A extends Activity> void await(ActivityScenario<A> scenario, Predicate<A> condition, String message) {
        long end = SystemClock.uptimeMillis() + 10000;
        AtomicBoolean done = new AtomicBoolean();
        do {
            scenario.onActivity(a -> done.set(condition.test(a)));
            if (done.get()) return;
            SystemClock.sleep(100);
        } while (SystemClock.uptimeMillis() < end);
        fail(message);
    }

    private static void capture(String name) {
        Bitmap screenshot = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(screenshot);
        Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();
        try (FileOutputStream out = new FileOutputStream(new File(app.getCacheDir(), name))) {
            screenshot.compress(Bitmap.CompressFormat.PNG, 100, out);
        } catch (Exception e) { throw new AssertionError(e); }
        finally { screenshot.recycle(); }
    }
}
