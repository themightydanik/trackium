package com.eurobuddha.minimacore;

import android.content.Context;
import android.content.ClipboardManager;
import android.graphics.Bitmap;
import android.graphics.drawable.BitmapDrawable;
import android.os.Build;
import android.view.View;
import android.widget.TextView;
import android.widget.ImageView;
import androidx.appcompat.app.AlertDialog;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.main.MainAdapter;
import com.eurobuddha.minimacore.main.views.balance.BalanceView;
import com.eurobuddha.minimacore.main.views.balance.BalanceAdapter;
import com.eurobuddha.minimacore.main.views.balance.coins.CoinsDialog;
import com.eurobuddha.minimacore.main.views.balance.coins.CoinDetailDialog;
import com.eurobuddha.minimacore.main.views.receive.ReceiveView;
import com.eurobuddha.minimacore.testing.CoreViewsHarnessActivity;
import java.util.concurrent.atomic.AtomicReference;
import java.util.Collections;
import org.minima.utils.json.JSONObject;
import org.minima.utils.json.JSONArray;
import org.minima.utils.MiniFormat;
import org.junit.Before;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static com.eurobuddha.minimacore.i18n.R.string.*;

/** No seed/node/transactions: real UI with synthetic balances, coins and a fixed QR payload. */
@RunWith(AndroidJUnit4.class)
public class CoreWalletLanguagesTest {
    private static final String[] CODES={"en","zh-Hans","ru","uk"};
    private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    private boolean prepared;
    private String oldAddress;
    @Before public void prepare() {
        assertEquals("true",InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"));
        assertEquals("ranchu",Build.HARDWARE);assertNull(org.minima.system.Main.getInstance());
        android.content.SharedPreferences p=context.getSharedPreferences("main_prefs",0);
        assertFalse(p.getBoolean("SEED_SET",false));assertFalse(p.contains("SEED"));
        oldAddress=MainAdapter.RECEIVE_ADDRESS;prepared=true;select("en");
    }
    @After public void clean() {
        if(!prepared)return;
        MainAdapter.RECEIVE_ADDRESS=oldAddress;
        assertNull(org.minima.system.Main.getInstance());select("en");
    }
    private void settle(){android.os.SystemClock.sleep(500);InstrumentationRegistry.getInstrumentation().waitForIdleSync();}
    private void select(String code){InstrumentationRegistry.getInstrumentation().runOnMainSync(()->Language.select(context,code));settle();}
    private String text(int id,Object...args){return Language.text(context,id,args);}
    private String value(View root,int id){return ((TextView)root.findViewById(id)).getText().toString();}
    private static JSONObject obj(Object...pairs){JSONObject j=new JSONObject();for(int i=0;i<pairs.length;i+=2)j.put((String)pairs[i],pairs[i+1]);return j;}
    private static Object field(Object o,String name){try{java.lang.reflect.Field f=o.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(o);}catch(Exception e){throw new AssertionError(e);}}
    private static void set(Object o,String name,Object val){try{java.lang.reflect.Field f=o.getClass().getDeclaredField(name);f.setAccessible(true);f.set(o,val);}catch(Exception e){throw new AssertionError(e);}}
    private static void call(Object o,String name,Class<?> type,Object value){try{java.lang.reflect.Method m=o.getClass().getDeclaredMethod(name,type);m.setAccessible(true);m.invoke(o,value);}catch(Exception e){throw new AssertionError(e);}}
    private void snapshot(String name)throws Exception{
        java.io.File dir=new java.io.File(context.getExternalFilesDir(null),"language-tests");assertTrue(dir.isDirectory()||dir.mkdirs());
        Bitmap b=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();assertNotNull(b);
        try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(dir,name+".png"))){assertTrue(b.compress(Bitmap.CompressFormat.PNG,100,out));}finally{b.recycle();}
    }
    @Test public void balancesRetainNumbersNamesExpansionAndOrderAcrossLanguages()throws Exception{
        AtomicReference<BalanceView> view=new AtomicReference<>();AtomicReference<CoreViewsHarnessActivity> first=new AtomicReference<>();
        JSONArray balances=new JSONArray();
        balances.add(obj("tokenid","0x00","token","Minima","confirmed","12.34567890123456789","sendable","2.00000001","unconfirmed","0.0000012","coins","21"));
        balances.add(obj("tokenid","0x1234","token","Send 中文 Русский {count}","confirmed","1.00000001","sendable","0.00000001","unconfirmed","0.00000002","coins","2"));
        String raw=balances.toString();long when=System.currentTimeMillis()-120000;
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)){
            screen.onActivity(a->{first.set(a);BalanceView v=new BalanceView(a);view.set(v);a.show(v);
                assertEquals(text(l10n_core_wallet_disconnected),value(v.getMainView(),R.id.wallet_balance_breakdown));
                set(v,"mLastBalanceUpdate",when);call(v,"refreshBalance",JSONArray.class,balances);
                v.getMainView().findViewById(R.id.wallet_balance_header).performClick();
            });
            for(String code:CODES){select(code);screen.onActivity(a->{
                assertSame(first.get(),a);BalanceView v=view.get();View root=v.getMainView();
                assertEquals(View.VISIBLE,root.findViewById(R.id.wallet_balance_breakdown).getVisibility());
                assertEquals(text(l10n_core_wallet_hide_details),root.findViewById(R.id.wallet_balance_expand).getContentDescription().toString());
                assertEquals("2",value(root,R.id.wallet_total_balance));
                assertTrue(value(root,R.id.wallet_balance_breakdown).contains("12.345678"));
                assertTrue(value(root,R.id.wallet_balance_breakdown).contains("10.345678"));
                assertTrue(value(root,R.id.wallet_balance_breakdown).contains(BalanceAdapter.coinCount("21").toString()));
                BalanceAdapter adapter=(BalanceAdapter)field(v,"mBalanceAdapter");
                assertEquals(java.util.Arrays.asList("0x00","0x1234"),adapter.tokenids());
                View row=adapter.getView(1,null,null);
                assertEquals("Send 中文 Русский {count}",value(row,R.id.balance_tokenname));
                assertEquals("0x1234",value(row,R.id.balance_tokenid));
                assertEquals("<0.000001",value(row,R.id.balance_tokenamount));
                assertEquals(text(l10n_core_wallet_sendable_description,"<0.000001"),row.findViewById(R.id.balance_tokenamount).getContentDescription().toString());
                assertEquals(raw,balances.toString());
                androidx.recyclerview.widget.RecyclerView list=root.findViewById(R.id.wallet_balance_recycler);
                View shown=list.getChildAt(0);assertNotNull(shown);
                TextView name=shown.findViewById(R.id.balance_tokenname);
                assertTrue("Token name needs readable width",name.getWidth()>48*a.getResources().getDisplayMetrics().density);
                TextView details=shown.findViewById(R.id.balance_breakdown);
                assertNotNull(details.getLayout());
                for(int line=0;line<details.getLayout().getLineCount();line++)assertEquals(0,details.getLayout().getEllipsisCount(line));

                assertTrue(BalanceAdapter.coinCount("—").toString().contains("—"));
                assertTrue(BalanceAdapter.coinCount("2147483648").toString().contains("2147483648"));
                assertTrue(BalanceAdapter.coinCount("002").toString().contains("002"));
            });}
            snapshot("core-balance-uk");
        }
    }
    private Object result(JSONArray coins,java.util.Set<String> sendable,String sum,String error){
        try{Class<?> c=Class.forName(CoinsDialog.class.getName()+"$Result");java.lang.reflect.Constructor<?> ctor=c.getDeclaredConstructor();ctor.setAccessible(true);Object r=ctor.newInstance();set(r,"coins",coins);set(r,"sendableIds",sendable);set(r,"sum",sum);set(r,"error",error);return r;}catch(Exception e){throw new AssertionError(e);}
    }
    @Test public void coinListStatesPluralFormsAndExactCopyStayLive()throws Exception{
        AtomicReference<CoinsDialog> holder=new AtomicReference<>();AtomicReference<AlertDialog> dialog=new AtomicReference<>();
        JSONArray coins=new JSONArray();coins.add(obj("coinid","0xFAKE中文","amount","0.1","tokenamount","1.234567890123456789"));
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)){
            screen.onActivity(a->{CoinsDialog c=CoinsDialog.show(a,"0x1234","Send 中文","0.234567890123456789","1.234567890123456789");holder.set(c);dialog.set((AlertDialog)field(c,"mDialog"));
                assertEquals(text(l10n_core_wallet_no_node),value(dialog.get().getWindow().getDecorView(),R.id.coins_status));
                Object r=result(coins,Collections.emptySet(),"1.234567890123456789",null);call(c,"populate",r.getClass(),r);
            });
            for(String code:CODES){select(code);screen.onActivity(a->{
                AlertDialog d=dialog.get();assertTrue(d.isShowing());View root=d.getWindow().getDecorView();
                assertTrue(value(root,R.id.coins_header).contains("0.234567890123456789"));
                assertTrue(value(root,R.id.coins_footer).contains(BalanceAdapter.coinCount("1").toString()));
                assertTrue(value(root,R.id.coins_footer).contains("1.234567890123456789"));
                assertEquals(text(l10n_nft_copy_token_id),d.getButton(AlertDialog.BUTTON_NEUTRAL).getText().toString());
                d.getButton(AlertDialog.BUTTON_NEUTRAL).performClick();
                ClipboardManager cm=(ClipboardManager)a.getSystemService(Context.CLIPBOARD_SERVICE);
                assertEquals("0x1234",cm.getPrimaryClip().getItemAt(0).getText().toString());assertTrue(d.isShowing());
            });}
            snapshot("core-coins-uk");
            screen.onActivity(a->{Object r=result(null,null,null,"raw 中文 %1$s {error}");call(holder.get(),"populate",r.getClass(),r);});
            for(String code:CODES){select(code);screen.onActivity(a->assertEquals(text(l10n_core_wallet_query_failed,"raw 中文 %1$s {error}"),value(dialog.get().getWindow().getDecorView(),R.id.coins_status)));}
            screen.onActivity(a->{Object r=result(new JSONArray(),null,"0",null);call(holder.get(),"populate",r.getClass(),r);});
            for(String code:CODES){select(code);screen.onActivity(a->assertEquals(text(l10n_core_wallet_no_coins),value(dialog.get().getWindow().getDecorView(),R.id.coins_status)));}
            screen.onActivity(a->holder.get().dismiss());
        }finally{InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{if(holder.get()!=null)holder.get().dismiss();});}
    }
    @Test public void coinDetailKeepsFullJsonStateAndCopyValuesAcrossLanguages()throws Exception{
        JSONObject coin=obj("coinid","0x01"+String.join("",Collections.nCopies(60,"f")),"amount","0.000000000000000001","tokenamount","1.234567890123456789","tokenid","0xTokenFixture","address","0xAddressFixture","miniaddress","MxAddressFixture","created","123456","age","77","mmrentry","11","spent",false,"storestate",true,"state",obj("1","Copy 中文 Русский Українська {label}"));
        String raw=MiniFormat.JSONPretty(coin);AtomicReference<CoinDetailDialog> holder=new AtomicReference<>();AtomicReference<AlertDialog> dialog=new AtomicReference<>();
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)){
            screen.onActivity(a->{holder.set(CoinDetailDialog.show(a,coin,false));dialog.set((AlertDialog)field(holder.get(),"mDialog"));});
            for(String code:CODES){select(code);screen.onActivity(a->{AlertDialog d=dialog.get();assertTrue(d.isShowing());
                assertEquals(raw,value(d.getWindow().getDecorView(),R.id.coin_detail_json));
                android.widget.LinearLayout rows=d.findViewById(R.id.coin_detail_rows);View first=rows.getChildAt(0);
                assertEquals(text(l10n_nft_coin_id),value(first,R.id.detail_label));assertEquals(coin.get("coinid"),value(first,R.id.detail_value));
                first.findViewById(R.id.detail_copy).performClick();ClipboardManager cm=(ClipboardManager)a.getSystemService(Context.CLIPBOARD_SERVICE);
                assertEquals(coin.get("coinid"),cm.getPrimaryClip().getItemAt(0).getText().toString());
                assertEquals(text(l10n_core_wallet_no_locked),value(rows.getChildAt(6),R.id.detail_value));
                d.getButton(AlertDialog.BUTTON_NEUTRAL).performClick();assertEquals(raw,cm.getPrimaryClip().getItemAt(0).getText().toString());assertTrue(d.isShowing());
            });}
            snapshot("core-coin-detail-uk");screen.onActivity(a->holder.get().dismiss());
        }finally{InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{if(holder.get()!=null)holder.get().dismiss();});}
    }
    private static class ReceiveFixture extends ReceiveView {
        int changes;
        ReceiveFixture(android.app.Activity a){super(a);}
        @Override public void changeAddress(){changes++;}
        void showAddress(String value){updateAddress(value);}
    }
    @Test public void receiveQrAddressAndRotationAreUnaffectedByLanguage()throws Exception{
        String address="MxLANGUAGEFIXTURE012345678901234567890123456789";AtomicReference<ReceiveFixture> holder=new AtomicReference<>();AtomicReference<Bitmap> qr=new AtomicReference<>();AtomicReference<CoreViewsHarnessActivity> first=new AtomicReference<>();
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)){
            screen.onActivity(a->{first.set(a);ReceiveFixture v=new ReceiveFixture(a);holder.set(v);a.show(v);v.showAddress(address);});settle();
            screen.onActivity(a->qr.set(((BitmapDrawable)((ImageView)holder.get().getMainView().findViewById(R.id.wallet_receive_qrcode)).getDrawable()).getBitmap()));
            for(String code:CODES){select(code);screen.onActivity(a->{assertSame(first.get(),a);View root=holder.get().getMainView();
                assertEquals(address,value(root,R.id.wallet_receive_address));assertEquals(address,MainAdapter.RECEIVE_ADDRESS);
                assertSame(qr.get(),((BitmapDrawable)((ImageView)root.findViewById(R.id.wallet_receive_qrcode)).getDrawable()).getBitmap());
                assertEquals(text(l10n_core_wallet_get_address),value(root,R.id.wallet_receive_changeaddress));
                assertEquals(text(l10n_core_wallet_qr),root.findViewById(R.id.wallet_receive_qrcode).getContentDescription().toString());
                assertEquals(0,holder.get().changes);root.findViewById(R.id.wallet_receive_copy).performClick();
                assertEquals(address,((ClipboardManager)a.getSystemService(Context.CLIPBOARD_SERVICE)).getPrimaryClip().getItemAt(0).getText().toString());
            });}
            snapshot("core-receive-uk");screen.onActivity(a->{holder.get().getMainView().findViewById(R.id.wallet_receive_changeaddress).performClick();assertEquals(1,holder.get().changes);});
        }
    }
}
