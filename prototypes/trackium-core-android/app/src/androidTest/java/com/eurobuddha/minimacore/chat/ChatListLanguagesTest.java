package com.eurobuddha.minimacore.chat;

import android.content.Context;
import android.os.Build;
import android.view.View;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.TextView;
import androidx.appcompat.app.AlertDialog;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.ChatPreview;
import com.eurobuddha.minimacore.testing.CoreViewsHarnessActivity;
import com.eurobuddha.minimacore.maxchat.MaxChat;
import com.eurobuddha.maxima.core.chat.ChatMedia;
import com.eurobuddha.maxima.core.chat.ChatContact;
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

/** Disposable emulator only: synthetic local contacts/messages, no transport or peer actions. */
@RunWith(AndroidJUnit4.class)
public class ChatListLanguagesTest {
    private static final String[] CODES={"en","zh-Hans","ru","uk"};
    private static final String A="0x"+"ab".repeat(32), B="0x"+"cd".repeat(32), C="0x"+"ef".repeat(32);
    private static final String RAW="📷 Photo 中文 Привет Україна {count} $1";
    private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    private ChatDb db; private boolean prepared; private String priorName; private boolean hadName;
    private int nativeListeners,maxListeners;
    @Before public void prepare() {
        assertEquals("true",InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"));
        assertEquals("ranchu",Build.HARDWARE);assertNull(org.minima.system.Main.getInstance());assertNull(MaxChat.node());assertNull(MaxChat.chat());
        android.content.SharedPreferences prefs=context.getSharedPreferences("main_prefs",0);
        assertFalse(prefs.getBoolean("SEED_SET",false));assertFalse(prefs.contains("SEED"));
        hadName=prefs.contains("chat_name");priorName=prefs.getString("chat_name","");
        db=ChatDb.get(context);
        for(String key:new String[]{A,B,C}) { assertFalse(db.hasContact(key));assertTrue(db.thread(key).isEmpty()); }
        nativeListeners=ChatDrainer.UI_LISTENERS.size();maxListeners=MaxChat.UI_LISTENERS.size();
        prepared=true;select("en");
    }
    @After public void clean() {
        if(!prepared)return;
        for(String key:new String[]{A,B,C})db.removeContact(key);
        android.content.SharedPreferences.Editor editor=context.getSharedPreferences("main_prefs",0).edit();
        if(hadName)editor.putString("chat_name",priorName);else editor.remove("chat_name");editor.commit();
        assertNull(org.minima.system.Main.getInstance());assertNull(MaxChat.node());
        assertEquals(nativeListeners,ChatDrainer.UI_LISTENERS.size());assertEquals(maxListeners,MaxChat.UI_LISTENERS.size());select("en");
    }
    private void settle(){android.os.SystemClock.sleep(350);InstrumentationRegistry.getInstrumentation().waitForIdleSync();}
    private void select(String code){InstrumentationRegistry.getInstrumentation().runOnMainSync(()->Language.select(context,code));settle();}
    private String text(int id,Object... args){return Language.text(context,id,args);}
    private String value(View v,int id){return ((TextView)v.findViewById(id)).getText().toString();}
    private static Object field(Object target,String name){try{java.lang.reflect.Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}catch(Exception e){throw new AssertionError(e);}}
    @SuppressWarnings("unchecked") private static Set<AlertDialog> dialogs(ChatView page){return (Set<AlertDialog>)field(page,"dialogs");}
    private static AlertDialog dialog(ChatView page,int id){for(AlertDialog d:dialogs(page))if(d.isShowing()&&(id==0||d.findViewById(id)!=null))return d;throw new AssertionError("Missing dialog "+id);}
    private static void invoke(ChatView page,String name,ChatDb.Thread thread){try{java.lang.reflect.Method m=ChatView.class.getDeclaredMethod(name,ChatDb.Thread.class);m.setAccessible(true);m.invoke(page,thread);}catch(Exception e){throw new AssertionError(e);}}
    private ChatView show(CoreViewsHarnessActivity a){ChatView page=new ChatView(a);a.show(page);return page;}
    private void add(String pk,String id,String state,String body,long ts){
        ChatDb.Msg message=new ChatDb.Msg();message.pubkey=pk;message.msgid="chat-language-"+id;message.body=body;message.state=state;
        message.ts=ts;message.incoming=false;message.read=true;assertTrue(db.addMessage(message));
    }
    private void snapshot(String name)throws Exception{
        settle();
        java.io.File dir=new java.io.File(context.getExternalFilesDir(null),"language-tests");assertTrue(dir.isDirectory()||dir.mkdirs());
        android.graphics.Bitmap bitmap=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();assertNotNull(bitmap);
        try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(dir,name+".png"))){assertTrue(bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out));}finally{bitmap.recycle();}
    }
    @Test public void newChatKeepsInputsSelectionAndValidationAcrossLanguages()throws Exception{
        AtomicReference<ChatView> page=new AtomicReference<>();AtomicReference<AlertDialog> sheet=new AtomicReference<>();
        AtomicReference<CoreViewsHarnessActivity> first=new AtomicReference<>();AtomicReference<EditText> address=new AtomicReference<>(),name=new AtomicReference<>();
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)){
            screen.onActivity(a->{first.set(a);page.set(show(a));page.get().getMainView().findViewById(R.id.chat_fab).performClick();
                sheet.set(dialog(page.get(),R.id.newchat_address));address.set(sheet.get().findViewById(R.id.newchat_address));name.set(sheet.get().findViewById(R.id.newchat_name));
                address.get().setText("invalid 中文 {count}");name.get().setText(RAW);
            });settle();
            onView(withId(android.R.id.button1)).inRoot(isDialog()).perform(click());
            screen.onActivity(a->{address.get().setSelection(2,5);name.get().setSelection(3,8);});
            for(String code:CODES){select(code);screen.onActivity(a->{
                assertSame(first.get(),a);assertSame(sheet.get(),dialog(page.get(),R.id.newchat_address));
                assertEquals("invalid 中文 {count}",address.get().getText().toString());assertEquals(RAW,name.get().getText().toString());
                assertEquals(2,address.get().getSelectionStart());assertEquals(5,address.get().getSelectionEnd());
                assertEquals(3,name.get().getSelectionStart());assertEquals(8,name.get().getSelectionEnd());
                assertEquals(text(l10n_chat_bad_address),address.get().getError().toString());
                assertEquals(text(l10n_chat_address_hint),address.get().getHint().toString());
                assertEquals(text(l10n_chat_start_chat),sheet.get().getButton(-1).getText().toString());
                assertFalse(db.hasContact(A));
            });}
            // Exercise scanner routing without launching a scanner or accepting the address.
            screen.onActivity(a->{sheet.get().findViewById(R.id.newchat_scan).performClick();page.get().onScanResult("MAX#language-fixture");assertNull(address.get().getError());assertEquals("MAX#language-fixture",address.get().getText().toString());page.get().onScanResult(A);assertEquals(A,address.get().getText().toString());assertNull(address.get().getError());assertEquals(RAW,name.get().getText().toString());});
            snapshot("chat-new-uk");
            onView(withId(android.R.id.button2)).inRoot(isDialog()).perform(click());settle();
            screen.onActivity(a->{assertNull(field(page.get(),"mPendingScanTarget"));assertTrue(dialogs(page.get()).isEmpty());});
        }
    }
    @Test public void identityDraftAndOpenDialogSurviveLanguageSwitchAndCloseWithHost()throws Exception{
        AtomicReference<ChatView> page=new AtomicReference<>();AtomicReference<AlertDialog> sheet=new AtomicReference<>();AtomicReference<EditText> name=new AtomicReference<>();
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)){
            screen.onActivity(a->{page.set(show(a));page.get().getMainView().findViewById(R.id.chat_myaddress_row).performClick();sheet.set(dialog(page.get(),R.id.identity_name));name.set(sheet.get().findViewById(R.id.identity_name));name.get().setText(RAW);name.get().setSelection(2,6);});settle();
            for(String code:CODES){select(code);screen.onActivity(a->{
                assertSame(sheet.get(),dialog(page.get(),R.id.identity_name));assertEquals(RAW,name.get().getText().toString());assertEquals(2,name.get().getSelectionStart());assertEquals(6,name.get().getSelectionEnd());
                assertEquals(text(l10n_chat_node_starting),value(sheet.get().getWindow().getDecorView(),R.id.identity_address));
                assertEquals(text(l10n_chat_display_name),name.get().getHint().toString());
                assertEquals(text(l10n_wallet_copy_address),value(sheet.get().getWindow().getDecorView(),R.id.identity_copy));
            });onView(withText(text(l10n_chat_no_relay))).inRoot(isDialog()).check(matches(isDisplayed()));}
            snapshot("chat-identity-uk");
            onView(withId(android.R.id.button1)).inRoot(isDialog()).perform(click());settle();
            assertEquals(RAW,context.getSharedPreferences("main_prefs",0).getString("chat_name",""));
            screen.onActivity(a->{page.get().getMainView().findViewById(R.id.chat_myaddress_row).performClick();sheet.set(dialog(page.get(),R.id.identity_name));});
        }
        assertFalse(sheet.get().isShowing());assertTrue(dialogs(page.get()).isEmpty());
    }
    @Test public void typedPreviewsNeverTranslateUserTextAndDatabaseKeepsRawBodies()throws Exception{
        db.putContact(A,"📷 Photo");db.putContact(B,null);db.putContact(C,"Contact 中文");long now=System.currentTimeMillis();
        add(A,"raw","",RAW,now);add(B,"photo","image","caption 中文",now+1);add(C,"voice","audio","0:42|abcf",now+2);
        AtomicReference<ChatView> page=new AtomicReference<>();AtomicReference<CoreViewsHarnessActivity> first=new AtomicReference<>();
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)){
            screen.onActivity(a->{first.set(a);page.set(show(a));});settle();
            for(String code:CODES){select(code);screen.onActivity(a->{
                assertSame(first.get(),a);ListView list=page.get().getMainView().findViewById(R.id.chat_threads);
                TextView avatar=new TextView(a);
                for(String[] example:new String[][]{{"📷 Photo","📷"},{"中文","中"},{"Україна","У"},{"Привет","П"}}) {
                    ChatUi.avatar(avatar,example[0],A);assertEquals(example[1],avatar.getText().toString());
                }
                for(int i=0;i<list.getAdapter().getCount();i++){
                    ChatDb.Thread t=(ChatDb.Thread)list.getAdapter().getItem(i);View row=list.getAdapter().getView(i,null,list);
                    if(A.equals(t.pubkey)){assertEquals(RAW,t.lastBody);assertEquals("",t.lastState);assertEquals(RAW,value(row,R.id.row_last));assertEquals("📷 Photo",value(row,R.id.row_name));}
                    if(B.equals(t.pubkey)){assertEquals("caption 中文",t.lastBody);assertEquals(text(l10n_media_photo),value(row,R.id.row_last));assertEquals(text(l10n_chat_new_contact),value(row,R.id.row_name));}
                    if(C.equals(t.pubkey)){assertEquals("0:42|abcf",t.lastBody);assertEquals(text(l10n_media_voice),value(row,R.id.row_last));}
                }
                // These are the proven Parlons preview cases, now checked with real Android resources.
                for(String raw:new String[]{"Photo","Chats","📷 Photo","You: Привет 中文","\u0001m\u0001broken"})assertEquals(raw,ChatPreview.text(a,raw));
                assertEquals(text(l10n_media_photo_caption,"中文 Photo"),ChatPreview.text(a,ChatMedia.wrap("image/jpeg","mx1_ref","中文 Photo")));
                assertEquals(text(l10n_media_voice_caption,"0:42"),ChatPreview.text(a,ChatMedia.wrap("audio/webm","mx1_ref","0:42|abcf")));
                assertEquals(text(l10n_media_contact,"Photo"),ChatPreview.text(a,ChatContact.wrap("key","Photo","MAX#address")));
                String payment=ChatPay.wrap("1.2500000000000001","TOKEN","0x123","Оплата 中文");assertEquals(ChatPay.preview(payment),ChatPreview.text(a,payment));
                ChatDb.Thread max=new ChatDb.Thread();max.pubkey="max:fixture";max.lastMine=true;max.lastBody=ChatMedia.wrap("image/jpeg","mx1_ref",RAW);
                assertEquals(text(l10n_chat_you_preview,text(l10n_media_photo_caption,RAW)),ChatView.preview(max).toString());
                max.lastBody=RAW;assertEquals(text(l10n_chat_you_preview,RAW),ChatView.preview(max).toString());
                assertEquals(text(l10n_media_photo_caption,"中文"),ChatPreview.summary(a,"legacy","photo","中文"));
                assertEquals("📷 Photo",ChatPreview.summary(a,"📷 Photo","future","value"));
            });}
            snapshot("chat-list-uk");
        }
        assertEquals(RAW,db.thread(A).get(0).body);assertEquals("caption 中文",db.thread(B).get(0).body);assertEquals("0:42|abcf",db.thread(C).get(0).body);
    }
    @Test public void pickerAndLocalDeleteKeepRawNamesAndContactSemantics()throws Exception{
        db.putContact(A,RAW);db.putContact(B,null);add(A,"delete","",RAW,System.currentTimeMillis());
        AtomicReference<ChatView> page=new AtomicReference<>();AtomicReference<AlertDialog> picker=new AtomicReference<>();AtomicReference<EditText> search=new AtomicReference<>();
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)){
            screen.onActivity(a->{page.set(show(a));page.get().getMainView().findViewById(R.id.chat_fab).performClick();});settle();
            onView(withId(R.id.newchat_pick)).inRoot(isDialog()).perform(click());settle();
            screen.onActivity(a->{picker.set(dialog(page.get(),R.id.pick_search));search.set(picker.get().findViewById(R.id.pick_search));search.get().setText("中文");search.get().setSelection(1);});
            for(String code:CODES){select(code);screen.onActivity(a->{
                assertSame(picker.get(),dialog(page.get(),R.id.pick_search));assertEquals("中文",search.get().getText().toString());assertEquals(1,search.get().getSelectionStart());
                assertEquals(text(l10n_chat_search_contacts),search.get().getHint().toString());
                ListView list=picker.get().findViewById(R.id.pick_list);assertEquals(1,list.getAdapter().getCount());assertEquals(RAW,value(list.getAdapter().getView(0,null,list),R.id.row_name));
            });}
            screen.onActivity(a->{search.get().setText("no-match-fixture");assertEquals(text(l10n_chat_no_matches),value(picker.get().getWindow().getDecorView(),R.id.pick_empty));picker.get().dismiss();dialog(page.get(),R.id.newchat_address).dismiss();
                ChatDb.Thread t=db.contactList().stream().filter(x->A.equals(x.pubkey)).findFirst().get();invoke(page.get(),"clearChat",t);
            });settle();
            for(String code:CODES){select(code);onView(withText(text(l10n_chat_clear_named,RAW))).inRoot(isDialog()).check(matches(isDisplayed()));assertEquals(1,db.thread(A).size());}
            onView(withId(android.R.id.button1)).inRoot(isDialog()).perform(click());settle();assertTrue(db.thread(A).isEmpty());assertTrue(db.hasContact(A));
            screen.onActivity(a->{ChatDb.Thread t=db.contactList().stream().filter(x->A.equals(x.pubkey)).findFirst().get();invoke(page.get(),"deleteContact",t);});
            onView(withId(android.R.id.button2)).inRoot(isDialog()).perform(click());settle();assertTrue(db.hasContact(A));
            screen.onActivity(a->{ChatDb.Thread t=db.contactList().stream().filter(x->A.equals(x.pubkey)).findFirst().get();invoke(page.get(),"deleteContact",t);});
            onView(withId(android.R.id.button1)).inRoot(isDialog()).perform(click());settle();assertFalse(db.hasContact(A));assertTrue(db.hasContact(B));
        }
    }
}
