package com.eurobuddha.minimacore.main.views.balance.coins;

import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.app.Activity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.TextView;

import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.utils.Format;

import java.util.Set;

/**
 * The coins in the coin modal. Same shape as BalanceAdapter, minus the async icon work -
 * this list is purely local data and never touches the network.
 */
public class CoinsAdapter extends BaseAdapter {

    private final LayoutInflater inflater;

    private JSONArray mCoins = new JSONArray();

    /** coinids the node reports as sendable. Null when that query failed - then no chips are shown. */
    private Set<String> mSendableIds = null;

    public CoinsAdapter(Activity zActivity){
        super();
        inflater = (LayoutInflater) zActivity.getSystemService(Activity.LAYOUT_INFLATER_SERVICE);
    }

    public void updateValues(JSONArray zCoins, Set<String> zSendableIds){
        mCoins       = zCoins == null ? new JSONArray() : zCoins;
        mSendableIds = zSendableIds;
        notifyDataSetChanged();
    }

    /** True when we know the coin is spendable. Unknown (query B failed) counts as sendable - no chip. */
    public boolean isSendable(JSONObject zCoin){
        if(mSendableIds == null){
            return true;
        }
        return mSendableIds.contains(String.valueOf(zCoin.get("coinid")));
    }

    @Override
    public int getCount() { return mCoins.size(); }

    @Override
    public Object getItem(int position) { return mCoins.get(position); }

    @Override
    public long getItemId(int position) { return position; }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        View row = convertView;
        if(row == null){
            row = inflater.inflate(R.layout.view_coin_row, null);
        }

        Language.apply(row);

        TextView amount = row.findViewById(R.id.coin_amount);
        TextView coinid = row.findViewById(R.id.coin_id);
        TextView locked = row.findViewById(R.id.coin_locked);

        JSONObject coin = (JSONObject) mCoins.get(position);

        amount.setText(Format.tidyAmount(Format.coinAmount(coin)));

        //IN FULL - wrapped, never shortened
        coinid.setText(String.valueOf(coin.get("coinid")));

        locked.setVisibility(isSendable(coin) ? View.GONE : View.VISIBLE);

        return row;
    }
}
