package com.eurobuddha.minimacore;

import android.content.Context;
import android.graphics.Bitmap;
import android.os.Build;
import android.view.View;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.launcher.LauncherActivity;
import com.eurobuddha.minimacore.lock.AppLock;
import com.eurobuddha.minimacore.lock.LockSettingsActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.*;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static androidx.test.espresso.matcher.RootMatchers.isDialog;

/** Reuses the existing ActivityScenario screen tests; only run on a disposable emulator.
 * Never starts a node, creates a wallet or requests a blockchain operation. */
@RunWith(AndroidJUnit4.class)
public class LanguageScreensTest {
    private static final String[] CODES = {"en", "zh-Hans", "ru", "uk"};
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    @Before public void prepare() {
        assertEquals("Pass bearLanguagesDisposable=true for the fresh test emulator", "true",
                InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"));
        assertEquals("Localization tests require a disposable emulator", "ranchu", Build.HARDWARE);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            AppLock.disable(context);
            Language.select(context, "en");
        });
        settle();
    }
    @After public void reset() {
        if (!"ranchu".equals(Build.HARDWARE)
                || !"true".equals(InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"))) return;
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            AppLock.disable(context);
            Language.select(context, "en");
        });
    }
    private void settle() {
        android.os.SystemClock.sleep(700);
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    }
    private String text(int resource, Object... arguments) { return Language.text(context, resource, arguments); }
    private void select(String code) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> Language.select(context, code));
        settle();
    }
    private void screenshot(String name) throws Exception {
        File dir = new File(context.getExternalFilesDir(null), "language-tests");
        assertTrue(dir.isDirectory() || dir.mkdirs());
        Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(bitmap);
        try (FileOutputStream out = new FileOutputStream(new File(dir, name + ".png"))) {
            assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, out));
        } finally { bitmap.recycle(); }
    }
    @Test public void explicitChooserIncludesUkrainianAndRemembersIt() throws Exception {
        context.getSharedPreferences("minimacore_language", Context.MODE_PRIVATE).edit().putBoolean("chosen", false).commit();
        try (ActivityScenario<LauncherActivity> screen = ActivityScenario.launch(LauncherActivity.class)) {
            onView(withText("Language · 语言 · Язык · Мова")).inRoot(isDialog()).check(matches(isDisplayed()));
            screenshot("chooser");
            onView(withText("Українська")).inRoot(isDialog()).perform(click());
            settle();
            assertEquals("uk", Language.code());
            assertTrue(Language.hasChoice(context));
        }
        try (ActivityScenario<LauncherActivity> screen = ActivityScenario.launch(LauncherActivity.class)) {
            onView(withId(R.id.launcher_button_newwallet)).check(matches(withText("Новий гаманець")));
        }
    }
    @Test public void launcherChangesAllFourLanguagesWithoutRecreation() throws Exception {
        try (ActivityScenario<LauncherActivity> screen = ActivityScenario.launch(LauncherActivity.class)) {
            AtomicReference<LauncherActivity> original = new AtomicReference<>();
            screen.onActivity(original::set);
            for (String code : CODES) {
                select(code);
                screen.onActivity(a -> {
                    assertSame("Locale switch recreated launcher", original.get(), a);
                    assertEquals(text(l10n_launcher_new_wallet), ((TextView)a.findViewById(R.id.launcher_button_newwallet)).getText().toString());
                    assertEquals(text(l10n_language_title), ((TextView)a.findViewById(R.id.launcher_language)).getText().toString());
                });
                screenshot("launcher-" + code);
            }
        }
    }
    @Test public void openPinDialogKeepsDraftsValidationAndButtonsAcrossLanguages() throws Exception {
        try (ActivityScenario<LockSettingsActivity> screen = ActivityScenario.launch(LockSettingsActivity.class)) {
            AtomicReference<LockSettingsActivity> original = new AtomicReference<>();
            screen.onActivity(a -> { original.set(a); a.findViewById(R.id.lock_switch_enable).performClick(); });
            onView(withHint(text(l10n_lock_new_pin, 4, 8))).inRoot(isDialog()).perform(replaceText("1234"));
            onView(withHint(text(l10n_lock_confirm_pin))).inRoot(isDialog()).perform(replaceText("5678"), closeSoftKeyboard());
            for (String code : CODES) {
                select(code);
                screen.onActivity(a -> assertSame("Locale switch recreated PIN settings", original.get(), a));
                onView(withHint(text(l10n_lock_new_pin, 4, 8))).inRoot(isDialog()).check(matches(withText("1234")));
                onView(withHint(text(l10n_lock_confirm_pin))).inRoot(isDialog()).check(matches(withText("5678")));
                onView(withText(text(l10n_common_save))).inRoot(isDialog()).perform(click());
                onView(withHint(text(l10n_lock_confirm_pin))).inRoot(isDialog()).check(matches(hasErrorText(text(l10n_lock_mismatch))));
                assertFalse("Invalid confirmation enabled the lock", AppLock.isEnabled(context));
                screenshot("pin-dialog-" + code);
            }
            onView(withText(text(l10n_common_cancel))).inRoot(isDialog()).perform(click());
            screen.onActivity(a -> assertEquals(View.GONE, a.findViewById(R.id.lock_options).getVisibility()));
        }
    }
    @Test public void generatedRecoveryWordsStayIdenticalAcrossLanguages() {
        try (ActivityScenario<com.eurobuddha.minimacore.launcher.newwallet.NewWalletActivity> screen =
                ActivityScenario.launch(com.eurobuddha.minimacore.launcher.newwallet.NewWalletActivity.class)) {
            AtomicReference<android.app.Activity> original = new AtomicReference<>();
            AtomicReference<String> words = new AtomicReference<>();
            screen.onActivity(a -> {
                original.set(a);
                words.set(((TextView)a.findViewById(R.id.newwallet_seed)).getText().toString());
                assertFalse(words.get().isEmpty());
            });
            for (String code : CODES) {
                select(code);
                screen.onActivity(a -> {
                    assertSame("Language switch must not generate a new recovery phrase", original.get(), a);
                    assertEquals(words.get(), ((TextView)a.findViewById(R.id.newwallet_seed)).getText().toString());
                    assertEquals(text(l10n_launcher_new_wallet), ((androidx.appcompat.widget.Toolbar)a.findViewById(R.id.toolbar)).getTitle());
                    assertEquals(text(l10n_onboarding_saved_seed), ((TextView)a.findViewById(R.id.newwallet_button_proceed)).getText().toString());
                });
            }
        }
    }
    @Test public void seedInputAndOpenValidationDialogSurviveLanguageChanges() throws Exception {
        try (ActivityScenario<com.eurobuddha.minimacore.launcher.newwallet.NewWalletRestoreActivity> screen =
                ActivityScenario.launch(com.eurobuddha.minimacore.launcher.newwallet.NewWalletRestoreActivity.class)) {
            AtomicReference<android.app.Activity> original = new AtomicReference<>();
            screen.onActivity(a -> {
                original.set(a);
                android.widget.EditText input = a.findViewById(R.id.restorewallet_seed);
                input.setText("invalid-draft 中文 Русский Українська");
                input.setSelection(7);
                a.findViewById(R.id.restorewallet_button_check).performClick();
            });
            for (String code : CODES) {
                select(code);
                screen.onActivity(a -> {
                    assertSame(original.get(), a);
                    android.widget.EditText input = a.findViewById(R.id.restorewallet_seed);
                    assertEquals("invalid-draft 中文 Русский Українська", input.getText().toString());
                    assertEquals(7, input.getSelectionStart());
                    assertEquals(text(l10n_onboarding_seed_hint), input.getHint().toString());
                });
                onView(withText(text(l10n_onboarding_invalid_word))).inRoot(isDialog()).check(matches(isDisplayed()));
                onView(withText(text(l10n_common_ok))).inRoot(isDialog()).check(matches(isDisplayed()));
                screenshot("seed-validation-" + code);
            }
            onView(withText(text(l10n_common_ok))).inRoot(isDialog()).perform(click());
        }
    }
    @Test public void autoLockChoiceKeepsStoredMinutesAndUsesTranslatedRows() {
        AppLock.setPin(context, "1234");
        AppLock.get().unlock();
        AppLock.setAutolockMinutes(context, 5);
        try (ActivityScenario<LockSettingsActivity> screen = ActivityScenario.launch(LockSettingsActivity.class)) {
            onView(withId(R.id.lock_autolock)).check(matches(withText(text(l10n_lock_five_minutes))));
            onView(withId(R.id.lock_autolock)).perform(click());
            select("uk");
            onView(withText(text(l10n_lock_fifteen_minutes))).inRoot(isDialog()).perform(click());
            assertEquals(15, AppLock.autolockMinutes(context));
            onView(withId(R.id.lock_autolock)).check(matches(withText(text(l10n_lock_fifteen_minutes))));
        }
    }
}
