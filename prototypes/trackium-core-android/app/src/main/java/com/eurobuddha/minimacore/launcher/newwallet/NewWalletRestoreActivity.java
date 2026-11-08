package com.eurobuddha.minimacore.launcher.newwallet;

import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import org.minima.utils.BIP39;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import com.eurobuddha.minimacore.utils.KeyboardInsets;
import com.eurobuddha.minimacore.launcher.LauncherActivity;
import com.eurobuddha.minimacore.launcher.StartServiceActivity;
import com.eurobuddha.minimacore.launcher.restore.SeedSyncServiceActivity;
import com.eurobuddha.minimacore.main.MainActivity;
import com.eurobuddha.minimacore.utils.logger;

public class NewWalletRestoreActivity extends AppCompatActivity {

    EditText mSeedInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.restorenewwallet_activity);


        Toolbar tb = findViewById(R.id.toolbar);
        Language.toolbarTitle(tb, Language.msg(l10n_launcher_new_wallet));
        setSupportActionBar(tb);
        KeyboardInsets.install(this, findViewById(R.id.restorewallet_main), tb);

        mSeedInput = findViewById(R.id.restorewallet_seed);

        Button checkbutton = findViewById(R.id.restorewallet_button_check);
        checkbutton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String seed = mSeedInput.getText().toString().trim();
                if(seed.equals("")){
                    logger.showDialog(NewWalletRestoreActivity.this,Language.msg(l10n_onboarding_seed_error),Language.msg(l10n_onboarding_empty_seed));
                    return;
                }

                //Check it..
                try{
                    String newseed = BIP39.cleanSeedPhrase(seed);
                    setSeedText(newseed);
                }catch (IllegalArgumentException exc){
                    logger.showDialog(NewWalletRestoreActivity.this,Language.msg(l10n_onboarding_seed_error),Language.msg(l10n_onboarding_invalid_word));
                    return;
                }

                logger.showDialog(NewWalletRestoreActivity.this,Language.msg(l10n_onboarding_seed_phrase),Language.msg(l10n_onboarding_valid_seed));
            }
        });

        Button proceedbutton = findViewById(R.id.restorewallet_button_proceed);
        proceedbutton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {

                //Get the seed
                String seed = mSeedInput.getText().toString().trim();
                if(seed.equals("")){
                    logger.showDialog(NewWalletRestoreActivity.this,Language.msg(l10n_onboarding_seed_error),Language.msg(l10n_onboarding_empty_seed));
                    return;
                }

//                //Get the Node
//                String seed = mSeedInput.getText().toString().trim();
//                if(seed.equals("")){
//                    logger.showDialog(NewWalletRestoreActivity.this,Language.msg(l10n_onboarding_seed_error),Language.msg(l10n_onboarding_empty_seed));
//                    return;
//                }

                //Set the prefs..
                SharedPreferences prefs = getSharedPreferences("main_prefs", MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                editor.putBoolean("SEED_SET", true);
                editor.putString("SEED", seed);
                editor.commit();

                //Jump to restore wallet..
                Intent myIntent = new Intent(NewWalletRestoreActivity.this, StartServiceActivity.class);
                NewWalletRestoreActivity.this.startActivity(myIntent);

                //Close the main Launcher
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
}
