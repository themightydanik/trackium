package com.eurobuddha.minimacore.main;

import org.minima.system.params.GeneralParams;

import org.minima.system.commands.network.connect;
import org.minima.utils.messages.Message;

/**
 * One destructive node job: the command to run, and the words to describe it while it runs.
 *
 * WHY THIS TYPE EXISTS: {@link ResyncSession} used to hard-code
 * "megammrsync action:resync host:" + host. Restore, MegaMMR-from-file and archive reset are
 * equally destructive and equally restart the node, so they must share that session's lifecycle
 * (see ResyncLauncher) rather than grow their own. A job is the only thing that varies.
 *
 * WHY THE VALIDATION IS SO STRICT: the node has NO escape character. CommandRunner tokenises
 * with a bare quote-toggle, so a '"' inside a value ends the quote and everything after it
 * becomes new parameters - a password is enough to inject "phrase:" or "confirm:". Worse, the
 * fast tokeniser (splitterQuotedPattern) runs replaceAll(":", " : ") BEFORE it looks at quotes,
 * so a password of a:b arrives at the command as "a : b" - silently different from what the user
 * typed, and unusable from the terminal or any other client. Values are therefore restricted to
 * characters that survive both tokenisers byte-for-byte. This is not over-caution: it is the
 * rule the core itself documents in backup.java - "Set a password using letters and numbers only."
 */
public final class ResyncJob {

    public enum Kind { HOST_RESYNC, FILE_RESTORE, FILE_RESYNC, SEED_RESYNC }

    /** Letters and numbers only - the core's own documented password rule (backup.java help). */
    private static final String PASSWORD_RULE = "[A-Za-z0-9]{1,128}";

    /** A plain base-folder filename. No separators, no quotes, no spaces, no colons. */
    private static final String FILENAME_RULE = "[A-Za-z0-9][A-Za-z0-9._-]{0,127}";

    /**
     * A BIP39 seed phrase: words and single spaces, nothing else.
     *
     * Spaces are the one whitespace that CAN be carried safely, because the value is quoted and
     * both tokenisers keep a quoted run intact. A ':' or '"' cannot - see the class comment.
     */
    private static final String PHRASE_RULE = "[A-Za-z]+( [A-Za-z]+)+";

    /** BIP39 only ever produces these lengths, so anything else is a typo, not a phrase. */
    private static final int[] PHRASE_WORD_COUNTS = {12, 15, 18, 21, 24};

    /**
     * The node's own default, and our floor.
     *
     * keyuses:0 is the single most dangerous value this app can send. It tells the node no keys
     * have been used, so after a seed resync it signs from index 0 again - and a reused
     * Winternitz index exposes the private key. Refusing it outright is the only safe default;
     * the node itself defaults to 1000 for the same reason.
     */
    public static final int MIN_KEY_USES = 1000;
    //Legacy keys are 64x3 trees (262,144 leaves); the block flavor's keys are 128x4
    //(268,435,456) and its key uses track the chain tip block number.
    public static int maxKeyUses(boolean blockMode) {
        return blockMode ? 268435456 : 262144;
    }

    private final Kind kind;
    private final boolean selfShutsDown;
    private final boolean automatic;
    private String command;
    private final String host;
    private final String label;
    private final String startLine;

    private ResyncJob(Kind kind, boolean selfShutsDown, boolean automatic, String command,
                      String host, String label, String startLine) {
        this.kind = kind;
        this.selfShutsDown = selfShutsDown;
        this.automatic = automatic;
        this.command = command;
        this.host = host;
        this.label = label;
        this.startLine = startLine;
    }

    // ---- validation ----

    /** Reject command separators/extra parameters, then reuse the node's host parser. */
    public static boolean validHost(String host) {
        if (host == null || !host.matches("[A-Za-z0-9.-]+:[0-9]{1,5}")) return false;
        Message parsed = connect.createConnectMessage(host);
        return parsed != null && parsed.getInteger("port") > 0 && parsed.getInteger("port") <= 65535;
    }

    /**
     * Letters and numbers only. Anything else either breaks out of the quoting (") or is
     * silently rewritten by the tokeniser (: and whitespace) - see the class comment.
     */
    public static boolean validPassword(String password) {
        return password != null && password.matches(PASSWORD_RULE);
    }

    /**
     * A bare filename in the node's base folder. Rejects every path separator and "..", so a
     * job can never be pointed outside the folder the node actually reads from.
     */
    public static boolean validFilename(String filename) {
        return filename != null && filename.matches(FILENAME_RULE) && !filename.contains("..");
    }

    /**
     * The wallet seed as the node stores it: SeedRow keeps seed.to0xString().
     * Whole bytes only - an odd digit count is a truncated paste, not a seed.
     */
    public static boolean validSeedHex(String seed) {
        return seed != null && seed.matches("0[xX](?:[0-9A-Fa-f]{2}){1,128}");
    }

    /** A BIP39-length phrase of letters and single spaces. Rejects what the tokeniser rewrites. */
    public static boolean validPhrase(String phrase) {
        if (phrase == null || !phrase.matches(PHRASE_RULE)) return false;
        int words = phrase.split(" ").length;
        for (int allowed : PHRASE_WORD_COUNTS) {
            if (words == allowed) return true;
        }
        return false;
    }

    /** Collapse the whitespace a user pastes, so a tidy phrase is not rejected for formatting. */
    public static String tidyPhrase(String phrase) {
        return phrase == null ? "" : phrase.trim().replaceAll("\\s+", " ");
    }

    // ---- factories ----

    /**
     * Chain resync from a MegaMMR host. The wallet and seed are untouched.
     * Command string is byte-identical to the one ResyncSession used before this type existed.
     */
    public static ResyncJob hostResync(String host) {
        return hostResync(host, false);
    }

    /**
     * @param automatic true when the health monitor started it with nobody watching. Such a job
     *                  must bring the node back itself (ResyncLauncher.afterShutdown) - a manual
     *                  one leaves restart with the user.
     */
    public static ResyncJob hostResync(String host, boolean automatic) {
        if (!validHost(host)) return null;
        return new ResyncJob(Kind.HOST_RESYNC, true, automatic,
                "megammrsync action:resync host:" + host,
                host,
                "Resync",
                "Starting node resync from " + host);
    }

    /** Pure local restore from a backup file already in the node's base folder. No network. */
    public static ResyncJob fileRestore(String filename, String password) {
        if (!validFilename(filename) || !validPassword(password)) return null;
        return new ResyncJob(Kind.FILE_RESTORE, false, false,
                "restore file:\"" + filename + "\" password:\"" + password + "\"",
                "",
                "Restore",
                "Restoring from " + filename);
    }

    /** Restore a backup file AND resync to the chain tip from a MegaMMR host. */
    public static ResyncJob fileResync(String host, String filename, String password) {
        if (!validHost(host) || !validFilename(filename) || !validPassword(password)) return null;
        return new ResyncJob(Kind.FILE_RESYNC, true, false,
                "megammrsync action:resync host:" + host
                        + " file:\"" + filename + "\" password:\"" + password + "\"",
                host,
                "Restore",
                "Restoring from " + filename + " and resyncing from " + host);
    }

    /**
     * Rebuild this wallet from a seed phrase and resync from a MegaMMR host.
     *
     * keyuses matters and is not cosmetic: Minima signatures are stateful, so every seed resync
     * must declare a higher used-key count than the last one or previously used keys can be
     * reused - which is how a wallet loses funds. Floored at MIN_KEY_USES: a low value is not a
     * lesser version of this operation, it is the unsafe version of it.
     */
    public static ResyncJob seedResync(String host, String phrase, int keyUses) {
        return seedResync(host, phrase, keyUses, GeneralParams.USE_BLOCK_AS_KEYUSES);
    }

    static ResyncJob seedResync(String host, String phrase, int keyUses, boolean blockMode) {
        String tidy = tidyPhrase(phrase);
        if (!validHost(host) || !validPhrase(tidy)
                || keyUses < MIN_KEY_USES || keyUses > maxKeyUses(blockMode)) return null;
        return new ResyncJob(Kind.SEED_RESYNC, true, false,
                "megammrsync action:resync host:" + host
                        + " phrase:\"" + tidy + "\" keyuses:" + keyUses,
                host,
                "Seed restore",
                "Rebuilding this wallet from your seed phrase, resyncing from " + host);
    }

    // ---- accessors ----

    public Kind kind() { return kind; }

    /** The exact string handed to the node. Never logged - it carries the backup password. */
    public String command() { return command; }

    /**
     * Drop our reference to the command once it has been dispatched.
     *
     * The command string carries the backup password, and ResyncSession is a process-lifetime
     * singleton, so holding it kept the password reachable long after the node had finished with
     * it. This does not scrub it from memory - Java strings cannot be zeroed - but it stops the
     * lifetime being "until the app dies". Everything the UI reads afterwards (label, host, kind,
     * selfShutsDown) is still here.
     */
    void forgetCommand() { command = ""; }

    /** "" when this job has no host, so callers can always ask without a null check. */
    public String host() { return host; }

    /** "Resync" / "Restore" - used to build progress and failure text for THIS operation. */
    public String label() { return label; }

    /** First line of the live log. Safe to show: it never contains the password. */
    public String startLine() { return startLine; }

    /** Started by the health monitor, not a person - so the node must restart itself afterwards. */
    public boolean automatic() { return automatic; }

    /** True when finishing this job should be remembered as the node's default peer. */
    public boolean setsDefaultPeer() { return !host.isEmpty(); }

    /**
     * Whether the NODE takes itself down when this command finishes.
     *
     * This is not a detail - it decides whether a screen may wait for a shutdown.
     * megammrsync ends with Main.NotifyMainListenerOfShutDown(), which MinimaService receives
     * and answers with stopSelf(), so onDestroy runs and isShutdownComplete() becomes true.
     * Plain `restore` does NOT: it calls Main.restoreReady(true) part-way through, tears the
     * node's processors down in place, and returns "Restart Minima for restore to take effect!"
     * without ever notifying the service. Waiting for a shutdown there waits forever - which
     * left the restore screen spinning with its Restart button disabled and force-quit as the
     * only way out (reported on device, 2026-09-16).
     */
    public boolean selfShutsDown() { return selfShutsDown; }
}
