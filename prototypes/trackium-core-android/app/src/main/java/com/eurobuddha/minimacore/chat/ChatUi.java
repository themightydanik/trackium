package com.eurobuddha.minimacore.chat;

import android.graphics.Color;
import com.eurobuddha.minimacore.i18n.Language;
import android.graphics.drawable.GradientDrawable;
import android.widget.TextView;

import java.text.DateFormat;
import java.util.Calendar;
import java.util.Date;

/** Small shared helpers for the chat UI: avatars and human time labels. */
public final class ChatUi {

    private ChatUi() {}

    /** Deterministic avatar: circle coloured from the pubkey, contact's initial on top. */
    public static void avatar(TextView zView, String zName, String zPubkey) {
        float hue = 0;
        try { hue = Integer.parseInt(zPubkey.substring(4, 8), 16) % 360; } catch (Exception e) {}
        int color = Color.HSVToColor(new float[]{hue, 0.55f, 0.75f});
        GradientDrawable d = new GradientDrawable();
        d.setShape(GradientDrawable.OVAL);
        d.setColor(color);
        zView.setBackground(d);
        String initial = "?";
        if (zName != null && !zName.equals("")) {
            // Same Unicode boundary calculation as Parlons CloudChatsPage.oneLine.
            initial = zName.substring(0, zName.offsetByCodePoints(0, 1)).toUpperCase(Language.locale());
            if (zName.startsWith("0x")) initial = "#";
        }
        zView.setText(initial);
    }

    /** WhatsApp-style list time: time today, weekday this week, date otherwise. */
    public static String listTime(long zTs) {
        if (zTs == 0) return "";
        Calendar now = Calendar.getInstance();
        Calendar then = Calendar.getInstance();
        then.setTimeInMillis(zTs);
        if (now.get(Calendar.YEAR) == then.get(Calendar.YEAR)
                && now.get(Calendar.DAY_OF_YEAR) == then.get(Calendar.DAY_OF_YEAR)) {
            return Language.date(zTs, "Hm");
        }
        long days = (now.getTimeInMillis() - zTs) / (24L * 3600 * 1000);
        if (days < 7) {
            return Language.date(zTs, "EEE");
        }
        return Language.date(zTs, "yMd");
    }

    /** Date-separator label: Today / Yesterday / full date. */
    public static String dayLabel(android.content.Context context, long zTs) {
        return Language.dayLabel(context, zTs, false);
    }

    public static boolean sameDay(long zA, long zB) {
        Calendar a = Calendar.getInstance(); a.setTimeInMillis(zA);
        Calendar b = Calendar.getInstance(); b.setTimeInMillis(zB);
        return sameDay(a, b);
    }

    private static boolean sameDay(Calendar a, Calendar b) {
        return a.get(Calendar.YEAR) == b.get(Calendar.YEAR)
                && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR);
    }

    /** Delivery glyphs: pending → one tick (held at a mailbox) → two ticks (direct). */
    public static String statusGlyph(String zVia) {
        if (zVia == null || zVia.equals("") || zVia.startsWith("sending")) return "🕓";
        if (zVia.equals("direct") || zVia.equals("delivered")) return "✓✓";
        if (zVia.equals("mailbox")) return "✓";
        if (zVia.equals("FAILED")) return "✗";
        return "✓";
    }
}
