package com.eurobuddha.minimacore.main.views.balance;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.eurobuddha.minimacore.R;

/**
 * Wraps the existing {@link BalanceAdapter} (a {@code BaseAdapter}) in a RecyclerView adapter so the
 * Pandamonium wallet token list can be drag-reordered — WITHOUT duplicating the row rendering: each
 * bind delegates to {@link BalanceAdapter#getView}, reusing the proven icon/name/amount/breakdown
 * logic. Only the drag plumbing and the row click live here.
 */
public class WalletReorderAdapter extends RecyclerView.Adapter<WalletReorderAdapter.VH> {

    /** Row tap -> open the token's coins (full detail), the same as the ListView's item click. */
    public interface OnTokenClick { void onToken(int position); }

    private final BalanceAdapter mBase;
    private final OnTokenClick mClick;

    /** True while a drag is in progress — suppresses clicks and refresh clobbering. */
    boolean dragging;

    public WalletReorderAdapter(BalanceAdapter zBase, OnTokenClick zClick){
        mBase  = zBase;
        mClick = zClick;
        setHasStableIds(true);   // stable per-token ids make notifyItemMoved animate correctly
    }

    static class VH extends RecyclerView.ViewHolder {
        VH(View itemView){ super(itemView); }
    }

    @NonNull @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType){
        View row = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.view_balance_row, parent, false);
        return new VH(row);
    }

    @Override
    public void onBindViewHolder(@NonNull VH holder, int position){
        //Reuse the BaseAdapter's rendering: convertView is non-null, so it populates holder.itemView
        //in place and never inflates (parent is only used on inflate, hence null is safe here).
        mBase.getView(position, holder.itemView, null);
        holder.itemView.setOnClickListener(v -> {
            if (dragging || mClick == null) return;
            int p = holder.getBindingAdapterPosition();
            if (p != RecyclerView.NO_POSITION) mClick.onToken(p);
        });
    }

    @Override
    public int getItemCount(){ return mBase.getCount(); }

    @Override
    public long getItemId(int position){ return mBase.tokenidAt(position).hashCode(); }
}
