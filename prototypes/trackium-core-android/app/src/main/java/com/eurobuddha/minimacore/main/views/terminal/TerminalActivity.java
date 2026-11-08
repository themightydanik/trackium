package com.eurobuddha.minimacore.main.views.terminal;

import android.content.Intent;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.graphics.Typeface;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import org.minima.system.params.GlobalParams;
import org.minima.utils.MiniFormat;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.utils.KeyboardInsets;
import com.eurobuddha.minimacore.launcher.StartServiceActivity;
import com.eurobuddha.minimacore.main.MainActivity;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.MinimaCMDListener;
import com.eurobuddha.minimacore.utils.Peers;
import com.eurobuddha.minimacore.utils.logger;

public class TerminalActivity extends AppCompatActivity {

    public int MAX_TERMINAL_LENGTH = 20000;

    ScrollView mScroller;
    TextView mMainText;
    EditText mInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.activity_terminal);


        Toolbar tb = findViewById(R.id.toolbar);
        Language.toolbarTitle(tb, Language.msg(l10n_tab_terminal));
        setSupportActionBar(tb);
        KeyboardInsets.install(this, findViewById(R.id.sync_main), tb);

        mScroller   = findViewById(R.id.terminal_scroller);
        mMainText   = findViewById(R.id.terminal_maintext);
        mMainText.setTypeface(Typeface.MONOSPACE);
        mMainText.setTextIsSelectable(true);

        TerminalView.bindBanner(findViewById(R.id.main));

        mInput      = findViewById(R.id.terminal_input);
        mInput.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                // Match the configured Send action; unrelated IME actions must retain the draft.
                if (actionId != EditorInfo.IME_ACTION_DONE && actionId != EditorInfo.IME_ACTION_SEND
                        && !(event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER
                        && event.getAction() == KeyEvent.ACTION_DOWN)) return false;
                String cmd = mInput.getText().toString().trim();
                mInput.post(new Runnable() {
                    @Override
                    public void run() {
                        mInput.setText("");
                    }
                });

                if(actionId == EditorInfo.IME_ACTION_DONE || actionId == EditorInfo.IME_ACTION_SEND){
                    runCMD(cmd);
                    return true;
                }

                if(event != null) {
                    if (event.getKeyCode() == KeyEvent.KEYCODE_ENTER && event.getAction() == KeyEvent.ACTION_DOWN) {
                        if (cmd.equals("")) {
                            appendText("\n");
                            return false;
                        }

                        //Run this command
                        runCMD(cmd);

                        return true;
                    }
                }
                return false;
            }
        });

        Button but  = findViewById(R.id.terminal_send);
        but.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String cmd = mInput.getText().toString().trim();
                mInput.post(new Runnable() {
                    @Override
                    public void run() {
                        mInput.setText("");
                    }
                });

                if(cmd.equals("")){
                    return;
                }
                //Run this command
                runCMD(cmd);
            }
        });
    }

    public void runCMD(String zCommand){

        //First append the command
        appendText(zCommand);

        //Run and append the result..
        MinimaCMD.runMinima(zCommand, new MinimaCMDListener() {
            @Override
            public void cmdResult(JSONObject zResult) {
                appendText(MiniFormat.JSONPretty(zResult));
            }
        });
    }

    public void appendText(String zText) {
        // Bound the new response before posting it: the previous guard trimmed only old output.
        final String incoming = zText.length() >= MAX_TERMINAL_LENGTH
                ? TerminalView.boundedAppend("", zText, MAX_TERMINAL_LENGTH) : zText;
        mMainText.post(new Runnable() {
            @Override
            public void run() {
                mMainText.setText(TerminalView.boundedAppend(
                        mMainText.getText().toString(), incoming, MAX_TERMINAL_LENGTH));

                mScroller.post(new Runnable() {
                    @Override
                    public void run() {
                        mScroller.scrollTo(0,1000000);
                    }
                });
            }
        });
    }
}
