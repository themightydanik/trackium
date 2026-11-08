package com.eurobuddha.minimaapi.direct;

import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import com.eurobuddha.minimaapi.MinimaAPIListener;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.function.BooleanSupplier;

/** In-process API for bundled code only. No Intents, pairing tokens, Binder or reply files. */
public final class DirectNodeApi {
    public interface Backend {
        boolean ready();
        void command(String command, Request reply);
        void file(String action, String path, String newPath, Uri source, Request reply);
    }
    private static volatile Backend backend;
    public static void install(Backend value) { backend = value; }
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Set<Request> pending = new HashSet<>();
    private boolean closed;
    private static final int MAX_PENDING = 128;
    private static final long RETENTION_MS = 10 * 60_000L; // existing PandaDEX late-result window

    public DirectNodeApi(Context context, MinimaAPIListener registration) {
        // In-process node access is for trusted bundled code only: Pandamonium (integrated apps)
        // and BlackBear (the History tab). Both ship the embedded node in their own package.
        String pkg = context.getPackageName();
        if (!"com.eurobuddha.pandamonium".equals(pkg) && !"com.eurobuddha.minimablock".equals(pkg)
                && !"tech.trackium.core.prototype".equals(pkg))
            throw new IllegalArgumentException("Direct node access is only available inside Pandamonium or BlackBear");
        main.post(() -> { if (!closed && registration != null) deliverSafely(registration, LocalJson.ready(backend != null && backend.ready())); });
    }
    public void Command(String command, MinimaAPIListener listener) {
        Command(command, () -> true, listener);
    }
    /** The guard must be thread-safe: the shared worker checks it immediately before execution. */
    public void Command(String command, BooleanSupplier authorized, MinimaAPIListener listener) {
        dispatch(listener, authorized, request -> {
            Backend host = backend;
            if (host == null || !host.ready()) { request.accept(LocalJson.failure("The embedded node is not running. No command was sent.")); return; }
            if ("__register__".equals(command)) { request.accept(LocalJson.ready(host.ready())); return; }
            host.command(command, request);
        });
    }
    public void FileCommand(String action, String path, String newPath, Uri source, MinimaAPIListener listener) {
        dispatch(listener, () -> true, request -> {
            Backend host = backend;
            if (host == null || !host.ready()) { request.accept(LocalJson.failure("The embedded node is not running. No file action was sent.")); return; }
            host.file(action, path, newPath, source, request);
        });
    }
    private void dispatch(MinimaAPIListener listener, BooleanSupplier authorized, Consumer<Request> submit) {
        main.post(() -> {
            if (closed || pending.size() >= MAX_PENDING) {
                if (listener != null) deliverSafely(listener, LocalJson.failure(closed ? "Node connection is closed." : "Too many pending node requests. Nothing was sent."));
                return;
            }
            Request request = new Request(result -> {
                if (listener != null) deliverSafely(listener, result);
            }, action -> main.post(action), authorized);
            pending.add(request);
            Runnable expiry = () -> request.accept(LocalJson.failure("Node result was not received. Outcome remains unknown."));
            request.cleanup = () -> { main.removeCallbacks(expiry); pending.remove(request); };
            main.postDelayed(expiry, RETENTION_MS);
            try { submit.accept(request); }
            catch (RuntimeException failure) { request.accept(LocalJson.failure("Node request could not complete. Outcome remains unknown.")); }
        });
    }
    private static void deliverSafely(MinimaAPIListener listener, JSONObject result) {
        try { listener.response(result); }
        catch (RuntimeException failure) { android.util.Log.e("DirectNodeApi", "Node result consumer failed: " + failure.getClass().getSimpleName()); }
    }
    public void onDestroy() {
        main.post(() -> {
            closed = true;
            // Cancel work still waiting in the queue. An executing write keeps its late reply:
            // existing app wrappers use that reply to reconcile durable write markers.
            for (Request request : new HashSet<>(pending)) request.cancelQueued();
        });
    }
    /** Completion gate reused from the native SerialQueue pattern, with a dispatch boundary. */
    public static final class Request implements Consumer<JSONObject> {
        private final AtomicInteger state = new AtomicInteger(); // queued=0, executing=1, complete=2
        private final Consumer<JSONObject> callback;
        private final java.util.concurrent.Executor delivery;
        private final BooleanSupplier authorized;
        Runnable cleanup = () -> {};
        public Request(Consumer<JSONObject> callback, java.util.concurrent.Executor delivery) {
            this(callback, delivery, () -> true);
        }
        public Request(Consumer<JSONObject> callback, java.util.concurrent.Executor delivery, BooleanSupplier authorized) {
            this.callback = callback; this.delivery = delivery; this.authorized = authorized;
        }
        public boolean begin() {
            boolean allowed;
            try { allowed = authorized != null && authorized.getAsBoolean(); }
            catch (RuntimeException failure) { allowed = false; }
            if (!allowed) { cancelQueued(); return false; }
            return state.compareAndSet(0, 1);
        }
        public boolean active() { return state.get() != 2; }
        public void cancelQueued() {
            if (state.compareAndSet(0, 2)) deliver(LocalJson.failure("Node request cancelled before execution. Nothing was sent."));
        }
        @Override public void accept(JSONObject result) {
            if (state.getAndSet(2) != 2) deliver(result == null ? LocalJson.failure("Node result is unavailable. Outcome remains unknown.") : result);
        }
        private void deliver(JSONObject result) {
            final JSONObject isolated;
            try { isolated = (JSONObject) LocalJson.copy(result); }
            catch (RuntimeException malformed) { deliverFailure(); return; }
            delivery.execute(() -> { cleanup.run(); invoke(isolated); });
        }
        private void invoke(JSONObject result) {
            try { callback.accept(result); } catch (RuntimeException ignored) { /* A consumer cannot crash another integrated app. */ }
        }
        private void deliverFailure() {
            delivery.execute(() -> { cleanup.run(); invoke(LocalJson.failure("Invalid node result. Outcome remains unknown.")); });
        }
    }
}
