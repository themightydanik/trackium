package com.eurobuddha.minimacore.chat;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.widget.*;
import androidx.appcompat.app.AlertDialog;
import com.eurobuddha.maxima.core.chat.ChatFile;
import com.eurobuddha.maxima.files.FileCrypto;
import com.eurobuddha.maxima.files.KeetsFiles;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/** Native explicit-download file sheet, adapted from Parlons PrivateFileUi.
 * Same sealed offer and AES-GCM implementation on both sides. Only verified files can be saved.
 * Accepted downloads and outgoing preparations persist; closing the activity pauses work. */
final class ChatFiles implements AutoCloseable {
    static final int PICK=941,SAVE=942;
    private final Activity activity;
    private final String peer;
    private final Runnable refresh;
    private final Path root;
    private final ChatKeetsTransport transport;
    private ChatFileDelivery delivery(){return ChatFileDelivery.get(activity);}
    private final ExecutorService jobs=Executors.newSingleThreadExecutor();
    private final ExecutorService catalog=Executors.newSingleThreadExecutor();
    private final Set<AlertDialog> dialogs=new HashSet<>();
    private final Set<Transfer> active=ConcurrentHashMap.newKeySet();
    // Fixed-size locks also cover two activity instances during a screen transition.
    private static final Object[] DISK_LOCKS=new Object[64];
    static {for(int i=0;i<DISK_LOCKS.length;i++)DISK_LOCKS[i]=new Object();}
    private static Object disk(Transfer t){return DISK_LOCKS[Math.floorMod(t.file.id.hashCode(),DISK_LOCKS.length)];}
    private volatile boolean closed;
    private Transfer saving;
    private static final class Transfer {
        volatile ChatFile file;final Path dir;final String peer;final boolean mine;
        String msgid;long ts;volatile boolean sent;boolean prepared=true;
        volatile boolean running;volatile long done;volatile String error="";
        final AtomicBoolean paused=new AtomicBoolean(true);
        Transfer(ChatFile f,Path d,String p,boolean m){file=f;dir=d;peer=p;mine=m;msgid="kf-"+f.id;ts=System.currentTimeMillis();}
    }
    ChatFiles(Activity a,String p,Runnable r){activity=a;peer=p;refresh=r;root=a.getFilesDir().toPath().resolve("chat-files");transport=new ChatKeetsTransport(a);ChatFileDelivery.get(a);}
    private String text(int id){return Language.text(activity,id);}
    void pick(){activity.startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE),PICK);}
    boolean result(int request,int result,Intent data){
        if(request!=PICK && request!=SAVE)return false;
        if(result!=Activity.RESULT_OK || data==null || data.getData()==null)return true;
        Uri uri=data.getData();if(request==PICK)prepare(uri);else if(saving!=null)export(uri,saving);return true;
    }
    private void post(Runnable r){activity.runOnUiThread(()->{if(!closed&&!activity.isFinishing()&&!activity.isDestroyed())r.run();});}
    private AlertDialog track(AlertDialog d){dialogs.add(d);d.setOnDismissListener(x->dialogs.remove(d));return d;}
    private void error(Exception e){post(()->track(new LanguageDialog(activity).setTitle(R.string.chat_files_title)
            .setMessage(e.getMessage()==null?text(R.string.chat_files_failed):e.getMessage()).setPositiveButton(android.R.string.ok,null).show()));}
    private void capacity(long size)throws Exception {
        if(size<0 || size>ChatFile.TRANSFER_MAX_BYTES)throw new IOException(text(R.string.chat_files_limit));
        Files.createDirectories(root);int count=0;long used=0;
        try(java.util.stream.Stream<Path> paths=Files.list(root)){
            for(Path p:(Iterable<Path>)paths::iterator){if(!Files.isDirectory(p))continue;count++;
                try{used+=2*FileCrypto.cipherSize(read(p).file.size);}catch(Exception e){used+=ChatFile.TRANSFER_MAX_BYTES*2;}}
        }
        if(count>=32 || used+2*FileCrypto.cipherSize(size)>2L*1024*1024*1024
                || root.toFile().getUsableSpace()<2*FileCrypto.cipherSize(size)+32*1024*1024)
            throw new IOException(text(R.string.chat_files_storage));
    }
    private void prepare(Uri uri){
        jobs.execute(()->{
            Transfer t=null;
            try {
                String name="file",mime=activity.getContentResolver().getType(uri);long size=-1;
                try(android.database.Cursor c=activity.getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null)){
                    if(c!=null&&c.moveToFirst()){name=c.getString(0);if(!c.isNull(1))size=c.getLong(1);}}
                capacity(size);String id=FileCrypto.randomHex(16);
                ChatFile initial=new ChatFile(id,name,mime==null?"application/octet-stream":mime,size,FileCrypto.randomHex(32),FileCrypto.randomHex(8),"0000000000000000000000000000000000000000000000000000000000000000","");
                t=new Transfer(initial,root.resolve(id),peer,true);t.prepared=false;Files.createDirectory(t.dir);write(t);
                final Transfer transfer=t;t.running=true;t.paused.set(false);active.add(t);post(()->show(transfer));
                String digest;
                try(Awake awake=new Awake(activity);InputStream in=activity.getContentResolver().openInputStream(uri)){
                    if(in==null)throw new IOException(text(R.string.chat_files_failed));
                    digest=FileCrypto.encrypt(in,t.dir.resolve("payload.bin"),id,size,initial.key,initial.nonce,()->closed||transfer.paused.get(),n->transfer.done=n);
                }
                t.file=new ChatFile(id,name,initial.mime,size,initial.key,initial.nonce,digest,"");t.prepared=true;write(t);
                continuePrepared(t);
            }catch(Exception e){if(t!=null){t.running=false;t.error=e.getMessage()==null?text(R.string.chat_files_failed):e.getMessage();active.remove(t);if(!Files.exists(t.dir.resolve("offer.json")))erase(t.dir);}error(e);}
        });
    }
    private void write(Transfer t)throws Exception {
        JSONObject j=new JSONObject().put("ref",t.file.ref()).put("peer",t.peer).put("mine",t.mine).put("msgid",t.msgid).put("ts",t.ts).put("sent",t.sent).put("prepared",t.prepared);
        Path tmp=t.dir.resolve("offer.tmp");Files.write(tmp,j.toString().getBytes(StandardCharsets.UTF_8));Files.move(tmp,t.dir.resolve("offer.json"),StandardCopyOption.REPLACE_EXISTING);
    }
    private Transfer read(Path dir)throws Exception {
        Path path=dir.resolve("offer.json");if(Files.size(path)>100000)throw new IOException("Invalid file state");
        JSONObject j=new JSONObject(new String(Files.readAllBytes(path),StandardCharsets.UTF_8));ChatFile f=ChatFile.parse(j.getString("ref"));
        if(!dir.getFileName().toString().equals(f.id))throw new IOException("Invalid file state");
        Transfer t=new Transfer(f,dir,j.getString("peer"),j.getBoolean("mine"));t.sent=j.optBoolean("sent");t.prepared=j.optBoolean("prepared",true);t.msgid=j.getString("msgid");t.ts=j.getLong("ts");if(ready(t))t.done=f.size;return t;
    }
    void showOffer(String ref){
        try{
            ChatFile f=ChatFile.parse(ref);KeetsFiles.validate(f);
            for(Transfer t:active)if(t.file.id.equals(f.id)){show(t);return;}
            Path dir=root.resolve(f.id);Transfer t=Files.exists(dir.resolve("offer.json"))?read(dir):new Transfer(f,dir,peer,false);
            if(!t.peer.equals(peer)||!t.file.ref().equals(ref))throw new IOException("Conflicting file offer");show(t);
        }catch(Exception e){error(e);}
    }
    void transfers(){catalog.execute(()->{
        try{
            List<Transfer> list=new ArrayList<>();if(Files.isDirectory(root))try(java.util.stream.Stream<Path> dirs=Files.list(root)){
                for(Path dir:(Iterable<Path>)dirs::iterator)try{Transfer t=read(dir);if(t.peer.equals(peer)){
                    for(Transfer a:active)if(a.file.id.equals(t.file.id)){t=a;break;}list.add(t);
                }}catch(Exception ignored){}
            }
            post(()->{if(list.isEmpty()){Toast.makeText(activity,R.string.chat_files_none,Toast.LENGTH_SHORT).show();return;}
                CharSequence[] names=list.stream().map(t->t.file.name).toArray(CharSequence[]::new);
                track(new LanguageDialog(activity).setTitle(R.string.chat_files_title).setItems(names,(d,w)->show(list.get(w))).setNegativeButton(Language.msg(com.eurobuddha.minimacore.i18n.R.string.l10n_language_close),null).show());});
        }catch(Exception e){error(e);}
    });}
    private boolean ready(Transfer t){return Files.isRegularFile(t.dir.resolve("verified.bin"))&&t.dir.resolve("verified.bin").toFile().length()==t.file.size;}
    private void show(Transfer t){
        LinearLayout box=new LinearLayout(activity);box.setOrientation(LinearLayout.VERTICAL);int pad=(int)(20*activity.getResources().getDisplayMetrics().density);box.setPadding(pad,pad,pad,pad);
        TextView info=new TextView(activity);box.addView(info);
        ProgressBar progress=new ProgressBar(activity,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);box.addView(progress);
        Button action=new Button(activity);box.addView(action);Button save=new Button(activity);Language.setText(save,Language.msg(R.string.chat_files_save));box.addView(save);
        CheckBox keep=new CheckBox(activity);Language.setText(keep,Language.msg(com.eurobuddha.minimacore.i18n.R.string.l10n_files_keep_sharing));keep.setVisibility(t.mine?android.view.View.VISIBLE:android.view.View.GONE);box.addView(keep);
        keep.setChecked("true".equals(delivery().status(t.file.id).get("keepSharing")));
        keep.setOnClickListener(v->{boolean selected=keep.isChecked();jobs.execute(()->{try{delivery().keep(t.file.id,selected);if(selected)transport.sharing(t.file,true);}catch(Exception e){error(e);}});});
        Button again=new Button(activity);Language.setText(again,Language.msg(com.eurobuddha.minimacore.i18n.R.string.l10n_files_share_again));again.setVisibility(t.mine?android.view.View.VISIBLE:android.view.View.GONE);box.addView(again);
        again.setOnClickListener(v->jobs.execute(()->{try{delivery().keep(t.file.id,true);transport.sharing(t.file,true);post(()->keep.setChecked(true));}catch(Exception e){error(e);}}));
        Button remove=new Button(activity);Language.setText(remove,Language.msg(R.string.chat_files_remove));box.addView(remove);
        AlertDialog dialog=track(new LanguageDialog(activity).setTitle(t.file.name).setView(box).setNegativeButton(Language.msg(com.eurobuddha.minimacore.i18n.R.string.l10n_language_close),null).show());
        android.os.Handler handler=new android.os.Handler(android.os.Looper.getMainLooper());Runnable[] tick=new Runnable[1];
        tick[0]=()->{if(closed||!dialog.isShowing())return;boolean done=ready(t);
            info.setText((t.error.isEmpty()?text(done?R.string.chat_files_ready:t.running?R.string.chat_files_working:R.string.chat_files_help):t.error)+"\n"+String.format(java.util.Locale.ROOT,"%.1f / %.1f MB",t.done/1048576.0,t.file.size/1048576.0));
            Map<String,String> receipt=delivery().status(t.file.id);
            if(t.mine&&receipt.containsKey("delivery"))info.append("\n"+deliveryText(receipt.get("delivery"))+(receipt.containsKey("deliveryError")?"\n"+receipt.get("deliveryError"):""));
            again.setEnabled("true".equals(receipt.get("sharingStopped")));
            progress.setProgress((int)(100*t.done/Math.max(1,t.file.size)));save.setEnabled(done);remove.setEnabled(!t.running);
            Language.setText(action,Language.msg(t.running?R.string.chat_files_pause:t.mine?R.string.chat_files_send:R.string.chat_files_download));action.setEnabled(!(done&&(!t.mine||t.sent)));
            handler.postDelayed(tick[0],400);
        };tick[0].run();
        action.setOnClickListener(v->{if(t.running)t.paused.set(true);else run(t);});
        save.setOnClickListener(v->{saving=t;activity.startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType(t.file.mime).addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,t.file.name),SAVE);});
        remove.setOnClickListener(v->{if(!t.running){jobs.execute(()->{synchronized(disk(t)){try{if(t.file.isKeets())transport.forget(t.file);delivery().forget(t.file.id);erase(t.dir);active.remove(t);}catch(Exception e){error(e);}}});dialog.dismiss();}});
    }
    private synchronized void continuePrepared(Transfer t){
        t.running=false;
        if(closed||t.paused.get()){active.remove(t);return;}
        enqueue(t,false);
    }
    private synchronized void run(Transfer t){enqueue(t,true);}
    private void enqueue(Transfer t,boolean resume){
        if(closed||t.running)return;t.running=true;if(resume)t.paused.set(false);t.error="";active.add(t);
        jobs.execute(()->{
            synchronized(disk(t)) {
            try(Awake awake=new Awake(activity)){
                if(closed||t.paused.get())throw new InterruptedIOException(text(R.string.chat_files_paused));
                if(!t.prepared)throw new IOException(text(R.string.chat_files_incomplete));
                if(!ChatDb.get(activity).hasContact(t.peer))throw new IOException(text(R.string.chat_files_contact));
                if(Files.exists(t.dir.resolve("offer.json"))) {
                    Transfer saved=read(t.dir);
                    if(!saved.peer.equals(t.peer)||saved.mine!=t.mine||!saved.file.ref().equals(t.file.ref()))
                        throw new IOException("File state changed. Close this sheet and reopen the file transfer.");
                    t.sent|=saved.sent;
                }else if(Files.exists(t.dir))throw new IOException(text(R.string.chat_files_incomplete));
                else{capacity(t.file.size);Files.createDirectory(t.dir);write(t);}
                java.util.function.BooleanSupplier cancelled=()->closed||t.paused.get();
                if(t.mine){
                    if(!t.file.isKeets()){t.done=0;t.file=KeetsFiles.publish(transport,t.dir.resolve("payload.bin"),t.file,cancelled,n->t.done=n);write(t);}
                    delivery().register(t.file,t.dir,t.mine,t.peer);
                    if(!ready(t))FileCrypto.decrypt(t.dir.resolve("payload.bin"),t.dir.resolve("verified.bin"),t.file,cancelled);
                    if(cancelled.getAsBoolean())throw new InterruptedIOException(text(R.string.chat_files_paused));
                    if(!t.sent){
                        String name=activity.getSharedPreferences("main_prefs",Activity.MODE_PRIVATE).getString("chat_name","");
                        org.minima.utils.json.JSONObject wire=ChatSchema.base(name,t.file.name,t.file.ref());wire.put("id",t.msgid);wire.put("ts",t.ts);wire.put("state","file");
                        ChatDb.Msg m=new ChatDb.Msg();m.msgid=t.msgid;m.pubkey=t.peer;m.incoming=false;m.body=t.file.name;m.name=name;m.ref=t.file.ref();m.state="file";m.ts=t.ts;m.read=true;m.via="";
                        ChatDb.get(activity).addMessage(m);post(refresh);
                        try{transport.send(t.peer,wire.toString());ChatDb.get(activity).setVia(t.msgid,transport.via);t.sent=true;write(t);}
                        catch(Exception e){ChatDb.get(activity).setVia(t.msgid,"FAILED");throw e;}
                    }
                }else {
                    delivery().register(t.file,t.dir,t.mine,t.peer);
                    if(!ready(t))KeetsFiles.download(transport,t.file,t.dir,cancelled,n->t.done=n);
                    delivery().verified(t.file.id);
                }
                t.done=t.file.size;
            }catch(Exception e){t.error=e.getMessage()==null?text(R.string.chat_files_failed):e.getMessage();}
            finally{t.running=false;t.paused.set(true);active.remove(t);post(refresh);}
            }
        });
    }
    private String deliveryText(String state){
        int id;
        switch(state){
            case "Downloaded and verified · sharing stopped":id=com.eurobuddha.minimacore.i18n.R.string.l10n_files_downloaded_stopped;break;
            case "Downloaded and verified · sharing":id=com.eurobuddha.minimacore.i18n.R.string.l10n_files_downloaded_sharing;break;
            case "Waiting for verified download":id=com.eurobuddha.minimacore.i18n.R.string.l10n_files_awaiting_download;break;
            default:id=com.eurobuddha.minimacore.i18n.R.string.l10n_files_confirmation_unavailable;
        }
        return Language.text(activity,id);
    }
    private void export(Uri uri,Transfer t){jobs.execute(()->{
        try(Awake awake=new Awake(activity)){
            if(!ready(t))throw new IOException(text(R.string.chat_files_failed));
            try(InputStream in=Files.newInputStream(t.dir.resolve("verified.bin"));OutputStream out=activity.getContentResolver().openOutputStream(uri,"w")){
                if(out==null)throw new IOException(text(R.string.chat_files_failed));byte[] b=new byte[65536];int n;
                while((n=in.read(b))!=-1){if(closed)throw new InterruptedIOException();out.write(b,0,n);}
            }post(()->Toast.makeText(activity,R.string.chat_files_saved,Toast.LENGTH_SHORT).show());
        }catch(Exception e){try{android.provider.DocumentsContract.deleteDocument(activity.getContentResolver(),uri);}catch(Exception ignored){}error(e);}
    });}
    private static void erase(Path dir){if(!Files.exists(dir))return;try(java.util.stream.Stream<Path> paths=Files.walk(dir)){
        for(Path p:(Iterable<Path>)paths.sorted(Comparator.reverseOrder())::iterator)Files.deleteIfExists(p);
    }catch(Exception ignored){}}
    private static final class Awake implements AutoCloseable {
        android.os.PowerManager.WakeLock lock;
        Awake(Activity activity){android.os.PowerManager pm=(android.os.PowerManager)activity.getSystemService(Activity.POWER_SERVICE);
            if(pm!=null){lock=pm.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK,"KeetChat:file-transfer");lock.acquire(20*60*1000L);}}
        public void close(){if(lock!=null&&lock.isHeld())lock.release();}
    }
    public void close(){closed=true;for(Transfer t:active)t.paused.set(true);jobs.shutdownNow();catalog.shutdownNow();for(AlertDialog d:new ArrayList<>(dialogs))d.dismiss();dialogs.clear();}
}
