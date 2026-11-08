package com.eurobuddha.minimacore.main.backup;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;



import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import com.eurobuddha.minimacore.main.ResyncJob;
import com.eurobuddha.minimacore.main.ResyncLauncher;
import com.eurobuddha.minimacore.main.SeedSyncActivity;
import com.eurobuddha.minimacore.utils.KeyboardInsets;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.Peers;

import java.io.File;
import java.util.List;
import java.util.Locale;

/**
 * Restore this node from a backup file - the route the node's own UI never had.
 *
 * Two commands sit behind one screen, because the user's real question is "is my backup recent
 * enough?", not "which subcommand?":
 *   recent  -> restore file: password:                       (local, no network)
 *   old     -> megammrsync action:resync host: file: password:  (catch up to the tip)
 *
 * Both are destructive and both restart the node, so both go through ResyncLauncher and are
 * watched on SeedSyncActivity. Nothing here runs a command directly.
 */
public class RestoreFileActivity extends AppCompatActivity {

    private final Handler handler = new Handler(Looper.getMainLooper());

    private LinearLayout fileRows, hostRow;
    private TextView gate, empty, status;
    private EditText password, host;
    private RadioButton modeLocal, modeResync;
    private Button go, importButton;

    private ActivityResultLauncher<String[]> importLauncher;
    private String selected = "";

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Registered before STARTED, as SendActivity documents.
        importLauncher = registerForActivityResult(
                new ActivityResultContracts.OpenDocument(), this::onFileChosen);

        // The backup password is the only thing protecting an exported .bak, and it can now be
        // revealed on screen - so this screen opts out of the "Allow Screenshots" setting exactly
        // as VaultActivity does, rather than leaving the password in a recents thumbnail.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        setContentView(R.layout.backup_restore);
        Toolbar tb = findViewById(R.id.toolbar);
        Language.toolbarTitle(tb, Language.msg(l10n_backup_restore));
        setSupportActionBar(tb);
        if (getSupportActionBar() != null) getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        tb.setNavigationOnClickListener(v -> finish());
        KeyboardInsets.install(this, findViewById(R.id.backup_restore_main), tb);

        fileRows = findViewById(R.id.backup_restore_files);
        hostRow = findViewById(R.id.backup_restore_host_row);
        gate = findViewById(R.id.backup_restore_gate);
        empty = findViewById(R.id.backup_restore_empty);
        status = findViewById(R.id.backup_restore_status);
        password = findViewById(R.id.backup_restore_password);
        host = findViewById(R.id.backup_restore_host);
        modeLocal = findViewById(R.id.backup_restore_mode_local);
        modeResync = findViewById(R.id.backup_restore_mode_resync);
        go = findViewById(R.id.backup_restore_go);
        importButton = findViewById(R.id.backup_restore_import);

        PasswordField.attach(password, findViewById(R.id.backup_restore_password_eye));
        host.setText(Peers.getDefaultPeers(this));
        modeResync.setOnCheckedChangeListener((b, checked) ->
                hostRow.setVisibility(checked ? View.VISIBLE : View.GONE));
        importButton.setOnClickListener(v -> importLauncher.launch(new String[]{"*/*"}));
        go.setOnClickListener(v -> attemptRestore());
    }

    @Override protected void onResume() {
        super.onResume();
        renderGate();
        renderFiles();
    }

    private void renderGate() {
        NodeKeys.Status keys = NodeKeys.read();
        gate.setVisibility(keys.ready ? View.GONE : View.VISIBLE);
        if (!keys.ready) Language.setText(gate, keys.message());
        go.setEnabled(keys.ready);
    }

    private void renderFiles() {
        fileRows.removeAllViews();
        List<File> files = NodeFiles.restorable(this);
        empty.setVisibility(files.isEmpty() ? View.VISIBLE : View.GONE);
        for (File file : files) {
            View row = LayoutInflater.from(this).inflate(R.layout.view_backup_row, fileRows, false);
            TextView title = row.findViewById(R.id.backup_row_title);
            TextView subtitle = row.findViewById(R.id.backup_row_subtitle);
            // Full filename, never elided - it is what goes into the command.
            title.setText(file.getName());
            // The folder also holds archive exports and txn files. They are listed because a
            // restore CAN name them, but they must not look like backups.
            CharSequence kind = NodeFiles.isBackup(file) ? "" : Language.msg(l10n_backup_not_backup);
            Language.setText(subtitle, Language.join(NodeFiles.formatBytes(file.length()), " · ",
                    Language.stamp(file.lastModified(), "yMMMdHm"), kind));
            row.setOnClickListener(v -> {
                selected = file.getName();
                renderFiles();
            });
            Button action = row.findViewById(R.id.backup_row_action);
            action.setVisibility(View.VISIBLE);
            Language.setText(action, Language.msg(l10n_backup_delete));
            action.setOnClickListener(v -> confirmDelete(file, NodeFiles.backupCount(this)));
            row.setAlpha(file.getName().equals(selected) ? 1f : 0.55f);
            fileRows.addView(row);
        }
        if (!selected.isEmpty()) {
            setTextIfChanged(status, Language.msg(l10n_backup_selected, selected));
        }
    }

    /**
     * Deleting a backup is irreversible and the file may be the only copy of a wallet.
     *
     * So the dialog names the file in full and its size, and says plainly what cannot be
     * undone. When it is the last backup left, it says that too - that is the case where
     * someone is one tap from having no way back at all.
     */
    private void confirmDelete(File file, int totalBackups) {
        // Counts .bak files only. Counting every listed file meant one backup sitting beside a
        // txn file looked like "two backups", and this warning silently did not fire.
        CharSequence warning = NodeFiles.isBackup(file) && totalBackups <= 1
                ? Language.msg(l10n_backup_last_backup)
                : "";
        new LanguageDialog(this)
                .setTitle(Language.msg(l10n_backup_delete_title))
                .setMessage(Language.join(file.getName(), "\n", NodeFiles.formatBytes(file.length()), "\n\n", Language.msg(l10n_backup_delete_warning), warning))
                .setPositiveButton(Language.msg(l10n_backup_delete), (d, w) -> deleteNow(file.getName()))
                .setNegativeButton(Language.msg(l10n_backup_keep), null)
                .show();
    }

    private void deleteNow(String name) {
        CharSequence message;
        try {
            NodeFiles.delete(this, name);
            message = Language.msg(l10n_backup_deleted, name);
            if (name.equals(selected)) selected = "";
        } catch (Exception exc) {
            message = Language.msg(l10n_backup_delete_failed, name, (exc.getMessage() == null ? exc.toString() : exc.getMessage()));
        }
        renderFiles();
        setTextIfChanged(status, message);
    }

    private void onFileChosen(Uri source) {
        if (source == null) return;
        setTextIfChanged(status, Language.msg(l10n_backup_importing));
        MinimaCMD.readExecutor().execute(() -> {
            CharSequence message;
            String landed = "";
            try {
                // Never trust the provider's display name, and never silently overwrite.
                String name = NodeFiles.uniqueName(NodeFiles.base(this),
                        NodeFiles.displayName(getContentResolver(), source));
                File file = NodeFiles.importFrom(this, source, name);
                landed = file.getName();
                message = Language.msg(l10n_backup_imported, file.getName(), NodeFiles.formatBytes(file.length()));
            } catch (Exception exc) {
                message = Language.msg(l10n_backup_import_failed, (exc.getMessage() == null ? exc.toString() : exc.getMessage()));
            }
            final CharSequence done = message;
            final String pick = landed;
            handler.post(() -> {
                if (isFinishing() || isDestroyed()) return;
                if (!pick.isEmpty()) selected = pick;
                renderFiles();
                setTextIfChanged(status, done);
            });
        });
    }

    private void attemptRestore() {
        if (selected.isEmpty()) {
            setTextIfChanged(status, Language.msg(l10n_backup_choose_file));
            return;
        }
        String pass = password.getText().toString();
        if (!ResyncJob.validPassword(pass)) {
            Language.error(password, Language.msg(l10n_backup_invalid_password));
            return;
        }
        Language.error(password, null);

        final ResyncJob job;
        if (modeResync.isChecked()) {
            String where = host.getText().toString().trim();
            if (!ResyncJob.validHost(where)) {
                Language.error(host, Language.msg(l10n_resync_host_error));
                return;
            }
            Language.error(host, null);
            job = ResyncJob.fileResync(where, selected, pass);
        } else {
            job = ResyncJob.fileRestore(selected, pass);
        }
        if (job == null) {
            setTextIfChanged(status, Language.msg(l10n_backup_check_file));
            return;
        }
        confirm(job);
    }

    /**
     * A restore overwrites the wallet, not just the chain - a wrong choice here loses funds in
     * a way a resync never does. So this confirmation names the file, says what goes, and needs
     * the word typed rather than one more tap.
     */
    private void confirm(ResyncJob job) {
        EditText typed = new EditText(this);
        Language.hint(typed, Language.msg(l10n_backup_restore_hint));
        int pad = Math.round(20 * getResources().getDisplayMetrics().density);
        typed.setPadding(pad, pad, pad, pad);

        new LanguageDialog(this)
                .setTitle(Language.msg(l10n_backup_replace_title))
                .setMessage(Language.msg(l10n_backup_replace_warning, selected))
                .setView(typed)
                .setPositiveButton(Language.msg(l10n_wallet_restore), (d, w) -> {
                    if (!"RESTORE".contentEquals(typed.getText().toString().trim().toUpperCase(Locale.UK))) {
                        setTextIfChanged(status, Language.msg(l10n_backup_not_confirmed));
                        return;
                    }
                    launch(job);
                })
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    private void launch(ResyncJob job) {
        // Shared with the resync path - see ResyncLauncher for why the pending flag, the alarms
        // and the service binding all have to be handled there and not here.
        ResyncLauncher.Result result = ResyncLauncher.begin(this, job);
        if (!result.started) {
            setTextIfChanged(status, SeedSyncActivity.launchError(result.error));
            return;
        }
        // Progress, the live node log and the restart button all live on the resync screen.
        startActivity(new Intent(this, SeedSyncActivity.class));
        finish();
    }

    private static void setTextIfChanged(TextView view, CharSequence text) {
        if (!text.toString().contentEquals(view.getText())) Language.setText(view, text);
    }
}
