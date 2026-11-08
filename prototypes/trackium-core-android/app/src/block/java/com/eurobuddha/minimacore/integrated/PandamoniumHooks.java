package com.eurobuddha.minimacore.integrated;
public final class PandamoniumHooks {
    private PandamoniumHooks() {}
    public static boolean requiresSecureScreen(android.app.Activity activity) {
        return activity instanceof tech.trackium.cargo.MainActivity;
    }
    public static com.eurobuddha.minimacore.main.BaseView createUtilityTab(com.eurobuddha.minimacore.main.MainActivity activity) {
        // BlackBear's utility tab is History (Terminal lives in the overflow menu).
        return new HistoryTabView(activity);
    }
    public static void initialize(android.content.Context context) {
        // History talks to the embedded node via DirectNodeApi and listens on DirectNodeEvents.
        // History and Trackium share the existing in-process transport; no DeFi apps.
        com.eurobuddha.minimaapi.direct.DirectNodeApi.install(new EmbeddedNodeTransport(context));
        tech.trackium.cargo.TrackiumCoreAccess.install(() ->
                !com.eurobuddha.minimacore.lock.AppLock.isEnabled(context)
                || com.eurobuddha.minimacore.lock.AppLock.get().isUnlocked());
        android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
        com.eurobuddha.minimaapi.direct.DirectNodeEvents.install(action -> main.post(action));
    }
    public static void install(android.app.Activity activity) {}
    // Explicit Node button/menu opens Trackium; no Pandamonium DeFi drawer.
    public static java.util.List<IntegratedApp> integratedApps(android.content.Context ctx) {
        return java.util.Collections.singletonList(new IntegratedApp(0, "Trackium",
                ctx.getApplicationInfo().loadIcon(ctx.getPackageManager()), true, true));
    }
    public static void setIntegratedEnabled(android.content.Context ctx, int id, boolean enabled) {}
    public static CharSequence setIntegratedFrozen(android.content.Context ctx, int id, boolean frozen) { return null; }
}
