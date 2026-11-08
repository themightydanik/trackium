package com.eurobuddha.minimacore.main.views.balance;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Persists the wallet token-list order by tokenid — the same shape as the app drawer's
 * {@code PandamoniumOrder}: Minima ({@code 0x00}) is pinned first, the saved order is replayed for
 * tokens still held, and any new/unknown tokens are appended at the end so a freshly received token
 * never disappears. Backs the drag-reorderable RecyclerView wallet list on all three bears.
 * (The prefs file name is historical — reorder shipped on Pandamonium first.)
 */
public final class TokenOrder {

    public static final String PREFS  = "pandamonium_wallet";
    public static final String KEY    = "token_order";
    /** Minima is always first and not draggable (mirrors Core being pinned in the drawer). */
    public static final String PINNED = "0x00";

    private TokenOrder() {}

    public static SharedPreferences prefs(Context zContext) {
        return zContext.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** The desired display order given the tokenids currently held. */
    public static List<String> decode(String zSaved, List<String> zPresent) {
        LinkedHashSet<String> order = new LinkedHashSet<>();
        if (zPresent.contains(PINNED)) order.add(PINNED);        // pin Minima first when present
        if (zSaved != null && !zSaved.isEmpty()) {
            for (String tid : zSaved.split(",")) {
                if (zPresent.contains(tid)) order.add(tid);      // replay saved order (dedup via set)
            }
        }
        order.addAll(zPresent);                                  // append anything new at the end
        return new ArrayList<>(order);
    }

    /** Serialise the order back to a CSV of tokenids (Minima is implicit/pinned, so dropped). */
    public static String encode(List<String> zTokenids) {
        StringBuilder sb = new StringBuilder();
        for (String tid : zTokenids) {
            if (PINNED.equals(tid)) continue;
            if (sb.length() > 0) sb.append(',');
            sb.append(tid);
        }
        return sb.toString();
    }
}
