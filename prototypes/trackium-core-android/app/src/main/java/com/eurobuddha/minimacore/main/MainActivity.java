package com.eurobuddha.minimacore.main;

import com.eurobuddha.minimacore.BuildConfig;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.Manifest;
import androidx.appcompat.app.AlertDialog;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import android.view.View;
import android.app.ProgressDialog;
import android.content.ComponentName;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.InputType;
import android.view.Menu;
import android.view.MenuItem;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.viewpager.widget.ViewPager;

import com.google.android.material.tabs.TabLayout;

import org.minima.database.MinimaDB;
import org.minima.objects.TxPoW;
import org.minima.system.params.GeneralParams;
import org.minima.utils.MiniFile;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.MinimaApplication;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.utils.KeyboardInsets;
import com.eurobuddha.minimacore.receiver.ReceiverDB;
import com.eurobuddha.minimacore.service.MinimaService;
import com.eurobuddha.minimacore.service.MinimaServiceListener;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.MinimaCMDListener;
import com.eurobuddha.minimacore.utils.logger;

import java.io.File;
import java.util.Date;


public class MainActivity extends AppCompatActivity implements ServiceConnection, MinimaServiceListener {

    public static MainActivity MAIN_ACTIVITY;

    MinimaService mMinimaService = null;

    ViewPager mMainPager;

    MainAdapter mMainAdapter;

    private final java.util.Set<AlertDialog> languageDialogs = new java.util.HashSet<>();
    private LanguageDialog languageDialog() {
        return new LanguageDialog(this) {
            @Override public AlertDialog create() {
                AlertDialog dialog = super.create();
                languageDialogs.add(dialog);
                dialog.getWindow().getDecorView().addOnAttachStateChangeListener(new View.OnAttachStateChangeListener() {
                    @Override public void onViewAttachedToWindow(View v) { languageDialogs.add(dialog); }
                    @Override public void onViewDetachedFromWindow(View v) { languageDialogs.remove(dialog); }
                });
                return dialog;
            }
        };
    }

    ProgressDialog mShutdownDialog = null;

    boolean WIPE_ON_SHUTDOWN = false;

    //Set by ParamsActivity's Save & Restart - the service is started again after
    //the graceful shutdown completes instead of finishing the activity
    boolean RESTART_ON_SHUTDOWN = false;

    TextView mFooterLeft;
    TextView mFooterRight;
    private boolean hostVisible;
    private final android.os.Handler displayHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private final com.eurobuddha.minimacore.utils.CoalescingRefresh<JSONObject> footerRefresh =
            new com.eurobuddha.minimacore.utils.CoalescingRefresh<>(MinimaCMD.readExecutor(),
                    displayHandler::post, () -> MinimaCMD.execute("keys"), this::renderFooterKeys,
                    error -> logger.log("Footer refresh failed: " + error));

    private boolean canRenderFooter() {
        return (!BuildConfig.PANDAMONIUM || hostVisible) && !isFinishing() && !isDestroyed();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        //App-open lock wins over everything else: show the PIN screen before any content.
        if (com.eurobuddha.minimacore.lock.LockActivity.redirectIfLocked(this)) return;

        if (SeedSyncActivity.redirectIfPending(this)) return;

        MAIN_ACTIVITY = this;

        //Start the Service..
        startMinimaService();

        //AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);

        setContentView(R.layout.activity_main);


        Toolbar tb = findViewById(R.id.toolbar);
        tb.setTitle("Trackium Core");

        setSupportActionBar(tb);
        // SKU brand line (e.g. "BlackBear") persists under the title, like Pandamonium's brand.
        if (!BuildConfig.PANDAMONIUM && !BuildConfig.SHELL_BRAND.isEmpty() && getSupportActionBar() != null)
            getSupportActionBar().setSubtitle(BuildConfig.SHELL_BRAND);
        KeyboardInsets.install(this, findViewById(R.id.main), tb,
                findViewById(R.id.tabs), findViewById(R.id.main_footer));

        mFooterLeft  = findViewById(R.id.main_footer_left);
        Language.setText(mFooterLeft, Language.msg(l10n_core_awaiting_blocks));
        mFooterRight = findViewById(R.id.main_footer_right);

        mMainAdapter = new MainAdapter(this);

        //Chat QR scanner: launchers must register before STARTED (SendActivity pattern).
        //No Chat tab (keets transport off) = no ChatView: register anyway, wire nothing.
        androidx.activity.result.ActivityResultLauncher<com.journeyapps.barcodescanner.ScanOptions> chatScan =
                registerForActivityResult(new com.journeyapps.barcodescanner.ScanContract(), result -> {
                    com.eurobuddha.minimacore.chat.ChatView chat =
                            (com.eurobuddha.minimacore.chat.ChatView) mMainAdapter.getChatView();
                    if (chat != null && result != null && result.getContents() != null) {
                        chat.onScanResult(result.getContents());
                    }
                });
        com.eurobuddha.minimacore.chat.ChatView chatView =
                (com.eurobuddha.minimacore.chat.ChatView) mMainAdapter.getChatView();
        if (chatView != null) chatView.setOnScanRequest(() ->
                chatScan.launch(new com.journeyapps.barcodescanner.ScanOptions()
                        .setDesiredBarcodeFormats(com.journeyapps.barcodescanner.ScanOptions.QR_CODE)
                        .setPrompt(Language.text(this, l10n_core_scan_keets))
                        .setBeepEnabled(false)
                        .setOrientationLocked(false)));

        mMainPager = findViewById(R.id.main_pager);
        mMainPager.setAdapter(mMainAdapter);
        mMainPager.setCurrentItem(MainAdapter.HOME_POSITION, false);

        TabLayout tabs = findViewById(R.id.tabs);
        tabs.setupWithViewPager(mMainPager);

        // Tab labels and content share the adapter positions for this build.
        tabs.getTabAt(MainAdapter.HOME_POSITION).setText(Language.text(this, BuildConfig.PANDA_SHELL ? l10n_tab_node : l10n_tab_home));
        tabs.getTabAt(MainAdapter.HOME_POSITION).setIcon(BuildConfig.PANDA_SHELL
                ? R.drawable.ic_node : R.drawable.ic_drawer_home);

        tabs.getTabAt(MainAdapter.WALLET_POSITION).setText(Language.text(this, l10n_tab_wallet));
        tabs.getTabAt(MainAdapter.WALLET_POSITION).setIcon(R.drawable.ic_minima);

        tabs.getTabAt(MainAdapter.UTILITY_POSITION).setText(Language.text(this, BuildConfig.PANDA_SHELL ? l10n_tab_history : l10n_tab_terminal));
        tabs.getTabAt(MainAdapter.UTILITY_POSITION).setIcon(R.drawable.ic_edit_note);

        tabs.getTabAt(MainAdapter.APPS_POSITION).setText(Language.text(this, l10n_tab_apps));
        tabs.getTabAt(MainAdapter.APPS_POSITION).setIcon(R.drawable.ic_dapps);

        if (MainAdapter.CHAT_POSITION >= 0) {
            tabs.getTabAt(MainAdapter.CHAT_POSITION).setText(Language.text(this, l10n_tab_chat));
            tabs.getTabAt(MainAdapter.CHAT_POSITION).setIcon(R.drawable.ic_chat);
        }

        //Slightly smaller tab icons. TabLayout has no icon-size attribute, so inset each icon to
        //shrink the glyph (~24dp -> ~18dp).
        int inset = Math.round(getResources().getDisplayMetrics().density * 3);
        for (int i = 0; i < tabs.getTabCount(); i++) {
            TabLayout.Tab t = tabs.getTabAt(i);
            if (t != null && t.getIcon() != null) {
                t.setIcon(new android.graphics.drawable.InsetDrawable(t.getIcon(), inset));
            }
        }

        tabs.setOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) {
                //Refresh View
                mMainAdapter.selectPage(tab.getPosition());

                //Reflect the current tab in the toolbar title
                setToolbarTitle(tab.getPosition());
            }

            @Override
            public void onTabUnselected(TabLayout.Tab tab) {}

            @Override
            public void onTabReselected(TabLayout.Tab tab) {
                //Refresh View
                mMainAdapter.refreshPagerView(tab.getPosition());
            }
        });

        //Get Files Permission
        String[] perms = new String[]{
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
        };
        checkPermission(perms,99);

        //Notifications (chat, node health) get their OWN prompt on Android 13+: the storage
        //perms above are never granted there, so a combined request re-fires every launch
        //and two taps on "Don't allow" silently lose the notification prompt for good.
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            checkPermission(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 98);
        }

        checkBattery();
    }

    public void setToolbarTitle(int zPosition){
        String title;
        if (zPosition == MainAdapter.WALLET_POSITION)        title = Language.text(this, l10n_tab_wallet);
        else if (zPosition == MainAdapter.UTILITY_POSITION)  title = Language.text(this, BuildConfig.PANDA_SHELL ? l10n_tab_history : l10n_tab_terminal);
        else if (zPosition == MainAdapter.APPS_POSITION)     title = Language.text(this, l10n_tab_apps);
        else if (zPosition == MainAdapter.CHAT_POSITION)     title = Language.text(this, l10n_tab_chat);
        else title = BuildConfig.PANDAMONIUM ? "" : "Minima Core";
        if(getSupportActionBar() != null){
            getSupportActionBar().setTitle(BuildConfig.PANDAMONIUM ? "" : title);
            // Keep the SKU brand (e.g. "BlackBear") under the title as the user switches tabs.
            if (!BuildConfig.PANDAMONIUM && !BuildConfig.SHELL_BRAND.isEmpty())
                getSupportActionBar().setSubtitle(BuildConfig.SHELL_BRAND);
        }
    }

    @Override public void onConfigurationChanged(android.content.res.Configuration config) {
        super.onConfigurationChanged(config);
        Language.configurationChanged(this);
        refreshShutdownLabels();
        if (mMainAdapter != null) mMainAdapter.languageChanged();
        // Relabel retained tabs without selecting a page or restarting display work.
        TabLayout tabs = findViewById(R.id.tabs);
        if (tabs != null && mMainAdapter != null && tabs.getTabCount() == mMainAdapter.getCount()) {
            tabs.getTabAt(MainAdapter.HOME_POSITION).setText(Language.text(this,
                    BuildConfig.PANDA_SHELL ? l10n_tab_node : l10n_tab_home));
            tabs.getTabAt(MainAdapter.WALLET_POSITION).setText(Language.text(this, l10n_tab_wallet));
            tabs.getTabAt(MainAdapter.UTILITY_POSITION).setText(Language.text(this,
                    BuildConfig.PANDA_SHELL ? l10n_tab_history : l10n_tab_terminal));
            tabs.getTabAt(MainAdapter.APPS_POSITION).setText(Language.text(this, l10n_tab_apps));
            if (MainAdapter.CHAT_POSITION >= 0)
                tabs.getTabAt(MainAdapter.CHAT_POSITION).setText(Language.text(this, l10n_tab_chat));
        }
        if (mMainPager != null) setToolbarTitle(mMainPager.getCurrentItem());
        invalidateOptionsMenu();
    }

    public void checkBattery() {

        String packageName = getPackageName();
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (!pm.isIgnoringBatteryOptimizations(packageName)) {

            //Run intent and get the result
            ActivityResultLauncher<Intent> startActivityForResult = registerForActivityResult(
                    new ActivityResultContracts.StartActivityForResult(),
                    result -> {}
            );

            Intent intent = new Intent();
            intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + packageName));

            startActivityForResult.launch(intent);
        }
    }

    public void checkPermission(String[] permissions, int requestCode){

        //Check all the requested permissions
        boolean allok = true;
        for(String perm : permissions){
            if(ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED){
                allok = false;
                break;
            }
        }

        //Ask for all the permissions
        if(!allok){
            ActivityCompat.requestPermissions(this, permissions , requestCode);
        }
    }

    @Override protected void onStart() {
        super.onStart();
        hostVisible = true;
        if (mMainAdapter != null) mMainAdapter.setHostVisible(true, mMainPager.getCurrentItem());
        if (BuildConfig.PANDAMONIUM && mFooterLeft != null) setFooterText();
    }

    @Override protected void onResume() {
        super.onResume();
        // ViewPager restores its selected page after onStart during recreation.
        if (BuildConfig.PANDAMONIUM && mMainAdapter != null) {
            mMainAdapter.setHostVisible(hostVisible, mMainPager.getCurrentItem());
            // Returning from an overlay can resume an already-active page without onShown.
            mMainAdapter.refreshPagerView(mMainPager.getCurrentItem());
        }
    }

    @Override protected void onStop() {
        hostVisible = false;
        if (mMainAdapter != null) mMainAdapter.setHostVisible(false, mMainPager.getCurrentItem());
        if (BuildConfig.PANDAMONIUM) footerRefresh.invalidate();
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        for (AlertDialog dialog : new java.util.ArrayList<>(languageDialogs)) dialog.dismiss();
        languageDialogs.clear();
        if (mShutdownDialog != null) { mShutdownDialog.dismiss(); mShutdownDialog = null; }
        footerRefresh.close();
        displayHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
        if (MAIN_ACTIVITY == this) MAIN_ACTIVITY = null;

        //Drop any dialog a tab still has open, or its window leaks on rotation
        if(mMainAdapter != null){
            mMainAdapter.destroyAllViews();
        }

        //Unbind from the service..
        if(mMinimaService != null) {
            if (mMinimaService.mServiceListener == this) mMinimaService.mServiceListener = null;
            mMinimaService = null;
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
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.optionsmenu, menu);
        return true;
    }

    @Override
    public boolean onPrepareOptionsMenu(Menu menu) {
        menu.findItem(R.id.mainmenu_logs).setTitle(Language.text(this, l10n_menu_logs));
        menu.findItem(R.id.mainmenu_terminal).setTitle(Language.text(this, l10n_tab_terminal));
        menu.findItem(R.id.mainmenu_backup).setTitle(Language.text(this, l10n_menu_backup));
        menu.findItem(R.id.mainmenu_params).setTitle(Language.text(this, l10n_menu_params));
        menu.findItem(R.id.mainmenu_locknow).setTitle(Language.text(this, l10n_menu_lock_now));
        menu.findItem(R.id.mainmenu_applock).setTitle(Language.text(this, l10n_menu_app_lock));
        menu.findItem(R.id.mainmenu_shutdown).setTitle(Language.text(this, l10n_menu_shutdown));
        menu.findItem(R.id.mainmenu_wipeminima).setTitle(Language.text(this, l10n_menu_reset));
        menu.findItem(R.id.mainmenu_screenshots).setTitle(Language.text(this, l10n_menu_screenshots));
        menu.findItem(R.id.mainmenu_language).setTitle(Language.text(this, l10n_language_title));
        menu.findItem(R.id.mainmenu_battery).setTitle(Language.text(this, l10n_menu_battery));
        //Reflect the persisted screenshot preference in the checkbox
        MenuItem ss = menu.findItem(R.id.mainmenu_screenshots);
        if(ss != null){
            ss.setChecked(MinimaApplication.screenshotsAllowed(this));
        }
        //"Lock now" only makes sense once a PIN is set - otherwise there would be no way back in.
        MenuItem lock = menu.findItem(R.id.mainmenu_locknow);
        if(lock != null){
            lock.setVisible(com.eurobuddha.minimacore.lock.AppLock.isEnabled(this));
        }
        return super.onPrepareOptionsMenu(menu);
    }

    /** Battery profile picker (three-dot menu). Every profile keeps validating blocks and posting txns. */
    private void showBatteryDialog() {
        com.eurobuddha.minimacore.service.BatteryPolicy.load(this);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        android.widget.LinearLayout box = new android.widget.LinearLayout(this);
        box.setOrientation(android.widget.LinearLayout.VERTICAL);
        box.setPadding(pad, pad / 2, pad, 0);
        android.widget.RadioGroup group = new android.widget.RadioGroup(this);
        com.eurobuddha.minimacore.service.BatteryPolicy.Profile[] profiles =
                com.eurobuddha.minimacore.service.BatteryPolicy.Profile.values();
        int[] labels = {l10n_battery_instant, l10n_battery_balanced, l10n_battery_saver};
        for (int i = 0; i < profiles.length; i++) {
            android.widget.RadioButton rb = new android.widget.RadioButton(this);
            rb.setId(android.view.View.generateViewId());
            rb.setText(Language.text(this, labels[i]));
            rb.setTag(profiles[i]);
            rb.setPadding(0, pad / 4, 0, pad / 4);
            group.addView(rb);
            if (profiles[i] == com.eurobuddha.minimacore.service.BatteryPolicy.profile()) rb.setChecked(true);
        }
        box.addView(group);
        android.widget.TextView dhtTitle = new android.widget.TextView(this);
        dhtTitle.setText(Language.text(this, l10n_battery_dht_relay));
        dhtTitle.setPadding(0, pad / 2, 0, 0);
        dhtTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        //No DHT with the keets transport off: the relay rows are built (so OK keeps the saved
        //choice for when keets returns) but not shown.
        boolean keets = com.eurobuddha.minimacore.service.BatteryPolicy.keets();
        if (keets) box.addView(dhtTitle);
        android.widget.RadioGroup dhtGroup = new android.widget.RadioGroup(this);
        android.widget.RadioButton dhtAlways = new android.widget.RadioButton(this);
        dhtAlways.setId(android.view.View.generateViewId());
        dhtAlways.setText(Language.text(this, l10n_battery_dht_always));
        android.widget.RadioButton dhtPlugged = new android.widget.RadioButton(this);
        dhtPlugged.setId(android.view.View.generateViewId());
        dhtPlugged.setText(Language.text(this, l10n_battery_dht_plugged));
        android.widget.RadioButton dhtWifi = new android.widget.RadioButton(this);
        dhtWifi.setId(android.view.View.generateViewId());
        dhtWifi.setText(Language.text(this, l10n_battery_dht_wifi));
        dhtGroup.addView(dhtAlways);
        dhtGroup.addView(dhtWifi);
        dhtGroup.addView(dhtPlugged);
        com.eurobuddha.minimacore.service.BatteryPolicy.DhtRelay relayNow = com.eurobuddha.minimacore.service.BatteryPolicy.dhtRelay();
        (relayNow == com.eurobuddha.minimacore.service.BatteryPolicy.DhtRelay.PLUGGED ? dhtPlugged
                : relayNow == com.eurobuddha.minimacore.service.BatteryPolicy.DhtRelay.WIFI_OR_PLUGGED ? dhtWifi : dhtAlways).setChecked(true);
        if (keets) box.addView(dhtGroup);
        android.widget.CheckBox charger = new android.widget.CheckBox(this);
        charger.setText(Language.text(this, l10n_battery_full_on_charger));
        charger.setChecked(com.eurobuddha.minimacore.service.BatteryPolicy.fullOnCharger());
        box.addView(charger);
        android.widget.TextView note = new android.widget.TextView(this);
        note.setText(Language.text(this, l10n_battery_chain_note));
        note.setPadding(0, pad / 2, 0, 0);
        box.addView(note);
        AlertDialog.Builder b = new AlertDialog.Builder(this)
                .setTitle(Language.text(this, l10n_battery_title))
                .setView(box)
                .setNegativeButton(Language.text(this, l10n_common_cancel), null)
                .setPositiveButton(android.R.string.ok, (d, w) -> {
                    android.view.View sel = group.findViewById(group.getCheckedRadioButtonId());
                    if (sel != null) com.eurobuddha.minimacore.service.BatteryPolicy.setProfile(this,
                            (com.eurobuddha.minimacore.service.BatteryPolicy.Profile) sel.getTag());
                    com.eurobuddha.minimacore.service.BatteryPolicy.setFullOnCharger(this, charger.isChecked());
                    com.eurobuddha.minimacore.service.BatteryPolicy.setDhtRelay(this, dhtPlugged.isChecked()
                            ? com.eurobuddha.minimacore.service.BatteryPolicy.DhtRelay.PLUGGED
                            : dhtWifi.isChecked() ? com.eurobuddha.minimacore.service.BatteryPolicy.DhtRelay.WIFI_OR_PLUGGED
                            : com.eurobuddha.minimacore.service.BatteryPolicy.DhtRelay.ALWAYS);
                });
        if ("samsung".equalsIgnoreCase(android.os.Build.MANUFACTURER)) {
            b.setNeutralButton(Language.text(this, l10n_battery_never_sleep), (d, w) -> openSamsungNeverSleep());
        }
        b.show();
    }

    /** Samsung's "Never sleeping apps" list; falls back to this app's battery settings. */
    private void openSamsungNeverSleep() {
        try {
            startActivity(new Intent("com.samsung.android.sm.ACTION_OPEN_CHECKABLE_LISTACTIVITY")
                    .setPackage("com.samsung.android.lool")
                    .putExtra("activity_type", 2));
        } catch (Exception e) {
            try {
                startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        android.net.Uri.parse("package:" + getPackageName())));
            } catch (Exception ignored) { }
        }
    }

    public void toggleScreenshots(MenuItem zItem){
        boolean allow = !MinimaApplication.screenshotsAllowed(this);

        ((MinimaApplication) getApplication()).setScreenshotsAllowed(allow);

        zItem.setChecked(allow);

        Toast.makeText(this, Language.text(this, allow ? l10n_menu_screenshots_allowed : l10n_menu_screenshots_blocked),
                Toast.LENGTH_SHORT).show();
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {

        switch (item.getItemId())
        {
            case R.id.mainmenu_trackium:
                startActivity(new android.content.Intent(this, tech.trackium.cargo.MainActivity.class));
                return true;
//            case R.id.mainmenu_addpeer :
//
//                addPeerDialog();
//
//                return true;

            case R.id.mainmenu_language :
                Language.choose(this, false);
                return true;

            case R.id.mainmenu_battery :
                showBatteryDialog();
                return true;

            case R.id.mainmenu_screenshots :

                toggleScreenshots(item);

                return true;

            case R.id.mainmenu_logs :

                MainActivity.this.startActivity(new Intent(MainActivity.this,
                        com.eurobuddha.minimacore.main.views.logs.LogsActivity.class));

                return true;

            case R.id.mainmenu_terminal :

                MainActivity.this.startActivity(new Intent(MainActivity.this,
                        com.eurobuddha.minimacore.main.views.terminal.TerminalActivity.class));

                return true;

            case R.id.mainmenu_backup :

                MainActivity.this.startActivity(new Intent(MainActivity.this,
                        com.eurobuddha.minimacore.main.backup.BackupActivity.class));

                return true;

            case R.id.mainmenu_params :

                MainActivity.this.startActivity(new Intent(MainActivity.this, ParamsActivity.class));

                return true;

            case R.id.mainmenu_applock :

                MainActivity.this.startActivity(new Intent(MainActivity.this,
                        com.eurobuddha.minimacore.lock.LockSettingsActivity.class));

                return true;

            case R.id.mainmenu_locknow :

                //Lock on demand: only if a PIN is set, else there is no way back in.
                if (com.eurobuddha.minimacore.lock.AppLock.isEnabled(this)) {
                    com.eurobuddha.minimacore.lock.AppLock.get().lock();
                    MainActivity.this.startActivity(new Intent(MainActivity.this,
                            com.eurobuddha.minimacore.lock.LockActivity.class));
                }

                return true;

            case R.id.mainmenu_shutdown :
                //Wipe everything..
                shutdownMinima();

                return true;

            case R.id.mainmenu_wipeminima :

                //Wipe everything..
                wipeMinima();

                return true;

            default:
                return super.onOptionsItemSelected(item);
        }
    }

    public void addPeerDialog(){

        LanguageDialog builder = languageDialog();
        builder.setTitle(Language.msg(l10n_core_peer_title));

        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT);
        builder.setView(input);

        builder.setPositiveButton(Language.msg(l10n_core_add_peer), new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                String peer = input.getText().toString();

                MinimaCMD.runMinima("peers action:addpeers peerslist:"+peer);

                Toast.makeText(MainActivity.this, Language.msg(l10n_core_peer_added), Toast.LENGTH_SHORT).show();
            }
        });
        builder.setNegativeButton(Language.msg(l10n_common_cancel), new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                dialog.cancel();
            }
        });

        builder.show();
    }

    /** Save & Restart from ParamsActivity - clean shutdown then start again. */
    public void restartMinima(){
        RESTART_ON_SHUTDOWN = true;
        shutdownMinima();
    }

    private void refreshShutdownLabels() {
        if (mShutdownDialog == null) return;
        mShutdownDialog.setTitle(Language.text(this, l10n_core_shutting_down));
        mShutdownDialog.setMessage(Language.text(this, l10n_core_wait));
    }

    public void shutdownMinima(){

        //Has the service shutdown
        if(MinimaService.haveStartedShutdown()){

            //Restarting? Just start it again..
            if(RESTART_ON_SHUTDOWN){
                RESTART_ON_SHUTDOWN = false;
                startMinimaService();
                Toast.makeText(this, Language.msg(l10n_core_restarting), Toast.LENGTH_SHORT).show();
                return;
            }

            Toast.makeText(this, Language.msg(l10n_core_stopped), Toast.LENGTH_SHORT).show();

            //Are we WIPING..
            if(WIPE_ON_SHUTDOWN){
                wipeData();
            }

            return;
        }

        //Cancel the alarm
        if(mMinimaService != null){
            mMinimaService.cancelAlarm();
        }

        //Show a shutdown spinning dialog
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                mShutdownDialog = new ProgressDialog(MainActivity.this); // this = YourActivity
                mShutdownDialog.setProgressStyle(ProgressDialog.STYLE_SPINNER);
                refreshShutdownLabels();
                mShutdownDialog.setIndeterminate(true);

                mShutdownDialog.setCanceledOnTouchOutside(true);

                mShutdownDialog.show();
            }
        });

        //Unbind from service
        if(mMinimaService !=null) {
            mMinimaService = null;
            try{
                unbindService(this);
            }catch(Exception exc){

            }
        }

        Intent minimaintent = new Intent(MainActivity.this, MinimaService.class);
        boolean stopped = stopService(minimaintent);
    }

    public void wipeMinima(){

        languageDialog()
                .setTitle(Language.msg(l10n_core_reset_title))
                .setMessage(Language.msg(l10n_core_reset_warning))
                .setIcon(R.drawable.ic_minima)
                .setPositiveButton(Language.msg(android.R.string.yes), new DialogInterface.OnClickListener(){
                    public void onClick(DialogInterface dialog, int whichButton) {
                        //Now in shutdopwn mode..
                        logger.log("Minima WIPE STARTED");

                        WIPE_ON_SHUTDOWN = true;

                        shutdownMinima();
                    }})
                .setNegativeButton(Language.msg(android.R.string.no), null).show();
    }

    public void wipeData(){
        logger.log("WIPING BASE FOLDER");

        MiniFile.deleteFileOrFolder(GeneralParams.BASE_FILE_FOLDER, new File(GeneralParams.BASE_FILE_FOLDER));

        //Companion pairings live in receive.db, not the node folder. A reset is a new wallet and
        //must not hand every previously-enabled app - ADMIN included - straight to it.
        try{
            ReceiverDB pairings = new ReceiverDB(this);
            pairings.wipeDB();
            pairings.close();
        }catch(Exception exc){
            logger.log("Could not wipe companion pairings : "+exc);
        }

        //reset prefs..
        SharedPreferences prefs = getSharedPreferences("main_prefs", MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putBoolean("SEED_SET", false);
        editor.putString("SEED", "");
        editor.putInt("KEYUSES", 0);
        editor.putBoolean(ParamsActivity.PREF_PARAM_SERVER, false);
        editor.putBoolean(ParamsActivity.PREF_PARAM_MEGAMMR, false);
        editor.putBoolean(ParamsActivity.PREF_PARAM_RPC, false);
        editor.putString(ParamsActivity.PREF_EXTRA_PARAMS, "");
        editor.commit();
    }

    @Override
    public void MinimaServiceShutdown(){

        //Are we WIPING..
        if(WIPE_ON_SHUTDOWN){
            wipeData();
        }

        //Hide the window
        if(mShutdownDialog!=null){
            if(mShutdownDialog.isShowing()){
                mShutdownDialog.dismiss();
            }
        }

        //Restarting with new params? Start the service again instead of closing
        if(RESTART_ON_SHUTDOWN){
            RESTART_ON_SHUTDOWN = false;

            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    //Small delay so the old service instance fully releases (DB locks etc)
                    mMainPager.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            //The Keets transport switch changes the tab shell (Chat tab or not),
                            //which only onCreate builds: recreate() rebuilds it and starts the service.
                            boolean keetsNow = com.eurobuddha.minimacore.main.StartupMode.keetsEnabled(
                                    getSharedPreferences("main_prefs", MODE_PRIVATE));
                            if ((MainAdapter.CHAT_POSITION >= 0) != keetsNow) {
                                recreate();
                                return;
                            }
                            startMinimaService();
                            Toast.makeText(MainActivity.this,
                                    Language.msg(l10n_core_restart_params), Toast.LENGTH_LONG).show();
                        }
                    }, 2000);
                }
            });
            return;
        }

        //And shutdown..
        finish();
    }

    @Override
    public void MinimaNewBlock() {
        runOnUiThread(() -> {
            if (isFinishing() || isDestroyed() || mMainAdapter == null) return;
            mMainAdapter.refreshHomeView();
            setFooterText();
        });
    }

    /**
     * NEWBALANCE - funds have actually moved on chain.
     *
     * This is the honest confirmation point: a `send` reply only means the transaction was
     * built and posted, not that it was mined. Refresh the wallet so its figures and the
     * "updated ..." stamp are current, and say so once.
     */
    @Override
    public void MinimaNewBalance() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try{
                    // Refresh the wallet by its build-specific position.
                    mMainAdapter.refreshPagerView(MainAdapter.WALLET_POSITION);
                    Toast.makeText(MainActivity.this, Language.msg(l10n_core_balance_updated), Toast.LENGTH_SHORT).show();

                }catch(Throwable exc){
                    logger.log("NEWBALANCE refresh failed : "+exc);
                }
            }
        });
    }

    public void setFooterText(){

        if (!canRenderFooter()) return;

        //Have we started
        if(!MinimaCMD.checkMinimaStarted()){
            return;
        }

        mFooterRight.post(new Runnable() {
            @Override
            public void run() {
                //Re-check inside the Runnable: the tip can be gone by the time this runs
                //(mid-resync), and an NPE here is on the main thread.
                if(!canRenderFooter() || !MinimaCMD.checkMinimaStarted()) return;
                TxPoW txp = MinimaDB.getDB().getTxPoWTree().getTip().getTxPoW();

                int block = txp.getBlockNumber().getAsInt();

                long timemilli  = txp.getTimeMilli().getAsLong();
                Language.setText(mFooterRight, Language.join(block, " @ ", Language.stamp(timemilli, "Hms")));
            }
        });

        //Run some Minima Commands..
        footerRefresh.request();
    }

    private void renderFooterKeys(JSONObject result) {
        if (!canRenderFooter() || !MinimaCMD.checkMinimaStarted()) return;
        try {
            JSONObject resp = (JSONObject) result.get("response");
            Object maxuses = resp.get("maxuses");
            if (maxuses != null) Language.setText(mFooterLeft, Language.msg(
                    GeneralParams.USE_BLOCK_AS_KEYUSES ? l10n_core_last_key_block : l10n_core_key_uses,
                    String.valueOf(maxuses)));
        } catch (Exception ignored) {}
    }

    @Override
    public void MinimaLoadKeys(int zKeys, boolean zFinished) {}

    @Override
    public void onServiceConnected(ComponentName componentName, IBinder iBinder) {
        MinimaService.MyBinder binder = (MinimaService.MyBinder)iBinder;
        mMinimaService = binder.getService();

        //Tell the service Who we are..
        mMinimaService.mServiceListener = this;

        //Get the Database
        mMainAdapter.getAppsView().setDatabase(mMinimaService.getReceiverDatabase());

        //Now refresh the views..
        mMainAdapter.refreshAllViews();

        //Set the footer Text
        setFooterText();
    }

    @Override
    public void onServiceDisconnected(ComponentName componentName) {
        mMinimaService = null;
    }
}
