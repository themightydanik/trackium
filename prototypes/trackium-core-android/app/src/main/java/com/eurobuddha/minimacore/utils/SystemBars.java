package com.eurobuddha.minimacore.utils;

import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/**
 * Keep a screen's content out from under the status and navigation bars.
 *
 * targetSdk 35 draws every window edge to edge, so a layout that does not pad for the system
 * bars puts its toolbar behind the clock and its last row behind the gesture pill.
 * {@link KeyboardInsets} already does this as part of its keyboard handling; this is the same
 * inset maths for screens with no text fields, which have no business growing a
 * keyboard-dismiss button just to get their padding right.
 */
public final class SystemBars {
    private SystemBars() {}

    public static void pad(View root) {
        final int left = root.getPaddingLeft(), top = root.getPaddingTop();
        final int right = root.getPaddingRight(), bottom = root.getPaddingBottom();
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(left + bars.left, top + bars.top, right + bars.right, bottom + bars.bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(root);
    }
}
