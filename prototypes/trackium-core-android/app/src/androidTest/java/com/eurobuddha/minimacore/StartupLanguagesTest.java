package com.eurobuddha.minimacore;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import androidx.appcompat.widget.Toolbar;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.android.material.switchmaterial.SwitchMaterial;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.main.ParamsActivity;
import com.eurobuddha.minimacore.main.ResyncSession;
import com.eurobuddha.minimacore.main.SeedSyncActivity;
import com.eurobuddha.minimacore.main.StartupMode;
import com.eurobuddha.minimacore.testing.StartupHarnessActivity;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Before;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static androidx.test.espresso.matcher.RootMatchers.isDialog;

/** Disposable fixtures: no real service, restart, parser mutation, seed, or owner credential. */
@RunWith(AndroidJUnit4.class)
public class StartupLanguagesTest {
    private static final String[] CODES = {"en", "zh-Hans", "ru", "uk"};
    private static final String PASSWORD = "0123456789abcdef0123456789abcdef";
    private static final String[] KEYS = {ParamsActivity.PREF_PARAM_SERVER, ParamsActivity.PREF_PARAM_MEGAMMR,
            ParamsActivity.PREF_PARAM_RPC, ParamsActivity.PREF_PARAM_RPC_PASSWORD,
            ParamsActivity.PREF_AUTORESYNC, ParamsActivity.PREF_EXTRA_PARAMS, StartupMode.PREF_CLASSIC_MODE};
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    private SharedPreferences prefs;
    private Map<String, Object> original;
    @Before public void prepare() {
        assertEquals("true", InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"));
        assertEquals("ranchu", Build.HARDWARE);
        assertNull(org.minima.system.Main.getInstance());
        prefs = context.getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
        assertFalse(prefs.getBoolean("SEED_SET", false));
        assertFalse(prefs.contains("SEED"));
        assertFalse(prefs.getBoolean(SeedSyncActivity.PREF_PENDING, false));
        assertEquals(ResyncSession.State.IDLE, ResyncSession.get().state());
        original = new HashMap<>();
        Map<String, ?> all = prefs.getAll();
        SharedPreferences.Editor edit = prefs.edit();
        for (String key : KEYS) { if (all.containsKey(key)) original.put(key, all.get(key)); edit.remove(key); }
        assertTrue(edit.putString(ParamsActivity.PREF_PARAM_RPC_PASSWORD, PASSWORD).commit());
        StartupHarnessActivity.reset(); select("en");
    }
    @After public void clean() {
        if (original == null) return;
        SharedPreferences.Editor edit = prefs.edit();
        for (String key : KEYS) {
            edit.remove(key); Object value = original.get(key);
            if (value instanceof Boolean) edit.putBoolean(key, (Boolean)value);
            if (value instanceof String) edit.putString(key, (String)value);
        }
        assertTrue(edit.commit());
        assertNull(org.minima.system.Main.getInstance());
        assertFalse(prefs.getBoolean("SEED_SET", false));
        assertFalse(prefs.contains("SEED"));
        select("en");
    }
    private void settle() {
        android.os.SystemClock.sleep(650);
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    }
    private void select(String code) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> Language.select(context, code));
        settle();
    }
    private String text(int id, Object... args) { return Language.text(context, id, args); }
    private void visible(int id, Object... args) {
        onView(withText(text(id, args))).inRoot(isDialog()).check(matches(isDisplayed()));
    }
    private void button(int id, int label) {
        onView(withId(id)).inRoot(isDialog()).check(matches(withText(text(label))));
    }
    private void clickButton(int id) { onView(withId(id)).inRoot(isDialog()).perform(click()); }
    private void serviceCounts(int starts, int binds) {
        assertEquals(starts, StartupHarnessActivity.starts);
        assertEquals(binds, StartupHarnessActivity.binds);
        assertEquals(0, StartupHarnessActivity.navigations);
    }
    @Test public void waitingAndTimeoutKeepTheSameActivityAndSingleService() {
        AtomicReference<StartupHarnessActivity> first = new AtomicReference<>();
        try (ActivityScenario<StartupHarnessActivity> screen = ActivityScenario.launch(StartupHarnessActivity.class)) {
            screen.onActivity(first::set);
            for (String code : CODES) {
                select(code); screen.onActivity(a -> assertSame(first.get(), a));
                visible(l10n_startup_starting); visible(l10n_startup_waiting); serviceCounts(1, 1);
            }
            screen.onActivity(a -> { StartupHarnessActivity.waitMs = 0; a.waitForMinimaToStartUp(); });
            for (String code : CODES) {
                select(code); screen.onActivity(a -> assertSame(first.get(), a));
                visible(l10n_startup_slow); visible(l10n_startup_slow_body);
                button(android.R.id.button1, l10n_startup_keep_waiting);
                button(android.R.id.button2, l10n_language_close); serviceCounts(1, 1);
            }
            screen.onActivity(a -> StartupHarnessActivity.waitMs = 120_000);
            clickButton(android.R.id.button1); settle();
            visible(l10n_startup_waiting); serviceCounts(1, 1);
        }
        assertEquals(1, StartupHarnessActivity.unbinds);
    }
    @Test public void reportedFailureStaysOpenUntilTheUserChooses() {
        StartupHarnessActivity.failed = true;
        AtomicReference<StartupHarnessActivity> first = new AtomicReference<>();
        try (ActivityScenario<StartupHarnessActivity> screen = ActivityScenario.launch(StartupHarnessActivity.class)) {
            screen.onActivity(first::set);
            for (String code : CODES) {
                select(code); screen.onActivity(a -> assertSame(first.get(), a));
                visible(l10n_startup_error); visible(l10n_startup_error_body);
                button(android.R.id.button1, l10n_startup_open);
                button(android.R.id.button2, l10n_language_close); serviceCounts(1, 1);
            }
            clickButton(android.R.id.button2);
        }
        assertEquals(0, StartupHarnessActivity.navigations);
        assertEquals(1, StartupHarnessActivity.unbinds);
    }
    @Test public void serviceRejectionTranslatesAndRetryStartsOnlyOnce() {
        StartupHarnessActivity.rejectStart = true;
        AtomicReference<StartupHarnessActivity> first = new AtomicReference<>();
        try (ActivityScenario<StartupHarnessActivity> screen = ActivityScenario.launch(StartupHarnessActivity.class)) {
            screen.onActivity(first::set);
            for (String code : CODES) {
                select(code); screen.onActivity(a -> assertSame(first.get(), a));
                visible(l10n_seed_sync_start_failed); visible(l10n_startup_connection_failed);
                button(android.R.id.button1, l10n_startup_retry);
                button(android.R.id.button2, l10n_language_close); serviceCounts(1, 0);
            }
            screen.onActivity(a -> StartupHarnessActivity.rejectStart = false);
            clickButton(android.R.id.button1); settle(); visible(l10n_startup_waiting); serviceCounts(2, 1);
        }
        assertEquals(1, StartupHarnessActivity.unbinds);
    }
    @Test public void parameterDraftsCredentialsAndBlockedFlagsSurviveLanguageSwitches() {
        String draft = "-clean 中文 Русский Українська";
        AtomicReference<ParamsActivity> first = new AtomicReference<>();
        try (ActivityScenario<ParamsActivity> screen = ActivityScenario.launch(ParamsActivity.class)) {
            screen.onActivity(a -> {
                first.set(a);
                ((SwitchMaterial)a.findViewById(R.id.params_switch_rpc)).setChecked(true);
                ((SwitchMaterial)a.findViewById(R.id.params_switch_server)).setChecked(true);
                ((SwitchMaterial)a.findViewById(R.id.params_switch_classic)).setChecked(true);
                EditText extra = a.findViewById(R.id.params_extra); extra.setText(draft); extra.setSelection(9);
                a.findViewById(R.id.params_button_save).performClick();
            });
            for (String code : CODES) {
                select(code);
                screen.onActivity(a -> {
                    assertSame(first.get(), a);
                    EditText extra = a.findViewById(R.id.params_extra);
                    assertEquals(draft, extra.getText().toString()); assertEquals(9, extra.getSelectionStart());
                    assertEquals("-p2pnodes host:port -txpowdbstore 3 …", extra.getHint().toString());
                    assertEquals(PASSWORD, ((TextView)a.findViewById(R.id.params_rpc_password)).getText().toString());
                    assertTrue(((SwitchMaterial)a.findViewById(R.id.params_switch_rpc)).isChecked());
                    assertTrue(((SwitchMaterial)a.findViewById(R.id.params_switch_server)).isChecked());
                    assertTrue(((SwitchMaterial)a.findViewById(R.id.params_switch_classic)).isChecked());
                    assertEquals(text(l10n_params_rpc), ((TextView)a.findViewById(R.id.params_switch_rpc)).getText().toString());
                    assertEquals(text(l10n_common_save), ((TextView)a.findViewById(R.id.params_button_save)).getText().toString());
                    assertEquals(text(l10n_menu_params), ((Toolbar)a.findViewById(R.id.toolbar)).getTitle());
                    assertEquals(BuildConfig.PANDAMONIUM ? View.VISIBLE : View.GONE, a.findViewById(R.id.params_classic_row).getVisibility());
                });
                visible(l10n_params_blocked); visible(l10n_params_blocked_body, "-clean");
                button(android.R.id.button1, android.R.string.yes);
                assertFalse(prefs.contains(ParamsActivity.PREF_EXTRA_PARAMS));
                assertFalse(prefs.contains(ParamsActivity.PREF_PARAM_RPC));
                assertEquals(PASSWORD, prefs.getString(ParamsActivity.PREF_PARAM_RPC_PASSWORD, ""));
            }
            clickButton(android.R.id.button1);
            screen.onActivity(a -> {
                ((EditText)a.findViewById(R.id.params_extra)).setText("-blockaskeyuses");
                a.findViewById(R.id.params_button_save).performClick();
            });
            for (String code : CODES) {
                select(code);
                visible(BuildConfig.PANDAMONIUM ? l10n_params_managed : l10n_params_blocked);
                visible(BuildConfig.PANDAMONIUM ? l10n_params_managed_body : l10n_params_blocked_body, "-blockaskeyuses");
                assertFalse(prefs.contains(ParamsActivity.PREF_EXTRA_PARAMS));
            }
            clickButton(android.R.id.button1);
        }
    }
    @Test public void restartConfirmationTranslatesWithoutRestartingOrChangingSavedSettings() {
        AtomicReference<ParamsActivity> first = new AtomicReference<>();
        try (ActivityScenario<ParamsActivity> screen = ActivityScenario.launch(ParamsActivity.class)) {
            screen.onActivity(a -> {
                first.set(a);
                assertEquals(BuildConfig.PANDAMONIUM ? View.GONE : View.VISIBLE, a.findViewById(R.id.params_button_save_restart).getVisibility());
                ((SwitchMaterial)a.findViewById(R.id.params_switch_server)).setChecked(true);
                ((SwitchMaterial)a.findViewById(R.id.params_switch_classic)).setChecked(true);
                // Exercise the existing listener without enabling a real seed or node. Never approve restart.
                a.findViewById(R.id.params_button_save_restart).performClick();
            });
            for (String code : CODES) {
                select(code); screen.onActivity(a -> assertSame(first.get(), a));
                visible(l10n_params_restart_title); visible(l10n_params_restart_body);
                button(android.R.id.button1, android.R.string.yes); button(android.R.id.button2, android.R.string.no);
                assertTrue(prefs.getBoolean(ParamsActivity.PREF_PARAM_SERVER, false));
                assertEquals(BuildConfig.PANDAMONIUM, prefs.getBoolean(StartupMode.PREF_CLASSIC_MODE, false));
                assertEquals("", prefs.getString(ParamsActivity.PREF_EXTRA_PARAMS, "missing"));
                assertEquals(PASSWORD, prefs.getString(ParamsActivity.PREF_PARAM_RPC_PASSWORD, ""));
                assertNull(org.minima.system.Main.getInstance());
            }
            clickButton(android.R.id.button2);
            screen.onActivity(a -> assertFalse(a.isFinishing()));
        }
    }
}
