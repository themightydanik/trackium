package com.eurobuddha.minimacore.integrated;

/** Hosts the existing History screen without a second Activity or node connection protocol.
 *  Shared by the block (BlackBear) and pandamonium flavors, which both ship integrated-history. */
final class HistoryTabView extends com.eurobuddha.minimacore.main.BaseView {
    private final com.eurobuddha.history.HistoryScreen screen;
    HistoryTabView(com.eurobuddha.minimacore.main.MainActivity activity) {
        super(activity);   // no-inflate: HistoryScreen supplies its own already-built view
        screen = new com.eurobuddha.history.HistoryScreen(activity);
        mMainView = screen.getView();
        activity.getLifecycle().addObserver(new androidx.lifecycle.DefaultLifecycleObserver() {
            @Override public void onStart(androidx.lifecycle.LifecycleOwner owner) { screen.start(); }
            @Override public void onStop(androidx.lifecycle.LifecycleOwner owner) { screen.stop(); }
        });
    }
    @Override public void refreshView() { screen.refresh(); }
    @Override public void onActivityDestroy() { screen.close(); }
}
