package com.eurobuddha.minimacore.main.views.balance;

import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.ImageView;
import android.widget.TextView;

import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.main.views.balance.tokens.Identicon;
import com.eurobuddha.minimacore.main.views.balance.tokens.ImageLoader;
import com.eurobuddha.minimacore.main.views.balance.tokens.TokenMeta;
import com.eurobuddha.minimacore.main.views.balance.tokens.WebValidate;
import com.eurobuddha.minimacore.utils.Format;

public class BalanceAdapter extends BaseAdapter {

    private final Activity mActivity;
    private final LayoutInflater inflater;

    JSONArray mCurrentBalance = new JSONArray();

    private final Handler mHandler = new Handler(Looper.getMainLooper());
    private boolean destroyed;
    private boolean displayActive = !com.eurobuddha.minimacore.BuildConfig.PANDAMONIUM;
    private final Runnable mRefresh = () -> { if (!destroyed && displayActive) notifyDataSetChanged(); };
    private final java.util.function.Consumer<WebValidate.Result> validationDone = result -> scheduleRefresh();

    //Optional extra observer: a RecyclerView adapter (Pandamonium reorder list) can't observe a
    //BaseAdapter, so it hooks in here to be refreshed whenever this adapter changes. Null on
    //classic/BlackBear (ListView observes the BaseAdapter directly).
    private Runnable mExtraNotify;
    public void setExtraNotify(Runnable zExtraNotify){ mExtraNotify = zExtraNotify; }

    @Override
    public void notifyDataSetChanged(){
        super.notifyDataSetChanged();
        if (mExtraNotify != null) mExtraNotify.run();
    }

    public void destroy() { destroyed = true; mHandler.removeCallbacks(mRefresh); }

    public void setDisplayActive(boolean active) {
        displayActive = active;
        mHandler.removeCallbacks(mRefresh);
        if (active && !destroyed) notifyDataSetChanged();
    }

    /** Called while the wallet is visible; only redraw when a metadata check has expired. */
    public void refreshExpiredMetadata(int first, int last) {
        if (destroyed || !displayActive) return;
        for (int index = Math.max(0, first); index <= Math.min(last, getCount() - 1); index++) {
            JSONObject bal = (JSONObject) mCurrentBalance.get(index);
            String id = String.valueOf(bal.get("tokenid"));
            TokenMeta meta = TokenMeta.parse(bal.get("token"), id);
            if (WebValidate.needsCheck(id, meta.webvalidate)) { scheduleRefresh(); return; }
        }
    }

    public BalanceAdapter(Activity zActivity){
        super();
        mActivity = zActivity;
        inflater = (LayoutInflater) zActivity.getSystemService(Activity.LAYOUT_INFLATER_SERVICE);
    }

    public void updateValues(JSONArray zCurrentBalance){
        mCurrentBalance = zCurrentBalance;
        notifyDataSetChanged();
    }

    // ---- drag-reorder support (Pandamonium) --------------------------------------------------

    /** The tokenid at a position (for pinning + persistence). */
    public String tokenidAt(int position){
        return String.valueOf(((JSONObject) mCurrentBalance.get(position)).get("tokenid"));
    }

    /** The current token order, top to bottom. */
    public java.util.List<String> tokenids(){
        java.util.List<String> ids = new java.util.ArrayList<>();
        for (int i = 0; i < mCurrentBalance.size(); i++) ids.add(tokenidAt(i));
        return ids;
    }

    /** Move a row during a drag. The caller is responsible for notifying its RecyclerView. */
    public void moveItem(int from, int to){
        if (from < 0 || to < 0 || from >= mCurrentBalance.size() || to >= mCurrentBalance.size()) return;
        Object moved = mCurrentBalance.remove(from);
        mCurrentBalance.add(to, moved);
    }

    /** Reorder the held tokens to the given tokenid order; tokens not listed are kept (appended). */
    public void applyTokenOrder(java.util.List<String> zDesired){
        JSONArray reordered = new JSONArray();
        java.util.LinkedHashMap<String, JSONObject> byId = new java.util.LinkedHashMap<>();
        for (int i = 0; i < mCurrentBalance.size(); i++){
            JSONObject j = (JSONObject) mCurrentBalance.get(i);
            byId.put(String.valueOf(j.get("tokenid")), j);
        }
        for (String tid : zDesired){
            JSONObject j = byId.remove(tid);
            if (j != null) reordered.add(j);
        }
        for (JSONObject leftover : byId.values()) reordered.add(leftover);
        mCurrentBalance = reordered;
    }

    /** Coalesce async web-validation callbacks into a single re-render. */
    private void scheduleRefresh(){
        if (destroyed || !displayActive || mActivity.isDestroyed() || mActivity.isFinishing()) return;
        mHandler.removeCallbacks(mRefresh);
        mHandler.postDelayed(mRefresh, 120);
    }

    @Override
    public int getCount() { return mCurrentBalance.size(); }

    @Override
    public Object getItem(int position) { return mCurrentBalance.get(position); }

    @Override
    public long getItemId(int position) { return position; }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        View row = convertView;
        if(row == null){
            row = inflater.inflate(R.layout.view_balance_row, parent, false);
        }

        Language.apply(row);

        TextView tokenname   = row.findViewById(R.id.balance_tokenname);
        TextView tokenamount = row.findViewById(R.id.balance_tokenamount);
        TextView tokenid     = row.findViewById(R.id.balance_tokenid);
        TextView breakdown   = row.findViewById(R.id.balance_breakdown);
        ImageView icon       = row.findViewById(R.id.balance_tokenicon);
        ImageView badge      = row.findViewById(R.id.balance_tokenbadge);

        //Get the balance..
        JSONObject bal = (JSONObject) mCurrentBalance.get(position);

        //Token ID - in full, never shortened
        String id = String.valueOf(bal.get("tokenid"));
        tokenid.setText(id);

        //Token metadata (name / icon / webvalidate)
        TokenMeta meta = TokenMeta.parse(bal.get("token"), id);
        Language.setText(tokenname, meta.nameProvided ? meta.name : Language.msg(l10n_wallet_token));

        int density = (int) mActivity.getResources().getDisplayMetrics().density;
        int iconPx  = 40 * Math.max(1, density);
        int badgePx = 15 * Math.max(1, density);

        if(TokenMeta.isMinima(id)){
            //Native coin: black Minima mark on a white tile, and it is the official verified coin
            icon.setScaleType(ImageView.ScaleType.FIT_CENTER);
            int pad = 6 * Math.max(1, density);
            icon.setPadding(pad, pad, pad, pad);
            icon.setBackgroundResource(R.drawable.bg_token_tile_white);
            icon.setColorFilter(0xFF000000);
            icon.setImageResource(R.drawable.ic_minima);
            icon.setTag(null);
            badge.setImageBitmap(Identicon.checkBadge(badgePx));
            badge.setVisibility(View.VISIBLE);
        }else{
            //Deterministic identicon base, real icon loaded over the top when it decodes
            icon.setScaleType(ImageView.ScaleType.CENTER_CROP);
            icon.setPadding(0, 0, 0, 0);
            icon.setBackground(null);
            icon.clearColorFilter();
            icon.setImageBitmap(Identicon.forToken(id, iconPx));
            if (displayActive) ImageLoader.loadOver(mActivity, meta.iconUrl, icon, null);

            //Web-validation badge (async, cached): show only when the domain proves the token
            badge.setVisibility(View.GONE);
            if(meta.webvalidate != null && !meta.webvalidate.isEmpty()){
                if (displayActive) WebValidate.ensure(id, meta.webvalidate, validationDone);
                if(Boolean.TRUE.equals(WebValidate.status(id, meta.webvalidate))){
                    badge.setImageBitmap(Identicon.checkBadge(badgePx));
                    badge.setVisibility(View.VISIBLE);
                }
            }
        }

        //SENDABLE is the headline figure - confirmed includes coins locked in contracts
        //and overstates what the user can actually spend. Tap the row for exact amounts.
        String confirmed   = val(bal, "confirmed");
        String unconfirmed = val(bal, "unconfirmed");
        String sendable    = bal.get("sendable") == null ? confirmed : val(bal, "sendable");
        String coincount   = val(bal, "coins");

        String summary = Format.summaryAmount(sendable);
        tokenamount.setText(summary);
        Language.description(tokenamount, Language.msg(l10n_core_wallet_sendable_description, summary));

        //Everything the headline number leaves out, for THIS token - not just Minima
        Language.TextBuilder sub = new Language.TextBuilder();
        boolean hasPart = false;
        String locked = Format.subtract(confirmed, sendable);
        if(isPositive(locked)){
            sub.append(Language.msg(l10n_core_wallet_locked_amount, Format.summaryAmount(locked)));
            hasPart = true;
        }
        if(isPositive(unconfirmed)){
            if(hasPart){ sub.append("  ·  "); }
            sub.append(Language.msg(l10n_core_wallet_unconfirmed_amount, Format.summaryAmount(unconfirmed)));
            hasPart = true;
        }
        if(!"0".equals(coincount) && !"—".equals(coincount)){
            if(hasPart){ sub.append("  ·  "); }
            sub.append(coinCount(coincount));
            hasPart = true;
        }

        if(hasPart){
            Language.setText(breakdown, sub.build());
            breakdown.setVisibility(View.VISIBLE);
        }else{
            breakdown.setVisibility(View.GONE);
        }

        return row;
    }

    /** Node counts stay literal; valid bounded integers select the language's plural form. */
    public static Language.Message coinCount(String raw) {
        try {
            int count = Integer.parseInt(raw);
            if (count >= 0) return Language.count(com.eurobuddha.minimacore.i18n.R.plurals.l10n_core_wallet_coin_count, count, raw);
        } catch (NumberFormatException ignored) { }
        return Language.msg(l10n_core_wallet_coin_count_raw, raw);
    }

    private static String val(JSONObject zBal, String zKey){
        Object v = zBal.get(zKey);
        if(v == null){
            return "0";
        }
        String s = String.valueOf(v);
        return (s.isEmpty() || "null".equals(s)) ? "0" : s;
    }

    /** True when the string parses as a number greater than zero. */
    private static boolean isPositive(String zValue){
        try{
            return new java.math.BigDecimal(zValue).signum() > 0;
        }catch(Exception exc){
            return false;
        }
    }
}
