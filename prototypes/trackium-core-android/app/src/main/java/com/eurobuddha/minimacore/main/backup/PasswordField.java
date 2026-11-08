package com.eurobuddha.minimacore.main.backup;

import android.content.Context;
import android.text.InputType;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageButton;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

/**
 * A password box with a reveal toggle.
 *
 * Every password in Backup &amp; Recovery is one a typo cannot be walked back from: a backup
 * password that does not match what you thought locks the file forever, and a vault lock password
 * you mistyped leaves the seed phrase as the only way back in. Being able to read what you typed
 * before committing is therefore not a convenience here.
 *
 * Reveal keeps the cursor where it was, so toggling mid-entry does not send the caret to the end
 * and invite an insertion in the wrong place.
 */
public final class PasswordField {

    private final View row;
    private final EditText input;

    private PasswordField(View row, EditText input) {
        this.row = row;
        this.input = input;
    }

    /** For dialogs, which build their views in code. */
    public static PasswordField inflate(Context context, ViewGroup parent, CharSequence hint) {
        View row = LayoutInflater.from(context).inflate(R.layout.view_password_field, parent, false);
        EditText input = row.findViewById(R.id.password_input);
        Language.hint(input, hint);
        attach(input, row.findViewById(R.id.password_toggle));
        return new PasswordField(row, input);
    }

    /** For layouts that already declare the pair. */
    public static void attach(EditText input, ImageButton toggle) {
        Language.description(toggle, Language.msg((input.getInputType() & InputType.TYPE_MASK_VARIATION) == InputType.TYPE_TEXT_VARIATION_PASSWORD
                ? l10n_backup_show_password : l10n_backup_hide_password));
        toggle.setOnClickListener(v -> {
            boolean hidden = (input.getInputType() & InputType.TYPE_MASK_VARIATION) == InputType.TYPE_TEXT_VARIATION_PASSWORD;
            int start = input.getSelectionStart();
            int end = input.getSelectionEnd();
            input.setInputType(hidden
                    ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                    : InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
            // setInputType resets the selection, so put it back.
            input.setSelection(Math.max(0, start), Math.max(0, end));
            toggle.setImageResource(hidden ? R.drawable.ic_visibility_off : R.drawable.ic_visibility);
            Language.description(toggle, hidden ? Language.msg(l10n_backup_hide_password) : Language.msg(l10n_backup_show_password));
        });
    }

    public View view() { return row; }
    public EditText input() { return input; }
    public String text() { return input.getText().toString(); }
    public void setError(CharSequence message) { Language.error(input, message); }
}
