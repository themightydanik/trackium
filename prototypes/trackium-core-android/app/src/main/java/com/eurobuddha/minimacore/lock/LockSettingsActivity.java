package com.eurobuddha.minimacore.lock;

import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.view.View;
import android.widget.CompoundButton;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.switchmaterial.SwitchMaterial;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import com.eurobuddha.minimacore.utils.KeyboardInsets;

import java.util.function.Consumer;

/** "App Lock" settings: turn the PIN gate on/off, add biometric, change the PIN, set the auto-lock delay. */
public class LockSettingsActivity extends AppCompatActivity {

    private SwitchMaterial mEnable, mBio;
    private View mOptions;
    private MaterialButton mAutolock, mChangePin;

    private final CompoundButton.OnCheckedChangeListener mEnableListener =
            (b, on) -> onToggleEnable(on);
    private final CompoundButton.OnCheckedChangeListener mBioListener =
            (b, on) -> onToggleBio(on);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_lock_settings);

        Toolbar tb = findViewById(R.id.toolbar);
        tb.setTitle(Language.text(this, l10n_menu_app_lock));
        setSupportActionBar(tb);
        KeyboardInsets.install(this, findViewById(R.id.locksettings_main), tb);

        mEnable    = findViewById(R.id.lock_switch_enable);
        mBio       = findViewById(R.id.lock_switch_bio);
        mOptions   = findViewById(R.id.lock_options);
        mAutolock  = findViewById(R.id.lock_autolock);
        mChangePin = findViewById(R.id.lock_change_pin);

        mAutolock.setOnClickListener(v -> pickAutolock());
        mChangePin.setOnClickListener(v -> changePin());

        render();
    }

    /** Reflect the actual stored state; set switch values WITHOUT firing their listeners. */
    private void render() {
        bind(mEnable, AppLock.isEnabled(this), mEnableListener);
        mOptions.setVisibility(AppLock.isEnabled(this) ? View.VISIBLE : View.GONE);
        mBio.setVisibility(BiometricUnlock.isAvailable(this) ? View.VISIBLE : View.GONE);
        bind(mBio, BiometricUnlock.isEnabled(this), mBioListener);
        Language.setText(mAutolock, autolockLabel());
    }

    private static void bind(SwitchMaterial sw, boolean checked, CompoundButton.OnCheckedChangeListener l) {
        sw.setOnCheckedChangeListener(null);
        sw.setChecked(checked);
        sw.setOnCheckedChangeListener(l);
    }

    // --- enable / disable the whole lock ---------------------------------------------------------

    private void onToggleEnable(boolean on) {
        if (on) {
            if (AppLock.isEnabled(this)) return;
            promptNewPin(pin -> {
                AppLock.setPin(this, pin);
                AppLock.get().unlock();   // we're in-app and just set it — don't lock ourselves out now
                toast(Language.msg(l10n_lock_enabled));
                render();
            }, this::render);             // cancelled → revert the switch
        } else {
            if (!AppLock.isEnabled(this)) return;
            promptPin(Language.msg(l10n_lock_disable_prompt), Language.msg(l10n_common_turn_off), pin -> {
                if (!AppLock.verifyPin(this, pin)) { toast(Language.msg(l10n_lock_wrong_pin)); render(); return; }
                AppLock.disable(this);
                toast(Language.msg(l10n_lock_disabled));
                render();
            });
        }
    }

    // --- biometric ------------------------------------------------------------------------------

    private void onToggleBio(boolean on) {
        if (on) {
            promptPin(Language.msg(l10n_lock_enable_biometric_prompt), Language.msg(l10n_common_enable), pin -> {
                if (!AppLock.verifyPin(this, pin)) { toast(Language.msg(l10n_lock_wrong_pin)); render(); return; }
                BiometricUnlock.enable(this, pin, new BiometricUnlock.Callback() {
                    @Override public void onSuccess() { toast(Language.msg(l10n_lock_biometric_enabled)); render(); }
                    @Override public void onError(String m, boolean inv) { toast(m); render(); }
                    @Override public void onCancelled() { render(); }
                });
            });
        } else {
            BiometricUnlock.disable(this);
            render();
        }
    }

    // --- change PIN ------------------------------------------------------------------------------

    private void changePin() {
        promptPin(Language.msg(l10n_lock_current_pin), Language.msg(l10n_common_next), current -> {
            if (!AppLock.verifyPin(this, current)) { toast(Language.msg(l10n_lock_wrong_pin)); return; }
            promptNewPin(newPin -> {
                AppLock.setPin(this, newPin);
                // Any biometric entry wrapped the OLD PIN, so it would hand back a stale value — clear it.
                if (BiometricUnlock.isEnabled(this)) {
                    BiometricUnlock.disable(this);
                    toast(Language.msg(l10n_lock_pin_changed_biometric));
                } else {
                    toast(Language.msg(l10n_lock_pin_changed));
                }
                render();
            }, () -> {});
        });
    }

    // --- auto-lock delay -------------------------------------------------------------------------

    private void pickAutolock() {
        int sel = indexOfMinutes(AppLock.autolockMinutes(this));
        new LanguageDialog(this)
                .setTitle(Language.msg(l10n_lock_auto_lock))
                .setSingleChoiceItems(autolockNames(), sel, (d, which) -> {
                    AppLock.setAutolockMinutes(this, AppLock.AUTOLOCK_MINUTES[which]);
                    d.dismiss();
                    render();
                })
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    private CharSequence[] autolockNames() {
        return new CharSequence[] { Language.msg(l10n_lock_immediately), Language.msg(l10n_lock_one_minute),
                Language.msg(l10n_lock_five_minutes), Language.msg(l10n_lock_fifteen_minutes), Language.msg(l10n_lock_one_hour) };
    }

    @Override public void onConfigurationChanged(android.content.res.Configuration config) {
        super.onConfigurationChanged(config);
        Language.configurationChanged(this);
        if (getSupportActionBar() != null)
            getSupportActionBar().setTitle(Language.text(this, l10n_menu_app_lock));
    }

    private CharSequence autolockLabel() {
        return autolockNames()[indexOfMinutes(AppLock.autolockMinutes(this))];
    }

    private static int indexOfMinutes(int minutes) {
        for (int i = 0; i < AppLock.AUTOLOCK_MINUTES.length; i++) {
            if (AppLock.AUTOLOCK_MINUTES[i] == minutes) return i;
        }
        return 1;   // default: after one minute
    }

    // --- PIN dialogs -----------------------------------------------------------------------------

    /** One PIN field; {@code onEntered} fires with the typed PIN only when it meets the length rule. */
    private void promptPin(CharSequence title, CharSequence positive, Consumer<String> onEntered) {
        final EditText in = pinField(Language.msg(l10n_lock_pin));
        AlertDialog d = new LanguageDialog(this)
                .setTitle(title)
                .setView(pad(in))
                .setPositiveButton(positive, null)
                .setNegativeButton(Language.msg(l10n_common_cancel), (dd, w) -> render())
                .setOnCancelListener(dd -> render())
                .create();
        d.setOnShowListener(x -> d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String pin = in.getText().toString();
            if (pin.length() < AppLock.MIN_PIN_LEN) {
                Language.error(in, Language.msg(l10n_lock_min_digits, AppLock.MIN_PIN_LEN));
                return;
            }
            d.dismiss();
            onEntered.accept(pin);
        }));
        d.show();
    }

    /** Two PIN fields (enter + confirm); {@code onSet} fires only when they are valid and match. */
    private void promptNewPin(Consumer<String> onSet, Runnable onCancel) {
        final EditText p1 = pinField(Language.msg(l10n_lock_new_pin, AppLock.MIN_PIN_LEN, AppLock.MAX_PIN_LEN));
        final EditText p2 = pinField(Language.msg(l10n_lock_confirm_pin));
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        int side = dp(20);
        col.setPadding(side, dp(8), side, 0);
        col.addView(p1);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(12);
        col.addView(p2, lp);

        AlertDialog d = new LanguageDialog(this)
                .setTitle(Language.msg(l10n_lock_set_pin))
                .setView(col)
                .setPositiveButton(Language.msg(l10n_common_save), null)
                .setNegativeButton(Language.msg(l10n_common_cancel), (dd, w) -> onCancel.run())
                .setOnCancelListener(dd -> onCancel.run())
                .create();
        d.setOnShowListener(x -> d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String a = p1.getText().toString();
            String b = p2.getText().toString();
            if (a.length() < AppLock.MIN_PIN_LEN || a.length() > AppLock.MAX_PIN_LEN) {
                Language.error(p1, Language.msg(l10n_lock_digits, AppLock.MIN_PIN_LEN, AppLock.MAX_PIN_LEN));
                return;
            }
            if (!a.equals(b)) {
                Language.error(p2, Language.msg(l10n_lock_mismatch));
                return;
            }
            d.dismiss();
            onSet.accept(a);
        }));
        d.show();
    }

    private EditText pinField(CharSequence hint) {
        EditText e = new EditText(this);
        e.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        e.setFilters(new InputFilter[]{ new InputFilter.LengthFilter(AppLock.MAX_PIN_LEN) });
        Language.hint(e, hint);
        return e;
    }

    private LinearLayout pad(View child) {
        LinearLayout wrap = new LinearLayout(this);
        int side = dp(20);
        wrap.setPadding(side, dp(8), side, 0);
        wrap.addView(child, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        return wrap;
    }

    private int dp(int v) {
        return Math.round(getResources().getDisplayMetrics().density * v);
    }

    private void toast(CharSequence msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }
}
