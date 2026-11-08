package com.eurobuddha.minimacore.main.views.receive;

import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.app.Activity;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;

import com.google.zxing.BarcodeFormat;
import com.journeyapps.barcodescanner.BarcodeEncoder;

import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.main.MainAdapter;
import com.eurobuddha.minimacore.utils.Clip;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.MinimaCMDListener;
import com.eurobuddha.minimacore.main.BaseView;

public class ReceiveView extends BaseView {

    TextView mAddressText;

    ImageView mQRCodeAddress;

    Button mChangeButton;

    public ReceiveView(Activity zActivity){
        super(zActivity, R.layout.view_wallet_receive);

        mQRCodeAddress = getMainView().findViewById(R.id.wallet_receive_qrcode);

        mAddressText = getMainView().findViewById(R.id.wallet_receive_address);

        getMainView().findViewById(R.id.wallet_receive_copy).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String addr = mAddressText.getText().toString().trim();
                if(!addr.isEmpty()){
                    Clip.copy(getActivity(), "address", addr, Language.msg(l10n_wallet_address_copied).toString());
                }
            }
        });

        mChangeButton = getMainView().findViewById(R.id.wallet_receive_changeaddress);
        mChangeButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                changeAddress();
            }
        });

        refreshView();
    }

    public void changeAddress(){

        mChangeButton.post(new Runnable() {
            @Override
            public void run() {
                mChangeButton.setEnabled(false);
            }
        });

        MinimaCMD.runMinima("getAddress", new MinimaCMDListener() {
            @Override
            public void cmdResult(JSONObject zResult) {
                JSONObject response = (JSONObject)zResult.get("response");
                String address      = response.get("miniaddress").toString();
                updateAddress(address);
            }
        });
    }

    protected void updateAddress(String zAddress){

        mAddressText.post(new Runnable() {
            @Override
            public void run() {
                try {
                    BarcodeEncoder barcodeEncoder = new BarcodeEncoder();
                    Bitmap bitmap = barcodeEncoder.encodeBitmap(zAddress, BarcodeFormat.QR_CODE, 400, 400);
                    mQRCodeAddress.setImageBitmap(bitmap);

                    //Store this..
                    MainAdapter.RECEIVE_ADDRESS = zAddress;

                } catch(Exception e) {

                }

                mAddressText.setText(zAddress);
            }
        });

        mChangeButton.post(new Runnable() {
            @Override
            public void run() {
                mChangeButton.setEnabled(true);
            }
        });
    }

    @Override
    public void refreshView() {
        //Have we started
        if(!MinimaCMD.checkMinimaStarted()){
            return;
        }

        if(MainAdapter.RECEIVE_ADDRESS == null){
            changeAddress();
        }else{
            updateAddress(MainAdapter.RECEIVE_ADDRESS);
        }
    }
}
