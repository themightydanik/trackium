package com.eurobuddha.minimacore.launcher;

import androidx.appcompat.app.AlertDialog;
import android.widget.ProgressBar;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import androidx.appcompat.app.AppCompatActivity;
import org.minima.system.Main;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.main.MainActivity;
import com.eurobuddha.minimacore.main.SeedSyncActivity;
import com.eurobuddha.minimacore.service.MinimaService;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.Peers;

/** Startup observation belongs to this screen; the foreground node owns its own lifetime. */
public class StartServiceActivity extends AppCompatActivity implements ServiceConnection {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MinimaService minima;
    private boolean bound, active, finished, initialized;
    private long deadline;
    private AlertDialog progress;
    private AlertDialog message;
    private final Runnable poll = this::checkStartup;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (SeedSyncActivity.redirectIfPending(this)) return;
        initialized = true;
        ProgressBar indicator = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        indicator.setIndeterminate(true);
        int padding = Math.round(24 * getResources().getDisplayMetrics().density);
        indicator.setPadding(padding, padding / 3, padding, padding / 2);
        progress = new LanguageDialog(this)
                .setTitle(Language.msg(l10n_startup_starting))
                .setMessage(Language.msg(l10n_startup_waiting))
                .setView(indicator).create();
        progress.setCancelable(true);
        progress.setCanceledOnTouchOutside(false);
        progress.setOnCancelListener(dialog -> finish());
        startMinimaService();
        deadline = SystemClock.elapsedRealtime() + waitLimitMillis();
    }

    @Override protected void onStart() {
        super.onStart();
        active = true;
        if (initialized && !finished && message == null) handler.post(poll);
    }

    @Override protected void onStop() {
        active = false;
        handler.removeCallbacks(poll);
        if (progress != null) progress.dismiss();
        super.onStop();
    }

    protected long waitLimitMillis() { return 120_000; }
    protected enum StartupState { WAITING, READY, FAILED }
    protected StartupState startupState() {
        Main node = Main.getInstance();
        if (minima == null || node == null) return StartupState.WAITING;
        if (node.isStartupError()) return StartupState.FAILED;
        return node.isStartUpComplete() ? StartupState.READY : StartupState.WAITING;
    }

    private void checkStartup() {
        if (!active || finished || isFinishing() || isDestroyed()) return;
        StartupState state = startupState();
        if (state == StartupState.READY) {
            finished = true;
            progress.dismiss();
            MinimaCMD.runMinima("peers action:addpeers peerslist:" + Peers.DEFAULT_MINIMAPEERS);
            openMain();
        } else if (state == StartupState.FAILED) {
            progress.dismiss();
            message = new LanguageDialog(this).setTitle(Language.msg(l10n_startup_error))
                    .setMessage(Language.msg(l10n_startup_error_body))
                    .setIcon(R.drawable.ic_minima)
                    .setPositiveButton(Language.msg(l10n_startup_open), (d, w) -> { finished = true; openMain(); })
                    .setNegativeButton(Language.msg(l10n_language_close), (d, w) -> finish())
                    .setOnCancelListener(d -> finish()).show();
        } else if (SystemClock.elapsedRealtime() >= deadline) {
            progress.dismiss();
            message = new LanguageDialog(this).setTitle(Language.msg(l10n_startup_slow))
                    .setMessage(Language.msg(l10n_startup_slow_body))
                    .setPositiveButton(Language.msg(l10n_startup_keep_waiting), (d, w) -> { message = null; waitForMinimaToStartUp(); })
                    .setNegativeButton(Language.msg(l10n_language_close), (d, w) -> finish())
                    .setOnCancelListener(d -> finish()).show();
        } else {
            if (!progress.isShowing()) progress.show();
            handler.postDelayed(poll, 500);
        }
    }

    protected void openMain() {
        startActivity(new Intent(this, MainActivity.class));
        finish();
    }

    public void waitForMinimaToStartUp() {
        deadline = SystemClock.elapsedRealtime() + waitLimitMillis();
        handler.removeCallbacks(poll);
        if (active && !finished) handler.post(poll);
    }

    public void startMinimaService() {
        if (bound) return;
        try {
            Intent intent = new Intent(this, MinimaService.class);
            startForegroundService(intent);
            bound = bindService(intent, this, Context.BIND_AUTO_CREATE);
        } catch (RuntimeException e) {
            message = new LanguageDialog(this).setTitle(Language.msg(l10n_seed_sync_start_failed))
                    .setMessage(Language.msg(l10n_startup_connection_failed))
                    .setPositiveButton(Language.msg(l10n_startup_retry), (d, w) -> {
                        message = null; startMinimaService();
                        if (message == null) waitForMinimaToStartUp();
                    })
                    .setNegativeButton(Language.msg(l10n_language_close), (d, w) -> finish())
                    .setOnCancelListener(d -> finish()).show();
        }
    }

    @Override protected void onDestroy() {
        active = false; finished = true;
        handler.removeCallbacksAndMessages(null);
        if (progress != null) progress.dismiss();
        if (message != null) message.dismiss();
        // A successful bind must be released even when onServiceConnected never arrived.
        if (bound) { bound = false; unbindService(this); }
        minima = null;
        super.onDestroy();
    }

    @Override public void onServiceConnected(ComponentName name, IBinder binder) {
        if (!finished) minima = ((MinimaService.MyBinder) binder).getService();
    }
    @Override public void onServiceDisconnected(ComponentName name) { minima = null; }
}
