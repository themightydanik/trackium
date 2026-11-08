package com.eurobuddha.minimacore.launcher.restore;

import androidx.appcompat.app.AlertDialog;
import android.widget.ProgressBar;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.IBinder;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.minima.database.wallet.Wallet;
import org.minima.system.Main;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.launcher.StartServiceActivity;
import com.eurobuddha.minimacore.main.ResyncJob;
import com.eurobuddha.minimacore.utils.Feedback;
import com.eurobuddha.minimacore.service.MinimaService;
import com.eurobuddha.minimacore.service.MinimaServiceListener;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.MinimaCMDListener;
import com.eurobuddha.minimacore.utils.Peers;
import com.eurobuddha.minimacore.utils.logger;


public class SeedSyncServiceActivity extends AppCompatActivity implements ServiceConnection, MinimaServiceListener {

    MinimaService mMinima = null;
    /** Set in onDestroy so the startup-wait thread stops instead of spinning past the screen. */
    volatile boolean mDestroyed = false;

    AlertDialog mProgress;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ProgressBar indicator = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        indicator.setIndeterminate(true);
        int padding = Math.round(24 * getResources().getDisplayMetrics().density);
        indicator.setPadding(padding, padding / 3, padding, padding / 2);
        mProgress = new LanguageDialog(this)
                .setTitle(Language.msg(l10n_seed_sync_title))
                .setMessage(Language.msg(l10n_seed_sync_wait))
                .setView(indicator).create();
        mProgress.setCanceledOnTouchOutside(false);
        mProgress.show();

        //Start the Service..
        startMinimaService();

        //Wait for startup
        waitForMinimaToStartUp();
    }

    public void waitForMinimaToStartUp(){

        Runnable wait = new Runnable() {
            @Override
            public void run() {
                logger.log("Wait for Minima Service to start..");

                //Bounded and cancellable: this used to spin forever if the bind never came, and
                //NPE'd on a raw thread - taking the whole app down - if the node was not up yet.
                long deadline = System.currentTimeMillis() + 120_000;
                while(mMinima == null && !mDestroyed && System.currentTimeMillis() < deadline){
                    try { Thread.sleep(500); } catch (InterruptedException e) { return; }
                }
                if(mDestroyed) return;
                if(mMinima == null){
                    //Giving up silently would leave the spinner up with nothing to read.
                    runOnUiThread(() -> {
                        if(isFinishing() || isDestroyed()) return;
                        mProgress.dismiss();
                        logger.showDialog(SeedSyncServiceActivity.this, Language.msg(l10n_seed_sync_start_failed),
                                Language.msg(l10n_seed_sync_start_failed_body),
                                SeedSyncServiceActivity.this::finish);
                    });
                    return;
                }

                //Set this to listen for shutdown after sync..
                mMinima.mServiceListener = SeedSyncServiceActivity.this;

                logger.log("Now wait for Minima to say..");

                while(!mDestroyed && (Main.getInstance() == null || !Main.getInstance().isStartUpComplete())){
                    try { Thread.sleep(500); } catch (InterruptedException e) { return; }
                }
                if(mDestroyed) return;

                //Get Key uses.. never below the node's own default (stateful signatures)
                SharedPreferences pref  = getSharedPreferences("main_prefs",MODE_PRIVATE);
                int keyuses = Math.max(ResyncJob.MIN_KEY_USES, pref.getInt("KEYUSES", ResyncJob.MIN_KEY_USES));

                //Now run command to create ALL key uses..
                MinimaCMD.runMinima("keys action:createallkeys keyuses:"+keyuses, new MinimaCMDListener() {
                    @Override
                    public void cmdResult(JSONObject zResult) {}
                });
            }
        };

        Thread tt = new Thread(wait);
        tt.start();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        mDestroyed = true;
        if (mProgress != null) mProgress.dismiss();

        //Unbind from the service..
        if(mMinima != null) {
            mMinima = null;
            unbindService(this);
        }
    }

    public void startMinimaService(){
        //Start the Minima Service..
        Intent minimaintent = new Intent(getBaseContext(), MinimaService.class);
        startForegroundService(minimaintent);

        bindService(minimaintent, this, Context.BIND_AUTO_CREATE);
    }

    @Override
    public void onServiceConnected(ComponentName componentName, IBinder iBinder) {
        MinimaService.MyBinder binder = (MinimaService.MyBinder)iBinder;
        mMinima = binder.getService();
    }

    @Override
    public void onServiceDisconnected(ComponentName componentName) {
        mMinima = null;
    }

    @Override
    public void MinimaServiceShutdown() {

        //Service has finished resync..
        mProgress.dismiss();

        //Start Main..
        Intent myIntent = new Intent(SeedSyncServiceActivity.this, StartServiceActivity.class);
        SeedSyncServiceActivity.this.startActivity(myIntent);

        finish();
    }

    @Override
    public void MinimaNewBlock() {}

    @Override
    public void MinimaLoadKeys(int zKeys, boolean zFinished) {

        if(!zFinished) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (mProgress.isShowing()) {
                        Language.setText(mProgress.findViewById(android.R.id.message),
                                Language.msg(l10n_seed_sync_generating, zKeys, Wallet.NUMBER_GETADDRESS_KEYS));
                    }
                }
            });
        }else{
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (mProgress.isShowing()) {
                        Language.setText(mProgress.findViewById(android.R.id.message),
                                Language.msg(l10n_seed_sync_syncing, Peers.getDefaultPeers(SeedSyncServiceActivity.this)));
                    }
                }
            });

            startMegaMMRSync();
        }
    }

    public void startMegaMMRSync(){

        //Unbind..
        mMinima = null;
        unbindService(SeedSyncServiceActivity.this);

        //Shuts down service on finish
        MinimaCMD.runMinima("megammrsync action:resync host:"+Peers.getDefaultPeers(SeedSyncServiceActivity.this), new MinimaCMDListener() {
            @Override
            public void cmdResult(JSONObject zResult) {

                //The node reports failures under "message" or "error"; Feedback handles both
                //and never returns an empty string, so there is always something to show.
                final String error = Feedback.errorOf(zResult);

                if(error != null){
                    //Service has finished resync..
                    mProgress.dismiss();

                    SeedSyncServiceActivity.this.runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            if (isFinishing() || isDestroyed()) return;
                            logger.showDialog(SeedSyncServiceActivity.this, Language.msg(l10n_common_error), Language.msg(l10n_seed_sync_resync_after_start, error), new Runnable() {
                                @Override
                                public void run() {
                                    //Start Main..
                                    Intent myIntent = new Intent(SeedSyncServiceActivity.this, StartServiceActivity.class);
                                    SeedSyncServiceActivity.this.startActivity(myIntent);

                                    finish();
                                }
                            });
                        }
                    });
                }
            }
        });
    }
}