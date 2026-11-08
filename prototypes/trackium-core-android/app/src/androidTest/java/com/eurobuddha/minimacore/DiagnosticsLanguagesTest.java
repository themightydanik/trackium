package com.eurobuddha.minimacore;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.TextView;
import androidx.appcompat.widget.Toolbar;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.main.views.terminal.TerminalView;
import com.eurobuddha.minimacore.main.views.pending.PendingView;
import com.eurobuddha.minimacore.testing.TerminalHarnessActivity;
import com.eurobuddha.minimacore.testing.LogsHarnessActivity;
import com.eurobuddha.minimacore.utils.LogBuffer;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Before;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static com.eurobuddha.minimacore.i18n.R.string.*;

/** Disposable UI state only; command submissions and external sharing are intercepted. */
@RunWith(AndroidJUnit4.class)
public class DiagnosticsLanguagesTest {
    private static final String[] CODES = {"en", "zh-Hans", "ru", "uk"};
    private static final String RAW = "{\"status\":false,\"error\":\"Pause 中文 Русский Українська {flag} $1\"}";
    private static final String DRAFT = "coins relevant:true 中文 Русский Українська";
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    private boolean prepared;
    @Before public void prepare() {
        assertEquals("true", InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"));
        assertEquals("ranchu", Build.HARDWARE);
        assertNull(org.minima.system.Main.getInstance());
        android.content.SharedPreferences prefs = context.getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
        assertFalse(prefs.getBoolean("SEED_SET", false)); assertFalse(prefs.contains("SEED"));
        prepared = true; LogBuffer.clear(); select("en");
    }
    @After public void clean() {
        if (!prepared) return;
        assertNull(org.minima.system.Main.getInstance()); LogBuffer.clear(); select("en");
    }
    private void settle() {
        android.os.SystemClock.sleep(400);
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    }
    private void select(String code) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> Language.select(context, code)); settle();
    }
    private String text(int id, Object... args) { return Language.text(context, id, args); }
    private void banner(View root) {
        TextView label = root.findViewById(R.id.terminal_banner);
        assertEquals(android.graphics.Typeface.MONOSPACE, label.getTypeface());
        String banner = label.getText().toString();
        assertTrue(banner.contains("**********************************************"));
        assertTrue(banner.contains(text(l10n_terminal_welcome, org.minima.system.params.GlobalParams.getFullMicroVersion())));
        assertTrue(banner.endsWith(text(l10n_terminal_help)));
        assertEquals(text(l10n_terminal_run), ((TextView)root.findViewById(R.id.terminal_send)).getText().toString());
    }
    private void snapshot(String name) throws Exception {
        java.io.File dir = new java.io.File(context.getExternalFilesDir(null), "language-tests");
        assertTrue(dir.isDirectory() || dir.mkdirs());
        android.graphics.Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(bitmap);
        try (java.io.FileOutputStream out = new java.io.FileOutputStream(new java.io.File(dir, name + ".png"))) {
            assertTrue(bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out));
        } finally { bitmap.recycle(); }
    }
    @Test public void terminalActivityPreservesTranscriptDraftAndCommandAcrossLanguages() throws Exception {
        AtomicReference<TerminalHarnessActivity> first = new AtomicReference<>();
        try (ActivityScenario<TerminalHarnessActivity> screen = ActivityScenario.launch(TerminalHarnessActivity.class)) {
            screen.onActivity(a -> {
                first.set(a); a.appendText(RAW);
                EditText input = a.findViewById(R.id.terminal_input); input.setText(DRAFT); input.setSelection(6);
            }); settle();
            for (String code : CODES) {
                select(code);
                screen.onActivity(a -> {
                    assertSame(first.get(), a); banner(a.findViewById(R.id.main));
                    assertEquals(text(l10n_tab_terminal), ((Toolbar)a.findViewById(R.id.toolbar)).getTitle());
                    EditText input = a.findViewById(R.id.terminal_input);
                    assertEquals(DRAFT, input.getText().toString()); assertEquals(6, input.getSelectionStart());
                    assertEquals(text(l10n_terminal_input), input.getHint().toString());
                    assertEquals("\n"+RAW, ((TextView)a.findViewById(R.id.terminal_maintext)).getText().toString());
                    assertEquals(0, a.submissions);
                    input.onEditorAction(EditorInfo.IME_ACTION_NEXT);
                }); settle();
                screen.onActivity(a -> assertEquals(DRAFT, ((EditText)a.findViewById(R.id.terminal_input)).getText().toString()));
            }
            snapshot("terminal-uk");
            screen.onActivity(a -> ((EditText)a.findViewById(R.id.terminal_input)).onEditorAction(EditorInfo.IME_ACTION_SEND)); settle();
            screen.onActivity(a -> {
                assertEquals(1, a.submissions); assertEquals(DRAFT, a.command);
                EditText input = a.findViewById(R.id.terminal_input); assertEquals("", input.getText().toString());
                input.setText("status"); input.onEditorAction(EditorInfo.IME_ACTION_DONE);
            }); settle();
            screen.onActivity(a -> { assertEquals(2, a.submissions); assertEquals("status", a.command); });
        }
    }
    @Test public void lateInflatedTerminalAndPendingViewsUseTheCurrentLanguageImmediately() {
        select("uk");
        try (ActivityScenario<TerminalHarnessActivity> screen = ActivityScenario.launch(TerminalHarnessActivity.class)) {
            AtomicReference<TerminalView> view = new AtomicReference<>();
            int[] calls = {0}; String[] command = {null};
            screen.onActivity(a -> {
                TerminalView v = new TerminalView(a) {
                    @Override public void runCMD(String value) { calls[0]++; command[0] = value; }
                };
                view.set(v); a.setContentView(v.getMainView());
                banner(v.getMainView());
                assertEquals(text(l10n_terminal_input), ((EditText)v.getMainView().findViewById(R.id.terminal_input)).getHint().toString());
                v.appendText(RAW);
                EditText input = v.getMainView().findViewById(R.id.terminal_input); input.setText(DRAFT); input.setSelection(5);
                PendingView pending = new PendingView(a);
                assertEquals(text(l10n_pending_empty), ((TextView)pending.getMainView().findViewById(R.id.home_text)).getText().toString());
                View icon = ((ViewGroup)pending.getMainView()).getChildAt(0);
                assertEquals(text(l10n_wallet_pending), icon.getContentDescription().toString());
            }); settle();
            for (String code : CODES) {
                select(code);
                screen.onActivity(a -> {
                    View root = view.get().getMainView(); banner(root);
                    EditText input = root.findViewById(R.id.terminal_input);
                    assertEquals(DRAFT, input.getText().toString()); assertEquals(5, input.getSelectionStart());
                    assertEquals("\n"+RAW, ((TextView)root.findViewById(R.id.terminal_maintext)).getText().toString());
                    assertEquals(0, calls[0]); input.onEditorAction(EditorInfo.IME_ACTION_NEXT);
                }); settle();
            }
            screen.onActivity(a -> ((EditText)view.get().getMainView().findViewById(R.id.terminal_input)).onEditorAction(EditorInfo.IME_ACTION_SEND)); settle();
            screen.onActivity(a -> {
                assertEquals(1, calls[0]); assertEquals(DRAFT, command[0]);
                EditText input = view.get().getMainView().findViewById(R.id.terminal_input);
                assertEquals("", input.getText().toString()); input.setText("status");
                view.get().getMainView().findViewById(R.id.terminal_send).performClick();
            }); settle();
            screen.onActivity(a -> { assertEquals(2, calls[0]); assertEquals("status", command[0]); });
        }
    }
    @Test public void logsKeepPausedOutputFilterChipKeysAndSharePayloadLiteral() throws Exception {
        String firstLine = "match " + RAW, later = "match later 中文 Русский Українська";
        LogBuffer.append(firstLine); LogBuffer.append("excluded line");
        AtomicReference<LogsHarnessActivity> first = new AtomicReference<>();
        try (ActivityScenario<LogsHarnessActivity> screen = ActivityScenario.launch(LogsHarnessActivity.class)) {
            screen.onActivity(a -> {
                first.set(a); EditText filter = a.findViewById(R.id.logs_filter); filter.setText("match"); filter.setSelection(2);
                a.findViewById(R.id.logs_pause).performClick();
                ChipGroup chips = a.findViewById(R.id.logs_chips);
                ((Chip)chips.getChildAt(0)).setChecked(true); // No click; never dispatch a node command.
            }); settle(); LogBuffer.append(later); settle();
            String[] keys = {"scripts", "mining", "blocks", "networking", "ibd", "maxima"};
            int[] labels = {l10n_logs_scripts,l10n_logs_mining,l10n_logs_blocks,l10n_logs_networking,l10n_logs_ibd};
            for (String code : CODES) {
                select(code);
                screen.onActivity(a -> {
                    assertSame(first.get(), a);
                    assertEquals(text(l10n_menu_logs), ((Toolbar)a.findViewById(R.id.toolbar)).getTitle());
                    EditText filter = a.findViewById(R.id.logs_filter);
                    assertEquals("match", filter.getText().toString()); assertEquals(2, filter.getSelectionStart());
                    assertEquals(text(l10n_logs_filter), filter.getHint().toString());
                    assertEquals(text(l10n_logs_resume), ((TextView)a.findViewById(R.id.logs_pause)).getText().toString());
                    assertEquals(firstLine+"\n", ((TextView)a.findViewById(R.id.logs_maintext)).getText().toString());
                    ChipGroup chips = a.findViewById(R.id.logs_chips); assertEquals(keys.length, chips.getChildCount());
                    for (int i=0; i<keys.length; i++) {
                        Chip chip = (Chip)chips.getChildAt(i); assertEquals(keys[i], chip.getTag());
                        assertEquals(i == 0, chip.isChecked());
                        assertEquals(i<labels.length ? text(labels[i]) : "Maxima", chip.getText().toString());
                    }
                    a.findViewById(R.id.logs_share).performClick();
                    assertEquals(text(l10n_logs_share_title), a.chooser.getCharSequenceExtra(Intent.EXTRA_TITLE).toString());
                    Intent send = a.chooser.getParcelableExtra(Intent.EXTRA_INTENT);
                    assertEquals(Intent.ACTION_SEND, send.getAction()); assertEquals("text/plain", send.getType());
                    assertEquals(text(l10n_logs_subject), send.getStringExtra(Intent.EXTRA_SUBJECT));
                    assertEquals(firstLine+"\n", send.getStringExtra(Intent.EXTRA_TEXT));
                });
            }
            snapshot("logs-paused-uk");
            screen.onActivity(a -> a.findViewById(R.id.logs_pause).performClick()); settle();
            screen.onActivity(a -> {
                assertEquals(firstLine+"\n"+later+"\n", ((TextView)a.findViewById(R.id.logs_maintext)).getText().toString());
                assertEquals(text(l10n_logs_pause), ((TextView)a.findViewById(R.id.logs_pause)).getText().toString());
                a.findViewById(R.id.logs_clear).performClick();
                assertEquals("", ((TextView)a.findViewById(R.id.logs_maintext)).getText().toString());
                assertTrue(LogBuffer.snapshot().isEmpty());
            });
        }
    }
}
