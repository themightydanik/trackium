package com.eurobuddha.minimacore.chat;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import com.eurobuddha.minimacore.utils.MinimaCMD;

import org.minima.utils.json.JSONObject;

import java.io.File;
import java.security.MessageDigest;

/**
 * Voice-note bytes from a keets:// ref, cached to a file - ChatImages for
 * audio, minus the bitmap work (MediaPlayer wants a real file path anyway).
 */
public final class ChatAudio {

    public interface Callback {
        void done(File zFile);   // main thread; null = fetch failed
    }

    private ChatAudio() {
    }

    /** The cache path for a ref (file may not exist yet). */
    public static File file(Context zCtx, String zRef) {
        File dir = new File(zCtx.getCacheDir(), "chataudio");
        dir.mkdirs();
        return new File(dir, sha(zRef) + ".bin");
    }

    /** Fetch (or reuse the cached copy of) the audio behind a keets:// ref. */
    public static void load(Context zCtx, String zRef, Callback zCb) {
        Handler main = new Handler(Looper.getMainLooper());
        // An inbound ref is untrusted: whitespace would inject extra command
        // parameters into the fetch below. One guard covers the whole path.
        if (zRef == null || !zRef.matches("keets://\\S+")) {
            main.post(() -> zCb.done(null));
            return;
        }
        File f = file(zCtx, zRef);
        if (f.isFile() && f.length() > 0) {
            main.post(() -> zCb.done(f));
            return;
        }
        new Thread(() -> {
            File got = null;
            try {
                JSONObject r = MinimaCMD.execute(
                        "keets action:fetch url:" + zRef + " file:" + f.getAbsolutePath());
                if ((Boolean) r.getOrDefault("status", false)
                        && f.isFile() && f.length() > 0) {
                    got = f;
                }
            } catch (Exception ignored) {
            }
            if (got == null) {
                // a partial write must not become a permanent 'cache hit'
                f.delete();
            }
            final File out = got;
            main.post(() -> zCb.done(out));
        }, "chat-audio-fetch").start();
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
