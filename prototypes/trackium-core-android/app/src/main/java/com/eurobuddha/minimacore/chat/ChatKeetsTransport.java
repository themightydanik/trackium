package com.eurobuddha.minimacore.chat;

import android.content.Context;
import com.eurobuddha.maxima.core.chat.KeetsTransport;
import com.eurobuddha.maxima.core.chat.KeetsMediaClient;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import org.minima.utils.json.JSONObject;
import java.io.*;
import java.nio.file.Files;

/** Reuses ChatThreadActivity's local file publish and Salon's bounded loopback read. */
final class ChatKeetsTransport implements KeetsTransport {
    private final Context app;
    private KeetsMediaClient media;
    String via="";
    ChatKeetsTransport(Context context){app=context.getApplicationContext();}
    private static JSONObject result(String command)throws Exception {
        JSONObject r=MinimaCMD.execute(command);
        if(!Boolean.TRUE.equals(r.get("status")))throw new IOException(String.valueOf(r.get("error")));
        return (JSONObject)r.get("response");
    }
    public boolean send(String peer,String payload)throws Exception {
        if(!peer.matches("(?i)0x[0-9a-f]{64}"))throw new IOException("Invalid contact");
        JSONObject r=result("keets action:send to:"+peer+" datahex:"+ChatSchema.toDataHex(payload));
        via=String.valueOf(r.get("delivered"));return true;
    }
    public String publish(String path,byte[] bytes)throws Exception {
        if(!path.matches("/private/[a-f0-9]{32}/(manifest|[0-9]+)"))throw new IOException("Invalid file path");
        File tmp=File.createTempFile("chat-file-",".bin",app.getCacheDir());
        try {
            Files.write(tmp.toPath(),bytes);
            return String.valueOf(result("keets action:publish path:"+path+" file:"+tmp.getAbsolutePath()).get("url"));
        }finally{tmp.delete();}
    }
    public byte[] fetch(String url)throws Exception{return fetch(url,8*1024*1024);}
    public void forget(com.eurobuddha.maxima.core.chat.ChatFile file)throws Exception {sharing(file,false);media.forget(file);}
    public void sharing(com.eurobuddha.maxima.core.chat.ChatFile file,boolean enabled)throws Exception {
        try {
            if(media==null){
                JSONObject info=result("keets action:info");
                if(!Boolean.TRUE.equals(info.get("boundedMedia")))throw new IOException("Update your Keets node to receive files");
                media=KeetsMediaClient.local(Integer.parseInt(String.valueOf(info.get("apiport"))),String.valueOf(result("status").get("data")));
            }
            media.sharing(file,enabled);
        }catch(Exception e){media=null;throw e;}
    }
    public byte[] fetch(String url,int max)throws Exception {
        try {
            if(media==null){
                JSONObject info=result("keets action:info");
                if(!Boolean.TRUE.equals(info.get("boundedMedia")))throw new IOException("Update your Keets node to receive files");
                media=KeetsMediaClient.local(Integer.parseInt(String.valueOf(info.get("apiport"))),String.valueOf(result("status").get("data")));
            }
            return media.fetch(url,max);
        }catch(Exception e){media=null;throw e;}
    }
}
