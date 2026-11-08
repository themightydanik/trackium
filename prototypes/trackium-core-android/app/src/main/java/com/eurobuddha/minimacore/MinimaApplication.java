package com.eurobuddha.minimacore;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.WindowManager;

import org.minima.utils.MinimaUncaughtException;

/***
 * The main entry point for the Minima Application
 */
public class MinimaApplication extends Application {

    //Shared prefs used to remember the user's screenshot preference
    public static final String PREFS_NAME     = "main_prefs";
    public static final String PREF_ALLOW_SS  = "ALLOW_SCREENSHOTS";
    private final java.util.Set<Activity> activities = java.util.Collections.newSetFromMap(new java.util.WeakHashMap<>());

    //Count of started (foreground) activities, so we can tell a true app background (0) from
    //ordinary in-app navigation (never reaches 0). Drives the app-open lock's re-lock timer.
    private int mStartedActivities = 0;

    /** Update retained app windows too, including windows in the background or multi-window. */
    public void setScreenshotsAllowed(boolean allowed) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(PREF_ALLOW_SS, allowed).apply();
        for (Activity activity : new java.util.ArrayList<>(activities)) applyScreenshotPolicy(activity);
    }

    private void applyScreenshotPolicy(Activity activity) {
        // These screens already deliberately protect secrets independently of the general toggle.
        boolean sensitive = activity instanceof com.eurobuddha.minimacore.main.backup.VaultActivity
                || activity instanceof com.eurobuddha.minimacore.main.backup.BackupCreateActivity
                || activity instanceof com.eurobuddha.minimacore.main.backup.RestoreFileActivity
                || activity instanceof com.eurobuddha.minimacore.main.backup.ChatBackupActivity
                || com.eurobuddha.minimacore.integrated.PandamoniumHooks.requiresSecureScreen(activity);
        boolean allowed = screenshotsAllowed(this);
        if (sensitive || !allowed) activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }

    /** Persisted screenshot policy: release builds default off; debug builds default on. */
    public static boolean screenshotsAllowed(Context zContext){
        SharedPreferences prefs = zContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean debug = (zContext.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        return prefs.getBoolean(PREF_ALLOW_SS, debug);
    }
    @Override
    public void onCreate() {
        super.onCreate();

        //Catch ALL Uncaught Exceptions..
        Thread.setDefaultUncaughtExceptionHandler(new MinimaUncaughtException());

        //Make all activities no screenshot
        setupActivityListener();
        com.eurobuddha.minimacore.i18n.Language.initialize(this,
                () -> !com.eurobuddha.minimacore.lock.AppLock.isEnabled(this)
                        || com.eurobuddha.minimacore.lock.AppLock.get().isUnlocked());
        com.eurobuddha.minimacore.integrated.PandamoniumHooks.initialize(this);
    }

    @Override public void onConfigurationChanged(android.content.res.Configuration config) {
        super.onConfigurationChanged(config);
        com.eurobuddha.minimacore.i18n.Language.configurationChanged(this);
    }

    private void setupActivityListener() {
        registerActivityLifecycleCallbacks(new ActivityLifecycleCallbacks() {

            //Block screenshots by default (FLAG_SECURE), UNLESS either:
            //  - the user has turned on "Allow Screenshots" (persisted toggle), or
            //  - this is a debuggable build with no saved preference yet.
            //The toggle lets our fork opt in/out at runtime instead of it being a hard rule.
            @Override
            public void onActivityCreated(Activity activity, Bundle savedInstanceState) {
                activities.add(activity);
                applyScreenshotPolicy(activity);
            }

            @Override
            public void onActivityStarted(Activity activity) {
                // A restored activity or notification can bypass MainActivity.onCreate.
                // Always enforce the session lock, including a process that starts locked.
                if (mStartedActivities == 0)
                    com.eurobuddha.minimacore.lock.AppLock.get().maybeRelock(MinimaApplication.this);
                if (!activity.isFinishing()
                        && !(activity instanceof com.eurobuddha.minimacore.lock.LockActivity)
                        && com.eurobuddha.minimacore.lock.AppLock.isEnabled(MinimaApplication.this)
                        && !com.eurobuddha.minimacore.lock.AppLock.get().isUnlocked()) {
                    activity.startActivity(new android.content.Intent(
                            activity, com.eurobuddha.minimacore.lock.LockActivity.class)
                            .addFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP));
                }
                mStartedActivities++;
                com.eurobuddha.minimacore.service.BatteryPolicy.setAppVisible(true);
            }
            @Override
            public void onActivityResumed(Activity activity) {
                applyScreenshotPolicy(activity);
                com.eurobuddha.minimacore.integrated.PandamoniumHooks.install(activity);
            }
            @Override
            public void onActivityPaused(Activity activity) {}
            @Override
            public void onActivityStopped(Activity activity) {
                //1 -> 0 means the app just went to the background: start the auto-lock clock.
                if (--mStartedActivities <= 0) {
                    mStartedActivities = 0;
                    com.eurobuddha.minimacore.service.BatteryPolicy.setAppVisible(false);
                    if (!activity.isChangingConfigurations())
                        com.eurobuddha.minimacore.lock.AppLock.get().markBackgrounded();
                }
            }
            @Override
            public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}
            @Override
            public void onActivityDestroyed(Activity activity) { activities.remove(activity); }
        });
    }
}
