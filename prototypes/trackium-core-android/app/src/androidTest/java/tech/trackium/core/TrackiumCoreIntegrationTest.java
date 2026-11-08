package tech.trackium.core;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;
import com.eurobuddha.minimacore.StartActivity;
import com.eurobuddha.minimacore.R;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.minima.database.MinimaDB;
import org.minima.system.Main;
import org.minima.system.params.GeneralParams;
import org.minima.utils.BIP39;
import tech.trackium.cargo.EmbeddedCorePort;
import tech.trackium.cargo.SecureStore;
import static org.junit.Assert.*;

/** Opt-in, disposable emulator ONLY. Never imports an installed wallet or signs a transaction. */
@RunWith(AndroidJUnit4.class)
public class TrackiumCoreIntegrationTest {
    private static final String HOST = "tech.trackium.core.prototype";
    private void ui(Runnable r) { InstrumentationRegistry.getInstrumentation().runOnMainSync(r); }
    private Activity awaitActivity(String name) {
        long deadline = SystemClock.elapsedRealtime() + 600_000;
        while (SystemClock.elapsedRealtime() < deadline) {
            final Activity[] result = new Activity[1];
            ui(() -> { for (Activity a : ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED))
                if (a.getClass().getName().equals(name)) result[0] = a; });
            if (result[0] != null) return result[0];
            SystemClock.sleep(250);
        }
        throw new AssertionError("Activity deadline: " + name);
    }
    @Test public void oneApkNodeTrackiumAndEncryptedState() throws Exception {
        assertEquals("true", InstrumentationRegistry.getArguments().getString("trackiumDisposable"));
        assertTrue("Disposable emulator only", Build.FINGERPRINT.contains("generic") || Build.HARDWARE.contains("ranchu"));
        Context ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals(HOST, ctx.getPackageName());
        String phase = InstrumentationRegistry.getArguments().getString("trackiumPhase");
        assertTrue("Explicit fresh/restart phase required", "fresh".equals(phase) || "restart".equals(phase));
        var prefs = ctx.getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
        if ("fresh".equals(phase)) {
            assertFalse("Never reuse existing wallet data", prefs.getBoolean("SEED_SET", false));
            assertTrue(prefs.edit().putBoolean("SEED_SET", true)
                    .putString("SEED", BIP39.convertWordListToString(BIP39.getNewWordList()))
                    .putBoolean("keets_enabled", false)
                    .putString("minima_extra_params", "-nop2p -noconnect -host 127.0.0.1 -hashtest 0").commit());
        } else {
            assertTrue("Only this fixture may be restarted", prefs.contains("trackium_fixture_public_key"));
        }
        for (String command : new String[]{"svc power stayon true", "settings put system screen_off_timeout 1800000",
                "input keyevent 224", "wm dismiss-keyguard", "dumpsys deviceidle whitelist +" + HOST}) {
            try (var fd = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
                 var input = new android.os.ParcelFileDescriptor.AutoCloseInputStream(fd)) { while (input.read() != -1) {} }
        }
        if (Build.VERSION.SDK_INT >= 33) InstrumentationRegistry.getInstrumentation().getUiAutomation()
                .grantRuntimePermission(HOST, android.Manifest.permission.POST_NOTIFICATIONS);
        if (Build.VERSION.SDK_INT <= 28) {
            for (String permission : new String[]{android.Manifest.permission.READ_EXTERNAL_STORAGE,
                    android.Manifest.permission.WRITE_EXTERNAL_STORAGE})
                InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(HOST, permission);
        }
        ctx.startActivity(new Intent(ctx, StartActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        Activity home = awaitActivity("com.eurobuddha.minimacore.main.MainActivity");
        assertNotNull(Main.getInstance());
        assertTrue(Main.getInstance().isStartUpComplete());
        assertTrue(GeneralParams.USE_BLOCK_AS_KEYUSES);
        assertTrue(GeneralParams.USE_SQL_COINDB);
        assertTrue(GeneralParams.USE_SQL_TXBLOCKDB);
        String publicKey = MinimaDB.getDB().getWallet().getAllKeys().get(0).getPublicKey();
        if ("fresh".equals(phase)) assertTrue(prefs.edit().putString("trackium_fixture_public_key", publicKey).commit());
        else assertEquals(prefs.getString("trackium_fixture_public_key", ""), publicKey);
        EmbeddedCorePort core = new EmbeddedCorePort(ctx, () -> true);
        try {
            assertFalse(core.getAdmin());
            assertNotNull(((JSONObject)core.call("status")).getString("version"));
            // A fresh offline chain has no tip. Preserve its real balance rejection;
            // do not manufacture a genesis block or claim a synchronized balance.
            if (Boolean.TRUE.equals(Main.getInstance().runSingleMinimaCMD("balance").get("status"))) {
                assertNotNull(core.call("balance"));
            } else {
                try { core.call("balance"); fail("Offline node error must be preserved"); }
                catch (IllegalStateException expected) { }
            }
            for (String forbidden : new String[]{"send amount:1", "seed", "vault", "status;balance", "txnsign", "getaddress"}) {
                try { core.call(forbidden); fail("Write/private command accepted"); }
                catch (IllegalArgumentException expected) { }
            }
        } finally { core.close(); }
        SecureStore store = new SecureStore(ctx);
        if ("fresh".equals(phase)) store.write("prototype-fixture", new JSONObject().put("marker", "disposable-state-v1"));
        assertEquals("disposable-state-v1", new SecureStore(ctx).read("prototype-fixture").getString("marker"));
        ui(() -> assertTrue(home.findViewById(R.id.open_trackium).performClick()));
        Activity trackium = awaitActivity("tech.trackium.cargo.MainActivity");
        assertEquals(HOST, trackium.getPackageName());
        var controller = tech.trackium.cargo.TrackiumRuntime.INSTANCE.get((android.app.Application)ctx.getApplicationContext());
        long observedDeadline = SystemClock.elapsedRealtime() + 30_000;
        while ((controller.getBusy().get() || controller.getCore() == null)
                && SystemClock.elapsedRealtime() < observedDeadline) SystemClock.sleep(100);
        assertNotNull("Native UI observed its embedded node", controller.getCore());
        assertTrue("Node status is displayed in reused UI", controller.getCoreState().contains("1.1.2.31-euro4"));
        var info = ctx.getPackageManager().getActivityInfo(trackium.getComponentName(), 0);
        assertFalse(info.exported);
        var pkg = ctx.getPackageManager().getPackageInfo(HOST, PackageManager.GET_SERVICES | PackageManager.GET_PROVIDERS);
        assertNull(pkg.sharedUserId);
        assertFalse((ctx.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_ALLOW_BACKUP) != 0);
        for (var s : pkg.services) if (s.name.endsWith("MinimaService")) assertFalse(s.exported);
        for (var p : pkg.providers) if (p.authority.equals(HOST + ".trackium.exports")) assertFalse(p.exported);
        ui(trackium::finish);
        awaitActivity("com.eurobuddha.minimacore.main.MainActivity");
    }
}
