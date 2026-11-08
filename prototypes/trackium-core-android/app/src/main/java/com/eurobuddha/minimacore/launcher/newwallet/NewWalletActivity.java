package com.eurobuddha.minimacore.launcher.newwallet;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import org.minima.utils.BIP39;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import com.eurobuddha.minimacore.utils.KeyboardInsets;

public class NewWalletActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.newwallet_activity);


        Toolbar tb = findViewById(R.id.toolbar);
        Language.toolbarTitle(tb, Language.msg(l10n_launcher_new_wallet));
        setSupportActionBar(tb);
        KeyboardInsets.install(this, findViewById(R.id.newwallet_main), tb);

        //get a new seed
        String seed = BIP39.convertWordListToString(BIP39.getNewWordList());

        TextView seedtxt = findViewById(R.id.newwallet_seed);
        seedtxt.setText(seed);

        Button proceedbutton = findViewById(R.id.newwallet_button_proceed);
        proceedbutton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                //Jump to restore wallet..
                Intent myIntent = new Intent(NewWalletActivity.this, NewWalletRestoreActivity.class);
                NewWalletActivity.this.startActivity(myIntent);

                finish();
            }
        });
    }
}
