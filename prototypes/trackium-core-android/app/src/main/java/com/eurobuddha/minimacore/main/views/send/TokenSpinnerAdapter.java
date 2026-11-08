package com.eurobuddha.minimacore.main.views.send;

import com.eurobuddha.minimacore.i18n.Language;

import android.content.Context;
import android.widget.ArrayAdapter;

import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;

import java.util.ArrayList;

public class TokenSpinnerAdapter extends ArrayAdapter<CharSequence> {

    JSONArray mBalance;

    public TokenSpinnerAdapter(Context zContext){
        super(zContext, R.layout.send_spinner_item, R.id.send_spinner_text, new ArrayList<>());
    }

    public void updateTokens(JSONArray zBalance){
        //Remove the old
        clear();

        mBalance = zBalance;

        ArrayList<CharSequence> tokens = new ArrayList<>();
        for (int i=0; i<mBalance.size(); i++) {
            tokens.add(com.eurobuddha.minimacore.utils.TokenUtils.getTokenDisplayName((JSONObject)mBalance.get(i)));
        }

        //Add the new
        addAll(tokens);

        notifyDataSetChanged();
    }

    @Override public android.view.View getView(int position, android.view.View recycled, android.view.ViewGroup parent) {
        android.view.View row = super.getView(position, recycled, parent);
        Language.setText(row.findViewById(R.id.send_spinner_text), getItem(position));
        return row;
    }

    @Override public android.view.View getDropDownView(int position, android.view.View recycled, android.view.ViewGroup parent) {
        android.view.View row = super.getDropDownView(position, recycled, parent);
        Language.setText(row.findViewById(R.id.send_spinner_text), getItem(position));
        return row;
    }

    public JSONObject getToken(int zPosition){
        if (mBalance == null || zPosition < 0 || zPosition >= mBalance.size()) return null;
        JSONObject bal = (JSONObject) mBalance.get(zPosition);
        return bal;
    }
}
