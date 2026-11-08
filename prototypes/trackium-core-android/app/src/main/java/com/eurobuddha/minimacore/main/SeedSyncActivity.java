package com.eurobuddha.minimacore.main;

import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.widget.NestedScrollView;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.utils.KeyboardInsets;
import com.eurobuddha.minimacore.launcher.StartServiceActivity;
import com.eurobuddha.minimacore.service.MinimaService;
import com.eurobuddha.minimacore.utils.Clip;
import com.eurobuddha.minimacore.utils.Peers;

/** Retained command state with a bounded, selectable live tail of real node output. */
public class SeedSyncActivity extends AppCompatActivity {
    public static final String PREF_PENDING = "node_resync_pending";
    /** Which operation the pending flag belongs to, so an interrupted restore is not called a resync. */
    public static final String PREF_PENDING_LABEL = "node_resync_pending_label";

    /** Reopening the app must return to progress, not start a node over an active resync. */
    public static boolean redirectIfPending(android.app.Activity activity) {
        ResyncSession session = ResyncSession.get();
        if (session.state() != ResyncSession.State.RUNNING
                && session.state() != ResyncSession.State.SUCCEEDED
                && !session.restartRequested()
                && !activity.getSharedPreferences("main_prefs", MODE_PRIVATE).getBoolean(PREF_PENDING, false)) return false;
        activity.startActivity(new Intent(activity, SeedSyncActivity.class));
        activity.finish();
        return true;
    }
    private final ResyncSession session = ResyncSession.get();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private EditText host;
    private Button proceed, restart;
    private TextView status, elapsed, terminal;
    private ProgressBar progress;
    private NestedScrollView logScroll;
    private SharedPreferences prefs;
    private long renderedRevision = -1;
    private boolean leaving;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            render();
            if (!leaving) handler.postDelayed(this, 500);
        }
    };

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("main_prefs", MODE_PRIVATE);
        if (prefs.getBoolean(PREF_PENDING, false)) session.interrupted(prefs.getString(PREF_PENDING_LABEL, "Resync"));
        setContentView(R.layout.seed_sync);

        Toolbar tb = findViewById(R.id.toolbar);
        // This screen shows progress for whatever destructive job is live, not only a host resync
        // - redirectIfPending routes a restore back here too.
        Language.Message title = Language.msg("Restore".equals(operationLabel()) ? l10n_resync_restore_title
                : "Seed restore".equals(operationLabel()) ? l10n_resync_seed_title : l10n_resync_title);
        Language.toolbarTitle(tb, title);
        Language.setText(findViewById(R.id.seed_sync_heading), title);
        setSupportActionBar(tb);
        KeyboardInsets.install(this, findViewById(R.id.sync_main), tb);
        host = findViewById(R.id.seed_sync_host);
        host.setText(session.host().isEmpty() ? Peers.getDefaultPeers(this) : session.host());
        proceed = findViewById(R.id.seed_sync_proceed);
        restart = findViewById(R.id.seed_sync_restart);
        status = findViewById(R.id.seed_sync_status);
        elapsed = findViewById(R.id.seed_sync_elapsed);
        terminal = findViewById(R.id.seed_sync_log);
        Language.setText(status, Language.msg(l10n_resync_ready));
        Language.setText(elapsed, Language.msg(l10n_resync_node_output));
        progress = findViewById(R.id.seed_sync_progress);
        logScroll = findViewById(R.id.seed_sync_log_scroll);
        proceed.setOnClickListener(v -> confirmResync());
        restart.setOnClickListener(v -> {
            session.requestRestart();
            // A failed resync can leave a partially stopped node. Finish its normal
            // service shutdown before launching a fresh instance.
            MinimaService.cancelAlarm();
            stopService(new Intent(this, MinimaService.class));
            render();
        });
        findViewById(R.id.seed_sync_copy).setOnClickListener(v ->
                Clip.copy(this, Language.text(this, l10n_resync_log), terminal.getText().toString(),
                        Language.text(this, l10n_resync_log_copied)));
        render();
    }

    /**
     * A resync is not a tidy-up: the node deletes txpow.mv.db and archive.mv.db, refetches
     * the chain and then shuts down. Say so before it happens, and say what is NOT at risk -
     * the wallet and seed are untouched without a seed phrase, and people need to know that
     * before they will press the button on a node holding real funds.
     */
    private void confirmResync() {
        String requestedHost = host.getText().toString().trim();
        if (!ResyncSession.validHost(requestedHost)) {
            Language.error(host, Language.msg(l10n_resync_host_error));
            return;
        }
        new LanguageDialog(this)
                .setTitle(Language.msg(l10n_resync_confirm_title))
                .setMessage(Language.msg(l10n_resync_confirm_body, requestedHost))
                .setPositiveButton(Language.msg(l10n_resync_operation), (d, w) -> startResync())
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    private void startResync() {
        String requestedHost = host.getText().toString().trim();
        if (!ResyncSession.validHost(requestedHost)) {
            Language.error(host, Language.msg(l10n_resync_host_error));
            return;
        }
        Language.error(host, null);
        // Shared with the health check's automatic path - see ResyncLauncher for why the
        // pending flag, the alarms and the service binding all have to be handled here.
        ResyncLauncher.Result result = ResyncLauncher.begin(this, ResyncJob.hostResync(requestedHost));
        if (!result.started) {
            setTextIfChanged(status, launchError(result.error));
        }
        render();
    }

    @Override protected void onStart() {
        super.onStart();
        handler.post(tick);
    }

    @Override protected void onStop() {
        handler.removeCallbacks(tick);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onStop();
    }

    private void render() {
        if (leaving || isFinishing() || isDestroyed()) return;
        ResyncSession.State state = session.state();
        boolean running = state == ResyncSession.State.RUNNING;
        boolean succeeded = state == ResyncSession.State.SUCCEEDED;
        boolean failed = state == ResyncSession.State.FAILED;
        boolean waitingToRestart = session.restartRequested();
        // A plain `restore` never notifies the service, so isShutdownComplete() stays false
        // forever. Only wait on a shutdown the command actually performs - see
        // ResyncJob.selfShutsDown().
        boolean selfShutsDown = session.job() == null || session.job().selfShutsDown();
        boolean nodeDown = !selfShutsDown || MinimaService.isShutdownComplete();
        host.setEnabled(!running && !succeeded && !waitingToRestart);
        proceed.setEnabled(!running && !succeeded && !waitingToRestart);
        setTextIfChanged(proceed, Language.msg(running ? l10n_resync_working : failed ? l10n_resync_retry : l10n_resync_title));
        boolean hostJob = "Resync".equals(operationLabel());
        // A restore has no host to type - hide the input rather than offer a field it ignores.
        host.setVisibility(hostJob ? View.VISIBLE : View.GONE);
        findViewById(R.id.seed_sync_host_help).setVisibility(hostJob ? View.VISIBLE : View.GONE);
        findViewById(R.id.seed_sync_host_label).setVisibility(hostJob ? View.VISIBLE : View.GONE);
        proceed.setVisibility(hostJob ? View.VISIBLE : View.GONE);
        progress.setVisibility(running || waitingToRestart || (succeeded && !nodeDown)
                ? View.VISIBLE : View.GONE);
        restart.setVisibility(succeeded || failed ? View.VISIBLE : View.GONE);
        restart.setEnabled(!waitingToRestart && (!succeeded || nodeDown));
        if (running) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            setTextIfChanged(status, Language.msg(l10n_resync_in_progress, operation()));
        } else if (!waitingToRestart) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            if (succeeded) {
                setTextIfChanged(status, Language.msg(nodeDown ? l10n_resync_complete : l10n_resync_waiting_complete, operation()));
                if (prefs.getBoolean(PREF_PENDING, false)) {
                    // Only a job that actually used a host should overwrite the default peer.
                    if (session.job() != null && session.job().setsDefaultPeer()) Peers.setDefaultPeers(this, session.host());
                    prefs.edit().putBoolean(PREF_PENDING, false).apply();
                }
            } else if (failed) {
                // A missing job in FAILED means a process interruption, not a node reply.
                // Keep the original result/log intact; only the application summary is translated.
                setTextIfChanged(status, session.job() == null
                        ? Language.msg(l10n_resync_interrupted, operation())
                        : Language.msg(l10n_resync_failed, operation(), session.result()));
                if (prefs.getBoolean(PREF_PENDING, false)) prefs.edit().putBoolean(PREF_PENDING, false).apply();
            }
        }
        if (state != ResyncSession.State.IDLE) {
            long seconds = session.elapsedSeconds(System.nanoTime());
            setTextIfChanged(elapsed, Language.msg(l10n_resync_elapsed, seconds / 60, seconds % 60));
        }
        long revision = session.log.revision();
        if (revision != renderedRevision) {
            boolean atBottom = !logScroll.canScrollVertically(1);
            terminal.setText(String.join("\n", session.log.snapshot()));
            renderedRevision = revision;
            if (atBottom) logScroll.post(() -> logScroll.fullScroll(View.FOCUS_DOWN));
        }
        if (waitingToRestart) {
            setTextIfChanged(status, Language.msg(l10n_resync_waiting_shutdown));
            if (MinimaService.isShutdownComplete()) {
                leaving = true;
                session.reset();
                prefs.edit().putBoolean(PREF_PENDING, false).apply();
                if (MainActivity.MAIN_ACTIVITY != null) MainActivity.MAIN_ACTIVITY.finish();
                startActivity(new Intent(this, StartServiceActivity.class));
                finish();
            }
        }
    }

    /** Persisted names belong to the recovery protocol; translate only at the view boundary. */
    private String operationLabel() {
        if (session.job() != null) return session.job().label();
        return session.state() == ResyncSession.State.FAILED
                ? prefs.getString(PREF_PENDING_LABEL, "Resync") : "Resync";
    }

    private Language.Message operation() {
        String label = operationLabel();
        return Language.msg("Restore".equals(label) ? l10n_resync_restore_operation
                : "Seed restore".equals(label) ? l10n_resync_seed_operation : l10n_resync_operation);
    }

    public static CharSequence launchError(String error) {
        if (error == null) return "";
        switch (error) {
            case "Check the details and try again": return Language.msg(l10n_resync_invalid_details);
            case "The node is not running. Restart the node before continuing.": return Language.msg(l10n_resync_node_stopped);
            case "Could not save progress state. Check available storage and try again.": return Language.msg(l10n_resync_save_failed);
            case "Another resync is already in progress.": return Language.msg(l10n_resync_already_running);
            case "Another restore is already in progress.": return Language.msg(l10n_backup_restore_running);
            case "Another seed restore is already in progress.": return Language.msg(l10n_backup_seed_restore_running);
            default: return error;
        }
    }

    private static void setTextIfChanged(TextView view, CharSequence text) {
        if (!text.toString().contentEquals(view.getText())) Language.setText(view, text);
    }
}
