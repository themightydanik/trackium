package com.eurobuddha.minimacore.chat;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.widget.*;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.widget.Toolbar;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.maxchat.MaxChat;
import com.eurobuddha.minimacore.maxchat.MaxThreadActivity;
import com.eurobuddha.maxima.core.chat.ChatEngine;
import com.eurobuddha.maxima.core.chat.ChatMedia;
import com.eurobuddha.maxima.core.chat.ChatPay;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static androidx.test.espresso.matcher.RootMatchers.isDialog;

/** Real screens, disposable local fixtures. Never sends a message/payment or starts a node/engine. */
@RunWith(AndroidJUnit4.class)
public class ChatThreadLanguagesTest {
    private static final String[] CODES={"en","zh-Hans","ru","uk"};
    private static final String KEY="0x"+"35".repeat(32);
    private static final String RAW="Draft 中文 Привет Україна {amount} $1";
    private static final String AMOUNT="1.25000000000000001", TOKEN="Token 中文 {count}";
    private static final String LINK="keets://language-fixture/link?literal={amount}", TXID="0x1234abcdef";
    private static final String PHOTO="keets://language-fixture/local-image-v2";
    private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    private ChatDb db; private boolean prepared; private int nativeListeners,maxListeners;
    private java.io.File photoFile;
    @Before public void prepare(){
        assertEquals("true",InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"));assertEquals("ranchu",Build.HARDWARE);
        assertNull(org.minima.system.Main.getInstance());assertNull(MaxChat.node());assertNull(MaxChat.chat());
        android.content.SharedPreferences prefs=context.getSharedPreferences("main_prefs",0);assertFalse(prefs.getBoolean("SEED_SET",false));assertFalse(prefs.contains("SEED"));
        db=ChatDb.get(context);assertFalse(db.hasContact(KEY));assertTrue(db.thread(KEY).isEmpty());
        nativeListeners=ChatDrainer.UI_LISTENERS.size();maxListeners=MaxChat.UI_LISTENERS.size();prepared=true;select("en");
    }
    @After public void clean(){if(!prepared)return;db.removeContact(KEY);if(photoFile!=null)assertTrue(photoFile.delete()||!photoFile.exists());
        assertNull(org.minima.system.Main.getInstance());assertNull(MaxChat.node());assertEquals(nativeListeners,ChatDrainer.UI_LISTENERS.size());assertEquals(maxListeners,MaxChat.UI_LISTENERS.size());select("en");}
    private void settle(){android.os.SystemClock.sleep(450);InstrumentationRegistry.getInstrumentation().waitForIdleSync();}
    private void select(String code){InstrumentationRegistry.getInstrumentation().runOnMainSync(()->Language.select(context,code));settle();}
    private String text(int id,Object... args){return Language.text(context,id,args);}
    private static String value(View root,int id){return ((TextView)root.findViewById(id)).getText().toString();}
    private static Object field(Object target,String name){try{java.lang.reflect.Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}catch(Exception e){throw new AssertionError(e);}}
    private static void field(Object target,String name,Object value){try{java.lang.reflect.Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);f.set(target,value);}catch(Exception e){throw new AssertionError(e);}}
    private static void invoke(Object target,String name,Class<?>[] types,Object... args){try{java.lang.reflect.Method m=target.getClass().getDeclaredMethod(name,types);m.setAccessible(true);m.invoke(target,args);}catch(Exception e){throw new AssertionError(e);}}
    @SuppressWarnings("unchecked") private static Set<AlertDialog> dialogs(Activity a){return (Set<AlertDialog>)field(a,"dialogs");}
    private static AlertDialog dialog(Activity a){for(AlertDialog d:dialogs(a))if(d.isShowing())return d;throw new AssertionError("No dialog");}
    private ActivityScenario<ChatThreadActivity> nativeScreen(){return ActivityScenario.launch(new Intent(context,ChatThreadActivity.class).putExtra("pubkey",KEY));}
    private String clipboard(){return ((android.content.ClipboardManager)context.getSystemService(Context.CLIPBOARD_SERVICE)).getPrimaryClip().getItemAt(0).getText().toString();}
    private void add(String id,String state,String body,String ref,long time){ChatDb.Msg m=new ChatDb.Msg();m.msgid="thread-languages-"+id;m.pubkey=KEY;m.state=state;m.body=body;m.ref=ref;m.ts=time;m.incoming=false;m.read=true;m.amt=AMOUNT;m.tokname=TOKEN;m.txid=TXID;m.via="delivered";assertTrue(db.addMessage(m));}
    private void snapshot(String name)throws Exception{settle();java.io.File dir=new java.io.File(context.getExternalFilesDir(null),"language-tests");assertTrue(dir.isDirectory()||dir.mkdirs());android.graphics.Bitmap bm=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();assertNotNull(bm);try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(dir,name+".png"))){assertTrue(bm.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out));}finally{bm.recycle();}}
    private static EditText input(View v){if(v instanceof EditText)return (EditText)v;if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++){EditText found=input(((ViewGroup)v).getChildAt(i));if(found!=null)return found;}return null;}
    @Test public void nativeDraftPaymentAndRenameStayInPlaceAcrossLanguages()throws Exception{
        db.putContact(KEY,"Photo");db.setContactPayAddr(KEY,"MxLanguageFixtureAddress");
        AtomicReference<ChatThreadActivity> first=new AtomicReference<>();AtomicReference<EditText> draft=new AtomicReference<>(),amount=new AtomicReference<>();AtomicReference<AlertDialog> sheet=new AtomicReference<>();
        try(ActivityScenario<ChatThreadActivity> screen=nativeScreen()){
            screen.onActivity(a->{first.set(a);draft.set(a.findViewById(R.id.chat_input));draft.get().setText(RAW);draft.get().setSelection(3,8);invoke(a,"startPayment",new Class<?>[]{});sheet.set(dialog(a));amount.set(sheet.get().findViewById(R.id.pay_amount));amount.get().setText(AMOUNT);amount.get().setSelection(2,6);});
            for(String code:CODES){select(code);screen.onActivity(a->{assertSame(first.get(),a);assertSame(draft.get(),a.findViewById(R.id.chat_input));assertSame(sheet.get(),dialog(a));
                assertEquals(RAW,draft.get().getText().toString());assertEquals(3,draft.get().getSelectionStart());assertEquals(8,draft.get().getSelectionEnd());assertEquals(AMOUNT,amount.get().getText().toString());assertEquals(2,amount.get().getSelectionStart());assertEquals(6,amount.get().getSelectionEnd());
                assertEquals(text(l10n_chat_message),draft.get().getHint().toString());assertEquals(text(l10n_chat_amount_minima),amount.get().getHint().toString());
                assertEquals("MxLanguageFixtureAddress",value(sheet.get().getWindow().getDecorView(),R.id.pay_to));assertEquals(text(l10n_wallet_send),sheet.get().getButton(-1).getText().toString());
                Toolbar bar=a.findViewById(R.id.chat_thread_toolbar);assertEquals("Photo",bar.getTitle().toString());assertEquals(text(l10n_chat_delete_chat),bar.getMenu().findItem(R.id.chatmenu_clear).getTitle().toString());
                assertEquals(text(l10n_chat_attach),a.findViewById(R.id.chat_attach).getContentDescription().toString());assertTrue(db.thread(KEY).isEmpty());
            });onView(withText(text(l10n_chat_real_funds))).inRoot(isDialog()).check(matches(isDisplayed()));}
            snapshot("thread-payment-uk");onView(withId(android.R.id.button2)).inRoot(isDialog()).perform(click());settle();
            screen.onActivity(a->{Toolbar bar=a.findViewById(R.id.chat_thread_toolbar);invoke(a,"onMenu",new Class<?>[]{android.view.MenuItem.class},bar.getMenu().findItem(R.id.chatmenu_rename));sheet.set(dialog(a));input(sheet.get().getWindow().getDecorView()).setText(RAW);input(sheet.get().getWindow().getDecorView()).setSelection(2,5);});
            for(String code:CODES){select(code);screen.onActivity(a->{assertSame(sheet.get(),dialog(a));EditText edit=input(sheet.get().getWindow().getDecorView());assertEquals(RAW,edit.getText().toString());assertEquals(2,edit.getSelectionStart());assertEquals(5,edit.getSelectionEnd());assertEquals(RAW,draft.get().getText().toString());});}
            onView(withId(android.R.id.button2)).inRoot(isDialog()).perform(click());settle();assertEquals("Photo",db.contactName(KEY));
            screen.onActivity(a->{a.findViewById(R.id.chat_attach).performClick();sheet.set(dialog(a));});
            for(String code:CODES){select(code);onView(withText(text(l10n_chat_pay_action))).inRoot(isDialog()).check(matches(isDisplayed()));onView(withText(text(l10n_chat_request_pay))).inRoot(isDialog()).check(matches(isDisplayed()));}
        }
        assertFalse(sheet.get().isShowing());assertTrue(db.thread(KEY).isEmpty());
    }
    @Test public void nativeMessageRowsKeepAmountsLinksAndCopyValuesLiteral()throws Exception{
        db.putContact(KEY,null);long now=System.currentTimeMillis();add("text","",RAW,LINK,now);add("payment","payment","","",now+1);add("audio","audio","0:42|abcf","keets://language-fixture/never-played",now+2);
        AtomicReference<View> plain=new AtomicReference<>(),payment=new AtomicReference<>();
        try(ActivityScenario<ChatThreadActivity> screen=nativeScreen()){
            settle();for(String code:CODES){select(code);screen.onActivity(a->{
                ListView list=a.findViewById(R.id.chat_msgs);assertEquals(4,list.getAdapter().getCount());
                assertEquals(text(l10n_date_today),value(list.getAdapter().getView(0,null,list),R.id.date_text));
                View textRow=list.getAdapter().getView(1,null,list);plain.set(textRow);assertEquals(RAW,value(textRow,R.id.msg_body));assertEquals(text(l10n_chat_attachment_copy),value(textRow,R.id.msg_attach));
                View payRow=list.getAdapter().getView(2,null,list);payment.set(payRow);assertEquals("💸 "+text(l10n_chat_payment_sent)+"\n"+AMOUNT+" "+TOKEN,value(payRow,R.id.msg_body));
                assertEquals(text(l10n_chat_tap_txid),value(payRow,R.id.msg_attach));
                // Recycle a translated payment row into literal user text, then switch language again.
                View recycled=list.getAdapter().getView(1,payRow,list);assertEquals(RAW,value(recycled,R.id.msg_body));Language.refresh();assertEquals(RAW,value(recycled,R.id.msg_body));
                payment.set(list.getAdapter().getView(2,null,list));
                View audio=list.getAdapter().getView(3,null,list);assertEquals("0:42",value(audio,R.id.msg_audio_time));assertEquals(text(l10n_chat_play_voice),audio.findViewById(R.id.msg_audio_btn).getContentDescription().toString());
                assertEquals("1:05",VoiceRecordDialog.fmtSecs(65));assertEquals(text(l10n_chat_new_contact),((Toolbar)a.findViewById(R.id.chat_thread_toolbar)).getTitle().toString());
            });}
            snapshot("thread-messages-uk");
            screen.onActivity(a->{plain.get().findViewById(R.id.msg_attach).performClick();assertEquals(LINK,clipboard());payment.get().findViewById(R.id.msg_attach).performClick();});
            for(String code:CODES){select(code);onView(withText(TXID)).inRoot(isDialog()).check(matches(isDisplayed()));}
            onView(withId(android.R.id.button1)).inRoot(isDialog()).perform(click());settle();assertEquals(TXID,clipboard());
            screen.onActivity(a->plain.get().findViewById(R.id.msg_bubble).performLongClick());
            for(String code:CODES){select(code);onView(withText(text(l10n_chat_copy_text))).inRoot(isDialog()).check(matches(isDisplayed()));}
            onView(withText(text(l10n_chat_copy_text))).inRoot(isDialog()).perform(click());settle();assertEquals(RAW,clipboard());assertEquals(3,db.thread(KEY).size());
        }
    }
    private ChatEngine.Entry entry(String body)throws Exception{java.lang.reflect.Constructor<ChatEngine.Entry> c=ChatEngine.Entry.class.getDeclaredConstructor(String.class,String.class,String.class,String.class,String.class,long.class,boolean.class,String.class);c.setAccessible(true);return c.newInstance("thread-fixture","peer","","self",body,System.currentTimeMillis(),true,"read");}
    @Test public void parlonsDraftTypedRowsAndOpenMenuSurviveWithoutStartingTransport()throws Exception{
        ArrayList<Object> items=new ArrayList<>();items.add(System.currentTimeMillis());items.add(entry(RAW));items.add(entry(ChatMedia.wrap("video/mp4","mx1_fixture",RAW)));items.add(entry(ChatPay.wrap(AMOUNT,TOKEN,TXID,"memo")));
        AtomicReference<MaxThreadActivity> first=new AtomicReference<>();AtomicReference<EditText> draft=new AtomicReference<>();AtomicReference<AlertDialog> sheet=new AtomicReference<>();
        try(ActivityScenario<MaxThreadActivity> screen=ActivityScenario.launch(new Intent(context,MaxThreadActivity.class).putExtra("peer","language-fixture-unpaired"))){
            screen.onActivity(a->{first.set(a);draft.set(a.findViewById(R.id.chat_input));draft.get().setText(RAW);draft.get().setSelection(2,7);Object adapter=field(a,"mAdapter");field(adapter,"mItems",items);((BaseAdapter)adapter).notifyDataSetChanged();a.findViewById(R.id.chat_attach).performClick();sheet.set(dialog(a));});
            for(String code:CODES){select(code);screen.onActivity(a->{assertSame(first.get(),a);assertSame(sheet.get(),dialog(a));assertEquals(RAW,draft.get().getText().toString());assertEquals(2,draft.get().getSelectionStart());assertEquals(7,draft.get().getSelectionEnd());
                Toolbar bar=a.findViewById(R.id.chat_thread_toolbar);assertEquals(text(l10n_chat_parlons_contact),bar.getTitle().toString());assertEquals(text(l10n_chat_delete_contact),bar.getMenu().findItem(R.id.maxmenu_delete).getTitle().toString());
                ListView list=a.findViewById(R.id.chat_msgs);assertEquals(text(l10n_date_today),value(list.getAdapter().getView(0,null,list),R.id.date_text));assertEquals(RAW,value(list.getAdapter().getView(1,null,list),R.id.msg_body));assertEquals(text(l10n_media_video_caption,RAW),value(list.getAdapter().getView(2,null,list),R.id.msg_body));assertEquals("💸 "+AMOUNT+" "+TOKEN,value(list.getAdapter().getView(3,null,list),R.id.msg_body));assertNull(MaxChat.node());
            });onView(withText(text(l10n_media_voice))).inRoot(isDialog()).check(matches(isDisplayed()));}
            screen.onActivity(a->sheet.get().dismiss());settle();snapshot("thread-parlons-uk");
            screen.onActivity(a->{a.findViewById(R.id.chat_send).performClick();assertEquals(RAW,draft.get().getText().toString());Toolbar bar=a.findViewById(R.id.chat_thread_toolbar);a.onOptionsItemSelected(bar.getMenu().findItem(R.id.maxmenu_clear));sheet.set(dialog(a));});
            for(String code:CODES){select(code);onView(withText(text(l10n_chat_clear_thread))).inRoot(isDialog()).check(matches(isDisplayed()));}
        }
        assertFalse(sheet.get().isShowing());assertNull(MaxChat.node());
    }
    @Test public void photoViewerPreservesCaptionBitmapAndZoomWhileMenuChanges()throws Exception{
        photoFile=ChatImages.file(context,PHOTO);assertFalse(photoFile.exists());android.graphics.Bitmap bm=android.graphics.Bitmap.createBitmap(32,24,android.graphics.Bitmap.Config.ARGB_8888);bm.eraseColor(android.graphics.Color.BLUE);
        try(java.io.FileOutputStream out=new java.io.FileOutputStream(photoFile)){assertTrue(bm.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out));}finally{bm.recycle();}
        AtomicReference<ChatImageActivity> first=new AtomicReference<>();AtomicReference<ZoomImageView> image=new AtomicReference<>();float[] expected=new float[9];
        try(ActivityScenario<ChatImageActivity> screen=ActivityScenario.launch(new Intent(context,ChatImageActivity.class).putExtra("ref",PHOTO).putExtra("caption",RAW))){
            settle();screen.onActivity(a->{first.set(a);image.set(a.findViewById(R.id.imgview_photo));assertNotNull(image.get().getDrawable());android.graphics.Matrix matrix=new android.graphics.Matrix(image.get().getImageMatrix());matrix.postScale(1.5f,1.5f);matrix.postTranslate(4,8);image.get().setImageMatrix(matrix);matrix.getValues(expected);});
            for(String code:CODES){select(code);screen.onActivity(a->{assertSame(first.get(),a);assertSame(image.get(),a.findViewById(R.id.imgview_photo));assertEquals(RAW,value(a.findViewById(android.R.id.content),R.id.imgview_caption));assertEquals(text(l10n_chat_photo),image.get().getContentDescription().toString());float[] actual=new float[9];image.get().getImageMatrix().getValues(actual);assertArrayEquals(expected,actual,0.0001f);Toolbar bar=a.findViewById(R.id.imgview_toolbar);assertEquals(text(l10n_chat_save_photos),bar.getMenu().findItem(R.id.imgmenu_save).getTitle().toString());});}
            snapshot("thread-photo-uk");
        }
        try(ActivityScenario<ChatImageActivity> screen=ActivityScenario.launch(new Intent(context,ChatImageActivity.class).putExtra("ref","invalid-fixture-no-network"))){
            settle();for(String code:CODES){select(code);screen.onActivity(a->{TextView error=a.findViewById(R.id.imgview_error);assertEquals(View.VISIBLE,error.getVisibility());assertEquals(text(l10n_chat_photo_load_error),error.getText().toString());});}
        }
    }
}
