package com.eurobuddha.minimacore.chat;

import android.app.Application;
import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.maxima.core.chat.ChatFile;
import com.eurobuddha.maxima.files.KeetsFiles;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

/** Real native sheet and schema, synthetic offers only; no node or outgoing messages. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=34,application=Application.class)
public class ChatFilesTest {
    private AppCompatActivity activity;private ChatFiles files;
    private final String peer="0x"+"1".repeat(64);
    @Before public void setup(){
        Language.initialize(RuntimeEnvironment.getApplication(),()->false);
        activity=Robolectric.buildActivity(AppCompatActivity.class).get();activity.setTheme(R.style.Theme_MinimaCore);
        files=new ChatFiles(activity,peer,()->{});
    }
    @After public void close(){files.close();Language.select(RuntimeEnvironment.getApplication(),"en");}
    private ChatFile offer(){String id="a".repeat(32);return new ChatFile(id,"test file.bin","application/octet-stream",100*1024*1024,
            "b".repeat(64),"c".repeat(16),"d".repeat(64),"keets://"+"e".repeat(64)+"/private/"+id+"/manifest?hash="+"f".repeat(64));}
    private static Button button(View v,String text){
        if(v instanceof Button && text.equals(((Button)v).getText().toString()))return (Button)v;
        if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++){Button b=button(((ViewGroup)v).getChildAt(i),text);if(b!=null)return b;}return null;
    }
    @Test public void displayingOfferDoesNotDownloadAndUnverifiedFileCannotBeSaved()throws Exception {
        ChatFile f=offer();files.showOffer(f.ref());
        Field dialogs=ChatFiles.class.getDeclaredField("dialogs");dialogs.setAccessible(true);
        Set<?> shown=(Set<?>)dialogs.get(files);assertEquals(1,shown.size());AlertDialog d=(AlertDialog)shown.iterator().next();
        View root=d.getWindow().getDecorView();
        Button save=button(root,Language.text(activity,R.string.chat_files_save));assertNotNull(save);assertFalse(save.isEnabled());
        Button download=button(root,Language.text(activity,R.string.chat_files_download));assertNotNull(download);assertTrue(download.isEnabled());
        assertFalse(Files.exists(activity.getFilesDir().toPath().resolve("chat-files").resolve(f.id)));
        files.close();assertFalse(d.isShowing());
    }
    @Test public void pickerAcceptsArbitraryDocumentsRatherThanOnlyImages(){
        files.pick();Intent i=Shadows.shadowOf(activity).getNextStartedActivity();
        assertEquals(Intent.ACTION_OPEN_DOCUMENT,i.getAction());assertEquals("*/*",i.getType());assertTrue(i.hasCategory(Intent.CATEGORY_OPENABLE));
    }
    @Test public void explicitPauseAtPreparationBoundaryIsPreserved()throws Exception {
        Class<?> type=Class.forName(ChatFiles.class.getName()+"$Transfer");
        Constructor<?> constructor=type.getDeclaredConstructor(ChatFile.class,Path.class,String.class,boolean.class);constructor.setAccessible(true);
        Object t=constructor.newInstance(offer(),activity.getFilesDir().toPath().resolve("not-created"),peer,true);
        Field running=type.getDeclaredField("running");running.setAccessible(true);running.setBoolean(t,true);
        Field paused=type.getDeclaredField("paused");paused.setAccessible(true);((AtomicBoolean)paused.get(t)).set(true);
        Method next=ChatFiles.class.getDeclaredMethod("continuePrepared",type);next.setAccessible(true);next.invoke(files,t);
        assertFalse(running.getBoolean(t));assertTrue(((AtomicBoolean)paused.get(t)).get());
    }
    @Test public void nativeWireDecoderPreservesFileOfferExactly()throws Exception {
        ChatFile f=offer();org.minima.utils.json.JSONObject wire=ChatSchema.base("sender",f.name,f.ref());wire.put("state","file");
        ChatSchema.Decoded d=ChatSchema.decode(wire.toString());assertEquals("file",d.state);assertEquals(f.ref(),d.ref);
        KeetsFiles.validate(ChatFile.parse(d.ref));assertEquals(f.name,d.body);
    }
}
