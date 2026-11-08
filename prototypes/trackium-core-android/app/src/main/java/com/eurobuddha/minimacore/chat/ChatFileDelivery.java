package com.eurobuddha.minimacore.chat;

import android.content.Context;
import com.eurobuddha.maxima.core.chat.*;
import com.eurobuddha.maxima.files.FileDelivery;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.JSONObject;

/** Account-lifetime receipt processing; never depends on an open chat activity. */
final class ChatFileDelivery {
    private static ChatFileDelivery instance;
    private final FileDelivery delivery;
    private final Context context;
    private final Path root;
    private final ScheduledExecutorService jobs=Executors.newSingleThreadScheduledExecutor();
    static synchronized ChatFileDelivery get(Context c){if(instance==null)instance=new ChatFileDelivery(c.getApplicationContext());return instance;}
    static synchronized void close(){if(instance!=null){instance.jobs.shutdownNow();instance=null;}}
    private ChatFileDelivery(Context c){
        context=c;root=c.getFilesDir().toPath().resolve("chat-files");ChatKeetsTransport transport=new ChatKeetsTransport(c);
        delivery=new FileDelivery((peer,body)->{if(ChatDb.get(c).hasContact(peer))transport.send(peer,KeetsWire.fileControl(body));},id->{
            JSONObject state=new JSONObject(new String(Files.readAllBytes(root.resolve(id).resolve("offer.json")),java.nio.charset.StandardCharsets.UTF_8));
            transport.sharing(ChatFile.parse(state.getString("ref")),false);
        });
        jobs.scheduleWithFixedDelay(()->{
            try{restore();delivery.tick();}catch(Exception ignored){}
        },1,5,TimeUnit.SECONDS);
    }
    private void restore()throws Exception {
        if(!Files.isDirectory(root))return;
        try(java.util.stream.Stream<Path> dirs=Files.list(root)){
            for(Path dir:(Iterable<Path>)dirs::iterator)try{
                if(!dir.getFileName().toString().matches("[a-f0-9]{32}"))continue;
                Path path=dir.resolve("offer.json");if(Files.size(path)>100000)continue;
                JSONObject j=new JSONObject(new String(Files.readAllBytes(path),java.nio.charset.StandardCharsets.UTF_8));ChatFile f=ChatFile.parse(j.getString("ref"));
                if(!f.id.equals(dir.getFileName().toString())||!f.isKeets()||!ChatDb.get(context).hasContact(j.getString("peer")))continue;
                register(f,dir,j.getBoolean("mine"),j.getString("peer"));
                if(!j.getBoolean("mine")&&Files.isRegularFile(dir.resolve("verified.bin"))&&Files.size(dir.resolve("verified.bin"))==f.size)delivery.verified(f.id);
            }catch(Exception ignored){}
        }
    }
    void register(ChatFile f,Path dir,boolean mine,String peer)throws Exception {delivery.register(f,dir,mine,Collections.singleton(peer));}
    void verified(String id)throws Exception{delivery.verified(id);}
    void inbound(String peer,String body)throws Exception{if(ChatDb.get(context).hasContact(peer)){restore();delivery.inbound(peer,body);}}
    Map<String,String> status(String id){return delivery.status(id);}
    void keep(String id,boolean keep)throws Exception{delivery.keep(id,keep);}
    void forget(String id){delivery.forget(id);}
}
