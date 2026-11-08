package com.eurobuddha.minimacore.main.views.balance.tokens;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.LruCache;
import android.widget.ImageView;

import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import java.lang.ref.WeakReference;
import java.util.function.Consumer;
import com.eurobuddha.minimacore.utils.BackgroundWork;
import com.eurobuddha.minimacore.utils.ExpiringCache;
import com.eurobuddha.minimacore.utils.SharedRequests;

/**
 * Ported from the utxoWallet/Minima wallet: async loader for token icons — handles data: URIs,
 * http(s), and ipfs:// URLs, with a byte-bounded in-memory cache. All decoding runs off the UI thread.
 */
public final class ImageLoader {

    // Bounded by total bitmap bytes so a few large icons can't grow without limit.
    private static final LruCache<String, Bitmap> CACHE =
            new LruCache<String, Bitmap>(6 * 1024 * 1024) {
                @Override protected int sizeOf(String key, Bitmap value) {
                    return value.getByteCount();
                }
            };

    private static final int THUMB_PX = 320;     // list rows + detail icon
    private static final int FULL_PX  = 1600;     // NFT full-resolution view (bounded so it can't OOM)
    private static final int MAX_BYTES = 8 * 1024 * 1024;   // hard cap so a hostile icon url can't OOM us

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final SharedRequests<String, Bitmap> REQUESTS =
            new SharedRequests<>(BackgroundWork.pool(4, 64), task -> MAIN.post(task));
    private static final ExpiringCache<String, Boolean> FAILED =
            new ExpiringCache<>(256, SystemClock::elapsedRealtime);

    private ImageLoader() {}

    public static void load(Activity act, String url, ImageView iv, int fallbackRes) {
        load(act, url, iv, fallbackRes, THUMB_PX);
    }

    public static void loadFull(Activity act, String url, ImageView iv, int fallbackRes) {
        load(act, url, iv, fallbackRes, FULL_PX);
    }

    public static void loadOver(Activity act, String url, ImageView iv, Runnable onLoaded) {
        request(act, url, iv, THUMB_PX, onLoaded);
    }

    private static void load(Activity act, String url, ImageView iv, int fallbackRes, int reqPx) {
        iv.setImageResource(fallbackRes);
        request(act, url, iv, reqPx, null);
    }

    /** The view owns its subscription; background tasks hold only a weak reference to it. */
    private static final class Target implements Consumer<Bitmap> {
        final WeakReference<Activity> activity;
        final WeakReference<ImageView> view;
        final Runnable onLoaded;
        final String key;
        Target(Activity act, ImageView iv, String key, Runnable callback) {
            activity = new WeakReference<>(act); view = new WeakReference<>(iv);
            onLoaded = callback; this.key = key;
        }
        @Override public void accept(Bitmap bitmap) {
            Activity act = activity.get(); ImageView iv = view.get();
            if (bitmap == null || act == null || act.isDestroyed() || act.isFinishing()
                    || iv == null || iv.getTag() != this) return;
            iv.setImageBitmap(bitmap);
            Runnable callback = onLoaded;
            if (callback != null) callback.run();
        }
    }

    private static void request(Activity act, String url, ImageView iv, int reqPx, Runnable onLoaded) {
        if (url == null || url.isEmpty()) { iv.setTag(null); return; }
        String key = reqPx + "|" + url;
        Object previous = iv.getTag();
        Target target = previous instanceof Target && key.equals(((Target) previous).key)
                ? (Target) previous : new Target(act, iv, key, onLoaded);
        iv.setTag(target);
        Bitmap cached = CACHE.get(key);
        if (cached != null) { iv.setImageBitmap(cached); return; }
        if (FAILED.get(key) != null) return;
        REQUESTS.request(key, () -> {
            // Another completed request may have filled the cache before this job ran.
            Bitmap bitmap = CACHE.get(key);
            if (bitmap == null) bitmap = decode(url, reqPx);
            if (bitmap != null) CACHE.put(key, bitmap);
            else FAILED.put(key, Boolean.TRUE, 30_000);
            return bitmap;
        }, target);
    }

    /** Fetch the raw bytes then decode DOWNSAMPLED to ~reqPx, so a multi-MB icon never OOMs a thumbnail.
     *  SVG (which BitmapFactory can't handle, and which many Minima token urls use) is rasterised. */
    private static Bitmap decode(String url, int reqPx) {
        try {
            byte[] bytes = url.startsWith("data:") ? dataUriBytes(url) : fetch(url);
            if (bytes == null || bytes.length == 0) return null;
            if (looksLikeSvg(bytes, url)) return renderSvg(bytes, reqPx);
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            BitmapFactory.Options opt = new BitmapFactory.Options();
            opt.inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight, reqPx);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opt);
        } catch (Throwable t) {     // includes OutOfMemoryError — a giant icon must never crash the loader
            return null;
        }
    }

    private static boolean looksLikeSvg(byte[] bytes, String url) {
        if (url != null && url.toLowerCase().contains(".svg")) return true;
        int n = Math.min(bytes.length, 300);
        String head = new String(bytes, 0, n, java.nio.charset.StandardCharsets.UTF_8).trim().toLowerCase();
        return head.startsWith("<svg") || (head.startsWith("<?xml") && head.contains("<svg")) || head.contains("<svg");
    }

    /** Rasterise SVG bytes to a bitmap ≤ reqPx (preserving aspect), via AndroidSVG. */
    private static Bitmap renderSvg(byte[] bytes, int reqPx) {
        try {
            com.caverock.androidsvg.SVG svg =
                    com.caverock.androidsvg.SVG.getFromString(new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
            float dw = svg.getDocumentWidth(), dh = svg.getDocumentHeight();
            int w = reqPx, h = reqPx;
            if (dw > 0 && dh > 0) {                     // preserve aspect if the doc declares a size
                if (dw >= dh) { w = reqPx; h = Math.max(1, Math.round(reqPx * dh / dw)); }
                else { h = reqPx; w = Math.max(1, Math.round(reqPx * dw / dh)); }
            }
            svg.setDocumentWidth(w);
            svg.setDocumentHeight(h);
            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            svg.renderToCanvas(new android.graphics.Canvas(bmp));
            return bmp;
        } catch (Throwable t) {
            return null;
        }
    }

    private static int sampleSize(int w, int h, int reqPx) {
        int s = 1;
        int max = Math.max(w, h);
        while (max / s > reqPx) s <<= 1;
        return Math.max(1, s);
    }

    private static byte[] fetch(String url) throws Exception {
        String f = url.startsWith("ipfs://") ? "https://ipfs.io/ipfs/" + url.substring("ipfs://".length()) : url;
        return NetFetch.get(f, MAX_BYTES, 8000, 15000, false);
    }

    private static byte[] dataUriBytes(String dataUri) {
        int comma = dataUri.indexOf(',');
        if (comma < 0) return null;
        if (!dataUri.substring(0, comma).contains("base64")) return null;
        // Enforce the same byte budget for inline metadata before allocating the decoded array.
        if (dataUri.length() - comma - 1 > ((MAX_BYTES + 2L) / 3) * 4) return null;
        byte[] bytes = Base64.decode(dataUri.substring(comma + 1), Base64.DEFAULT);
        return bytes.length <= MAX_BYTES ? bytes : null;
    }
}
