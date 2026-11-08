package com.eurobuddha.minimacore.testing;

import android.content.Intent;
import com.eurobuddha.minimacore.main.views.logs.LogsActivity;

/** Captures the share chooser intent; never opens another app. */
public class LogsHarnessActivity extends LogsActivity {
    public Intent chooser;
    @Override public void startActivity(Intent intent) {
        if (!Intent.ACTION_CHOOSER.equals(intent.getAction())) throw new AssertionError("Unexpected navigation");
        chooser = intent;
    }
}
