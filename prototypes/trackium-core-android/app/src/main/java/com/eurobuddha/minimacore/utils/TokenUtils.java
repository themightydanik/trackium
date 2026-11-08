package com.eurobuddha.minimacore.utils;

import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.main.views.balance.tokens.TokenMeta;
import com.eurobuddha.minimacore.i18n.Language;

public class TokenUtils {
    public static String getTokenName(JSONObject token) {
        return metadata(token).name;
    }

    /** A literal token named Token remains literal; only missing metadata gets a translated label. */
    public static CharSequence getTokenDisplayName(JSONObject token) {
        TokenMeta meta = metadata(token);
        return meta.nameProvided ? meta.name : Language.msg(com.eurobuddha.minimacore.i18n.R.string.l10n_wallet_token);
    }

    private static TokenMeta metadata(JSONObject token) {
        return TokenMeta.parse(token == null ? null : token.get("token"),
                token == null ? "" : String.valueOf(token.get("tokenid")));
    }
}
