package com.eurobuddha.minimacore.testing;

import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import com.eurobuddha.minimacore.launcher.StartServiceActivity;

/** Debug-only startup host: deliberately never starts or binds a real node. */
public class StartupHarnessActivity extends StartServiceActivity {
    public static int starts, binds, unbinds, checks, navigations;
    public static boolean ready, failed, rejectStart;
    public static long waitMs = 120_000;
    public static void reset() { starts = binds = unbinds = checks = navigations = 0; ready = failed = rejectStart = false; waitMs = 120_000; }
    @Override public ComponentName startForegroundService(Intent intent) {
        starts++;
        if (rejectStart) throw new IllegalStateException("Synthetic service rejection");
        return intent.getComponent();
    }
    @Override public boolean bindService(Intent intent, ServiceConnection connection, int flags) {
        binds++; return true; // onServiceConnected intentionally never arrives
    }
    @Override public void unbindService(ServiceConnection connection) { unbinds++; }
    @Override protected StartupState startupState() {
        checks++;
        return failed ? StartupState.FAILED : ready ? StartupState.READY : StartupState.WAITING;
    }
    @Override protected long waitLimitMillis() { return waitMs; }
    @Override protected void openMain() { navigations++; finish(); }
}
