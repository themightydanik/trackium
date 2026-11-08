package com.eurobuddha.minimacore.main.views.send;

import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.app.Activity;
import android.content.DialogInterface;
import android.view.View;
import android.widget.AdapterView;
import android.widget.Button;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.main.BaseView;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import androidx.appcompat.app.AlertDialog;

import com.eurobuddha.minimacore.utils.Feedback;
import com.eurobuddha.minimacore.utils.Format;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.MinimaCMDListener;
import com.eurobuddha.minimacore.utils.TokenUtils;
import com.eurobuddha.minimacore.utils.logger;

public class SendView extends BaseView {

    TextView mAmount;
    TextView mAddress;
    TextView mSendable;

    Button mSendButton;
    Spinner mTokens;

    TokenSpinnerAdapter mTokenAdapter;

    int mChosenToken=0;
    private AlertDialog confirmDialog;
    private boolean destroyed;

    /** Set by SendActivity - it owns the scan launcher, which must be registered in onCreate. */
    Runnable mOnScanRequest = null;

    public void setOnScanRequest(Runnable zOnScanRequest){
        mOnScanRequest = zOnScanRequest;
    }

    /** Called back by SendActivity with whatever the QR contained. */
    public void setScannedAddress(String zRaw){
        String addr = Format.cleanAddress(zRaw);
        if(addr.isEmpty()){
            Toast.makeText(getActivity(), Language.msg(l10n_send_no_qr), Toast.LENGTH_SHORT).show();
            return;
        }
        mAddress.setText(addr);
    }

    public SendView(Activity zActivity){
        super(zActivity, R.layout.view_wallet_send);

        mTokens = getMainView().findViewById(R.id.wallet_send_tokens);
        mTokenAdapter = new TokenSpinnerAdapter(zActivity);
        mTokens.setAdapter(mTokenAdapter);

        mTokens.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                mChosenToken = position;
                updateSendable();
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {}
        });

        mAmount     = getMainView().findViewById(R.id.wallet_send_amount);
        mAddress    = getMainView().findViewById(R.id.wallet_send_address);
        mSendable   = getMainView().findViewById(R.id.wallet_send_sendable);

        //Max = the selected token's SENDABLE, in full. Not confirmed - confirmed counts
        //coins locked in contracts and the send would simply fail.
        getMainView().findViewById(R.id.wallet_send_max).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String max = sendableOfChosenToken();
                if(max == null){
                    Toast.makeText(getActivity(), Language.msg(l10n_send_no_balance), Toast.LENGTH_SHORT).show();
                    return;
                }
                mAmount.setText(max);
            }
        });

        getMainView().findViewById(R.id.wallet_send_scan).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if(mOnScanRequest != null){
                    mOnScanRequest.run();
                }
            }
        });

        mSendButton = getMainView().findViewById(R.id.wallet_send_sendbutton);
        mSendButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String amount       = mAmount.getText().toString().trim();
                String address      = mAddress.getText().toString().trim();

                if(amount.equals("") || address.equals("")){
                    logger.showDialog(getActivity(),Language.msg(l10n_common_error),Language.msg(l10n_send_blank));
                    return;
                }

                //Checked BEFORE anything is put into a command. The node has no escape character,
                //so a pasted "MxREAL burn:100" would otherwise inject a burn - and the confirm
                //dialog was the only thing standing between that paste and lost funds.
                if(!Format.isValidAddress(address)){
                    logger.showDialog(getActivity(),Language.msg(l10n_common_error),Language.msg(l10n_send_invalid_address));
                    return;
                }
                if(!Format.isValidAmount(amount)){
                    logger.showDialog(getActivity(),Language.msg(l10n_common_error),Language.msg(l10n_send_invalid_amount));
                    return;
                }

                JSONObject token    = mTokenAdapter.getToken(mChosenToken);
                if (token == null) {
                    logger.showDialog(getActivity(), Language.msg(l10n_common_error), Language.msg(l10n_send_no_balance));
                    return;
                }
                String tokenid = String.valueOf(token.get("tokenid"));
                if (!Format.isValidTokenId(tokenid)) {
                    logger.showDialog(getActivity(), Language.msg(l10n_common_error), Language.msg(l10n_send_invalid_token));
                    return;
                }
                CharSequence tokenname = TokenUtils.getTokenDisplayName(token);

                showConfirmDialog(amount, address, tokenname, tokenid);
            }
        });

        refreshView();
    }

    private void showConfirmDialog(String zAmount, String zAddress, CharSequence zTokenName, String zTokenid ){
        if (confirmDialog != null) confirmDialog.dismiss();
        confirmDialog = new LanguageDialog(getActivity())
                .setTitle(Language.msg(l10n_send_confirm))
                .setMessage(Language.msg(l10n_send_confirm_body, zAmount, zTokenName, zAddress))
                .setIcon(R.drawable.ic_minima)
                .setPositiveButton(Language.msg(android.R.string.yes), new DialogInterface.OnClickListener(){
                    public void onClick(DialogInterface dialog, int whichButton) {
                        sendFunds(zAmount, zAddress, zTokenid);
                    }})
                .setNegativeButton(Language.msg(android.R.string.no), null).show();
    }

    protected void sendFunds(String zAMount, String zAddress, String zTokenid){

        Feedback.toast(getActivity(), Language.msg(l10n_send_building).toString());

        String cmd = "send amount:"+zAMount+" address:"+zAddress+" tokenid:"+zTokenid;

        MinimaCMD.runMinima(cmd, this::onSendResult);
    }

    /** Existing node reply handling, also exercised with synthetic replies by the UI tests. */
    protected void onSendResult(JSONObject zResult) {
        //Raw Thread - an escaping throwable would kill the app
        try{
            final String err = Feedback.errorOf(zResult);

            if(err != null){
                //Show the node's OWN words - "Insufficient funds.. you only have X
                //require:Y" is exactly what the user needs, and is under "message"
                getActivity().runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (destroyed || getActivity().isFinishing() || getActivity().isDestroyed()) return;
                        logger.showDialog(getActivity(), Language.msg(l10n_send_failed),
                                Language.msg(l10n_send_failed_body, err));
                    }
                });
                return;
            }

            final String txpowid = Feedback.txpowIdOf(zResult);

            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (destroyed || getActivity().isFinishing() || getActivity().isDestroyed()) return;
                    //Accepted - clear the form. Only now, never before the node answered.
                    mAmount.setText("");
                    mAddress.setText("");

                    //NOT "sent". The node has built and posted the transaction; it still
                    //has to be mined into a block. The wallet toasts again when the
                    //balance actually moves (NEWBALANCE).
                    Feedback.longToast(getActivity(), Language.msg(l10n_send_posted).toString());

                    if(txpowid != null){
                        logger.log("Send posted txpowid:"+txpowid);
                    }
                }
            });

        }catch(Throwable exc){
            logger.log("Send failed : "+exc);
            Feedback.toast(getActivity(), Language.msg(l10n_send_failed_logs).toString());
        }
    }

    @Override public void onActivityDestroy() {
        destroyed = true;
        if (confirmDialog != null) { confirmDialog.dismiss(); confirmDialog = null; }
    }

    @Override
    public void refreshView() {

        //Have we started
        if(!MinimaCMD.checkMinimaStarted()){
            return;
        }

        //Run Cmd
        MinimaCMD.runMinima("balance", new MinimaCMDListener() {
            @Override
            public void cmdResult(JSONObject zResult) {

                //Get the balance response
                JSONArray balance = (JSONArray)zResult.get("response");

                if(balance == null){
                    logger.log("NULL BALANCE : "+zResult.toString());
                    return;
                }

                refreshTokenSpinner(balance);
            }
        });
    }

    public void refreshTokenSpinner(JSONArray zBalance){
        mTokens.post(new Runnable() {
            @Override
            public void run() {
                mTokenAdapter.updateTokens(zBalance);
                mTokens.invalidate();
                updateSendable();
            }
        });
    }

    /** The chosen token's sendable amount, or null when no balance has loaded yet. */
    private String sendableOfChosenToken(){
        try{
            JSONObject token = mTokenAdapter.getToken(mChosenToken);
            if(token == null){
                return null;
            }
            Object send = token.get("sendable");
            if(send == null){
                send = token.get("confirmed");
            }
            return send == null ? null : Format.tidyAmount(String.valueOf(send));

        }catch(Exception exc){
            return null;
        }
    }

    private void updateSendable(){
        if(mSendable == null){
            return;
        }

        String send = sendableOfChosenToken();
        if(send == null){
            mSendable.setVisibility(View.GONE);
            return;
        }

        Language.setText(mSendable, Language.msg(l10n_core_wallet_sendable_amount, send));
        mSendable.setVisibility(View.VISIBLE);
    }
}
