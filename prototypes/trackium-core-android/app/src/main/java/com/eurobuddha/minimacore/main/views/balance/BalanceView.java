package com.eurobuddha.minimacore.main.views.balance;

import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.app.Activity;
import android.content.Intent;
import android.view.View;
import android.widget.ListView;
import android.widget.TextView;

import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.DividerItemDecoration;
import androidx.recyclerview.widget.ItemTouchHelper;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.main.BaseView;
import com.eurobuddha.minimacore.main.views.balance.coins.CoinsDialog;
import com.eurobuddha.minimacore.main.views.balance.tokens.TokenMeta;
import com.eurobuddha.minimacore.main.views.receive.ReceiveActivity;
import com.eurobuddha.minimacore.main.views.send.SendActivity;
import com.eurobuddha.minimacore.utils.Clip;
import com.eurobuddha.minimacore.utils.Format;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.logger;

public class BalanceView extends BaseView {

    private final android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
    private final com.eurobuddha.minimacore.utils.CoalescingRefresh<JSONObject> refresh =
            new com.eurobuddha.minimacore.utils.CoalescingRefresh<>(MinimaCMD.readExecutor(),
                    main::post, () -> MinimaCMD.execute("balance"), this::applyBalance,
                    this::balanceFailed);
    private boolean destroyed;

    ListView mBalanceList;

    //Pandamonium: drag-reorderable RecyclerView instead of the ListView (null on classic/BlackBear).
    RecyclerView mRecycler;
    LinearLayoutManager mRecyclerLayout;
    WalletReorderAdapter mReorder;

    TextView mTotalBalance;
    TextView mRefreshStatus;

    TextView mBreakdown;

    BalanceAdapter mBalanceAdapter;

    //The Minima (0x00) figures behind the header number
    String mConfirmed   = "—";
    String mUnconfirmed = "—";
    String mSendable    = "—";
    String mCoinCount   = "—";

    /** When the node last answered `balance`. Drives the "updated ..." staleness. */
    long mLastBalanceUpdate = 0;

    CoinsDialog mOpenCoins = null;

    /**
     * Refresh while visible even if a balance event was missed during startup/resume.
     * The idle-only read keeps slow snapshots from being perpetually discarded.
     */
    private final Runnable mTick = new Runnable() {
        @Override
        public void run() {
            if (destroyed || !isDisplayActive()) return;
            updateBreakdown();
            if (MinimaCMD.checkMinimaStarted()) refresh.requestIfIdle();
            else {
                refreshView(); // Also schedules the next tick while disconnected.
                return;
            }
            if (mMainView.getGlobalVisibleRect(new android.graphics.Rect())) {
                refreshVisibleMetadata();
            }
            if(mBreakdown != null && mBreakdown.getWindowToken() != null){
                main.postDelayed(this, 10000);
            }
        }
    };

    public BalanceView(Activity zActivity){
        super(zActivity, R.layout.view_wallet_balance);

        mBalanceAdapter = new BalanceAdapter(zActivity);

        mBalanceList = getMainView().findViewById(R.id.wallet_balance_list);          // classic/BlackBear
        mRecycler    = getMainView().findViewById(R.id.wallet_balance_recycler);      // Pandamonium

        mTotalBalance = getMainView().findViewById(R.id.wallet_total_balance);
        mRefreshStatus = getMainView().findViewById(R.id.wallet_refresh_status);
        mBreakdown    = getMainView().findViewById(R.id.wallet_balance_breakdown);

        //Pandamonium: the breakdown is collapsed behind an expand arrow in the header. These ids
        //exist only in the pandamonium header layout; null elsewhere, so classic/BlackBear keep
        //the breakdown always shown.
        final View expandRow   = getMainView().findViewById(R.id.wallet_balance_header);
        final View expandArrow = getMainView().findViewById(R.id.wallet_balance_expand);
        if (expandRow != null && expandArrow != null && mBreakdown != null) {
            mBreakdown.setVisibility(View.GONE);
            Language.description(expandArrow, Language.msg(l10n_core_wallet_show_details));
            expandRow.setOnClickListener(v -> {
                boolean show = mBreakdown.getVisibility() != View.VISIBLE;
                mBreakdown.setVisibility(show ? View.VISIBLE : View.GONE);
                expandArrow.animate().rotation(show ? 180f : 0f).setDuration(150).start();
                Language.description(expandArrow, show ? Language.msg(l10n_core_wallet_hide_details) : Language.msg(l10n_core_wallet_show_details));
            });
        }

        if (mBalanceList != null) {
            //Classic/BlackBear: the existing ListView. Tap opens coins; long-press copies the token id.
            mBalanceList.setAdapter(mBalanceAdapter);
            mBalanceList.setOnItemClickListener((parent, view, position, id) -> openCoins(position));
            //Long-press copies the full token id. Wired on the ListView, not the row view -
            //a long-click listener set on the row itself can swallow the item click.
            mBalanceList.setOnItemLongClickListener((parent, view, position, id) -> {
                copyTokenId(position);
                return true;
            });
        } else if (mRecycler != null) {
            //Pandamonium: drag-to-reorder RecyclerView. Long-press starts the drag (like the app
            //drawer), so copying the token id moves to the tap-to-open coins dialog.
            mRecyclerLayout = new LinearLayoutManager(zActivity);
            mRecycler.setLayoutManager(mRecyclerLayout);
            mReorder = new WalletReorderAdapter(mBalanceAdapter, this::openCoins);
            mRecycler.setAdapter(mReorder);

            DividerItemDecoration divider = new DividerItemDecoration(zActivity, DividerItemDecoration.VERTICAL);
            divider.setDrawable(ContextCompat.getDrawable(zActivity, R.drawable.divider_hairline));
            mRecycler.addItemDecoration(divider);

            //A RecyclerView can't observe a BaseAdapter: refresh it whenever BalanceAdapter changes
            //(async icon loads / web validation), but never mid-drag.
            mBalanceAdapter.setExtraNotify(() -> {
                if (mReorder != null && !mReorder.dragging) mReorder.notifyDataSetChanged();
            });

            attachReorder();
        }

        getMainView().findViewById(R.id.wallet_btn_send).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                getActivity().startActivity(new Intent(getActivity(), SendActivity.class));
            }
        });

        getMainView().findViewById(R.id.wallet_btn_receive).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                getActivity().startActivity(new Intent(getActivity(), ReceiveActivity.class));
            }
        });

        refreshView();
    }

    /** Open the coins (full detail) for the token at a list position. */
    private void openCoins(int position){
        try{
            JSONObject bal  = (JSONObject) mBalanceAdapter.getItem(position);
            String     tid  = String.valueOf(bal.get("tokenid"));
            TokenMeta  meta = TokenMeta.parse(bal.get("token"), tid);
            mOpenCoins = CoinsDialog.show(getActivity(), tid, meta.nameProvided ? meta.name : Language.msg(l10n_wallet_token),
                    String.valueOf(bal.get("sendable")), String.valueOf(bal.get("confirmed")));
        }catch(Throwable exc){
            logger.log("Could not open coins : "+exc);
        }
    }

    /** Copy the full token id (ListView long-press path; Pandamonium uses the coins dialog button). */
    private void copyTokenId(int position){
        try{
            JSONObject bal = (JSONObject) mBalanceAdapter.getItem(position);
            Clip.copy(getActivity(), "tokenid", String.valueOf(bal.get("tokenid")), Language.msg(l10n_core_wallet_token_copied).toString());
        }catch(Throwable exc){
            logger.log("Could not copy token id : "+exc);
        }
    }

    /** Only the RecyclerView path: long-press drag-to-reorder, Minima pinned first, order persisted. */
    private void attachReorder(){
        ItemTouchHelper.SimpleCallback cb = new ItemTouchHelper.SimpleCallback(
                ItemTouchHelper.UP | ItemTouchHelper.DOWN, 0) {
            @Override public int getDragDirs(RecyclerView rv, RecyclerView.ViewHolder vh){
                //Pin Minima (position 0): it can't be dragged.
                return vh.getBindingAdapterPosition() > 0 ? super.getDragDirs(rv, vh) : 0;
            }
            @Override public boolean onMove(RecyclerView rv, RecyclerView.ViewHolder from, RecyclerView.ViewHolder to){
                int s = from.getBindingAdapterPosition();
                int e = to.getBindingAdapterPosition();
                //Both ends > 0 so nothing can drop above the pinned Minima row either.
                if (s <= 0 || e <= 0 || s >= mBalanceAdapter.getCount() || e >= mBalanceAdapter.getCount()) return false;
                mBalanceAdapter.moveItem(s, e);
                mReorder.notifyItemMoved(s, e);
                TokenOrder.prefs(getActivity()).edit()
                        .putString(TokenOrder.KEY, TokenOrder.encode(mBalanceAdapter.tokenids())).apply();
                return true;
            }
            @Override public void onSwiped(RecyclerView.ViewHolder vh, int direction){}
            @Override public void onSelectedChanged(RecyclerView.ViewHolder vh, int actionState){
                mReorder.dragging = actionState == ItemTouchHelper.ACTION_STATE_DRAG;
                if (mReorder.dragging && vh != null){
                    vh.itemView.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS);
                    vh.itemView.setAlpha(0.85f);
                }
                super.onSelectedChanged(vh, actionState);
            }
            @Override public void clearView(RecyclerView rv, RecyclerView.ViewHolder vh){
                super.clearView(rv, vh);
                vh.itemView.setAlpha(1f);
            }
        };
        new ItemTouchHelper(cb).attachToRecyclerView(mRecycler);
    }

    /** Ask the adapter to re-check web validation for the visible rows (ListView or RecyclerView). */
    private void refreshVisibleMetadata(){
        if (mBalanceList != null) {
            mBalanceAdapter.refreshExpiredMetadata(
                    mBalanceList.getFirstVisiblePosition(), mBalanceList.getLastVisiblePosition());
        } else if (mRecyclerLayout != null) {
            mBalanceAdapter.refreshExpiredMetadata(
                    mRecyclerLayout.findFirstVisibleItemPosition(), mRecyclerLayout.findLastVisibleItemPosition());
        }
    }

    @Override
    public void refreshView() {
        if (android.os.Looper.myLooper() != android.os.Looper.getMainLooper()) {
            main.post(this::refreshView); return;
        }
        if (destroyed || !isDisplayActive()) return;

        //Never stack timers when the tab is re-selected
        if(mBreakdown != null){
            main.removeCallbacks(mTick);
            main.postDelayed(mTick, 10000);
        }

        //Have we started
        if(!MinimaCMD.checkMinimaStarted()){
            refresh.invalidate();

            JSONArray tempbal = new JSONArray();
            JSONObject bal = new JSONObject();
            bal.put("tokenid","0x00");
            bal.put("token","Awaiting Connection..");
            bal.put("confirmed","0");
            bal.put("unconfirmed","0");
            tempbal.add(bal);

            //The placeholder has no sendable / coins - don't let the breakdown print nulls
            mLastBalanceUpdate = 0;
            refreshBalance(tempbal);
            if (mTotalBalance != null) mTotalBalance.setText("—");
            if (mRefreshStatus != null) {
                Language.setText(mRefreshStatus, Language.msg(l10n_core_wallet_disconnected));
                mRefreshStatus.setVisibility(View.VISIBLE);
            }

            return;
        }

        if (mRefreshStatus != null) {
            Language.setText(mRefreshStatus, Language.msg(l10n_core_wallet_refreshing));
            mRefreshStatus.setVisibility(View.VISIBLE);
        }
        refresh.request();
    }

    private void balanceFailed(Exception error) {
        logger.log("Balance refresh failed: " + error);
        if (destroyed || !isDisplayActive()) return;
        if (mRefreshStatus != null) {
            Language.setText(mRefreshStatus, Language.msg(l10n_core_wallet_refresh_failed));
            mRefreshStatus.setVisibility(View.VISIBLE);
        }
    }

    private void applyBalance(JSONObject result) {
        if (destroyed || !isDisplayActive() || getActivity().isFinishing() || getActivity().isDestroyed()) return;
        if (!MinimaCMD.checkMinimaStarted()) { refreshView(); return; }
        Object balance = result == null ? null : result.get("response");
        if (result == null || !Boolean.TRUE.equals(result.get("status")) || !(balance instanceof JSONArray)) {
            balanceFailed(new IllegalStateException("Incomplete balance response"));
            return;
        }
        if (mRefreshStatus != null) mRefreshStatus.setVisibility(View.GONE);
        mLastBalanceUpdate = System.currentTimeMillis();
        refreshBalance((JSONArray) balance);
    }

    private void refreshBalance(JSONArray balance) {
        if (destroyed) return;
        mBalanceAdapter.updateValues(balance);
        //Pandamonium: lay the tokens out in the user's saved order (new tokens appended), unless a
        //drag is in progress (don't yank rows out from under the finger).
        if (mReorder != null && !mReorder.dragging) {
            mBalanceAdapter.applyTokenOrder(TokenOrder.decode(
                    TokenOrder.prefs(getActivity()).getString(TokenOrder.KEY, null),
                    mBalanceAdapter.tokenids()));
            mReorder.notifyDataSetChanged();
        }
        updateTotal(balance);
    }

    private void updateTotal(JSONArray zBalance){
        if(mTotalBalance == null){
            return;
        }

        String total = "0";

        mConfirmed   = "—";
        mUnconfirmed = "—";
        mSendable    = "—";
        mCoinCount   = "—";

        try{
            for(int i=0;i<zBalance.size();i++){
                JSONObject token = (JSONObject) zBalance.get(i);
                String tokenid   = String.valueOf(token.get("tokenid"));
                if("0x00".equals(tokenid)){
                    //Prefer sendable; fall back to confirmed
                    Object send = token.get("sendable");
                    Object conf = token.get("confirmed");
                    total = String.valueOf(send != null ? send : conf);

                    //Everything else the node told us, for the breakdown line
                    mConfirmed   = str(conf,               mConfirmed);
                    mUnconfirmed = str(token.get("unconfirmed"), mUnconfirmed);
                    mSendable    = str(send,               mSendable);
                    mCoinCount   = str(token.get("coins"), mCoinCount);
                    break;
                }
            }
        }catch(Exception exc){}

        mTotalBalance.setText(Format.summaryAmount(total));

        updateBreakdown();
    }

    /** What makes up the header number - ported from the AtomiX wallet card. */
    private void updateBreakdown(){
        if(mBreakdown == null){
            return;
        }

        if(mLastBalanceUpdate == 0){
            Language.setText(mBreakdown, Language.msg(l10n_core_wallet_disconnected));
            return;
        }

        Language.setText(mBreakdown, Language.msg(l10n_core_wallet_breakdown,
                Format.summaryAmount(mConfirmed),
                Format.summaryAmount(Format.subtract(mConfirmed, mSendable)),
                Format.summaryAmount(mUnconfirmed), BalanceAdapter.coinCount(mCoinCount),
                Language.since(mLastBalanceUpdate)));
    }

    @Override protected void onShown() {
        mBalanceAdapter.setDisplayActive(true);
        // Do not present retained figures as the current balance on foreground entry.
        if (mTotalBalance != null) mTotalBalance.setText("—");
        mBalanceAdapter.updateValues(new JSONArray());
        if (mReorder != null) mReorder.notifyDataSetChanged();
        updateBreakdown();
        refreshView();
    }

    @Override protected void onHidden() {
        refresh.invalidate();
        main.removeCallbacks(mTick);
        mBalanceAdapter.setDisplayActive(false);
    }

    @Override
    public void onActivityDestroy(){
        destroyed = true;
        refresh.close();
        main.removeCallbacksAndMessages(null);
        mBalanceAdapter.destroy();
        if(mBreakdown != null){
            mBreakdown.removeCallbacks(mTick);
        }
        if(mOpenCoins != null){
            mOpenCoins.dismiss();
            mOpenCoins = null;
        }
    }

    private static String str(Object zValue, String zFallback){
        if(zValue == null){
            return zFallback;
        }
        String s = String.valueOf(zValue);
        return (s.isEmpty() || "null".equals(s)) ? zFallback : s;
    }
}
