package com.eurobuddha.minimacore.chat;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;

import com.eurobuddha.minimacore.utils.MinimaCMD;

import org.minima.utils.json.JSONObject;

import java.io.File;
import java.util.function.Consumer;

/**
 * Shared chat photo loader: memory LRU + disk cache under cache/chatimg, fetched
 * P2P once via `keets action:fetch url: file:` (file hand-off — never megabyte
 * hex through the command parser). Used by the bubbles and the full-screen viewer;
 * the Share action hands the cached file out through the app FileProvider.
 */
public final class ChatImages {

    private static final LruCache<String, Bitmap> MEM =
            new LruCache<String, Bitmap>((int) (Runtime.getRuntime().maxMemory() / 8)) {
                @Override protected int sizeOf(String k, Bitmap b) { return b.getByteCount(); }
            };
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private ChatImages() {}

    /** The disk-cache file for a keets:// ref (exists only after a successful load). */
    public static File file(Context zContext, String zRef) {
        File dir = new File(zContext.getCacheDir(), "chatimg");
        dir.mkdirs();
        // sha256 of the FULL ref — a 32-bit hashCode collides silently (wrong photo)
        String key;
        try {
            byte[] h = java.security.MessageDigest.getInstance("SHA-256").digest(zRef.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 20; i++) sb.append(String.format("%02x", h[i]));
            key = sb.toString();
        } catch (Exception e) {
            key = Integer.toHexString(zRef.hashCode());
        }
        return new File(dir, key + ".jpg");
    }

    /** Load (cache-first, else P2P fetch). Callback on the MAIN thread; null = failed. */
    public static void load(Context zContext, String zRef, Consumer<Bitmap> zCb) {
        // Untrusted inbound ref interpolated into a node command (whitespace-split,
        // last-key-wins tokenizer) - same gate as ChatAudio, or a hostile ref
        // rewrites the command.
        if (zRef == null || !zRef.matches("keets://\\S+")) {
            MAIN.post(() -> zCb.accept(null));
            return;
        }
        Bitmap hit = MEM.get(zRef);
        if (hit != null) { zCb.accept(hit); return; }
        Context app = zContext.getApplicationContext();
        new Thread(() -> {
            Bitmap bm = null;
            try {
                File f = file(app, zRef);
                if (!f.exists()) {
                    JSONObject r = MinimaCMD.execute("keets action:fetch url:" + zRef + " file:" + f.getAbsolutePath());
                    if (!(Boolean) r.getOrDefault("status", false)) throw new Exception("" + r.get("error"));
                }
                bm = BitmapFactory.decodeFile(f.getAbsolutePath());
                if (bm != null) MEM.put(zRef, bm);
            } catch (Exception exc) { /* cb(null) signals the error state */ }
            final Bitmap fin = bm;
            MAIN.post(() -> zCb.accept(fin));
        }, "chat-image-load").start();
    }
}
