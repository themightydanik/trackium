package com.eurobuddha.minimacore.utils;

import android.content.Context;
import android.content.DialogInterface;
import android.util.Log;

import com.eurobuddha.minimacore.i18n.LanguageDialog;
import com.eurobuddha.minimacore.i18n.Language;

import com.eurobuddha.minimacore.R;

public class logger {
    public static void log(String zLog){
        Log.d("Minima-Core",zLog);
    }

    public static void showDialog(Context zContext, CharSequence zTitle, CharSequence zMessage){
        showDialog(zContext, zTitle, zMessage, new Runnable() {
            @Override
            public void run() {}
        });
    }

    public static void showDialog(Context zContext, CharSequence zTitle, CharSequence zMessage, Runnable zOnOK){
        new LanguageDialog(zContext)
                .setTitle(zTitle)
                .setMessage(zMessage)
                .setIcon(R.drawable.ic_minima)
                .setPositiveButton(Language.msg(com.eurobuddha.minimacore.i18n.R.string.l10n_common_ok), new DialogInterface.OnClickListener(){
                    public void onClick(DialogInterface dialog, int whichButton) {
                        zOnOK.run();
                    }}).show();

    }
}
