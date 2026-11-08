package com.eurobuddha.minimacore.maxchat;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import com.eurobuddha.maxima.core.chat.ChatMedia;
import com.eurobuddha.maxima.core.media.MediaManifest;
import com.eurobuddha.maxima.core.media.MediaService;

import java.io.File;
import java.io.FileOutputStream;
import java.security.MessageDigest;

/**
 * Bytes-to-file for a Parlons media body (ChatMedia-wrapped): a data: URL is
 * decoded inline, an mx1: manifest is fetched over the media mesh. Cached by
 * ref hash so a bubble re-bind never re-fetches. MediaPlayer and BitmapFactory
 * both want a real file, so a file is what everyone gets.
 */
public final class MaxMedia {

    public interface Callback {
        void done(File zFile);   // main thread; null = not available
    }

    public interface BitmapCallback {
        void done(android.graphics.Bitmap zBm);   // main thread; null = not available
    }

    // Decoded-image cache: decode off-main ONCE, not on every bind
    // (receipt ticks and play/pause both notifyDataSetChanged the whole list).
    private static final android.util.LruCache<String, android.graphics.Bitmap> BITMAPS =
            new android.util.LruCache<String, android.graphics.Bitmap>(
                    (int) (Runtime.getRuntime().maxMemory() / 8)) {
                @Override protected int sizeOf(String k, android.graphics.Bitmap b) {
                    return b.getByteCount();
                }
            };

    /** Resolve a ChatMedia IMAGE body to a decoded bitmap (cached, bg decode). */
    public static void loadBitmap(Context zCtx, String zBody, BitmapCallback zCb) {
        Handler main = new Handler(Looper.getMainLooper());
        String ref = ChatMedia.ref(zBody);
        android.graphics.Bitmap hit = ref == null ? null : BITMAPS.get(ref);
        if (hit != null) {
            main.post(() -> zCb.done(hit));
            return;
        }
        load(zCtx, zBody, f -> {
            if (f == null) {
                zCb.done(null);
                return;
            }
            new Thread(() -> {
                android.graphics.Bitmap bm =
                        android.graphics.BitmapFactory.decodeFile(f.getAbsolutePath());
                if (bm != null && ref != null) {
                    BITMAPS.put(ref, bm);
                }
                final android.graphics.Bitmap out = bm;
                main.post(() -> zCb.done(out));
            }, "maxchat-image-decode").start();
        });
    }

    private MaxMedia() {
    }

    public static File file(Context zCtx, String zRef) {
        File dir = new File(zCtx.getCacheDir(), "maxmedia");
        dir.mkdirs();
        return new File(dir, sha(zRef) + ".bin");
    }

    /** Resolve a ChatMedia BODY to a cached file (fetches off-main). */
    public static void load(Context zCtx, String zBody, Callback zCb) {
        Handler main = new Handler(Looper.getMainLooper());
        String ref = ChatMedia.ref(zBody);
        if (ref == null || ref.isEmpty()) {
            main.post(() -> zCb.done(null));
            return;
        }
        File f = file(zCtx, ref);
        if (f.isFile() && f.length() > 0) {
            main.post(() -> zCb.done(f));
            return;
        }
        new Thread(() -> {
            File got = null;
            try {
                byte[] bytes = null;
                if (ref.startsWith("data:")) {
                    int comma = ref.indexOf(',');
                    if (comma > 0) {
                        bytes = java.util.Base64.getMimeDecoder()
                                .decode(ref.substring(comma + 1).trim());
                    }
                } else if (ref.startsWith("mx1:")) {
                    MediaService media = MaxChat.media();
                    if (media != null) {
                        String json = new String(java.util.Base64.getUrlDecoder()
                                .decode(ref.substring(4)),
                                java.nio.charset.StandardCharsets.UTF_8);
                        bytes = media.fetch(MediaManifest.decode(json));
                    }
                }
                if (bytes != null && bytes.length > 0) {
                    try (FileOutputStream fos = new FileOutputStream(f)) {
                        fos.write(bytes);
                    }
                    got = f;
                }
            } catch (Exception ignored) {
            }
            if (got == null) {
                f.delete();   // a partial write must never become a cache hit
            }
            final File out = got;
            main.post(() -> zCb.done(out));
        }, "maxchat-media-fetch").start();
    }

    private static String sha(String zRef) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(zRef.getBytes());
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 16; i++) {
                sb.append(String.format("%02x", h[i]));
            }
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(zRef.hashCode());
        }
    }
}
