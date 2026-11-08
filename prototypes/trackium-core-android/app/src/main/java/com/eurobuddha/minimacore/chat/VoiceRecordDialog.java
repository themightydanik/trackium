package com.eurobuddha.minimacore.chat;

import android.app.Activity;
import androidx.appcompat.app.AlertDialog;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;


import java.util.ArrayList;

/**
 * The hold-and-talk recording dialog, shared by the keets and Parlons chat
 * screens: live waveform from the mic amplitude, blinking dot, m:ss timer,
 * 60s cap. Hands back the encoded bytes plus the "M:SS|waveformhex" pieces.
 */
public final class VoiceRecordDialog {

    public interface OnRecorded {
        void recorded(byte[] zBytes, String zMime, int zSecs, String zWaveHex);
    }

    private VoiceRecordDialog() {
    }

    public static String fmtSecs(int zSecs) {
        return (zSecs / 60) + ":" + String.format(java.util.Locale.UK, "%02d", zSecs % 60);
    }

    /** Show the dialog and start recording. Returns the recorder so the caller
     *  can stopQuiet() it from onDestroy (dismiss listeners never fire there). */
    public static VoiceNote show(Activity zAct, OnRecorded zDone) {
        final VoiceNote rec = new VoiceNote(zAct);
        try {
            rec.start();
        } catch (Exception e) {
            Toast.makeText(zAct, Language.msg(l10n_chat_no_microphone), Toast.LENGTH_SHORT).show();
            return null;
        }
        int pad = Math.round(22 * zAct.getResources().getDisplayMetrics().density);
        int padS = Math.round(18 * zAct.getResources().getDisplayMetrics().density);
        LinearLayout box = new LinearLayout(zAct);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(pad, padS, pad, padS / 3);
        final WaveformView wave = new WaveformView(zAct);
        wave.setInk(zAct.getColor(R.color.minima_orange));
        LinearLayout.LayoutParams wlp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                Math.round(44 * zAct.getResources().getDisplayMetrics().density));
        wlp.bottomMargin = padS / 2;
        box.addView(wave, wlp);
        LinearLayout rowBox = new LinearLayout(zAct);
        rowBox.setOrientation(LinearLayout.HORIZONTAL);
        rowBox.setGravity(Gravity.CENTER_VERTICAL);
        box.addView(rowBox);
        final ArrayList<Integer> samples = new ArrayList<>();
        final TextView dot = new TextView(zAct);
        dot.setText("●");
        dot.setTextColor(0xFFE0524D);
        dot.setTextSize(16);
        final TextView timer = new TextView(zAct);
        timer.setTextSize(28);
        timer.setTypeface(android.graphics.Typeface.MONOSPACE);
        timer.setTextColor(zAct.getColor(R.color.core_text));
        timer.setPadding(padS, 0, 0, 0);
        timer.setText("0:00");
        rowBox.addView(dot);
        rowBox.addView(timer);

        final AlertDialog dlg = new LanguageDialog(zAct)
                .setTitle(Language.msg(l10n_chat_voice_note))
                .setView(box)
                .setPositiveButton(Language.msg(l10n_wallet_send), null)
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .create();
        dlg.setCanceledOnTouchOutside(false);
        dlg.show();

        final android.os.Handler h = new android.os.Handler(android.os.Looper.getMainLooper());
        final Runnable sampler = new Runnable() {
            @Override public void run() {
                int a = rec.amplitude();
                samples.add(a);
                wave.append(a);
                if (rec.elapsedSeconds() < VoiceNote.MAX_SECONDS) {
                    h.postDelayed(this, 100);
                }
            }
        };
        h.post(sampler);
        final Runnable tick = new Runnable() {
            @Override public void run() {
                int sSec = rec.elapsedSeconds();
                dot.setAlpha(dot.getAlpha() > 0.5f ? 0.25f : 1f);
                if (sSec >= VoiceNote.MAX_SECONDS) {
                    Language.setText(timer, Language.msg(l10n_chat_max_duration, fmtSecs(VoiceNote.MAX_SECONDS)));
                    rec.stopQuiet();   // recorder hard-caps too (setMaxDuration)
                } else {
                    timer.setText(fmtSecs(sSec));
                    h.postDelayed(this, 500);
                }
            }
        };
        h.post(tick);

        dlg.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            h.removeCallbacksAndMessages(null);
            rec.stopQuiet();
            byte[] bytes;
            int secs = rec.recordedSeconds();
            try {
                bytes = rec.bytes();
            } catch (Exception e) {
                Toast.makeText(zAct, Language.msg(l10n_chat_recording_failed), Toast.LENGTH_SHORT).show();
                dlg.dismiss();
                return;
            }
            dlg.dismiss();
            if (bytes == null || bytes.length == 0 || secs < 1) {
                Toast.makeText(zAct, Language.msg(l10n_chat_recording_short), Toast.LENGTH_SHORT).show();
                return;
            }
            zDone.recorded(bytes, rec.mime(), secs,
                    WaveformView.encode(WaveformView.summarise(samples)));
        });
        dlg.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener(v -> {
            h.removeCallbacksAndMessages(null);
            rec.cancel();
            dlg.dismiss();
        });
        dlg.setOnDismissListener(d -> {
            h.removeCallbacksAndMessages(null);
            rec.stopQuiet();
        });
        // Activity destruction can detach the window without an onDismiss callback.
        // Use the same window lifecycle hook as LanguageDialog to stop its UI timers.
        dlg.getWindow().getDecorView().addOnAttachStateChangeListener(new android.view.View.OnAttachStateChangeListener() {
            @Override public void onViewAttachedToWindow(android.view.View view) {}
            @Override public void onViewDetachedFromWindow(android.view.View view) {
                h.removeCallbacksAndMessages(null);
                rec.stopQuiet();
            }
        });
        return rec;
    }
}
