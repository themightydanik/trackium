package com.eurobuddha.minimacore.main.backup;

import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import com.eurobuddha.minimacore.lock.VaultCrypto;
import com.eurobuddha.minimacore.main.MainActivity;
import com.eurobuddha.minimacore.utils.KeyboardInsets;
import com.eurobuddha.minimacore.utils.MinimaCMD;

import java.io.InputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Save / restore the chat identity and history ({@link ChatBackup}). Save encrypts in memory and
 * streams the result straight to the picked document - no plaintext and no copy is left on the
 * phone. Restore decrypts, shows both addresses in full, needs RESTORE typed, then restarts.
 */
public class ChatBackupActivity extends AppCompatActivity {

    private static final int MIN_PASSWORD = 8;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private EditText password, confirm, restorePassword;
    private Button save, restore;
    private TextView saveStatus, restoreStatus;
    private ActivityResultLauncher<String> saveLauncher;
    private ActivityResultLauncher<String[]> openLauncher;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        saveLauncher = registerForActivityResult(
                new ActivityResultContracts.CreateDocument("application/octet-stream"), this::onSaveTo);
        openLauncher = registerForActivityResult(
                new ActivityResultContracts.OpenDocument(), this::onOpen);

        // Passwords can be revealed and the confirm dialog shows identities: no screenshots.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        setContentView(R.layout.backup_chat);
        Toolbar tb = findViewById(R.id.toolbar);
        Language.toolbarTitle(tb, Language.msg(l10n_chatbak_title));
        setSupportActionBar(tb);
        if (getSupportActionBar() != null) getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        tb.setNavigationOnClickListener(v -> finish());
        KeyboardInsets.install(this, findViewById(R.id.chat_backup_main), tb);

        password = findViewById(R.id.chat_backup_password);
        confirm = findViewById(R.id.chat_backup_confirm);
        restorePassword = findViewById(R.id.chat_backup_restore_password);
        save = findViewById(R.id.chat_backup_save);
        restore = findViewById(R.id.chat_backup_restore);
        saveStatus = findViewById(R.id.chat_backup_save_status);
        restoreStatus = findViewById(R.id.chat_backup_restore_status);
        PasswordField.attach(password, findViewById(R.id.chat_backup_password_eye));
        PasswordField.attach(confirm, findViewById(R.id.chat_backup_confirm_eye));
        PasswordField.attach(restorePassword, findViewById(R.id.chat_backup_restore_password_eye));

        save.setOnClickListener(v -> attemptSave());
        restore.setOnClickListener(v -> {
            if (!checkPassword(restorePassword)) return;
            openLauncher.launch(new String[]{"*/*"});
        });
    }

    private boolean checkPassword(EditText field) {
        boolean ok = field.getText().length() >= MIN_PASSWORD;
        Language.error(field, ok ? null : Language.msg(l10n_chatbak_password_short));
        return ok;
    }

    private void attemptSave() {
        if (!checkPassword(password)) return;
        if (!password.getText().toString().equals(confirm.getText().toString())) {
            Language.error(confirm, Language.msg(l10n_backup_mismatch));
            return;
        }
        Language.error(confirm, null);
        saveLauncher.launch("keets-chat-backup-"
                + new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.UK).format(new Date()) + ".kbak");
    }

    private void onSaveTo(Uri destination) {
        if (destination == null) return;
        final String pass = password.getText().toString();
        save.setEnabled(false);
        Language.setText(saveStatus, Language.msg(l10n_chatbak_saving));
        MinimaCMD.readExecutor().execute(() -> {
            CharSequence message;
            try {
                int[] counts = new int[2];
                byte[] file = ChatBackup.export(this, pass, counts);
                try (OutputStream out = getContentResolver().openOutputStream(destination, "wt")) {
                    if (out == null) throw new java.io.IOException("cannot open the destination");
                    out.write(file);
                }
                message = Language.msg(l10n_chatbak_saved, String.valueOf(counts[0]), String.valueOf(counts[1]));
            } catch (Exception e) {
                message = Language.msg(l10n_chatbak_failed, e.getMessage() == null ? e.toString() : e.getMessage());
            }
            final CharSequence done = message;
            handler.post(() -> {
                if (isFinishing() || isDestroyed()) return;
                save.setEnabled(true);
                Language.setText(saveStatus, done);
            });
        });
    }

    private void onOpen(Uri source) {
        if (source == null) return;
        final String pass = restorePassword.getText().toString();
        restore.setEnabled(false);
        Language.setText(restoreStatus, Language.msg(l10n_chatbak_opening));
        MinimaCMD.readExecutor().execute(() -> {
            ChatBackup.Contents contents = null;
            String current = "";
            CharSequence error = null;
            try (InputStream in = getContentResolver().openInputStream(source)) {
                if (in == null) throw new java.io.IOException("cannot open the file");
                contents = ChatBackup.open(ChatBackup.readAll(in, ChatBackup.MAX_FILE), pass);
                current = ChatBackup.currentKeetsPubkey();
            } catch (VaultCrypto.BadPassphraseException e) {
                error = Language.msg(l10n_chatbak_bad_password);
            } catch (Exception e) {
                error = Language.msg(l10n_chatbak_failed, e.getMessage() == null ? e.toString() : e.getMessage());
            }
            final ChatBackup.Contents opened = contents;
            final String now = current;
            final CharSequence failed = error;
            handler.post(() -> {
                if (isFinishing() || isDestroyed()) return;
                restore.setEnabled(true);
                if (failed != null) {
                    Language.setText(restoreStatus, failed);
                } else {
                    restoreStatus.setText("");
                    confirmRestore(opened, now);
                }
            });
        });
    }

    /** Names both keets addresses and the MAX# address IN FULL: it is the whole decision. */
    private void confirmRestore(ChatBackup.Contents c, String current) {
        CharSequence none = Language.msg(l10n_chatbak_none);
        // Message and input share ONE scroll view: with setMessage() the full-length addresses fill
        // the dialog and AlertDialog collapses the custom view to nothing (seen on the Fold).
        int pad = Math.round(24 * getResources().getDisplayMetrics().density);
        TextView body = new TextView(this);
        body.setTextAppearance(R.style.TextAppearance_MinimaCore_Body);
        body.setTextIsSelectable(true);
        Language.setText(body, Language.msg(l10n_chatbak_confirm_body,
                c.keetsPubkey.isEmpty() ? none : c.keetsPubkey,
                c.maxAddress.isEmpty() ? none : c.maxAddress,
                current.isEmpty() ? none : current,
                String.valueOf(c.contacts), String.valueOf(c.messages)));
        EditText typed = new EditText(this);
        Language.hint(typed, Language.msg(l10n_backup_restore_hint));
        typed.setSingleLine(true);
        android.widget.LinearLayout column = new android.widget.LinearLayout(this);
        column.setOrientation(android.widget.LinearLayout.VERTICAL);
        column.setPadding(pad, pad / 2, pad, 0);
        column.addView(body);
        column.addView(typed);
        android.widget.ScrollView scroll = new android.widget.ScrollView(this);
        scroll.addView(column);

        new LanguageDialog(this)
                .setTitle(Language.msg(l10n_chatbak_confirm_title))
                .setView(scroll)
                .setPositiveButton(Language.msg(l10n_wallet_restore), (d, w) -> {
                    if (!"RESTORE".contentEquals(typed.getText().toString().trim().toUpperCase(Locale.UK))) {
                        Language.setText(restoreStatus, Language.msg(l10n_backup_not_confirmed));
                        return;
                    }
                    stageAndRestart(c);
                })
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    private void stageAndRestart(ChatBackup.Contents c) {
        try {
            ChatBackup.stage(this, c);
        } catch (Exception e) {
            Language.setText(restoreStatus, Language.msg(l10n_chatbak_failed, e.getMessage() == null ? e.toString() : e.getMessage()));
            return;
        }
        if (MainActivity.MAIN_ACTIVITY == null) {
            // Staged: it loads at the next node start whichever way that happens.
            Language.setText(restoreStatus, Language.msg(l10n_chatbak_restart_later));
            return;
        }
        MainActivity.MAIN_ACTIVITY.restartMinima();
        finish();
    }
}
