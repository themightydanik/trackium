package com.eurobuddha.minimacore.main.views.balance.coins;

import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.app.Activity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;

import com.google.android.material.button.MaterialButton;
import com.eurobuddha.minimacore.i18n.LanguageDialog;

import org.minima.utils.MiniFormat;
import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.utils.Clip;
import com.eurobuddha.minimacore.utils.Format;

/**
 * Everything the node knows about one coin.
 *
 * No value is ever shortened here and every one has its own COPY button - ids that come
 * out of this modal must round-trip back into `coins coinid:...` byte for byte.
 * Purely synchronous: the coin JSON is already in hand, so no node call and no threading.
 */
public class CoinDetailDialog {

    private final Activity mActivity;

    private AlertDialog mDialog;

    public static CoinDetailDialog show(Activity zActivity, JSONObject zCoin, boolean zSendable){
        CoinDetailDialog cdd = new CoinDetailDialog(zActivity);
        cdd.open(zCoin, zSendable);
        return cdd;
    }

    private CoinDetailDialog(Activity zActivity){
        mActivity = zActivity;
    }

    private void open(JSONObject zCoin, boolean zSendable){

        LayoutInflater inflater = (LayoutInflater) mActivity.getSystemService(Activity.LAYOUT_INFLATER_SERVICE);
        View body = inflater.inflate(R.layout.dialog_coin_detail, null);
        Language.apply(body);

        LinearLayout rows = body.findViewById(R.id.coin_detail_rows);

        addRow(inflater, rows, Language.msg(l10n_nft_coin_id),      value(zCoin, "coinid"));
        addRow(inflater, rows, Language.msg(l10n_history_amount),       value(zCoin, "amount"));
        addRow(inflater, rows, Language.msg(l10n_core_wallet_token_amount), value(zCoin, "tokenamount"));
        addRow(inflater, rows, Language.msg(l10n_history_token),     value(zCoin, "tokenid"));
        addRow(inflater, rows, Language.msg(l10n_history_address),      value(zCoin, "address"));
        addRow(inflater, rows, Language.msg(l10n_core_wallet_mini_address), value(zCoin, "miniaddress"));
        addRow(inflater, rows, Language.msg(l10n_wallet_sendable),     zSendable ? Language.msg(l10n_core_wallet_yes) : Language.msg(l10n_core_wallet_no_locked));
        addRow(inflater, rows, Language.msg(l10n_core_wallet_created),      value(zCoin, "created"));
        addRow(inflater, rows, Language.msg(l10n_core_wallet_age),          value(zCoin, "age"));
        addRow(inflater, rows, Language.msg(l10n_core_wallet_mmr),    value(zCoin, "mmrentry"));
        addRow(inflater, rows, Language.msg(l10n_core_wallet_spent),        value(zCoin, "spent"));
        addRow(inflater, rows, Language.msg(l10n_core_wallet_store_state),  value(zCoin, "storestate"));
        addRow(inflater, rows, Language.msg(l10n_nft_state),        stateOf(zCoin));

        final String raw = MiniFormat.JSONPretty(zCoin);

        TextView json = body.findViewById(R.id.coin_detail_json);
        json.setText(raw);

        mDialog = new LanguageDialog(mActivity)
                .setTitle(zSendable ? Language.msg(l10n_core_wallet_coin_sendable) : Language.msg(l10n_core_wallet_coin_locked))
                .setView(body)
                .setPositiveButton(Language.msg(l10n_language_close), null)
                //null listener on purpose - see below
                .setNeutralButton(Language.msg(l10n_core_wallet_copy_json), null)
                .create();

        mDialog.show();

        //Any button with a listener passed to the builder dismisses the dialog on click.
        //Wiring it after show() keeps the modal open so the user can copy more than one thing.
        mDialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(
                v -> Clip.copy(mActivity, "coin", raw, Language.msg(l10n_core_wallet_json_copied).toString()));
    }

    private void addRow(LayoutInflater zInflater, LinearLayout zRows, CharSequence zLabel, CharSequence zValue){
        if(zValue == null || zValue.length() == 0){
            return;
        }

        View row = zInflater.inflate(R.layout.view_coin_detail_row, zRows, false);
        Language.apply(row);

        Language.setText(row.findViewById(R.id.detail_label), zLabel);
        Language.setText(row.findViewById(R.id.detail_value), zValue);

        MaterialButton copy = row.findViewById(R.id.detail_copy);
        copy.setOnClickListener(v -> Clip.copy(mActivity, zLabel.toString(), zValue.toString(), Language.msg(l10n_core_wallet_copied, zLabel).toString()));

        zRows.addView(row);
    }

    public void dismiss(){
        if(mDialog != null && mDialog.isShowing()){
            mDialog.dismiss();
        }
    }

    // ---- helpers ----

    private static String value(JSONObject zCoin, String zKey){
        Object val = zCoin.get(zKey);
        if(val == null){
            return null;
        }
        String str = String.valueOf(val);
        return "null".equals(str) ? null : str;
    }

    /**
     * We ask for simplestate:false, so state arrives as an array of {port,data,keeper}.
     * Handle the object form too - it is what simplestate:true returns.
     */
    private static CharSequence stateOf(JSONObject zCoin){
        Object state = zCoin.get("state");
        if(state == null){
            return Language.msg(l10n_core_wallet_none);
        }

        if(state instanceof JSONArray){
            JSONArray arr = (JSONArray) state;
            return arr.size() == 0 ? Language.msg(l10n_core_wallet_none) : MiniFormat.JSONPretty(arr);
        }

        if(state instanceof JSONObject){
            JSONObject obj = (JSONObject) state;
            return obj.isEmpty() ? Language.msg(l10n_core_wallet_none) : MiniFormat.JSONPretty(obj);
        }

        String str = String.valueOf(state);
        return str.isEmpty() ? Language.msg(l10n_core_wallet_none) : str;
    }
}
