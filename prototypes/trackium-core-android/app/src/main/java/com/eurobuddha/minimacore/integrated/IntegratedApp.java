package com.eurobuddha.minimacore.integrated;

import android.graphics.drawable.Drawable;

/** One of our own integrated apps, as shown in the Apps tab's Internal list.
 *  {@code id} is the stable allowlist index (see PandamoniumDestinations in the
 *  Pandamonium flavour); classic/block builds have none of these. */
public final class IntegratedApp {
    public final int id;          // allowlist identity, not a display position
    public final String name;
    public final Drawable icon;
    public final boolean enabled; // false = hidden from the app drawer
    public final boolean locked;  // the host (Minima Core) — always on
    public final boolean frozen;  // deep frozen: no background work until opened

    public IntegratedApp(int zId, String zName, Drawable zIcon, boolean zEnabled, boolean zLocked) {
        this(zId, zName, zIcon, zEnabled, zLocked, false);
    }
    public IntegratedApp(int zId, String zName, Drawable zIcon, boolean zEnabled, boolean zLocked, boolean zFrozen) {
        id = zId; name = zName; icon = zIcon; enabled = zEnabled; locked = zLocked; frozen = zFrozen;
    }
}
