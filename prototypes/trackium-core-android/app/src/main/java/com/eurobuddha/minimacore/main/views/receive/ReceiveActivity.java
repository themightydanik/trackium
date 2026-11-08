package com.eurobuddha.minimacore.main.views.receive;

import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.os.Bundle;
import android.widget.FrameLayout;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.utils.KeyboardInsets;

/**
 * Thin host that presents the receive (address + QR) screen.
 *
 * Reuses {@link ReceiveView} verbatim. Reached from the Wallet tab's
 * "Receive" button.
 */
public class ReceiveActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.activity_receive);


        Toolbar tb = findViewById(R.id.receive_toolbar);
        Language.toolbarTitle(tb, Language.msg(l10n_wallet_receive));
        tb.setNavigationOnClickListener(v -> finish());
        KeyboardInsets.install(this, findViewById(R.id.receive_main), tb);

        //Host the existing, self-contained receive view
        ReceiveView receive = new ReceiveView(this);
        FrameLayout container = findViewById(R.id.receive_container);
        container.addView(receive.getMainView());
    }
}
