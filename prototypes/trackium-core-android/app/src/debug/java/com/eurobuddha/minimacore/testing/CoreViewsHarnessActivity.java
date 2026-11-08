package com.eurobuddha.minimacore.testing;

import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.res.Configuration;
import android.os.Bundle;
import android.widget.FrameLayout;
import androidx.appcompat.app.AppCompatActivity;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.main.BaseView;
import com.eurobuddha.minimacore.utils.SystemBars;

/** Hosts real core pages without MainActivity's node lifecycle or external actions. */
public class CoreViewsHarnessActivity extends AppCompatActivity {
    public BaseView hosted;
    private FrameLayout content;
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state); content = new FrameLayout(this); setContentView(content); SystemBars.pad(content);
    }
    public void show(BaseView view) {
        if (hosted != null) { hosted.setDisplayActive(false); hosted.onActivityDestroy(); }
        hosted = view; content.removeAllViews(); content.addView(view.getMainView());
        view.setDisplayActive(true); view.refreshView();
    }
    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config); Language.configurationChanged(this);
        if (hosted != null) hosted.languageChanged();
    }
    @Override protected void onDestroy() {
        if (hosted != null) { hosted.setDisplayActive(false); hosted.onActivityDestroy(); }
        super.onDestroy();
    }
    @Override public ComponentName startForegroundService(Intent intent) { throw new AssertionError("Real node forbidden"); }
    @Override public boolean bindService(Intent intent, ServiceConnection service, int flags) { throw new AssertionError("Real binding forbidden"); }
    @Override public void startActivity(Intent intent) { throw new AssertionError("External navigation forbidden"); }
    @Override public void sendBroadcast(Intent intent) { throw new AssertionError("Broadcast forbidden"); }
}
