package com.eurobuddha.minimacore.launcher.restore;

import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import androidx.appcompat.app.AlertDialog;

/** Debug-only fixture reusing StartupHarnessActivity's no-node service boundary. */
public class SeedSyncHarnessActivity extends SeedSyncServiceActivity {
    public int starts, waits, resyncs;
    @Override public void startMinimaService() { starts++; }
    @Override public void waitForMinimaToStartUp() { waits++; }
    @Override public void startMegaMMRSync() { resyncs++; }
    @Override public ComponentName startForegroundService(Intent intent) {
        throw new AssertionError("The seed-sync fixture must not start a service");
    }
    @Override public boolean bindService(Intent intent, ServiceConnection connection, int flags) {
        throw new AssertionError("The seed-sync fixture must not bind a service");
    }
    @Override public void startActivity(Intent intent) {
        throw new AssertionError("The seed-sync fixture must not start a node activity");
    }
    public AlertDialog progressDialog() { return mProgress; }
}
