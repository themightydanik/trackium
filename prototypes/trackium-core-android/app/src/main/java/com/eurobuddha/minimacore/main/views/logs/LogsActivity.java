package com.eurobuddha.minimacore.main.views.logs;

import android.os.Bundle;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import androidx.appcompat.widget.Toolbar;
import com.eurobuddha.minimacore.utils.KeyboardInsets;
import android.widget.FrameLayout;

import androidx.appcompat.app.AppCompatActivity;

import com.eurobuddha.minimacore.R;

/**
 * Hosts the existing LogsView as a full-screen activity. Logs moved off the main
 * tab row (Chat took its slot, 1.9.20) into the toolbar overflow menu.
 */
public class LogsActivity extends AppCompatActivity {

    private LogsView mLogsView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_logs);
        Toolbar toolbar = findViewById(R.id.toolbar);
        Language.toolbarTitle(toolbar, Language.msg(l10n_menu_logs));
        setSupportActionBar(toolbar);
        KeyboardInsets.install(this, findViewById(R.id.logs_main), toolbar);
        if (getSupportActionBar() != null) getSupportActionBar().setDisplayHomeAsUpEnabled(true);

        mLogsView = new LogsView(this);
        ((FrameLayout) findViewById(R.id.logs_container)).addView(mLogsView.getMainView());
        mLogsView.setDisplayActive(true);
        mLogsView.refreshView();
    }

    @Override
    public boolean onSupportNavigateUp() { finish(); return true; }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (mLogsView != null) {
            mLogsView.setDisplayActive(false);
            mLogsView.onActivityDestroy();
        }
    }
}
