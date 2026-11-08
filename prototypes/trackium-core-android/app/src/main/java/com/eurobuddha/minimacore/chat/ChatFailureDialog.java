package com.eurobuddha.minimacore.chat;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.appcompat.app.AlertDialog;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;

/** Reuses PandaDEX's selectable activity-log view and explicit Copy details action.
 * The caller supplies its tracked builder so activity destruction dismisses it. */
public final class ChatFailureDialog {
    private ChatFailureDialog() { }

    public static AlertDialog show(Activity activity, LanguageDialog builder, CharSequence message) {
        if (activity.isFinishing() || activity.isDestroyed()) return null;
        TextView text = new TextView(builder.getContext());
        Language.setText(text, message);
        text.setTextSize(14);
        text.setTextIsSelectable(true);
        int padding = Math.round(24 * activity.getResources().getDisplayMetrics().density);
        text.setPadding(padding, padding / 2, padding, padding / 2);
        ScrollView scroll = new ScrollView(builder.getContext());
        scroll.addView(text);
        AlertDialog dialog = builder.setTitle(Language.msg(l10n_common_error))
                .setView(scroll)
                .setPositiveButton(Language.msg(l10n_language_close), null)
                .setNeutralButton(Language.msg(l10n_dex_copy_details), null)
                .create();
        dialog.show();
        // Copy without closing: the user can still scroll, select and read the error.
        dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v -> {
            ClipboardManager clipboard = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard != null) clipboard.setPrimaryClip(ClipData.newPlainText(
                    Language.text(activity, l10n_dex_copy_details), text.getText().toString()));
        });
        return dialog;
    }
}
