package com.eurobuddha.minimacore.lock;

import android.content.Context;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import java.security.KeyStore;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * BiometricUnlock — the OPTIONAL, device-bound convenience layer that lets the user re-open the app
 * with a fingerprint / face instead of typing the PIN. Lifted from apks/wallet (there it wraps the
 * wallet passphrase; here it wraps the app-open PIN). Strictly additive:
 *
 * <ul>
 *   <li>It NEVER replaces the PIN. The typed PIN always remains available on the lock screen.</li>
 *   <li>What it stores is the PIN, encrypted by an AndroidKeyStore AES-256-GCM key that requires user
 *       authentication ({@code setUserAuthenticationRequired(true)}) and is invalidated if the device's
 *       biometrics change ({@code setInvalidatedByBiometricEnrollment(true)}). Only the ciphertext + IV
 *       are kept in app-private prefs — NEVER the plaintext PIN — and the app's backup is off, so it is
 *       not cloud/device-portable.</li>
 *   <li>The Keystore key material is hardware-bound and non-exportable.</li>
 * </ul>
 *
 * <p>On success the recovered PIN is handed back to the caller, which verifies it the SAME way a typed
 * PIN is verified ({@link AppLock#verifyPin}), so the "unlocked" state is reached identically either way.
 */
public final class BiometricUnlock {

    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "applock_pin_v1";

    private static final String PREFS = "app_lock_bio";
    private static final String K_CT = "bio_ct";
    private static final String K_IV = "bio_iv";

    private static final String TRANSFORMATION =
            KeyProperties.KEY_ALGORITHM_AES + "/" + KeyProperties.BLOCK_MODE_GCM
                    + "/" + KeyProperties.ENCRYPTION_PADDING_NONE;

    private static final int GCM_TAG_BITS = 128;

    /** Crypto-backed prompts (we pass a CryptoObject) must use BIOMETRIC_STRONG only — pairing a CryptoObject
     *  with DEVICE_CREDENTIAL is rejected by BiometricPrompt on many devices. The typed PIN is the fallback. */
    private static int allowedAuthenticators() {
        return BiometricManager.Authenticators.BIOMETRIC_STRONG;
    }

    /** Result callbacks for enable. */
    public interface Callback {
        void onSuccess();
        /** {@code zPermanentlyInvalidated} is true when enrolment changed and the entry was cleared. */
        void onError(String zMessage, boolean zPermanentlyInvalidated);
        void onCancelled();
    }

    /** A callback that also yields the recovered PIN (unlock). */
    public interface UnlockCallback {
        void onPassphrase(String zPin);
        void onError(String zMessage, boolean zPermanentlyInvalidated);
        void onCancelled();
    }

    private BiometricUnlock() {}

    // --- availability / state --------------------------------------------------------------------

    /** True when the device has usable strong biometric auth. */
    public static boolean isAvailable(Context zContext) {
        BiometricManager bm = BiometricManager.from(zContext);
        int res = bm.canAuthenticate(allowedAuthenticators());
        return res == BiometricManager.BIOMETRIC_SUCCESS;
    }

    /** True when the user has enabled biometric unlock (a stored ciphertext exists). */
    public static boolean isEnabled(Context zContext) {
        SharedPreferences p = prefs(zContext);
        return p.contains(K_CT) && p.contains(K_IV);
    }

    /** Disable: wipe the Keystore key and the stored ciphertext + IV. */
    public static void disable(Context zContext) {
        clearStored(zContext);
        try {
            KeyStore ks = KeyStore.getInstance(ANDROID_KEYSTORE);
            ks.load(null);
            if (ks.containsAlias(KEY_ALIAS)) ks.deleteEntry(KEY_ALIAS);
        } catch (Exception ignore) {
            // Best-effort: the ciphertext is already gone, so nothing can be decrypted regardless.
        }
    }

    // --- enable ----------------------------------------------------------------------------------

    /**
     * Enable biometric unlock: (re)create the Keystore key, prompt for authentication to authorise an
     * ENCRYPT cipher, then store the encrypted PIN. Requires the caller to already hold the verified
     * plaintext PIN (i.e. the user just re-entered it).
     */
    public static void enable(FragmentActivity zActivity, String zPin, Callback zCallback) {
        final Cipher cipher;
        try {
            SecretKey key = createOrReplaceKey();
            cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key);
        } catch (Exception e) {
            zCallback.onError(Language.text(zActivity, l10n_biometric_key_error, e.getMessage()), false);
            return;
        }

        BiometricPrompt.PromptInfo info = promptInfo(zActivity,
                Language.text(zActivity, l10n_biometric_enable),
                Language.text(zActivity, l10n_biometric_protect_pin));

        prompt(zActivity, cipher, info, new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                try {
                    Cipher c = result.getCryptoObject().getCipher();
                    byte[] ct = c.doFinal(zPin.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    store(zActivity, ct, c.getIV());
                    zCallback.onSuccess();
                } catch (Exception e) {
                    disable(zActivity);
                    zCallback.onError(Language.text(zActivity, l10n_biometric_store_error, e.getMessage()), false);
                }
            }

            @Override
            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                if (isCancel(errorCode)) zCallback.onCancelled();
                else zCallback.onError(errString.toString(), false);
            }
        });
    }

    // --- unlock ----------------------------------------------------------------------------------

    /**
     * Prompt for biometric auth and, on success, decrypt the stored PIN and hand it back. If the key was
     * invalidated by a biometric-enrolment change ({@link KeyPermanentlyInvalidatedException}), the stored
     * entry is cleared and the error reports {@code permanentlyInvalidated=true} so the caller can tell the
     * user to re-enable and fall back to the typed PIN.
     */
    public static void unlock(FragmentActivity zActivity, UnlockCallback zCallback) {
        final byte[] ct;
        final Cipher cipher;
        try {
            SharedPreferences p = prefs(zActivity);
            String ctB64 = p.getString(K_CT, null);
            String ivB64 = p.getString(K_IV, null);
            if (ctB64 == null || ivB64 == null) {
                zCallback.onError(Language.text(zActivity, l10n_biometric_not_set_up), false);
                return;
            }

            ct = Base64.decode(ctB64, Base64.NO_WRAP);
            final byte[] iv = Base64.decode(ivB64, Base64.NO_WRAP);
            SecretKey key = loadKey();
            if (key == null) {
                clearStored(zActivity);
                zCallback.onError(Language.text(zActivity, l10n_biometric_key_missing), true);
                return;
            }
            cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
        } catch (KeyPermanentlyInvalidatedException invalidated) {
            disable(zActivity);
            zCallback.onError(Language.text(zActivity, l10n_biometric_reset), true);
            return;
        } catch (Exception e) {
            zCallback.onError(Language.text(zActivity, l10n_biometric_key_error, e.getMessage()), false);
            return;
        }

        BiometricPrompt.PromptInfo info = promptInfo(zActivity,
                Language.text(zActivity, l10n_biometric_unlock), Language.text(zActivity, l10n_biometric_confirm));

        prompt(zActivity, cipher, info, new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                try {
                    Cipher c = result.getCryptoObject().getCipher();
                    byte[] plain = c.doFinal(ct);
                    zCallback.onPassphrase(new String(plain, java.nio.charset.StandardCharsets.UTF_8));
                } catch (Exception e) {
                    zCallback.onError(Language.text(zActivity, l10n_biometric_decrypt_error, e.getMessage()), false);
                }
            }

            @Override
            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                if (isCancel(errorCode)) zCallback.onCancelled();
                else zCallback.onError(errString.toString(), false);
            }
        });
    }

    // --- internals -------------------------------------------------------------------------------

    private static void prompt(FragmentActivity zActivity, Cipher zCipher,
                               BiometricPrompt.PromptInfo zInfo,
                               BiometricPrompt.AuthenticationCallback zCb) {
        Executor exec = ContextCompat.getMainExecutor(zActivity);
        BiometricPrompt bp = new BiometricPrompt(zActivity, exec, zCb);
        try {
            bp.authenticate(zInfo, new BiometricPrompt.CryptoObject(zCipher));
        } catch (Exception e) {   // e.g. a device rejecting the crypto+authenticator combo — report instead of crashing
            zCb.onAuthenticationError(BiometricPrompt.ERROR_HW_UNAVAILABLE, Language.text(zActivity, l10n_biometric_prompt_error, e.getMessage()));
        }
    }

    private static BiometricPrompt.PromptInfo promptInfo(Context context, String zTitle, String zSubtitle) {
        BiometricPrompt.PromptInfo.Builder b = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(zTitle)
                .setSubtitle(zSubtitle)
                .setAllowedAuthenticators(allowedAuthenticators())
                .setNegativeButtonText(Language.text(context, l10n_biometric_use_pin));   // required whenever DEVICE_CREDENTIAL isn't an allowed authenticator
        return b.build();
    }

    private static SecretKey createOrReplaceKey() throws Exception {
        KeyStore ks = KeyStore.getInstance(ANDROID_KEYSTORE);
        ks.load(null);
        if (ks.containsAlias(KEY_ALIAS)) ks.deleteEntry(KEY_ALIAS);

        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
        KeyGenParameterSpec.Builder spec = new KeyGenParameterSpec.Builder(
                KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(true)
                .setInvalidatedByBiometricEnrollment(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Allow both a strong biometric and the device credential to authorise a use.
            spec.setUserAuthenticationParameters(0,
                    KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL);
        }
        kg.init(spec.build());
        return kg.generateKey();
    }

    private static SecretKey loadKey() throws Exception {
        KeyStore ks = KeyStore.getInstance(ANDROID_KEYSTORE);
        ks.load(null);
        return (SecretKey) ks.getKey(KEY_ALIAS, null);
    }

    private static void store(Context zContext, byte[] zCt, byte[] zIv) {
        prefs(zContext).edit()
                .putString(K_CT, Base64.encodeToString(zCt, Base64.NO_WRAP))
                .putString(K_IV, Base64.encodeToString(zIv, Base64.NO_WRAP))
                .apply();
    }

    private static void clearStored(Context zContext) {
        prefs(zContext).edit().remove(K_CT).remove(K_IV).apply();
    }

    private static SharedPreferences prefs(Context zContext) {
        return zContext.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static boolean isCancel(int zErrorCode) {
        return zErrorCode == BiometricPrompt.ERROR_USER_CANCELED
                || zErrorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                || zErrorCode == BiometricPrompt.ERROR_CANCELED;
    }
}
