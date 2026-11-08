package com.eurobuddha.minimacore.launcher.restore;


import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import org.minima.utils.BIP39;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import com.eurobuddha.minimacore.utils.KeyboardInsets;
import com.eurobuddha.minimacore.main.ResyncJob;
import com.eurobuddha.minimacore.launcher.LauncherActivity;
import com.eurobuddha.minimacore.utils.logger;

public class RestoreWalletSyncActivity extends AppCompatActivity {

    EditText mSeedInput;
    EditText mKeyUsesInput;

    EditText mMegaNode;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.restorewallet_activity);


        Toolbar tb = findViewById(R.id.toolbar);
        Language.toolbarTitle(tb, Language.msg(l10n_launcher_restore_wallet));
        setSupportActionBar(tb);
        KeyboardInsets.install(this, findViewById(R.id.restorewallet_main), tb);

        boolean block = com.eurobuddha.minimacore.main.StartupMode.usesBlockKeys(
                getSharedPreferences("main_prefs", MODE_PRIVATE));
        CharSequence intro = Language.msg(com.eurobuddha.minimacore.BuildConfig.PANDAMONIUM
                ? l10n_restore_intro_pandamonium : block ? l10n_restore_intro_block : l10n_restore_intro_classic);
        if (com.eurobuddha.minimacore.BuildConfig.PANDAMONIUM) {
            intro = Language.join(Language.msg(block ? l10n_drawer_block_mode : l10n_drawer_classic_mode), "\n\n", intro);
        }
        Language.setText(findViewById(R.id.restorewallet_intro), intro);
        Language.setText(findViewById(R.id.restorewallet_keyuses_label), Language.msg(
                com.eurobuddha.minimacore.BuildConfig.BLOCK_KEYUSES ? l10n_restore_key_uses_floor : l10n_restore_key_uses));

        mSeedInput      = findViewById(R.id.restorewallet_seed);
        mKeyUsesInput   = findViewById(R.id.restorewallet_keyuses);
        mMegaNode       = findViewById(R.id.restorewallet_megammr);

        Button checkbutton = findViewById(R.id.restorewallet_button_check);
        checkbutton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String seed = mSeedInput.getText().toString().trim();
                if(seed.equals("")){
                    showDialog(Language.msg(l10n_onboarding_seed_error), Language.msg(l10n_onboarding_empty_seed));
                    return;
                }

                //Check it..
                try{
                    String newseed = BIP39.cleanSeedPhrase(seed);
                    setSeedText(newseed);
                }catch (IllegalArgumentException exc){
                    showDialog(Language.msg(l10n_onboarding_seed_error), Language.msg(l10n_onboarding_invalid_word));
                    return;
                }

                showDialog(Language.msg(l10n_onboarding_seed_phrase), Language.msg(l10n_onboarding_valid_seed));
            }
        });

        Button proceedbutton = findViewById(R.id.restorewallet_button_proceed);
        proceedbutton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {

                //Get the seed
                String seed = mSeedInput.getText().toString().trim();
                if(seed.equals("")){
                    showDialog(Language.msg(l10n_onboarding_seed_error), Language.msg(l10n_onboarding_empty_seed));
                    return;
                }

                String keyusesstr = mKeyUsesInput.getText().toString().trim();
                int keyuses;
                try{
                    keyuses = Integer.parseInt(keyusesstr);
                }catch(NumberFormatException exc){
                    showDialog(Language.msg(l10n_restore_key_uses), Language.msg(l10n_restore_key_uses_integer));
                    return;
                }
                //Same floor as the in-app seed rebuild: keyuses:0 says no key was ever used, and
                //a reused Winternitz index exposes the private key.
                int maxKeyUses = ResyncJob.maxKeyUses(com.eurobuddha.minimacore.main.StartupMode.usesBlockKeys(
                        getSharedPreferences("main_prefs", MODE_PRIVATE)));
                if(keyuses < ResyncJob.MIN_KEY_USES || keyuses > maxKeyUses){
                    showDialog(Language.msg(l10n_restore_key_uses), Language.msg(l10n_restore_key_uses_range,
                            ResyncJob.MIN_KEY_USES, maxKeyUses));
                    return;
                }

                String megammr = mMegaNode.getText().toString().trim();

                //Set the prefs..
                SharedPreferences prefs = getSharedPreferences("main_prefs", MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                editor.putBoolean("SEED_SET", true);
                editor.putString("SEED", seed);
                editor.putInt("KEYUSES", keyuses);
                editor.putString("default_peers", megammr);
                editor.commit();

                //Jump to restore wallet..
                Intent myIntent = new Intent(RestoreWalletSyncActivity.this, SeedSyncServiceActivity.class);
                RestoreWalletSyncActivity.this.startActivity(myIntent);

                //Close the main Laumcher
                LauncherActivity.LAUNCHER_ACTIVITY.finish();

                finish();
            }
        });
    }

    public void setSeedText(String zSeed){
        mSeedInput.post(new Runnable() {
            @Override
            public void run() {
                mSeedInput.setText(zSeed);
            }
        });
    }

    private void showDialog(CharSequence title, CharSequence message) {
        logger.showDialog(this, title, message);
    }
}
