package com.eurobuddha.minimacore.utils;

import android.content.Context;
import android.content.res.Configuration;
import android.view.LayoutInflater;
import android.view.View;
import android.view.inputmethod.InputMethodManager;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.eurobuddha.minimacore.R;

/** Shared Terminal IDE/UTXO keyboard insets, with a dismissal action outside scrolling forms. */
public final class KeyboardInsets {
    private KeyboardInsets() {}

    public static void install(AppCompatActivity activity, View root, Toolbar toolbar, View... compactChrome) {
        View hide = LayoutInflater.from(activity).inflate(R.layout.keyboard_dismiss, toolbar, false);
        toolbar.addView(hide);
        Runnable dismiss = () -> {
            View focused = activity.getCurrentFocus();
            if (focused != null) focused.clearFocus();
            // Same explicit dismissal used by Terminal IDE's selection mode.
            InputMethodManager imm = (InputMethodManager) activity.getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) imm.hideSoftInputFromWindow(root.getWindowToken(), 0);
        };
        hide.setOnClickListener(v -> dismiss.run());
        // Filez's lifecycle-bound Back dispatcher pattern. Only intercept while
        // the IME is visible; navigation retains its normal behavior otherwise.
        OnBackPressedCallback back = new OnBackPressedCallback(false) {
            @Override public void handleOnBackPressed() { dismiss.run(); }
        };
        activity.getOnBackPressedDispatcher().addCallback(activity, back);

        final int left = root.getPaddingLeft(), top = root.getPaddingTop();
        final int right = root.getPaddingRight(), bottom = root.getPaddingBottom();
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            // Keep form scroll areas and bottom-anchored actions above the IME.
            // Max, rather than sum, avoids adding navigation-bar space twice.
            v.setPadding(left + bars.left, top + bars.top, right + bars.right,
                    bottom + Math.max(bars.bottom, ime.bottom));
            boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
            hide.setVisibility(keyboardVisible ? View.VISIBLE : View.GONE);
            back.setEnabled(keyboardVisible);
            // In landscape the main screen's tabs/footer can otherwise leave
            // zero height for the command field. Dismissing the IME restores them.
            boolean compact = keyboardVisible && v.getResources().getConfiguration().orientation
                    == Configuration.ORIENTATION_LANDSCAPE;
            for (View chrome : compactChrome) chrome.setVisibility(compact ? View.GONE : View.VISIBLE);
            return insets;
        });
        ViewCompat.requestApplyInsets(root);
    }
}
