package com.eurobuddha.minimacore.main;

import android.app.Activity;
import android.view.LayoutInflater;
import android.view.View;

import com.eurobuddha.minimacore.utils.logger;

public class BaseView {

    protected Activity mActivity;

    protected View mMainView;

    // Retained pages are not necessarily visible. Classic builds keep their existing lifecycle.
    private volatile boolean displayActive = !com.eurobuddha.minimacore.BuildConfig.PANDAMONIUM;
    private volatile long displayGeneration;

    public final boolean isDisplayActive() { return displayActive; }
    protected final long displayGeneration() { return displayGeneration; }

    /** Main-thread presentation lifecycle; never stops financial or archival work. */
    public final void setDisplayActive(boolean active) {
        if (displayActive == active) return;
        displayActive = active;
        displayGeneration++;
        if (active) onShown(); else onHidden();
    }

    protected void onShown() { refreshView(); }
    protected void onHidden() {}

    public BaseView(Activity zActivity, int zViewResID){
        mActivity = zActivity;

        LayoutInflater inflater = (LayoutInflater) mActivity.getSystemService(mActivity.LAYOUT_INFLATER_SERVICE);
        mMainView = inflater.inflate(zViewResID, null);
        com.eurobuddha.minimacore.i18n.Language.apply(mMainView);
    }

    /** For a view that supplies its OWN already-built content view - the subclass assigns
     *  mMainView itself. Avoids inflating a layout the subclass would immediately discard. */
    protected BaseView(Activity zActivity){
        mActivity = zActivity;
    }

    public Activity getActivity(){
        return mActivity;
    }

    public View getMainView(){
        return mMainView;
    }

    public void refreshView(){}

    /** Relabel retained controls without refreshing data or changing the selected page. */
    public void languageChanged() {}

    /** The Activity is going away - drop timers and dismiss any dialog this view owns. */
    public void onActivityDestroy(){}
}
