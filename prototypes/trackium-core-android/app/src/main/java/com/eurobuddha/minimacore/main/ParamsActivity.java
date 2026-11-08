package com.eurobuddha.minimacore.main;

import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import com.google.android.material.switchmaterial.SwitchMaterial;

import org.minima.system.params.ParamConfigurer;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.BuildConfig;
import com.eurobuddha.minimacore.utils.Clip;
import com.eurobuddha.minimacore.utils.KeyboardInsets;

import java.util.StringTokenizer;

/**
 * User-configurable node startup parameters.
 *
 * Curated toggles are stored as their own prefs and applied by MinimaService when it
 * builds the boot arg list; the free-text field is the existing minima_extra_params
 * pref that MinimaService has always consumed. Everything takes effect on the next
 * node (re)start.
 */
public class ParamsActivity extends AppCompatActivity {

    //Pref keys - read by MinimaService at boot
    public static final String PREF_PARAM_SERVER  = "PARAM_SERVER";
    public static final String PREF_PARAM_MEGAMMR = "PARAM_MEGAMMR";
    public static final String PREF_PARAM_RPC     = "PARAM_RPC";
    //Generated once, never blank: RPC is never started without it (MinimaService).
    public static final String PREF_PARAM_RPC_PASSWORD = "PARAM_RPC_PASSWORD";
    public static final String PREF_EXTRA_PARAMS  = "minima_extra_params";
    //Not a node flag: read by NodeHealthMonitor, not by MinimaService at boot.
    public static final String PREF_AUTORESYNC    = "PARAM_AUTORESYNC";

    //Flags that must never come in via the free-text field: wipe/seed danger
    //(-clean/-genesis/-solo wipe data, -seed/-anyseed/-dbpassword touch the wallet,
    //-blockaskeyuses flips the ENTIRE key system: same seed, different addresses, and
    //legacy keys driven past 262,144 uses - only the dedicated mode setting may change it)
    //and flags the app manages itself (-data/-basefolder/-conf/-daemon/-noshutdownhook,
    //-server/-isclient collide with the Server toggle non-deterministically).
    private static final String[] BLOCKED_FLAGS = {
            "-clean", "-genesis", "-solo", "-seed", "-anyseed", "-dbpassword", "-blockaskeyuses",
            "-data", "-basefolder", "-conf", "-daemon", "-noshutdownhook",
            "-server", "-isclient",
            //the Keets transport switch owns these (a typed -keets would re-enable a switched-off transport)
            "-keets", "-keetssidecar", "-keetssidecarargs"
    };

    SwitchMaterial mKeetsSwitch;
    SwitchMaterial mServerSwitch;
    SwitchMaterial mMegaSwitch;
    SwitchMaterial mRpcSwitch;
    SwitchMaterial mAutoResyncSwitch;
    SwitchMaterial mClassicSwitch;
    TextView       mRpcPassword;
    View           mRpcPasswordRow;
    EditText       mExtraInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.params_activity);


        Toolbar tb = findViewById(R.id.toolbar);
        Language.toolbarTitle(tb, Language.msg(l10n_menu_params));
        setSupportActionBar(tb);
        KeyboardInsets.install(this, findViewById(R.id.params_main), tb);

        mServerSwitch = findViewById(R.id.params_switch_server);
        mMegaSwitch   = findViewById(R.id.params_switch_megammr);
        mRpcSwitch    = findViewById(R.id.params_switch_rpc);
        mAutoResyncSwitch = findViewById(R.id.params_switch_autoresync);
        mKeetsSwitch  = findViewById(R.id.params_switch_keets);
        mClassicSwitch = findViewById(R.id.params_switch_classic);
        findViewById(R.id.params_classic_row).setVisibility(BuildConfig.PANDAMONIUM ? View.VISIBLE : View.GONE);
        mExtraInput   = findViewById(R.id.params_extra);

        //Load the current values
        SharedPreferences prefs = getSharedPreferences("main_prefs", MODE_PRIVATE);
        mClassicSwitch.setChecked(prefs.getBoolean(StartupMode.PREF_CLASSIC_MODE, false));
        mServerSwitch.setChecked(prefs.getBoolean(PREF_PARAM_SERVER, false));
        mMegaSwitch.setChecked(prefs.getBoolean(PREF_PARAM_MEGAMMR, false));
        mRpcSwitch.setChecked(prefs.getBoolean(PREF_PARAM_RPC, false));
        mAutoResyncSwitch.setChecked(prefs.getBoolean(PREF_AUTORESYNC, false));
        mKeetsSwitch.setChecked(StartupMode.keetsEnabled(prefs));
        String extra = prefs.getString(PREF_EXTRA_PARAMS, "");
        mExtraInput.setText(BuildConfig.PANDAMONIUM ? StartupMode.withoutManagedArguments(extra) : extra);

        //The RPC password, shown in full with Copy whenever RPC is on - it is the only thing
        //between the LAN and this node's commands, and the user has to type it somewhere.
        mRpcPassword    = findViewById(R.id.params_rpc_password);
        mRpcPasswordRow = findViewById(R.id.params_rpc_password_row);
        findViewById(R.id.params_rpc_password_copy).setOnClickListener(v ->
                Clip.copySensitive(this, Language.text(this, l10n_params_rpc_clipboard), mRpcPassword.getText().toString(), Language.text(this, l10n_params_rpc_copied)));
        mRpcSwitch.setOnCheckedChangeListener((b, on) -> renderRpcPassword(on));
        renderRpcPassword(mRpcSwitch.isChecked());

        Button save = findViewById(R.id.params_button_save);
        save.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if(saveParams()){
                    Toast.makeText(ParamsActivity.this,
                            Language.msg(l10n_params_saved), Toast.LENGTH_LONG).show();
                    finish();
                }
            }
        });

        Button saverestart = findViewById(R.id.params_button_save_restart);
        // This same screen is available before creating/restoring the first wallet.
        if (BuildConfig.PANDAMONIUM && !prefs.getBoolean("SEED_SET", false)) {
            saverestart.setVisibility(View.GONE);
        }
        saverestart.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if(!saveParams()){
                    return;
                }

                new LanguageDialog(ParamsActivity.this)
                        .setTitle(Language.msg(l10n_params_restart_title))
                        .setMessage(Language.msg(l10n_params_restart_body))
                        .setIcon(R.drawable.ic_minima)
                        .setPositiveButton(Language.msg(android.R.string.yes), new DialogInterface.OnClickListener(){
                            public void onClick(DialogInterface dialog, int whichButton) {
                                if(MainActivity.MAIN_ACTIVITY != null){
                                    MainActivity.MAIN_ACTIVITY.restartMinima();
                                }
                                finish();
                            }})
                        .setNegativeButton(Language.msg(android.R.string.no), null)
                        .show();
            }
        });
    }

    private void renderRpcPassword(boolean on){
        mRpcPasswordRow.setVisibility(on ? View.VISIBLE : View.GONE);
        if(on) mRpcPassword.setText(ensureRpcPassword(getSharedPreferences("main_prefs", MODE_PRIVATE)));
    }

    /**
     * The RPC password, generating and storing one on first use.
     *
     * Hex from SecureRandom: unguessable, and safe both as a boot argument and in a Basic-auth
     * header. The node's RPC user is "minima". Shared with MinimaService so the password shown
     * here is exactly the one the node is started with.
     */
    public static String ensureRpcPassword(SharedPreferences prefs){
        String existing = prefs.getString(PREF_PARAM_RPC_PASSWORD, "");
        if(!existing.isEmpty()) return existing;
        byte[] raw = new byte[16];
        new java.security.SecureRandom().nextBytes(raw);
        StringBuilder hex = new StringBuilder();
        for(byte b : raw) hex.append(String.format("%02x", b));
        prefs.edit().putString(PREF_PARAM_RPC_PASSWORD, hex.toString()).commit();
        return hex.toString();
    }

    /** Validate + persist. Returns false (with a dialog shown) on any problem. */
    private boolean saveParams(){

        String extra = mExtraInput.getText().toString().trim().replaceAll("\\s+", " ");

        //Refuse blocked flags outright - clearer than silently stripping them
        StringTokenizer tok = new StringTokenizer(extra, " ");
        while(tok.hasMoreTokens()){
            String t = tok.nextToken();
            if (BuildConfig.PANDAMONIUM && StartupMode.isManagedArgument(t)) {
                showDialog(Language.msg(l10n_params_managed), Language.msg(l10n_params_managed_body, t));
                return false;
            }
            for(String blocked : BLOCKED_FLAGS){
                if(t.equals(blocked)){
                    showDialog(Language.msg(l10n_params_blocked),
                            Language.msg(l10n_params_blocked_body, t));
                    return false;
                }
            }
        }

        //Validate against the node's own parser so errors surface NOW, not as a
        //silent skip at boot
        if(!extra.equals("") && !ParamConfigurer.checkParams(extra)){
            showDialog(Language.msg(l10n_params_invalid),
                    Language.msg(l10n_params_invalid_body, extra));
            return false;
        }

        SharedPreferences.Editor editor = getSharedPreferences("main_prefs", MODE_PRIVATE).edit();
        editor.putBoolean(PREF_PARAM_SERVER,  mServerSwitch.isChecked());
        editor.putBoolean(PREF_PARAM_MEGAMMR, mMegaSwitch.isChecked());
        editor.putBoolean(PREF_PARAM_RPC,     mRpcSwitch.isChecked());
        editor.putBoolean(PREF_AUTORESYNC,    mAutoResyncSwitch.isChecked());
        editor.putBoolean(StartupMode.PREF_KEETS, mKeetsSwitch.isChecked());
        if (BuildConfig.PANDAMONIUM) editor.putBoolean(StartupMode.PREF_CLASSIC_MODE, mClassicSwitch.isChecked());
        editor.putString(PREF_EXTRA_PARAMS, extra);
        if (!editor.commit()) {
            showDialog(Language.msg(l10n_params_save_failed), Language.msg(l10n_params_save_failed_body));
            return false;
        }

        return true;
    }

    private void showDialog(CharSequence zTitle, CharSequence zMessage){
        new LanguageDialog(this)
                .setTitle(zTitle)
                .setMessage(zMessage)
                .setIcon(R.drawable.ic_minima)
                .setPositiveButton(Language.msg(android.R.string.yes), new DialogInterface.OnClickListener(){
                    public void onClick(DialogInterface dialog, int whichButton) {

                    }}).show();
    }
}
