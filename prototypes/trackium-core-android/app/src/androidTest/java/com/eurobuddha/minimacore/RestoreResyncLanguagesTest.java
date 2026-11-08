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
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.launcher.restore.RestoreWalletSyncActivity;
import com.eurobuddha.minimacore.main.ResyncJob;
import com.eurobuddha.minimacore.main.ResyncSession;
import com.eurobuddha.minimacore.main.SeedSyncActivity;
import com.eurobuddha.minimacore.main.StartupMode;
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

/** Disposable UI fixtures only. Never approves resync, submits a valid restore, or starts a node. */
@RunWith(AndroidJUnit4.class)
public class RestoreResyncLanguagesTest {
    private static final String[] CODES = {"en", "zh-Hans", "ru", "uk"};
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    private SharedPreferences prefs;
    @Before public void prepare() {
        assertEquals("true", InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"));
        assertEquals("ranchu", Build.HARDWARE);
        assertNull("No node may be running", org.minima.system.Main.getInstance());
        prefs = context.getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
        assertFalse("A configured wallet is forbidden", prefs.getBoolean("SEED_SET", false));
        assertFalse(prefs.contains("SEED"));
        assertEquals(ResyncSession.State.IDLE, ResyncSession.get().state());
        select("en");
    }
    @After public void clean() {
        if (!"ranchu".equals(Build.HARDWARE)
                || !"true".equals(InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"))) return;
        assertNull(org.minima.system.Main.getInstance());
        assertFalse(prefs.getBoolean("SEED_SET", false));
        assertFalse(prefs.contains("SEED"));
        ResyncSession.get().reset();
        prefs.edit().remove(SeedSyncActivity.PREF_PENDING).remove(SeedSyncActivity.PREF_PENDING_LABEL).commit();
        select("en");
    }
    private void select(String code) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> Language.select(context, code));
        android.os.SystemClock.sleep(650);
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    }
    private String text(int id, Object... args) { return Language.text(context, id, args); }
    private void snapshot(String name) throws Exception {
        java.io.File dir = new java.io.File(context.getExternalFilesDir(null), "language-tests");
        assertTrue(dir.isDirectory() || dir.mkdirs());
        android.graphics.Bitmap image = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(image);
        try (java.io.FileOutputStream stream = new java.io.FileOutputStream(new java.io.File(dir, name + ".png"))) {
            assertTrue(image.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, stream));
        } finally { image.recycle(); }
    }
    @Test public void restoreDraftCursorValidationAndModeWarningSurviveAllLanguages() throws Exception {
        try (ActivityScenario<RestoreWalletSyncActivity> screen = ActivityScenario.launch(RestoreWalletSyncActivity.class)) {
            AtomicReference<RestoreWalletSyncActivity> first = new AtomicReference<>();
            screen.onActivity(a -> {
                first.set(a);
                EditText seed = a.findViewById(R.id.restorewallet_seed);
                seed.setText("invalid-draft 中文 Русский Українська"); seed.setSelection(7);
                ((EditText)a.findViewById(R.id.restorewallet_keyuses)).setText("0");
                ((EditText)a.findViewById(R.id.restorewallet_megammr)).setText("node.example.org:9001");
                a.findViewById(R.id.restorewallet_button_check).performClick();
            });
            for (String code : CODES) {
                select(code);
                screen.onActivity(a -> {
                    assertSame(first.get(), a);
                    EditText seed = a.findViewById(R.id.restorewallet_seed);
                    assertEquals("invalid-draft 中文 Русский Українська", seed.getText().toString());
                    assertEquals(7, seed.getSelectionStart());
                    assertEquals(text(l10n_onboarding_seed_hint), seed.getHint().toString());
                    assertEquals("0", ((TextView)a.findViewById(R.id.restorewallet_keyuses)).getText().toString());
                    assertEquals("node.example.org:9001", ((TextView)a.findViewById(R.id.restorewallet_megammr)).getText().toString());
                    boolean block = StartupMode.usesBlockKeys(prefs);
                    String intro = text(BuildConfig.PANDAMONIUM ? l10n_restore_intro_pandamonium
                            : block ? l10n_restore_intro_block : l10n_restore_intro_classic);
                    if (BuildConfig.PANDAMONIUM) intro = text(block ? l10n_drawer_block_mode : l10n_drawer_classic_mode) + "\n\n" + intro;
                    assertEquals(intro, ((TextView)a.findViewById(R.id.restorewallet_intro)).getText().toString());
                    assertEquals(text(BuildConfig.BLOCK_KEYUSES ? l10n_restore_key_uses_floor : l10n_restore_key_uses),
                            ((TextView)a.findViewById(R.id.restorewallet_keyuses_label)).getText().toString());
                    assertEquals(text(l10n_launcher_restore_wallet), ((Toolbar)a.findViewById(R.id.toolbar)).getTitle());
                });
                onView(withText(text(l10n_onboarding_invalid_word))).inRoot(isDialog()).check(matches(isDisplayed()));
            }
            snapshot("restore-validation-uk");
            onView(withText(text(l10n_common_ok))).inRoot(isDialog()).perform(click());
            // Zero is refused in both key families, before preferences or the node can be touched.
            screen.onActivity(a -> a.findViewById(R.id.restorewallet_button_proceed).performClick());
            for (String code : CODES) {
                select(code);
                onView(withText(text(l10n_restore_key_uses_range, ResyncJob.MIN_KEY_USES,
                        ResyncJob.maxKeyUses(StartupMode.usesBlockKeys(prefs)))))
                        .inRoot(isDialog()).check(matches(isDisplayed()));
                assertFalse(prefs.contains("KEYUSES"));
            }
            onView(withText(text(l10n_common_ok))).inRoot(isDialog()).perform(click());
        }
    }
    @Test public void resyncConfirmationAndHostErrorKeepTheOriginalHost() throws Exception {
        try (ActivityScenario<SeedSyncActivity> screen = ActivityScenario.launch(SeedSyncActivity.class)) {
            AtomicReference<SeedSyncActivity> first = new AtomicReference<>();
            screen.onActivity(a -> {
                first.set(a);
                EditText host = a.findViewById(R.id.seed_sync_host);
                host.setText("node.example.org:9001"); host.setSelection(4);
                a.findViewById(R.id.seed_sync_proceed).performClick();
            });
            for (String code : CODES) {
                select(code);
                screen.onActivity(a -> {
                    assertSame(first.get(), a);
                    EditText host = a.findViewById(R.id.seed_sync_host);
                    assertEquals("node.example.org:9001", host.getText().toString());
                    assertEquals(4, host.getSelectionStart());
                    assertEquals(text(l10n_resync_title), ((Toolbar)a.findViewById(R.id.toolbar)).getTitle());
                });
                onView(withText(text(l10n_resync_confirm_body, "node.example.org:9001"))).inRoot(isDialog()).check(matches(isDisplayed()));
                onView(withText(text(l10n_resync_operation))).inRoot(isDialog()).check(matches(isDisplayed()));
                assertEquals(ResyncSession.State.IDLE, ResyncSession.get().state());
                assertFalse(prefs.getBoolean(SeedSyncActivity.PREF_PENDING, false));
            }
            snapshot("resync-confirmation-uk");
            onView(withText(text(l10n_common_cancel))).inRoot(isDialog()).perform(click());
            screen.onActivity(a -> {
                EditText host = a.findViewById(R.id.seed_sync_host);
                host.setText("bad;quit"); host.setSelection(3);
                a.findViewById(R.id.seed_sync_proceed).performClick();
            });
            for (String code : CODES) {
                select(code);
                screen.onActivity(a -> {
                    EditText host = a.findViewById(R.id.seed_sync_host);
                    assertEquals("bad;quit", host.getText().toString());
                    assertEquals(3, host.getSelectionStart());
                    assertEquals(text(l10n_resync_host_error), host.getError().toString());
                });
            }
        }
    }
    @Test public void interruptedOperationsTranslateSummaryButPreserveProtocolAndLog() {
        String[] operations = {"Resync", "Restore", "Seed restore"};
        int[] labels = {l10n_resync_operation, l10n_resync_restore_operation, l10n_resync_seed_operation};
        int[] titles = {l10n_resync_title, l10n_resync_restore_title, l10n_resync_seed_title};
        for (int i = 0; i < operations.length; i++) {
            final int index = i;
            prefs.edit().putBoolean(SeedSyncActivity.PREF_PENDING, true)
                    .putString(SeedSyncActivity.PREF_PENDING_LABEL, operations[i]).commit();
            try (ActivityScenario<SeedSyncActivity> screen = ActivityScenario.launch(SeedSyncActivity.class)) {
                String rawResult = ResyncSession.get().result();
                String rawLog = String.join("\n", ResyncSession.get().log.snapshot());
                AtomicReference<SeedSyncActivity> first = new AtomicReference<>();
                screen.onActivity(first::set);
                for (String code : CODES) {
                    select(code);
                    screen.onActivity(a -> {
                        assertSame(first.get(), a);
                        assertEquals(text(l10n_resync_interrupted, text(labels[index])),
                                ((TextView)a.findViewById(R.id.seed_sync_status)).getText().toString());
                        assertEquals(text(titles[index]), ((Toolbar)a.findViewById(R.id.toolbar)).getTitle());
                        assertEquals(index == 0 ? View.VISIBLE : View.GONE, a.findViewById(R.id.seed_sync_host).getVisibility());
                        assertEquals(View.GONE, a.findViewById(R.id.seed_sync_progress).getVisibility());
                        assertTrue(a.findViewById(R.id.seed_sync_restart).isEnabled());
                        assertEquals(rawLog, ((TextView)a.findViewById(R.id.seed_sync_log)).getText().toString());
                    });
                    assertEquals(operations[index], prefs.getString(SeedSyncActivity.PREF_PENDING_LABEL, ""));
                    assertEquals(rawResult, ResyncSession.get().result());
                    assertEquals(ResyncSession.State.FAILED, ResyncSession.get().state());
                }
                screen.recreate();
                screen.onActivity(a -> assertEquals(text(l10n_resync_interrupted, text(labels[index])),
                        ((TextView)a.findViewById(R.id.seed_sync_status)).getText().toString()));
            } finally { ResyncSession.get().reset(); }
        }
    }
    @Test public void seedSyncProgressChangesLanguageWithoutRepeatingServiceOrKeyWork() throws Exception {
        AtomicReference<androidx.appcompat.app.AlertDialog> original = new AtomicReference<>();
        try (ActivityScenario<com.eurobuddha.minimacore.launcher.restore.SeedSyncHarnessActivity> screen =
                ActivityScenario.launch(com.eurobuddha.minimacore.launcher.restore.SeedSyncHarnessActivity.class)) {
            screen.onActivity(a -> original.set(a.progressDialog()));
            for (int stage = 0; stage < 3; stage++) {
                final int current = stage;
                if (stage == 1) screen.onActivity(a -> a.MinimaLoadKeys(17, false));
                if (stage == 2) screen.onActivity(a -> a.MinimaLoadKeys(org.minima.database.wallet.Wallet.NUMBER_GETADDRESS_KEYS, true));
                for (String code : CODES) {
                    select(code);
                    screen.onActivity(a -> {
                        assertSame(original.get(), a.progressDialog());
                        assertTrue(a.progressDialog().isShowing());
                        assertEquals(1, a.starts);
                        assertEquals(1, a.waits);
                        assertEquals(current == 2 ? 1 : 0, a.resyncs);
                        String expected = current == 0 ? text(l10n_seed_sync_wait)
                                : current == 1 ? text(l10n_seed_sync_generating, 17, org.minima.database.wallet.Wallet.NUMBER_GETADDRESS_KEYS)
                                : text(l10n_seed_sync_syncing, com.eurobuddha.minimacore.utils.Peers.getDefaultPeers(context));
                        assertEquals(expected, ((TextView)a.progressDialog().findViewById(android.R.id.message)).getText().toString());
                    });
                    onView(withText(text(l10n_seed_sync_title))).inRoot(isDialog()).check(matches(isDisplayed()));
                }
            }
            snapshot("seed-sync-progress-uk");
        }
        assertFalse("Progress window must close with its activity", original.get().isShowing());
    }

}
