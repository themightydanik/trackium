package com.eurobuddha.minimacore.main.views.terminal;

import android.app.Activity;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.graphics.Typeface;
import android.text.method.ScrollingMovementMethod;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ScrollView;
import android.widget.TextView;

import org.minima.system.params.GlobalParams;
import org.minima.utils.MiniFormat;
import org.minima.utils.MinimaLogger;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.MinimaCMDListener;
import com.eurobuddha.minimacore.utils.logger;
import com.eurobuddha.minimacore.main.BaseView;

public class TerminalView extends BaseView  {

    public int MAX_TERMINAL_LENGTH = 20000;

    ScrollView mScroller;
    TextView mMainText;
    EditText mInput;

    public TerminalView(Activity zActivity){
        super(zActivity, R.layout.view_terminal);

        logger.log("Terminal View created..");

        mScroller = getMainView().findViewById(R.id.terminal_scroller);

        mMainText   = mMainView.findViewById(R.id.terminal_maintext);
        mMainText.setTypeface(Typeface.MONOSPACE);
        mMainText.setTextIsSelectable(true);

        bindBanner(mMainView);

        mInput      = mMainView.findViewById(R.id.terminal_input);
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

        Button but  = mMainView.findViewById(R.id.terminal_send);
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

    /** Keep app-owned banner text live while command output stays literal, as in Parlons TerminalView. */
    public static void bindBanner(View root) {
        TextView banner = root.findViewById(R.id.terminal_banner);
        banner.setTypeface(Typeface.MONOSPACE);
        Language.setText(banner, Language.join(
                "\n",
                "**********************************************",
                "\n",
                "*  __  __  ____  _  _  ____  __  __    __    *",
                "\n",
                "* (  \\/  )(_  _)( \\( )(_  _)(  \\/  )  /__\\   *",
                "\n",
                "*  )    (  _)(_  )  (  _)(_  )    (  /(__)\\  *",
                "\n",
                "* (_/\\/\\_)(____)(_)\\_)(____)(_/\\/\\_)(__)(__) *",
                "\n",
                "*                                            *",
                "\n",
                "**********************************************",
                "\n",
                Language.msg(l10n_terminal_welcome, GlobalParams.getFullMicroVersion()),
                "\n",
                Language.msg(l10n_terminal_help)));
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

    /** Retain the original terminal's tail policy, including for one oversized response. */
    public static String boundedAppend(String existing, String incoming, int limit) {
        if (limit < 3) throw new IllegalArgumentException("Terminal limit must allow a truncation marker");
        if (incoming.length() >= limit) {
            int from = incoming.length() - (limit - 2);
            if (Character.isLowSurrogate(incoming.charAt(from))) from++;
            return "…\n" + incoming.substring(from);
        }
        int room = limit - incoming.length() - 1;
        int from = Math.max(0, existing.length() - room);
        if (from > 0 && from < existing.length() && Character.isLowSurrogate(existing.charAt(from))) from++;
        return existing.substring(from) + "\n" + incoming;
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
