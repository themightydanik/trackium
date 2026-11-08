package com.eurobuddha.minimacore;

import android.content.Context;
import android.os.Build;
import android.view.View;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.TextView;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.widget.Toolbar;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.main.views.send.SendActivity;
import com.eurobuddha.minimacore.main.views.send.SendView;
import com.eurobuddha.minimacore.main.views.send.TokenSpinnerAdapter;
import com.eurobuddha.minimacore.main.views.balance.coins.CoinsDialog;
import com.eurobuddha.minimacore.testing.CoreViewsHarnessActivity;
import java.util.concurrent.atomic.AtomicReference;
import org.minima.utils.json.JSONObject;
import org.minima.utils.json.JSONArray;
import org.junit.Before;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static androidx.test.espresso.matcher.RootMatchers.isDialog;

/** Runs real forms/dialogs; sendFunds records arguments and never calls a node. */
@RunWith(AndroidJUnit4.class)
public class SendLanguagesTest {
    private static final String[] CODES={"en","zh-Hans","ru","uk"};
    private static final String ADDRESS="0x"+String.join("",java.util.Collections.nCopies(64,"A"));
    private static final String AMOUNT="0.1234567890123456789";
    private static final String NAME="Send 中文 Русский Українська {amount}";
    private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    private boolean prepared;
    @Before public void prepare(){
        assertEquals("true",InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"));assertEquals("ranchu",Build.HARDWARE);
        assertNull(org.minima.system.Main.getInstance());android.content.SharedPreferences p=context.getSharedPreferences("main_prefs",0);
        assertFalse(p.getBoolean("SEED_SET",false));assertFalse(p.contains("SEED"));prepared=true;select("en");
    }
    @After public void clean(){if(!prepared)return;assertNull(org.minima.system.Main.getInstance());select("en");}
    private void settle(){android.os.SystemClock.sleep(500);InstrumentationRegistry.getInstrumentation().waitForIdleSync();}
    private void select(String code){InstrumentationRegistry.getInstrumentation().runOnMainSync(()->Language.select(context,code));settle();}
    private String text(int id,Object...args){return Language.text(context,id,args);}
    private static JSONObject obj(Object...pairs){JSONObject j=new JSONObject();for(int i=0;i<pairs.length;i+=2)j.put((String)pairs[i],pairs[i+1]);return j;}
    private JSONArray balances(){JSONArray a=new JSONArray();a.add(obj("tokenid","0x00","token","Minima","sendable","100"));a.add(obj("tokenid","0x1234","token",obj("name",obj("name",NAME)),"sendable","1.234567890123456789"));a.add(obj("tokenid","0x5678","token",new JSONObject(),"sendable","2"));a.add(obj("tokenid","0x9999","token","Token","sendable","3"));return a;}
    private static class Fixture extends SendView {
        int sends,scans;String amount,address,token;
        Fixture(android.app.Activity a){super(a);setOnScanRequest(()->scans++);}
        @Override protected void sendFunds(String amount,String address,String token){sends++;this.amount=amount;this.address=address;this.token=token;}
        void reply(JSONObject result){super.onSendResult(result);}
    }
    private AlertDialog confirm(Fixture view){try{java.lang.reflect.Field f=SendView.class.getDeclaredField("confirmDialog");f.setAccessible(true);return (AlertDialog)f.get(view);}catch(Exception e){throw new AssertionError(e);}}
    private void fill(View root,String amount,String address){((EditText)root.findViewById(R.id.wallet_send_amount)).setText(amount);((EditText)root.findViewById(R.id.wallet_send_address)).setText(address);}
    private String val(View root,int id){return ((TextView)root.findViewById(id)).getText().toString();}
    private void snapshot(String name)throws Exception{java.io.File dir=new java.io.File(context.getExternalFilesDir(null),"language-tests");assertTrue(dir.isDirectory()||dir.mkdirs());android.graphics.Bitmap b=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();assertNotNull(b);try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(dir,name+".png"))){assertTrue(b.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out));}finally{b.recycle();}}
    @Test public void draftCursorSelectionAndConfirmationSurviveLanguageSwitches()throws Exception{
        AtomicReference<Fixture> view=new AtomicReference<>();AtomicReference<CoreViewsHarnessActivity> first=new AtomicReference<>();
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)){
            screen.onActivity(a->{first.set(a);Fixture v=new Fixture(a);view.set(v);a.show(v);v.refreshTokenSpinner(balances());});settle();
            screen.onActivity(a->{View root=view.get().getMainView();((Spinner)root.findViewById(R.id.wallet_send_tokens)).setSelection(1);fill(root,AMOUNT,ADDRESS);((EditText)root.findViewById(R.id.wallet_send_address)).setSelection(10);});settle();
            for(String code:CODES){select(code);screen.onActivity(a->{assertSame(first.get(),a);View root=view.get().getMainView();
                assertEquals(AMOUNT,val(root,R.id.wallet_send_amount));assertEquals(ADDRESS,val(root,R.id.wallet_send_address));assertEquals(10,((EditText)root.findViewById(R.id.wallet_send_address)).getSelectionStart());
                assertEquals(1,((Spinner)root.findViewById(R.id.wallet_send_tokens)).getSelectedItemPosition());
                assertEquals(text(l10n_core_wallet_sendable_amount,"1.234567890123456789"),val(root,R.id.wallet_send_sendable));assertEquals(0,view.get().sends);
            });}
            snapshot("send-form-uk");screen.onActivity(a->view.get().getMainView().findViewById(R.id.wallet_send_sendbutton).performClick());settle();
            for(String code:CODES){select(code);screen.onActivity(a->{AlertDialog d=confirm(view.get());assertTrue(d.isShowing());
                assertEquals(text(l10n_send_confirm_body,AMOUNT,NAME,ADDRESS),((TextView)d.findViewById(android.R.id.message)).getText().toString());
                assertEquals(text(android.R.string.yes),d.getButton(AlertDialog.BUTTON_POSITIVE).getText().toString());assertEquals(0,view.get().sends);
            });}
            snapshot("send-confirm-uk");screen.onActivity(a->confirm(view.get()).getButton(AlertDialog.BUTTON_NEGATIVE).performClick());
            screen.onActivity(a->{View root=view.get().getMainView();assertEquals(AMOUNT,val(root,R.id.wallet_send_amount));root.findViewById(R.id.wallet_send_sendbutton).performClick();});
            onView(withId(android.R.id.button1)).inRoot(isDialog()).perform(click());
            screen.onActivity(a->{assertEquals(1,view.get().sends);assertEquals(AMOUNT,view.get().amount);assertEquals(ADDRESS,view.get().address);assertEquals("0x1234",view.get().token);});
        }
    }
    @Test public void validationRejectsEmptyInvalidAndUnavailableInputsBeforeDispatch(){
        AtomicReference<Fixture> view=new AtomicReference<>();
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)){
            screen.onActivity(a->{Fixture v=new Fixture(a);view.set(v);a.show(v);});
            String[][] inputs={{"",ADDRESS},{"1","bad-address"},{"0",ADDRESS},{"1",ADDRESS}};
            int[] errors={l10n_send_blank,l10n_send_invalid_address,l10n_send_invalid_amount,l10n_send_no_balance};
            for(int i=0;i<inputs.length;i++){String amount=inputs[i][0],address=inputs[i][1];int error=errors[i];
                screen.onActivity(a->{fill(view.get().getMainView(),amount,address);view.get().getMainView().findViewById(R.id.wallet_send_sendbutton).performClick();});
                for(String code:CODES){select(code);onView(withId(android.R.id.message)).inRoot(isDialog()).check(matches(withText(text(error))));}
                onView(withId(android.R.id.button1)).inRoot(isDialog()).perform(click());screen.onActivity(a->assertEquals(0,view.get().sends));
            }
            JSONArray bad=new JSONArray();bad.add(obj("tokenid","0x00 burn:100","token","Injected","sendable","10"));
            screen.onActivity(a->view.get().refreshTokenSpinner(bad));settle();screen.onActivity(a->{fill(view.get().getMainView(),"1",ADDRESS);view.get().getMainView().findViewById(R.id.wallet_send_sendbutton).performClick();});
            for(String code:CODES){select(code);onView(withId(android.R.id.message)).inRoot(isDialog()).check(matches(withText(text(l10n_send_invalid_token))));}
            onView(withId(android.R.id.button1)).inRoot(isDialog()).perform(click());screen.onActivity(a->assertEquals(0,view.get().sends));
            AtomicReference<CoinsDialog> coins=new AtomicReference<>();screen.onActivity(a->coins.set(CoinsDialog.show(a,"0x00;quit","Injected","1","1")));
            for(String code:CODES){select(code);onView(withId(R.id.coins_status)).inRoot(isDialog()).check(matches(withText(text(l10n_send_invalid_token))));}
            screen.onActivity(a->coins.get().dismiss());
        }
    }
    @Test public void fallbackNamesMaxAndScanKeepLiteralValues(){
        AtomicReference<Fixture> view=new AtomicReference<>();
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)){
            screen.onActivity(a->{Fixture v=new Fixture(a);view.set(v);a.show(v);v.refreshTokenSpinner(balances());});settle();
            screen.onActivity(a->((Spinner)view.get().getMainView().findViewById(R.id.wallet_send_tokens)).setSelection(2));settle();
            for(String code:CODES){select(code);screen.onActivity(a->{Spinner spinner=view.get().getMainView().findViewById(R.id.wallet_send_tokens);TokenSpinnerAdapter adapter=(TokenSpinnerAdapter)spinner.getAdapter();
                assertEquals(text(l10n_wallet_token),val(spinner.getSelectedView(),R.id.send_spinner_text));assertEquals(2,spinner.getSelectedItemPosition());
                View row=adapter.getDropDownView(2,null,new android.widget.FrameLayout(a));assertEquals(text(l10n_wallet_token),val(row,R.id.send_spinner_text));row=adapter.getDropDownView(3,row,new android.widget.FrameLayout(a));assertEquals("Token",val(row,R.id.send_spinner_text));
            });}
            screen.onActivity(a->((Spinner)view.get().getMainView().findViewById(R.id.wallet_send_tokens)).setSelection(1));settle();
            screen.onActivity(a->{View root=view.get().getMainView();root.findViewById(R.id.wallet_send_max).performClick();assertEquals("1.234567890123456789",val(root,R.id.wallet_send_amount));root.findViewById(R.id.wallet_send_scan).performClick();assertEquals(1,view.get().scans);view.get().setScannedAddress("minima://"+ADDRESS+"?amount=99");assertEquals(ADDRESS,val(root,R.id.wallet_send_address));assertEquals("1.234567890123456789",val(root,R.id.wallet_send_amount));});
            for(String code:CODES){select(code);screen.onActivity(a->{assertEquals(NAME,((Spinner)view.get().getMainView().findViewById(R.id.wallet_send_tokens)).getSelectedItem().toString());assertEquals(0,view.get().sends);});}
        }
    }
    @Test public void failedReplyRetainsDraftAndRawReasonAcceptedReplyClearsIt(){
        AtomicReference<Fixture> view=new AtomicReference<>();
        String reason="Insufficient 中文 {error} %1$s require:9.123456789";
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)){
            screen.onActivity(a->{Fixture v=new Fixture(a);view.set(v);a.show(v);fill(v.getMainView(),AMOUNT,ADDRESS);v.reply(obj("status",false,"message",reason));});
            for(String code:CODES){select(code);onView(withId(android.R.id.message)).inRoot(isDialog()).check(matches(withText(text(l10n_send_failed_body,reason))));screen.onActivity(a->{assertEquals(AMOUNT,val(view.get().getMainView(),R.id.wallet_send_amount));assertEquals(ADDRESS,val(view.get().getMainView(),R.id.wallet_send_address));});}
            onView(withId(android.R.id.button1)).inRoot(isDialog()).perform(click());
            screen.onActivity(a->{view.get().reply(obj("status",true,"response",obj("txpowid","0xSYNTHETIC")));assertEquals("",val(view.get().getMainView(),R.id.wallet_send_amount));assertEquals("",val(view.get().getMainView(),R.id.wallet_send_address));assertEquals(0,view.get().sends);});
        }
        // A completed host must not reopen a dialog on a late node callback.
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->view.get().reply(obj("status",false,"message",reason)));
    }
    @Test public void actualSendActivityKeepsToolbarAndDraftInAllLanguages(){
        AtomicReference<SendActivity> first=new AtomicReference<>();
        try(ActivityScenario<SendActivity> screen=ActivityScenario.launch(SendActivity.class)){
            screen.onActivity(a->{first.set(a);fill(a.findViewById(R.id.send_main),AMOUNT,ADDRESS);});
            for(String code:CODES){select(code);screen.onActivity(a->{assertSame(first.get(),a);assertEquals(text(l10n_wallet_send),((Toolbar)a.findViewById(R.id.send_toolbar)).getTitle().toString());assertEquals(AMOUNT,val(a.findViewById(R.id.send_main),R.id.wallet_send_amount));assertEquals(ADDRESS,val(a.findViewById(R.id.send_main),R.id.wallet_send_address));});}
        }
    }
}
