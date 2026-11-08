package com.eurobuddha.minimacore.main.views.balance.coins;

import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.app.Activity;
import android.util.DisplayMetrics;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ListView;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.core.content.ContextCompat;

import com.eurobuddha.minimacore.i18n.LanguageDialog;
import com.eurobuddha.minimacore.main.views.balance.BalanceAdapter;

import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.utils.Clip;
import com.eurobuddha.minimacore.utils.Feedback;
import com.eurobuddha.minimacore.utils.Format;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.MinimaCMDListener;
import com.eurobuddha.minimacore.utils.logger;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

/**
 * Every coin behind a token balance.
 *
 * Lists ALL relevant coins - including ones locked in a contract - because seeing what
 * inflates confirmed-over-sendable is the whole point. Locked coins get a chip.
 * Tapping a coin opens the full, copyable detail.
 */
public class CoinsDialog {

    private final Activity     mActivity;
    private final CoinsAdapter mAdapter;

    private AlertDialog mDialog;
    private TextView    mStatus;
    private TextView    mFooter;
    private ListView    mList;

    /** Set the moment the user closes the modal - a late node reply is then dropped. */
    private boolean mDismissed = false;

    private CoinDetailDialog mOpenDetail = null;

    private final String mTokenId;
    private final String mConfirmed;

    /** Everything the background thread produces, handed over in one go. */
    private static class Result {
        JSONArray   coins;
        Set<String> sendableIds;
        String      sum;
        String      error;
    }

    public static CoinsDialog show(Activity zActivity, String zTokenId, CharSequence zTokenName,
                                   String zSendable, String zConfirmed){
        CoinsDialog cd = new CoinsDialog(zActivity, zTokenId, zConfirmed);
        cd.open(zTokenName, zSendable, zConfirmed);
        return cd;
    }

    private CoinsDialog(Activity zActivity, String zTokenId, String zConfirmed){
        mActivity  = zActivity;
        mTokenId   = zTokenId;
        mConfirmed = zConfirmed;
        mAdapter   = new CoinsAdapter(zActivity);
    }

    /** Runs on the UI thread. The window is up before the node is asked anything. */
    private void open(CharSequence zTokenName, String zSendable, String zConfirmed){

        LayoutInflater inflater = (LayoutInflater) mActivity.getSystemService(Activity.LAYOUT_INFLATER_SERVICE);
        View body = inflater.inflate(R.layout.dialog_wallet_coins, null);
        Language.apply(body);

        TextView header = body.findViewById(R.id.coins_header);
        mStatus         = body.findViewById(R.id.coins_status);
        mFooter         = body.findViewById(R.id.coins_footer);
        mList           = body.findViewById(R.id.coins_list);

        //Sendable leads - it is the spendable figure. confirmed includes locked coins.
        Language.TextBuilder hdr = new Language.TextBuilder().append(Language.msg(l10n_core_wallet_sendable_amount, Format.tidyAmount(safe(zSendable))));
        String lockedAmt = Format.subtract(zConfirmed, zSendable);
        if(!"—".equals(lockedAmt) && !"0".equals(lockedAmt)){
            hdr.append("  ·  ").append(Language.msg(l10n_core_wallet_locked_amount, lockedAmt));
        }
        hdr.append("  ·  ").append(Language.msg(l10n_core_wallet_confirmed_amount, Format.tidyAmount(safe(zConfirmed))));
        Language.setText(header, hdr.build());

        mList.setAdapter(mAdapter);
        mList.setOnItemClickListener((parent, view, position, id) -> {
            JSONObject coin = (JSONObject) mAdapter.getItem(position);
            mOpenDetail = CoinDetailDialog.show(mActivity, coin, mAdapter.isSendable(coin));
        });

        //Long-press copies the full coin id straight out of the list
        mList.setOnItemLongClickListener((parent, view, position, id) -> {
            JSONObject coin = (JSONObject) mAdapter.getItem(position);
            Clip.copy(mActivity, "coinid", String.valueOf(coin.get("coinid")), Language.msg(l10n_core_wallet_coin_copied).toString());
            return true;
        });

        setStatus(Language.msg(l10n_core_wallet_reading), R.color.core_text_faint);

        mDialog = new LanguageDialog(mActivity)
                .setTitle(zTokenName == null ? Language.msg(l10n_wallet_coins) : Language.msg(l10n_core_wallet_token_coins, zTokenName))
                .setView(body)
                .setNeutralButton(Language.msg(l10n_nft_copy_token_id), null)   // click overridden below so it doesn't dismiss
                .setPositiveButton(Language.msg(l10n_language_close), null)
                .create();

        mDialog.setOnDismissListener(d -> {
            mDismissed = true;
            dismissDetail();
        });

        mDialog.show();

        //Copy the FULL token id (RULE 1 - never truncated). Overriding the click keeps the dialog open.
        android.widget.Button copy = mDialog.getButton(AlertDialog.BUTTON_NEUTRAL);
        if (copy != null) {
            copy.setOnClickListener(v ->
                    Clip.copy(mActivity, "tokenid", mTokenId, Language.msg(l10n_core_wallet_token_copied).toString()));
        }

        if (!Format.isValidTokenId(mTokenId)) {
            setStatus(Language.msg(l10n_send_invalid_token), R.color.status_bad);
            return;
        }

        //Guard first: with no tip the node answers status:true with an EMPTY array,
        //which would otherwise read as "you have no coins"
        if(!MinimaCMD.checkMinimaStarted()){
            setStatus(Language.msg(l10n_core_wallet_no_node), R.color.status_warn);
            return;
        }

        fetchCoins();
    }

    /**
     * Two queries: every relevant coin, then the sendable-only subset. The node's coin JSON
     * has no per-coin sendable flag, so the LOCKED chips come from diffing the two by coinid.
     * If the second one fails we simply show no chips - never fail the whole modal for it.
     */
    private void fetchCoins(){

        final String all      = "coins relevant:true tokenid:"+mTokenId+" simplestate:false";
        final String sendable = "coins relevant:true sendable:true tokenid:"+mTokenId+" simplestate:false";

        //MinimaCMD runs this on a bare Thread with no handler - an escaping throwable kills the app
        MinimaCMD.runMinima(all, new MinimaCMDListener() {
            @Override
            public void cmdResult(JSONObject zResult) {
                try{
                    final Result res = new Result();

                    res.error = errorOf(zResult);
                    if(res.error != null){
                        deliver(res);
                        return;
                    }

                    res.coins = (JSONArray) zResult.get("response");
                    if(res.coins == null){
                        res.coins = new JSONArray();
                    }

                    //Sum here, on the background thread - a wallet can hold thousands of coins
                    res.sum = sumOf(res.coins);

                    MinimaCMD.runMinima(sendable, new MinimaCMDListener() {
                        @Override
                        public void cmdResult(JSONObject zSendResult) {
                            try{
                                res.sendableIds = idsOf(zSendResult);
                            }catch(Throwable exc){
                                logger.log("Coins sendable query failed : "+exc);
                                res.sendableIds = null;
                            }
                            deliver(res);
                        }
                    });

                }catch(Throwable exc){
                    logger.log("Coins query failed : "+exc);
                    Result res = new Result();
                    res.error  = String.valueOf(exc);
                    deliver(res);
                }
            }
        });
    }

    private void deliver(Result zResult){
        mActivity.runOnUiThread(() -> {
            //Modal closed, tab left, or the Activity went away mid-flight
            if(mDismissed || mActivity.isFinishing() || mActivity.isDestroyed()){
                return;
            }
            populate(zResult);
        });
    }

    private void populate(Result zResult){

        if(zResult.error != null){
            //Deliberately distinct from the empty state - a failed query is not an empty wallet
            setStatus(Language.msg(l10n_core_wallet_query_failed, zResult.error), R.color.status_bad);
            return;
        }

        if(zResult.coins == null || zResult.coins.size() == 0){
            setStatus(Language.msg(l10n_core_wallet_no_coins), R.color.core_text_faint);
            return;
        }

        mAdapter.updateValues(zResult.coins, zResult.sendableIds);

        mStatus.setVisibility(View.GONE);
        mList.setVisibility(View.VISIBLE);
        sizeList(zResult.coins.size());

        int locked = 0;
        if(zResult.sendableIds != null){
            for(int i=0;i<zResult.coins.size();i++){
                if(!mAdapter.isSendable((JSONObject) zResult.coins.get(i))){
                    locked++;
                }
            }
        }

        Language.TextBuilder foot = new Language.TextBuilder();
        foot.append(BalanceAdapter.coinCount(String.valueOf(zResult.coins.size())));
        if(zResult.sendableIds != null){
            foot.append("  ·  ").append(Language.msg(l10n_core_wallet_locked_count, locked));
        }
        foot.append("  ·  ").append(Language.msg(l10n_core_wallet_sum, Format.tidyAmount(zResult.sum)));

        //Cross-check against the balance the wallet screen is showing
        if(differs(zResult.sum, mConfirmed)){
            foot.append("\n").append(Language.msg(l10n_core_wallet_sum_mismatch, Format.tidyAmount(safe(mConfirmed))));
            mFooter.setTextColor(ContextCompat.getColor(mActivity, R.color.status_warn));
        }else{
            mFooter.setTextColor(ContextCompat.getColor(mActivity, R.color.core_text_faint));
        }

        Language.setText(mFooter, foot.build());
        mFooter.setVisibility(View.VISIBLE);
    }

    /**
     * AlertDialog measures its custom view with an unbounded height spec, so a
     * wrap_content ListView collapses to a single row. Size it explicitly: snug for a
     * handful of coins, capped and scrollable for thousands.
     */
    private void sizeList(int zCount){
        DisplayMetrics dm = mActivity.getResources().getDisplayMetrics();

        //Measure a REAL row - rows wrap the full coin id, so their height depends on the
        //id length and the screen width and can't be hardcoded
        int rowPx = 0;
        try{
            View sample = mAdapter.getView(0, null, mList);
            int wSpec = View.MeasureSpec.makeMeasureSpec(
                    mList.getWidth() > 0 ? mList.getWidth() : dm.widthPixels, View.MeasureSpec.AT_MOST);
            sample.measure(wSpec, View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
            rowPx = sample.getMeasuredHeight();
        }catch(Throwable exc){}

        if(rowPx <= 0){
            rowPx = (int)(92 * dm.density);
        }

        int divider = (int)(1 * dm.density);
        int wanted  = (rowPx * zCount) + (divider * Math.max(0, zCount-1));
        int max     = (int)(dm.heightPixels * 0.55f);

        ViewGroup.LayoutParams lp = mList.getLayoutParams();
        lp.height = Math.min(wanted, max);
        mList.setLayoutParams(lp);
    }

    private void setStatus(CharSequence zText, int zColorRes){
        Language.setText(mStatus, zText);
        mStatus.setTextColor(ContextCompat.getColor(mActivity, zColorRes));
        mStatus.setVisibility(View.VISIBLE);
        mList.setVisibility(View.GONE);
        mFooter.setVisibility(View.GONE);
    }

    /** Called by BalanceView when the Activity goes away, so the window can't leak. */
    public void dismiss(){
        dismissDetail();
        if(mDialog != null && mDialog.isShowing()){
            mDialog.dismiss();
        }
    }

    private void dismissDetail(){
        if(mOpenDetail != null){
            mOpenDetail.dismiss();
            mOpenDetail = null;
        }
    }

    // ---- helpers ----

    /** Shared with every other call site - commands report failure under differing keys. */
    private static String errorOf(JSONObject zResult){
        return Feedback.errorOf(zResult);
    }

    private static Set<String> idsOf(JSONObject zResult){
        if(errorOf(zResult) != null){
            return null;
        }

        JSONArray arr = (JSONArray) zResult.get("response");
        if(arr == null){
            return null;
        }

        Set<String> ids = new HashSet<>();
        for(int i=0;i<arr.size();i++){
            ids.add(String.valueOf(((JSONObject)arr.get(i)).get("coinid")));
        }
        return ids;
    }

    private static String sumOf(JSONArray zCoins){
        BigDecimal sum = BigDecimal.ZERO;
        for(int i=0;i<zCoins.size();i++){
            try{
                sum = sum.add(new BigDecimal(Format.coinAmount((JSONObject) zCoins.get(i))));
            }catch(Exception exc){}
        }
        return sum.toPlainString();
    }

    /** compareTo, not equals - BigDecimal("10") does not equal BigDecimal("10.0"). */
    private static boolean differs(String zA, String zB){
        try{
            return new BigDecimal(zA).compareTo(new BigDecimal(zB)) != 0;
        }catch(Exception exc){
            return false;
        }
    }

    private static String safe(String zValue){
        return (zValue == null || "null".equals(zValue)) ? "—" : zValue;
    }
}
