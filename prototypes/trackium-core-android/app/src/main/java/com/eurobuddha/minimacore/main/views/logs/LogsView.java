package com.eurobuddha.minimacore.main.views.logs;

import android.app.Activity;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.content.Intent;
import android.graphics.Typeface;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ScrollView;
import android.widget.TextView;

import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;

import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.main.BaseView;
import com.eurobuddha.minimacore.utils.LogBuffer;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.MinimaCMDListener;
import com.eurobuddha.minimacore.utils.logger;

import java.util.ArrayList;

/**
 * Live tail of the node's own log (MINIMALOG events buffered in LogBuffer by
 * MinimaService). Pause/Clear/Share + a substring filter + verbosity chips that
 * drive the node's `logs <subsystem>:true|false` command.
 */
public class LogsView extends BaseView {

    public int MAX_LOG_LENGTH = 30000;

    //Chip keys = the node `logs` command params (response carries same keys as booleans)
    private static final String[] CHIP_KEYS =
            {"scripts", "mining", "blocks", "networking", "ibd", "maxima"};

    ScrollView mScroller;
    TextView   mMainText;
    EditText   mFilter;
    Button     mPauseBut;
    ChipGroup  mChips;

    boolean mPaused = false;
    private LogBuffer.Sink displaySink;

    //Seed the chip states from the node once (when it's up)
    boolean mChipsSeeded = false;

    public LogsView(Activity zActivity){
        super(zActivity, R.layout.view_logs);

        logger.log("Logs View created..");

        mScroller = getMainView().findViewById(R.id.logs_scroller);

        mMainText = mMainView.findViewById(R.id.logs_maintext);
        mMainText.setTypeface(Typeface.MONOSPACE);
        mMainText.setTextIsSelectable(true);

        mFilter   = mMainView.findViewById(R.id.logs_filter);
        mFilter.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int st, int c, int a){}
            @Override public void onTextChanged(CharSequence s, int st, int b, int c){}
            @Override
            public void afterTextChanged(Editable s) {
                renderSnapshot();
            }
        });

        mPauseBut = mMainView.findViewById(R.id.logs_pause);
        Language.setText(mPauseBut, Language.msg(l10n_logs_pause));
        mPauseBut.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                mPaused = !mPaused;
                Language.setText(mPauseBut, Language.msg(mPaused ? l10n_logs_resume : l10n_logs_pause));
                if(!mPaused){
                    //Catch up with everything buffered while frozen
                    renderSnapshot();
                }
            }
        });

        Button clear = mMainView.findViewById(R.id.logs_clear);
        clear.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                LogBuffer.clear();
                mMainText.setText("");
            }
        });

        Button share = mMainView.findViewById(R.id.logs_share);
        share.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String text = mMainText.getText().toString();
                if(text.trim().isEmpty()){
                    return;
                }
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_SUBJECT, Language.text(getActivity(), l10n_logs_subject));
                send.putExtra(Intent.EXTRA_TEXT, text);
                getActivity().startActivity(Intent.createChooser(send, Language.text(getActivity(), l10n_logs_share_title)));
            }
        });

        //Verbosity chips
        mChips = mMainView.findViewById(R.id.logs_chips);
        int[] labels = {l10n_logs_scripts, l10n_logs_mining, l10n_logs_blocks,
                l10n_logs_networking, l10n_logs_ibd};
        for(int i = 0; i < CHIP_KEYS.length; i++){
            String key = CHIP_KEYS[i];
            Chip chip = new Chip(zActivity);
            if (i < labels.length) Language.setText(chip, Language.msg(labels[i]));
            else chip.setText("Maxima");
            chip.setCheckable(true);
            chip.setTag(key);
            chip.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    boolean on = ((Chip)v).isChecked();
                    long generation = displayGeneration();
                    MinimaCMD.runMinima("logs "+key+":"+(on ? "true" : "false"), new MinimaCMDListener() {
                        @Override
                        public void cmdResult(JSONObject zResult) {
                            seedChipsFrom(zResult, generation);
                        }
                    });
                }
            });
            mChips.addView(chip);
        }
    }

    @Override
    public void refreshView(){
        if (!isDisplayActive()) return;
        // The service-owned buffer keeps recording while the display sleeps.
        if (displaySink == null) {
            long generation = displayGeneration();
            // A callback already captured by the log thread belongs to this visibility epoch.
            displaySink = line -> appendText(line, generation);
        }
        LogBuffer.setSink(displaySink);
        renderSnapshot();

        //Seed chip states from the node's current flags (once, when the node is up)
        if(!mChipsSeeded && MinimaCMD.checkMinimaStarted()){
            mChipsSeeded = true;
            long generation = displayGeneration();
            MinimaCMD.runMinima("logs", new MinimaCMDListener() {
                @Override
                public void cmdResult(JSONObject zResult) {
                    seedChipsFrom(zResult, generation);
                }
            });
        }
    }

    private boolean matchesFilter(String zLine){
        String f = mFilter == null ? "" : mFilter.getText().toString().trim();
        if(f.isEmpty()){
            return true;
        }
        return zLine.toLowerCase().contains(f.toLowerCase());
    }

    /** Re-render the whole (filtered) buffer - used on show / resume / filter change. */
    private void renderSnapshot(){
        if (!isDisplayActive()) return;
        long generation = displayGeneration();
        ArrayList<String> lines = LogBuffer.snapshot();
        StringBuilder sb = new StringBuilder();
        for(String l : lines){
            if(matchesFilter(l)){
                sb.append(l).append('\n');
            }
        }
        String text = sb.toString();
        if(text.length() > MAX_LOG_LENGTH){
            text = text.substring(text.length() - MAX_LOG_LENGTH);
        }
        final String ftext = text;
        mMainText.post(new Runnable() {
            @Override
            public void run() {
                if (!isDisplayActive() || generation != displayGeneration()) return;
                mMainText.setText(ftext);
                scrollToBottom();
            }
        });
    }

    private void seedChipsFrom(JSONObject zResult, long generation){
        try{
            Object respobj = zResult.get("response");
            if(!(respobj instanceof JSONObject)){
                return;
            }
            JSONObject resp = (JSONObject) respobj;
            mChips.post(new Runnable() {
                @Override
                public void run() {
                    if (!isDisplayActive() || generation != displayGeneration()) return;
                    for(int i=0; i<mChips.getChildCount(); i++){
                        Chip chip = (Chip) mChips.getChildAt(i);
                        Object val = resp.get((String) chip.getTag());
                        if(val != null){
                            chip.setChecked("true".equals(val.toString()));
                        }
                    }
                }
            });
        }catch(Exception ignore){}
    }

    private void appendText(String zText, long generation) {
        if (!isDisplayActive() || generation != displayGeneration()) return;
        mMainText.post(new Runnable() {
            @Override
            public void run() {
                if (!isDisplayActive() || generation != displayGeneration()
                        || mPaused || !matchesFilter(zText)) return;
                String text = mMainText.getText().toString();
                int len     = text.length();
                if(len > MAX_LOG_LENGTH){
                    String newtext = text.substring(len-MAX_LOG_LENGTH,len)+"\n" + zText;
                    mMainText.setText(newtext);
                }else{
                    mMainText.append("\n" + zText);
                }
                scrollToBottom();
            }
        });
    }

    private void scrollToBottom(){
        long generation = displayGeneration();
        mScroller.post(new Runnable() {
            @Override
            public void run() {
                if (!isDisplayActive() || generation != displayGeneration()) return;
                mScroller.scrollTo(0,1000000);
            }
        });
    }

    @Override protected void onHidden() {
        LogBuffer.clearSink(displaySink);
        displaySink = null;
        mChipsSeeded = false;
    }

    @Override
    public void onActivityDestroy() {
        LogBuffer.clearSink(displaySink);
        displaySink = null;
    }
}
