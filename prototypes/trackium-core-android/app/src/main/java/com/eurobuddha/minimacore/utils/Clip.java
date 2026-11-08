package com.eurobuddha.minimacore.utils;

import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.os.Build;
import android.widget.Toast;

/** Copy-to-clipboard with a confirmation toast. */
public class Clip {

    private Clip(){}

    /**
     * Copy something the OS must not put on screen.
     *
     * Android 13+ shows a preview of whatever was copied. For an address that is helpful - you
     * can see you grabbed the right one - but for a seed phrase or a wallet password it renders
     * the secret in a system overlay and into clipboard history. EXTRA_IS_SENSITIVE suppresses
     * the preview; it does not stop other apps reading the clipboard, so this is still a
     * deliberate act by the user, not a safe one.
     */
    public static void copySensitive(Context zContext, String zLabel, String zText, String zToast){
        copy(zContext, zLabel, zText, zToast, true);
    }

    public static void copy(Context zContext, String zLabel, String zText, String zToast){
        copy(zContext, zLabel, zText, zToast, false);
    }

    private static void copy(Context zContext, String zLabel, String zText, String zToast,
                             boolean zSensitive){
        if(zContext == null || zText == null){
            return;
        }

        ClipboardManager cm = (ClipboardManager) zContext.getSystemService(Context.CLIPBOARD_SERVICE);
        if(cm == null){
            Toast.makeText(zContext, Language.msg(l10n_core_wallet_clipboard), Toast.LENGTH_SHORT).show();
            return;
        }

        ClipData clip = ClipData.newPlainText(zLabel, zText);
        if(zSensitive && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU){
            android.os.PersistableBundle extras = new android.os.PersistableBundle();
            extras.putBoolean(android.content.ClipDescription.EXTRA_IS_SENSITIVE, true);
            clip.getDescription().setExtras(extras);
        }
        cm.setPrimaryClip(clip);

        //Android 13+ shows its own clipboard confirmation - ours would just be duplicate noise
        if(Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU && zToast != null){
            Toast.makeText(zContext, zToast, Toast.LENGTH_SHORT).show();
        }
    }
}
