package com.eurobuddha.minimacore.main.views.balance.tokens;

import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.function.Consumer;
import com.eurobuddha.minimacore.utils.BackgroundWork;
import com.eurobuddha.minimacore.utils.ExpiringCache;
import com.eurobuddha.minimacore.utils.SharedRequests;

/** Bounded verification cache keyed by token AND URL; temporary network failure is retryable. */
public final class WebValidate {
    public enum Result { VERIFIED, NOT_VERIFIED, UNAVAILABLE }
    private static final ExpiringCache<String, Result> CACHE =
            new ExpiringCache<>(512, SystemClock::elapsedRealtime);
    private static final class Workers {
        static final Handler MAIN = new Handler(Looper.getMainLooper());
        static final SharedRequests<String, Result> REQUESTS =
                new SharedRequests<>(BackgroundWork.pool(2, 64), task -> MAIN.post(task));
    }
    private WebValidate() { }

    public static Boolean status(String tokenid, String url) {
        Result result = CACHE.get(key(tokenid, url));
        return result == null || result == Result.UNAVAILABLE ? null : result == Result.VERIFIED;
    }

    public static boolean needsCheck(String tokenid, String url) {
        return url != null && !url.trim().isEmpty() && CACHE.get(key(tokenid, url)) == null;
    }

    // Adapter retains this callback while alive; shared requests hold it weakly.
    public static void ensure(String tokenid, String url, Consumer<Result> onDone) {
        if (!needsCheck(tokenid, url)) return;
        String k = key(tokenid, url);
        Workers.REQUESTS.request(k, () -> {
            Result result;
            try { result = verify(NetFetch.get(url.trim(), 262144, 8000, 10000, false), tokenid); }
            catch (Exception e) { result = Result.UNAVAILABLE; }
            CACHE.put(k, result, result == Result.UNAVAILABLE ? 30_000 : 300_000);
            return result;
        }, onDone);
    }

    static Result verify(byte[] bytes, String tokenid) {
        if (bytes == null) return Result.UNAVAILABLE;
        String bare = norm(tokenid);
        if (bare.isEmpty()) return Result.NOT_VERIFIED;
        String body = new String(bytes, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
        return body.contains(bare) ? Result.VERIFIED : Result.NOT_VERIFIED;
    }

    private static String key(String tokenid, String url) { return norm(tokenid) + "|" + (url == null ? "" : url.trim()); }
    private static String norm(String value) {
        String s = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        return s.startsWith("0x") ? s.substring(2) : s;
    }
}
