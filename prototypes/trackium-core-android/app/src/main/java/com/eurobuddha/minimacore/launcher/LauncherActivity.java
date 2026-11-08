package com.eurobuddha.minimacore.launcher;

import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.PorterDuff;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.utils.KeyboardInsets;
import com.eurobuddha.minimacore.launcher.newwallet.NewWalletActivity;
import com.eurobuddha.minimacore.launcher.restore.RestoreWalletSyncActivity;
import com.eurobuddha.minimacore.receiver.ReceiverDB;
import com.eurobuddha.minimacore.utils.logger;

public class LauncherActivity extends AppCompatActivity {

    public static LauncherActivity LAUNCHER_ACTIVITY;

    ReceiverDB mDatabase;

    public boolean isNightMode() {
        int nightModeFlags = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return nightModeFlags == Configuration.UI_MODE_NIGHT_YES;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        logger.log("Minima Launcher started..");

        LAUNCHER_ACTIVITY = this;

        setContentView(R.layout.launcher_activity);


        //Are we night mode..
        if(isNightMode()){
            ImageView logo = findViewById(R.id.launcher_mainicon);
            logo.setColorFilter(getResources().getColor(R.color.white), PorterDuff.Mode.SRC_ATOP);
        }

        Toolbar tb = findViewById(R.id.toolbar);
        //Clean launcher — no title, the M logo speaks for itself (matches design)
        tb.setTitle("");
        setSupportActionBar(tb);
        findViewById(R.id.launcher_language).setOnClickListener(
                v -> com.eurobuddha.minimacore.i18n.Language.choose(this, false));
        KeyboardInsets.install(this, findViewById(R.id.launcher_main), tb);

        View startup = findViewById(R.id.launcher_button_params);
        if (com.eurobuddha.minimacore.BuildConfig.PANDAMONIUM) {
            startup.setVisibility(View.VISIBLE);
            startup.setOnClickListener(v -> startActivity(new Intent(this,
                    com.eurobuddha.minimacore.main.ParamsActivity.class)));
        }

        Button newwallet = findViewById(R.id.launcher_button_newwallet);
        newwallet.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                //Start new activity
                Intent myIntent = new Intent(LauncherActivity.this, NewWalletActivity.class);
                LauncherActivity.this.startActivity(myIntent);
            }
        });

        Button restorewallet = findViewById(R.id.launcher_button_restore);
        restorewallet.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                //Start new activity
                Intent myIntent = new Intent(LauncherActivity.this, RestoreWalletSyncActivity.class);
                LauncherActivity.this.startActivity(myIntent);
            }
        });


        /*//Create the database
        mDatabase = new ReceiverDB(this);
        mDatabase.wipeDB();

        mDatabase.insertApp("pname","pid", "minid");
        mDatabase.insertApp("pname2","pid2", "minid2");

        JSONArray res = mDatabase.selectAllApps();
        logger.log("Database : "+res.toString());

        JSONObject app = mDatabase.selectApp("pname","pid", "minid");
        logger.log("APP : "+app.toString());

        //Check..
        //boolean added = mDatabase.alreadyAdded("pname2", "pid2", "minid2s");
        //logger.log("Already pname : "+added);

        mDatabase.close();
        */

    }

    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        com.eurobuddha.minimacore.i18n.Language.configurationChanged(this);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();

//        mDatabase.close();
    }


}
