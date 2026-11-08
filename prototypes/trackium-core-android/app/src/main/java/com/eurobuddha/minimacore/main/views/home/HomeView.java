package com.eurobuddha.minimacore.main.views.home;

import android.app.Activity;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.content.Intent;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import org.minima.database.MinimaDB;
import org.minima.objects.TxPoW;
import org.minima.system.params.GlobalParams;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.logger;
import com.eurobuddha.minimacore.main.BaseView;

import java.util.Random;

public class HomeView extends BaseView {

    TextView mKeyUses;
    TextView mVersion;
    TextView mMinima;
    TextView mBlock;
    TextView mBlockTime;
    TextView mConnections;
    TextView mIncoming;
    TextView mPeers;

    private final android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
    private boolean destroyed;
    private final com.eurobuddha.minimacore.utils.CoalescingRefresh<JSONObject[]> refresh =
            new com.eurobuddha.minimacore.utils.CoalescingRefresh<>(MinimaCMD.readExecutor(),
                    main::post, HomeView::readDashboard, this::renderDashboard,
                    error -> logger.log("Dashboard refresh failed: " + error));


    public HomeView(Activity zActivity){
        super(zActivity, R.layout.view_home);

        getMainView().findViewById(R.id.open_trackium).setOnClickListener(v ->
                zActivity.startActivity(new Intent(zActivity, tech.trackium.cargo.MainActivity.class)));

        mKeyUses    = getMainView().findViewById(R.id.home_keyuses);
        mMinima    = getMainView().findViewById(R.id.home_version);
        mBlock      = getMainView().findViewById(R.id.home_blocks);
        mBlockTime  = getMainView().findViewById(R.id.home_block_time);
        mConnections  = getMainView().findViewById(R.id.home_connections);
        mIncoming     = getMainView().findViewById(R.id.home_incoming);
        mPeers      = getMainView().findViewById(R.id.home_peers);
        mVersion    = getMainView().findViewById(R.id.home_app_version);

        Button tester = getMainView().findViewById(R.id.button_tester);
        tester.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                logger.log("Test Button pressed!");

                Intent intent = new Intent("com.example.snippets.ACTION_UPDATE_DATA");
                intent.putExtra("com.example.snippets.DATA", "SOME DATA!");
                intent.setPackage("com.eurobuddha.minimacore");
                zActivity.sendBroadcast(intent);
            }
        });

        Language.setText(mKeyUses, Language.msg(l10n_home_connecting));
        Language.setText(getMainView().findViewById(R.id.home_keyuses_caption),
                Language.msg(com.eurobuddha.minimacore.main.StartupMode.usesBlockKeys(
                        zActivity.getSharedPreferences("main_prefs", Activity.MODE_PRIVATE))
                        ? l10n_home_key_block : l10n_restore_key_uses));
        refreshView();
    }

    private static JSONObject[] readDashboard() {
        return new JSONObject[] { MinimaCMD.execute("keys"), MinimaCMD.execute("peers"), MinimaCMD.execute("network") };
    }

    @Override public void refreshView() {
        if (android.os.Looper.myLooper() != android.os.Looper.getMainLooper()) {
            main.post(this::refreshView); return;
        }
        if (destroyed || !isDisplayActive()) return;
        boolean ready = MinimaCMD.checkMinimaStarted();
        TextView status = getMainView().findViewById(R.id.home_status);
        Language.setText(status, Language.msg(ready ? l10n_home_online : l10n_home_waiting));
        int color = androidx.core.content.ContextCompat.getColor(getActivity(),
                ready ? R.color.status_good : R.color.core_text_faint);
        status.setTextColor(color);
        androidx.core.view.ViewCompat.setBackgroundTintList(getMainView().findViewById(R.id.home_status_dot),
                android.content.res.ColorStateList.valueOf(color));
        if (!ready) { refresh.invalidate(); return; }
        Language.setText(getMainView().findViewById(R.id.home_keyuses_caption),
                Language.msg(org.minima.system.params.GeneralParams.USE_BLOCK_AS_KEYUSES
                        ? l10n_home_key_block : l10n_restore_key_uses));
        refresh.request();
        // Block/version rendering stays cheap; all command work is bounded and coalesced.
        mMinima.setText(GlobalParams.getFullMicroVersion());
        try {
            TxPoW tip = MinimaDB.getDB().getTxPoWTree().getTip().getTxPoW();
            mBlock.setText(tip.getBlockNumber().toString());
            Language.setText(mBlockTime, Language.stamp(tip.getTimeMilli().getAsLong(), "yMMMdHms"));
        } catch (Exception ignored) { /* Node may be shutting down. */ }
        try { mVersion.setText(getActivity().getPackageManager().getPackageInfo(getActivity().getPackageName(), 0).versionName); }
        catch (Exception ignored) { }
    }

    private void renderDashboard(JSONObject[] results) {
        if (destroyed || !isDisplayActive() || getActivity().isFinishing() || getActivity().isDestroyed()) return;
        try {
            JSONObject keys = (JSONObject) results[0].get("response");
            if (keys != null && keys.get("maxuses") != null) mKeyUses.setText(String.valueOf(keys.get("maxuses")));
        } catch (Exception ignored) { }
        try {
            JSONObject peers = (JSONObject) results[1].get("response");
            String list = peers.getString("peerslist");
            String[] items = list == null || list.isEmpty() ? new String[0] : list.split(",");
            Language.setText(mPeers, items.length == 0 ? Language.msg(l10n_home_no_peers) : items[new Random().nextInt(items.length)]);
        } catch (Exception ignored) { }
        try {
            JSONObject network = (JSONObject) results[2].get("response");
            JSONObject details = (JSONObject) network.get("details");
            if (details.get("connected") != null) mConnections.setText(String.valueOf(details.get("connected")));

            // Incoming peers, matching the Desktop pill ("N in"): count incoming connections,
            // minus any self-dial — the node feeds its own public address to the peers checker
            // and a hairpinned dial back to itself shows up as an inbound peer. keets links
            // (synthetic 127.113.x.y) all arrive as incoming bridged sockets and count here —
            // they are the phone's real inbound reachability.
            String selfip = "";
            try {
                JSONObject p2p = (JSONObject) details.get("p2p");
                String addr = String.valueOf(p2p.get("address"));
                selfip = addr.contains(":") ? addr.substring(0, addr.indexOf(':')) : addr;
            } catch (Exception ignored) { }
            org.minima.utils.json.JSONArray conns = (org.minima.utils.json.JSONArray) network.get("connections");
            int in = 0;
            for (Object o : conns) {
                JSONObject c = (JSONObject) o;
                if (Boolean.TRUE.equals(c.get("incoming")) && !String.valueOf(c.get("host")).equals(selfip)) in++;
            }
            mIncoming.setText(String.valueOf(in));
        } catch (Exception ignored) { }
    }

    @Override protected void onHidden() { refresh.invalidate(); }

    @Override public void onActivityDestroy() {
        destroyed = true;
        refresh.close();
        main.removeCallbacksAndMessages(null);
    }
}
