package com.eurobuddha.minimacore.lock;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import com.eurobuddha.minimacore.main.MainActivity;

/**
 * Full-screen unlock gate: enter the PIN (or use biometric) before the main UI is shown. The node is
 * already running in its foreground service behind this screen.
 */
public class LockActivity extends AppCompatActivity {

    /**
     * The gate, mirrored on {@code SeedSyncActivity.redirectIfPending}: if the lock is enabled and the
     * session is not unlocked, start the lock screen, finish the caller, and return true so the caller
     * bails out of {@code onCreate} before building any content.
     */
    public static boolean redirectIfLocked(android.app.Activity zActivity) {
        if (!AppLock.isEnabled(zActivity) || AppLock.get().isUnlocked()) return false;
        zActivity.startActivity(new Intent(zActivity, LockActivity.class));
        zActivity.finish();
        return true;
    }

    private EditText mPin;
    private TextView mError;
    private boolean mBioTried = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_lock);
        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { moveTaskToBack(true); }
        });

        mPin   = findViewById(R.id.lock_pin);
        mError = findViewById(R.id.lock_error);
        findViewById(R.id.lock_unlock).setOnClickListener(v -> tryPin());
        mPin.setOnEditorActionListener((tv, actionId, ev) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE || actionId == EditorInfo.IME_ACTION_GO) {
                tryPin();
                return true;
            }
            return false;
        });

        View bioBtn = findViewById(R.id.lock_biometric);
        boolean bio = BiometricUnlock.isEnabled(this) && BiometricUnlock.isAvailable(this);
        bioBtn.setVisibility(bio ? View.VISIBLE : View.GONE);
        bioBtn.setOnClickListener(v -> promptBiometric());
    }

    @Override
    protected void onResume() {
        super.onResume();
        // If the lock was disabled or already satisfied elsewhere, don't strand the user here.
        if (!AppLock.isEnabled(this) || AppLock.get().isUnlocked()) { proceed(); return; }
        // Auto-offer the biometric sheet once per visit; dismissing it just leaves the PIN field.
        if (!mBioTried && BiometricUnlock.isEnabled(this) && BiometricUnlock.isAvailable(this)) {
            mBioTried = true;
            mPin.postDelayed(this::promptBiometric, 350);
        }
    }

    private void tryPin() {
        String pin = mPin.getText().toString();
        if (AppLock.verifyPin(this, pin)) {
            AppLock.get().unlock();
            proceed();
        } else {
            showError(Language.msg(l10n_lock_wrong_pin));
            mPin.setText("");
        }
    }

    private void promptBiometric() {
        if (isFinishing() || isDestroyed()) return;
        BiometricUnlock.unlock(this, new BiometricUnlock.UnlockCallback() {
            @Override public void onPassphrase(String pin) {
                if (AppLock.verifyPin(LockActivity.this, pin)) {
                    AppLock.get().unlock();
                    proceed();
                } else {
                    // Stored PIN no longer matches (changed without re-enrolling) — type it instead.
                    showError(Language.msg(l10n_lock_stale_biometric));
                }
            }
            @Override public void onError(String message, boolean permanentlyInvalidated) {
                showError(message);
                if (permanentlyInvalidated) findViewById(R.id.lock_biometric).setVisibility(View.GONE);
            }
            @Override public void onCancelled() { /* user backed out — the PIN field stays available */ }
        });
    }

    private void showError(CharSequence zMsg) {
        Language.setText(mError, zMsg);
        mError.setVisibility(View.VISIBLE);
    }

    private void proceed() {
        // CLEAR_TOP|SINGLE_TOP: reveal an existing MainActivity (re-lock case) or create a fresh one
        // (cold start, where the gate finished MainActivity) — never a duplicate.
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(i);
        finish();
    }

}
