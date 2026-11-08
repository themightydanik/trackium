package com.eurobuddha.minimacore.main.backup;

import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
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
import com.eurobuddha.minimacore.utils.Clip;
import com.eurobuddha.minimacore.utils.KeyboardInsets;
import com.eurobuddha.minimacore.utils.MinimaCMD;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Create one encrypted .bak, then offer to put a copy somewhere off this phone.
 *
 * Backup is not destructive and does not restart the node, so unlike restore it does not go
 * through ResyncLauncher. It IS slow, so the work lives in {@link BackupRun} and this screen
 * only renders it - a rotation mid-backup loses nothing.
 */
public class BackupCreateActivity extends AppCompatActivity {

    private final BackupRun run = BackupRun.get();
    private final Handler handler = new Handler(Looper.getMainLooper());

    private EditText name, password, confirm;
    private Button go, copy, export;
    private TextView status, detail, path;
    private ProgressBar progress;

    private ActivityResultLauncher<String> exportLauncher;

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            render();
            if (run.state() == BackupRun.State.RUNNING) handler.postDelayed(this, 400);
        }
    };

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Must be registered before the Activity reaches STARTED - the same rule SendActivity
        // documents for its scanner.
        exportLauncher = registerForActivityResult(
                new ActivityResultContracts.CreateDocument("application/octet-stream"),
                this::onExportDestinationChosen);

        // The backup password is the only thing protecting an exported .bak, and it can now be
        // revealed on screen - so this screen opts out of the "Allow Screenshots" setting exactly
        // as VaultActivity does, rather than leaving the password in a recents thumbnail.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        setContentView(R.layout.backup_create);
        Toolbar tb = findViewById(R.id.toolbar);
        Language.toolbarTitle(tb, Language.msg(l10n_backup_create));
        setSupportActionBar(tb);
        if (getSupportActionBar() != null) getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        tb.setNavigationOnClickListener(v -> finish());
        KeyboardInsets.install(this, findViewById(R.id.backup_create_main), tb);

        name = findViewById(R.id.backup_create_name);
        password = findViewById(R.id.backup_create_password);
        confirm = findViewById(R.id.backup_create_confirm);
        go = findViewById(R.id.backup_create_go);
        copy = findViewById(R.id.backup_create_copy);
        export = findViewById(R.id.backup_create_export);
        status = findViewById(R.id.backup_create_status);
        detail = findViewById(R.id.backup_create_detail);
        path = findViewById(R.id.backup_create_path);
        progress = findViewById(R.id.backup_create_progress);

        PasswordField.attach(password, findViewById(R.id.backup_create_password_eye));
        PasswordField.attach(confirm, findViewById(R.id.backup_create_confirm_eye));

        if (TextUtils.isEmpty(name.getText())) name.setText(suggestedName());
        go.setOnClickListener(v -> attemptBackup());
        copy.setOnClickListener(v ->
                Clip.copy(this, Language.text(this, l10n_backup_path), run.path(), Language.text(this, l10n_backup_path_copied)));
        export.setOnClickListener(v -> confirmExport());
    }

    @Override protected void onStart() {
        super.onStart();
        handler.post(tick);
    }

    @Override protected void onStop() {
        handler.removeCallbacks(tick);
        super.onStop();
    }

    /** Timestamped, and already valid under ResyncJob's filename rule. */
    private static String suggestedName() {
        return "minima-backup-"
                + new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.UK).format(new Date()) + ".bak";
    }

    private void attemptBackup() {
        String file = name.getText().toString().trim();
        String pass = password.getText().toString();
        String again = confirm.getText().toString();

        if (!ResyncJob.validFilename(file)) {
            Language.error(name, Language.msg(l10n_backup_invalid_name));
            return;
        }
        Language.error(name, null);
        if (!ResyncJob.validPassword(pass)) {
            // The node's own help says letters and numbers only, and its command tokeniser
            // silently rewrites anything else - see ResyncJob.
            Language.error(password, Language.msg(l10n_backup_invalid_password));
            return;
        }
        Language.error(password, null);
        if (!pass.equals(again)) {
            Language.error(confirm, Language.msg(l10n_backup_mismatch));
            return;
        }
        Language.error(confirm, null);

        NodeKeys.Status keys = NodeKeys.read();
        if (!keys.ready) {
            setTextIfChanged(status, keys.message());
            return;
        }

        if (!run.start(file, pass, again)) {
            setTextIfChanged(status, Language.msg(l10n_backup_already_running));
            return;
        }
        handler.post(tick);
    }

    private void render() {
        if (isFinishing() || isDestroyed()) return;
        BackupRun.State state = run.state();
        boolean running = state == BackupRun.State.RUNNING;
        boolean done = state == BackupRun.State.SUCCEEDED;

        go.setEnabled(!running);
        setTextIfChanged(go, running ? Language.msg(l10n_backup_creating) : done ? Language.msg(l10n_backup_create_another) : Language.msg(l10n_backup_create));
        name.setEnabled(!running);
        password.setEnabled(!running);
        confirm.setEnabled(!running);
        progress.setVisibility(running ? View.VISIBLE : View.GONE);

        if (running) {
            setTextIfChanged(status, Language.msg(l10n_backup_writing));
        } else if (done) {
            boolean located = !run.path().isEmpty();
            // Exporting needs a path. Without one the backup still exists - say so and point at
            // the list that will show it, rather than claiming a failure the folder disproves.
            setTextIfChanged(status, located
                    ? Language.msg(l10n_backup_created)
                    : Language.msg(l10n_backup_created_no_name));
            detail.setVisibility(located ? View.VISIBLE : View.GONE);
            path.setVisibility(located ? View.VISIBLE : View.GONE);
            copy.setVisibility(located ? View.VISIBLE : View.GONE);
            export.setVisibility(located ? View.VISIBLE : View.GONE);
            if (located) {
                setTextIfChanged(detail, Language.msg(l10n_backup_details, run.size(), run.block()));
                setTextIfChanged(path, run.path());
            }
        } else if (state == BackupRun.State.FAILED) {
            setTextIfChanged(status, Language.msg(l10n_backup_failed, run.error()));
            detail.setVisibility(View.GONE);
            path.setVisibility(View.GONE);
            copy.setVisibility(View.GONE);
            export.setVisibility(View.GONE);
        }
    }

    /**
     * Exporting takes the wallet off this device.
     *
     * The file is encrypted, but it is still every private key this node holds, and the place
     * it is going may well be a cloud-synced Downloads folder. Say that plainly once, here,
     * rather than letting a file picker imply it is routine.
     */
    private void confirmExport() {
        new LanguageDialog(this)
                .setTitle(Language.msg(l10n_backup_export_title))
                .setMessage(Language.msg(l10n_backup_export_warning))
                .setPositiveButton(Language.msg(l10n_backup_choose_location), (d, w) -> exportLauncher.launch(run.filename()))
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    private void onExportDestinationChosen(Uri destination) {
        if (destination == null) return;   // the user backed out of the picker
        final File source = new File(run.path());
        setTextIfChanged(status, Language.msg(l10n_backup_saving_copy));
        // Off the main thread: this streams the whole backup.
        MinimaCMD.readExecutor().execute(() -> {
            CharSequence message;
            try {
                long copied = NodeFiles.exportTo(this, source, destination);
                message = Language.msg(l10n_backup_copy_saved, NodeFiles.formatBytes(copied));
            } catch (Exception exc) {
                message = Language.msg(l10n_backup_copy_failed, (exc.getMessage() == null ? exc.toString() : exc.getMessage()));
            }
            final CharSequence done = message;
            handler.post(() -> {
                if (isFinishing() || isDestroyed()) return;
                setTextIfChanged(status, done);
            });
        });
    }

    private static void setTextIfChanged(TextView view, CharSequence text) {
        if (!text.toString().contentEquals(view.getText())) Language.setText(view, text);
    }
}
