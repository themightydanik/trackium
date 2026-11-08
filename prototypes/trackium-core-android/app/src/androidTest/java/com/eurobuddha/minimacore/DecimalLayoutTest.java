package com.eurobuddha.minimacore;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.text.Layout;
import android.view.ContextThemeWrapper;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.TextView;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import static org.junit.Assert.*;

/** Exercises Android's actual line layout: every digit must remain visible at narrow widths. */
@RunWith(AndroidJUnit4.class)
public class DecimalLayoutTest {
    private static final String AMOUNT = "123456789.12345678901234567890123456789012345678901234";

    @Test public void fullAmountsWrapWithoutClippingOrDisplacingNames() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();
            for (float scale : new float[]{1f, 1.5f, 2f}) {
                Configuration config = new Configuration(app.getResources().getConfiguration());
                config.fontScale = scale;
                Context ctx = new ContextThemeWrapper(app.createConfigurationContext(config), R.style.Theme_MinimaCore);
                int width = Math.round(320 * ctx.getResources().getDisplayMetrics().density);
                for (int resource : new int[]{R.layout.view_wallet_balance, R.layout.view_balance_row, R.layout.view_coin_row}) {
                    View root = LayoutInflater.from(ctx).inflate(resource, null);
                    int id = resource == R.layout.view_wallet_balance ? R.id.wallet_total_balance
                            : resource == R.layout.view_balance_row ? R.id.balance_tokenamount : R.id.coin_amount;
                    TextView amount = root.findViewById(id);
                    amount.setText(AMOUNT);
                    if (resource == R.layout.view_balance_row) {
                        ((TextView) root.findViewById(R.id.balance_tokenname)).setText("Long decimal token");
                        ((TextView) root.findViewById(R.id.balance_tokenid)).setText("0x1234567890123456789012345678901234567890123456789012345678901234");
                    } else if (resource == R.layout.view_coin_row) {
                        root.findViewById(R.id.coin_locked).setVisibility(View.VISIBLE);
                    }
                    root.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
                    root.layout(0, 0, width, root.getMeasuredHeight());
                    assertFullyVisible(amount);
                    assertTrue("Long decimals must wrap", amount.getLineCount() > 1);
                    if (resource == R.layout.view_balance_row) {
                        assertFullyVisible(root.findViewById(R.id.balance_tokenname));
                        save(root, app, "decimal-row-" + scale + ".png");
                    }
                }
            }
        });
    }

    private static void assertFullyVisible(TextView view) {
        Layout layout = view.getLayout();
        assertNotNull(layout);
        assertEquals(view.getText().length(), layout.getLineEnd(layout.getLineCount() - 1));
        int width = view.getWidth() - view.getCompoundPaddingLeft() - view.getCompoundPaddingRight();
        for (int line = 0; line < layout.getLineCount(); line++) {
            assertEquals(0, layout.getEllipsisCount(line));
            assertTrue("Text overruns available width", layout.getLineWidth(line) <= width + 1);
        }
        assertTrue("Last line clipped vertically", layout.getHeight() <=
                view.getHeight() - view.getCompoundPaddingTop() - view.getCompoundPaddingBottom());
    }

    private static void save(View root, Context app, String name) {
        Bitmap image = Bitmap.createBitmap(root.getWidth(), root.getHeight(), Bitmap.Config.ARGB_8888);
        root.draw(new Canvas(image));
        try (FileOutputStream out = new FileOutputStream(new File(app.getCacheDir(), name))) {
            image.compress(Bitmap.CompressFormat.PNG, 100, out);
        } catch (Exception e) { throw new AssertionError(e); }
        finally { image.recycle(); }
    }
}
