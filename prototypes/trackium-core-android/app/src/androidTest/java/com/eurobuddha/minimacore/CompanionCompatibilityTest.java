package com.eurobuddha.minimacore;

import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.minima.utils.BIP39;
import static org.junit.Assert.*;

/** Reuses the standalone Mail permission fixture against every build, on a disposable emulator only. */
public class CompanionCompatibilityTest {
    @Test public void standaloneCompanionPermissions() throws Exception {
        assertEquals("true", InstrumentationRegistry.getArguments().getString("pandamoniumDisposable"));
        assertTrue(android.os.Build.FINGERPRINT.contains("generic") || android.os.Build.HARDWARE.contains("ranchu"));
        Context ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue(ctx.getPackageName().startsWith("com.eurobuddha."));
        android.content.SharedPreferences prefs = ctx.getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
        assertFalse("Fresh application data required", prefs.getBoolean("SEED_SET", false));
        assertTrue(prefs.edit().putBoolean("SEED_SET", true)
                .putString("SEED", BIP39.convertWordListToString(BIP39.getNewWordList())).commit());
        if (android.os.Build.VERSION.SDK_INT >= 33) InstrumentationRegistry.getInstrumentation()
                .getUiAutomation().grantRuntimePermission(ctx.getPackageName(), android.Manifest.permission.POST_NOTIFICATIONS);
        ctx.startActivity(new Intent(ctx, StartActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        long end = SystemClock.elapsedRealtime() + 600_000;
        boolean ready = false;
        while (SystemClock.elapsedRealtime() < end) {
            // The same readiness signal as StartServiceActivity. IPC does not require
            // a foreground screen and must keep working behind Android system dialogs.
            org.minima.system.Main node = org.minima.system.Main.getInstance();
            if (node != null && node.isStartUpComplete()) { ready = true; break; }
            if (node != null) assertFalse("Core startup error", node.isStartupError());
            SystemClock.sleep(250);
        }
        assertTrue("Core startup completed", ready);
        verifyExternalCompanion(ctx);
    }
    private void verifyExternalCompanion(Context ctx) throws Exception {
        // The test above has already required a fresh, disposable emulator wallet.
        com.eurobuddha.minimacore.receiver.ReceiverDB db = new com.eurobuddha.minimacore.receiver.ReceiverDB(ctx);
        try {
          for (String companion : new String[]{"com.eurobuddha.mail", "com.eurobuddha.pandadex"}) {
            externalReadTest(companion, false, false);
            org.minima.utils.json.JSONObject registered = null;
            for (Object row : db.selectAllApps()) {
                org.minima.utils.json.JSONObject app = (org.minima.utils.json.JSONObject)row;
                if (companion.equals(app.get("package"))) registered = app;
            }
            assertNotNull("Standalone companion appears in core registrations", registered);
            String id = (String) registered.get("packageid");
            db.setEnabled(companion, id, true);
            externalReadTest(companion, true, false);
            db.setAdmin(companion, id, true);
            externalReadTest(companion, true, true);
            db.setEnabled(companion, id, false);
            db.setAdmin(companion, id, false);
            externalReadTest(companion, false, false);
          }
        } finally { db.close(); }
    }

    private void externalReadTest(String companion, boolean enabled, boolean admin) throws Exception {
        String command = "am instrument -w -r -e class com.eurobuddha.review.ExternalCompatibilityTest"
                + " -e companionPackage " + companion + " -e pandamoniumDisposable true -e enabled " + enabled + " -e admin " + admin
                + " " + companion + ".test/androidx.test.runner.AndroidJUnitRunner";
        try (android.os.ParcelFileDescriptor fd = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
             java.io.InputStream in = new android.os.ParcelFileDescriptor.AutoCloseInputStream(fd);
             java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096]; int count;
            while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
            String result = out.toString("UTF-8");
            assertTrue("External permissions enabled=" + enabled + " admin=" + admin + ": " + result, result.contains("OK (1 test)"));
        }
    }

}
