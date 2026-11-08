package com.eurobuddha.minimacore.main;

import android.content.SharedPreferences;
import com.eurobuddha.minimacore.BuildConfig;
import java.util.List;

/** Saved startup policy. Reading it must never change the running node's globals. */
public final class StartupMode {
    public static final String PREF_CLASSIC_MODE = "PARAM_CLASSIC_MODE";
    /** Keets transport on/off (Startup Params). Off = classic Minima transport only: no `-keets`, no
     *  worklet/DHT, no Chat tab, no built-in Parlons client. Default on = the behaviour before 2.2.0. */
    public static final String PREF_KEETS = "keets_enabled";

    private StartupMode() {}

    public static boolean keetsEnabled(SharedPreferences prefs) {
        return prefs.getBoolean(PREF_KEETS, true);
    }

    /** Drop the three flags the Keets transport switch owns (-keets, -keetssidecar, -keetssidecarargs)
     *  from stored extra params - a stored copy would override "off". Whole tokens only: -keetsbootstrap,
     *  -keetsconnect, -keetsmaxconns, -keetsmailboxurl and -keetsnode stay the user's to set. */
    public static String withoutKeetsSwitchFlags(String extra) {
        return extra.replaceAll("(?<!\\S)-keets(?:sidecar(?:args)?)?(?!\\S)", "");
    }

    /** Tab geometry: Chat is the only optional tab. -1 = no Chat tab. */
    static int chatPosition(boolean pandaShell, boolean chat) {
        return !chat ? -1 : pandaShell ? 3 : 4;
    }

    /** The Node/Home tab: last in the panda shell (slides down when Chat goes), first in classic. */
    static int homePosition(boolean pandaShell, boolean chat) {
        return !pandaShell ? 0 : chat ? 4 : 3;
    }

    public static boolean usesBlockKeys(SharedPreferences prefs) {
        return usesBlockKeys(BuildConfig.PANDAMONIUM, BuildConfig.BLOCK_KEYUSES,
                prefs.getBoolean(PREF_CLASSIC_MODE, false));
    }

    static boolean usesBlockKeys(boolean pandamonium, boolean blockDefault, boolean classic) {
        return blockDefault && !(pandamonium && classic);
    }

    public static void addArguments(List<String> args, boolean blockMode) {
        if (blockMode) {
            args.add("-blockaskeyuses");
            args.add("-lowram");
        }
    }

    public static boolean isManagedArgument(String arg) {
        return "-blockaskeyuses".equals(arg) || "-lowram".equals(arg)
                || "-sqlcoindb".equals(arg) || "-sqltxblockdb".equals(arg);
    }

    /** Remove old free-text overrides, including their optional value, before validation.
     * The core accepts both bare switches and switches followed by true/false.
     */
    public static String withoutManagedArguments(String extra) {
        String[] tokens = extra.trim().split("\\s+");
        StringBuilder kept = new StringBuilder();
        for (int i = 0; i < tokens.length; i++) {
            if (isManagedArgument(tokens[i])) {
                if (i + 1 < tokens.length && !tokens[i + 1].startsWith("-")) i++;
            } else if (!tokens[i].isEmpty()) {
                if (kept.length() > 0) kept.append(' ');
                kept.append(tokens[i]);
            }
        }
        return kept.toString();
    }
}
