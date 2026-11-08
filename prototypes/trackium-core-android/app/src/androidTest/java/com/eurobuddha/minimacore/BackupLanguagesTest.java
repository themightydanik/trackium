package com.eurobuddha.minimacore;

import android.content.Context;
import android.os.Build;
import android.view.View;
import android.view.WindowManager;
import android.widget.*;
import androidx.appcompat.widget.Toolbar;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.main.backup.*;
import com.eurobuddha.minimacore.main.ResyncSession;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.*;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static androidx.test.espresso.matcher.RootMatchers.isDialog;

/** No owner files or node. Only a synthetic .bak in the disposable emulator; confirmations are cancelled. */
@RunWith(AndroidJUnit4.class)
public class BackupLanguagesTest {
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    private static final String[] CODES = {"en","zh-Hans","ru","uk"};
    @Before public void guard() {
        assertEquals("true", InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"));
        assertEquals("ranchu", Build.HARDWARE);
        assertNull(org.minima.system.Main.getInstance());
        assertFalse(context.getSharedPreferences("main_prefs",0).contains("SEED"));
        assertEquals(BackupRun.State.IDLE, BackupRun.get().state());
        assertEquals(ResyncSession.State.IDLE, ResyncSession.get().state());
        select("en");
    }
    @After public void resetLanguage() {
        if (!"ranchu".equals(Build.HARDWARE) || !"true".equals(InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"))) return;
        assertNull(org.minima.system.Main.getInstance());
        assertEquals(BackupRun.State.IDLE, BackupRun.get().state());
        assertEquals(ResyncSession.State.IDLE, ResyncSession.get().state());
        select("en");
    }
    private void select(String code) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> Language.select(context,code));
        android.os.SystemClock.sleep(600);
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    }
    private String t(int id,Object...args){return Language.text(context,id,args);}
    private void invoke(Object owner,String method) {
        try { java.lang.reflect.Method m=owner.getClass().getDeclaredMethod(method);m.setAccessible(true);m.invoke(owner); }
        catch(Exception e){throw new AssertionError(e);}
    }
    private void secure(android.app.Activity a){assertTrue((a.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE)!=0);}
    @Test public void hubRetainsDisabledRowsAndTranslatedGate() {
        try(ActivityScenario<BackupActivity> screen=ActivityScenario.launch(BackupActivity.class)){
            AtomicReference<BackupActivity> original=new AtomicReference<>();screen.onActivity(original::set);
            int[] headings={l10n_backup_create,l10n_backup_restore,l10n_resync_title,l10n_backup_private_keys};
            for(String code:CODES){select(code);screen.onActivity(a->{
                assertSame(original.get(),a);
                assertEquals(t(l10n_menu_backup),((Toolbar)a.findViewById(R.id.toolbar)).getTitle());
                assertEquals(t(l10n_backup_node_stopped),((TextView)a.findViewById(R.id.backup_hub_gate)).getText().toString());
                LinearLayout rows=a.findViewById(R.id.backup_hub_rows);assertEquals(4,rows.getChildCount());
                for(int i=0;i<4;i++){View row=rows.getChildAt(i);assertFalse(row.isEnabled());assertEquals(t(headings[i]),((TextView)row.findViewById(R.id.backup_row_title)).getText().toString());}
            });}
        }
    }
    @Test public void backupInputsErrorsRevealAndExportWarningStayLive() {
        try(ActivityScenario<BackupCreateActivity> screen=ActivityScenario.launch(BackupCreateActivity.class)){
            AtomicReference<BackupCreateActivity> original=new AtomicReference<>();
            screen.onActivity(a->{original.set(a);secure(a);
                ((EditText)a.findViewById(R.id.backup_create_name)).setText("language-draft.bak");
                EditText pass=a.findViewById(R.id.backup_create_password);pass.setText("a:b");pass.setSelection(1);
                ((EditText)a.findViewById(R.id.backup_create_confirm)).setText("different");
                a.findViewById(R.id.backup_create_go).performClick();
                a.findViewById(R.id.backup_create_password_eye).performClick();
            });
            for(String code:CODES){select(code);screen.onActivity(a->{
                assertSame(original.get(),a);secure(a);
                EditText pass=a.findViewById(R.id.backup_create_password);
                assertEquals("a:b",pass.getText().toString());assertEquals(1,pass.getSelectionStart());
                assertEquals(t(l10n_backup_invalid_password),pass.getError().toString());
                assertEquals(t(l10n_backup_password_hint),pass.getHint().toString());
                assertEquals(t(l10n_backup_hide_password),a.findViewById(R.id.backup_create_password_eye).getContentDescription());
                assertFalse(pass.getTransformationMethod() instanceof android.text.method.PasswordTransformationMethod);
                assertEquals(android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD, pass.getInputType() & android.text.InputType.TYPE_MASK_VARIATION);
                a.findViewById(R.id.backup_create_password_eye).performClick();
                assertTrue(pass.getTransformationMethod() instanceof android.text.method.PasswordTransformationMethod);
                assertEquals(t(l10n_backup_show_password),a.findViewById(R.id.backup_create_password_eye).getContentDescription());
                assertEquals(1,pass.getSelectionStart());
                a.findViewById(R.id.backup_create_password_eye).performClick();
                assertFalse(pass.getTransformationMethod() instanceof android.text.method.PasswordTransformationMethod);
                assertEquals(android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD, pass.getInputType() & android.text.InputType.TYPE_MASK_VARIATION);
                assertEquals(1,pass.getSelectionStart());
                assertEquals("language-draft.bak",((TextView)a.findViewById(R.id.backup_create_name)).getText().toString());
                assertEquals("different",((TextView)a.findViewById(R.id.backup_create_confirm)).getText().toString());
            });}
            screen.onActivity(a->invoke(a,"confirmExport"));
            for(String code:CODES){select(code);onView(withText(t(l10n_backup_export_warning))).inRoot(isDialog()).check(matches(isDisplayed()));}
            onView(withText(t(l10n_common_cancel))).inRoot(isDialog()).perform(click());
        }
    }
    @Test public void selectedFileAndTypedRestoreTokenSurviveTranslationWithoutLaunching() throws Exception {
        File fixture=new File(context.getFilesDir(),"language-only-fixture.bak");
        byte[] data="LANGUAGE TEST ONLY: no wallet, keys or backup data".getBytes(StandardCharsets.UTF_8);
        assertFalse("Refuse to overwrite a file",fixture.exists());Files.write(fixture.toPath(),data);
        try(ActivityScenario<RestoreFileActivity> screen=ActivityScenario.launch(RestoreFileActivity.class)){
            screen.onActivity(a->{secure(a);LinearLayout rows=a.findViewById(R.id.backup_restore_files);boolean found=false;
                for(int i=0;i<rows.getChildCount();i++){
                    View row=rows.getChildAt(i);TextView title=row.findViewById(R.id.backup_row_title);
                    if(fixture.getName().contentEquals(title.getText())){row.performClick();found=true;break;}
                }
                assertTrue(found);
                ((EditText)a.findViewById(R.id.backup_restore_password)).setText("fixture123");
                // Invoke review directly: the stopped-node button remains disabled and no confirmation is accepted.
                invoke(a,"attemptRestore");
            });
            onView(withHint(t(l10n_backup_restore_hint))).inRoot(isDialog()).perform(replaceText("REST"),closeSoftKeyboard());
            for(String code:CODES){select(code);
                onView(withHint(t(l10n_backup_restore_hint))).inRoot(isDialog()).check(matches(withText("REST")));
                onView(withText(t(l10n_backup_replace_warning,fixture.getName()))).inRoot(isDialog()).check(matches(isDisplayed()));
                screen.onActivity(a->{secure(a);assertEquals(t(l10n_backup_selected,fixture.getName()),((TextView)a.findViewById(R.id.backup_restore_status)).getText().toString());});
            }
            // Incomplete REST must never be mistaken for RESTORE in any locale.
            onView(withText(t(l10n_wallet_restore))).inRoot(isDialog()).perform(click());
            screen.onActivity(a->assertEquals(t(l10n_backup_not_confirmed),((TextView)a.findViewById(R.id.backup_restore_status)).getText().toString()));
            assertEquals(ResyncSession.State.IDLE,ResyncSession.get().state());
            screen.onActivity(a->{LinearLayout rows=a.findViewById(R.id.backup_restore_files);
                for(int i=0;i<rows.getChildCount();i++){
                    View row=rows.getChildAt(i);
                    if(fixture.getName().contentEquals(((TextView)row.findViewById(R.id.backup_row_title)).getText())){row.findViewById(R.id.backup_row_action).performClick();return;}
                }fail("Fixture row missing");
            });
            for(String code:CODES){select(code);
                String body=fixture.getName()+"\n"+NodeFiles.formatBytes(data.length)+"\n\n"+t(l10n_backup_delete_warning)
                        +(NodeFiles.backupCount(context)<=1?t(l10n_backup_last_backup):"");
                onView(withText(body)).inRoot(isDialog()).check(matches(isDisplayed()));
                assertArrayEquals(data,Files.readAllBytes(fixture.toPath()));
            }
            onView(withText(t(l10n_backup_keep))).inRoot(isDialog()).perform(click());
        }finally{assertArrayEquals(data,Files.readAllBytes(fixture.toPath()));assertTrue(fixture.delete());}
    }
    @Test public void vaultPasswordAndRebuildDialogsKeepInputsAndSecureActivity() {
        try(ActivityScenario<VaultActivity> screen=ActivityScenario.launch(VaultActivity.class)){
            select("en");
            screen.onActivity(a->{secure(a);LinearLayout actions=a.findViewById(R.id.vault_actions);assertEquals(4,actions.getChildCount());actions.getChildAt(0).performClick();});
            onView(withHint(t(l10n_backup_password_hint))).inRoot(isDialog()).perform(replaceText("draft123"));
            onView(withHint(t(l10n_backup_again_hint))).inRoot(isDialog()).perform(replaceText("different456"),closeSoftKeyboard());
            for(String code:CODES){select(code);
                onView(withHint(t(l10n_backup_password_hint))).inRoot(isDialog()).check(matches(withText("draft123")));
                onView(withHint(t(l10n_backup_again_hint))).inRoot(isDialog()).check(matches(withText("different456")));
                onView(withText(t(l10n_vault_lock_prompt))).inRoot(isDialog()).check(matches(isDisplayed()));
                screen.onActivity(this::secure);
            }
            onView(withText(t(l10n_common_cancel))).inRoot(isDialog()).perform(click());
            screen.onActivity(a->invoke(a,"confirmSeedRebuild"));
            onView(withHint(t(l10n_vault_phrase_hint))).inRoot(isDialog()).perform(replaceText("invalid fixture draft"),closeSoftKeyboard());
            for(String code:CODES){select(code);
                onView(withHint(t(l10n_vault_phrase_hint))).inRoot(isDialog()).check(matches(withText("invalid fixture draft")));
                onView(withHint(t(l10n_vault_uses_hint,1000))).inRoot(isDialog()).check(matches(withText("2000")));
                onView(withText(t(l10n_vault_rebuild_warning))).inRoot(isDialog()).check(matches(isDisplayed()));
                screen.onActivity(this::secure);
            }
            onView(withText(t(l10n_common_cancel))).inRoot(isDialog()).perform(click());
        }
    }
}
