package com.eurobuddha.minimacore.main.backup;

import com.eurobuddha.minimacore.main.ResyncJob;

/**
 * The `vault` commands, built and validated in one place.
 *
 * Same contract as {@link ResyncJob}: a builder returns null when the input is not safe to put
 * into a node command, so an invalid value can never reach CommandRunner. The node has no escape
 * character - see ResyncJob for why that makes validation the only defence. vault.java has its
 * own partial guard (it refuses ';' in a password), which is a hint in the same direction rather
 * than a reason to relax anything here.
 *
 * These commands are NOT destructive to the chain and do not restart the node, so unlike restore
 * they do not go through ResyncLauncher. wipekeys IS destructive to the wallet, which is why the
 * node makes the caller hand back the seed to prove they hold it.
 */
public final class VaultCommands {

    private VaultCommands() {}

    /** Read the seed phrase, the seed, and whether the private keys are currently locked. */
    public static String read() {
        return "vault";
    }

    /**
     * Encrypt the private keys behind a password. They are wiped from the wallet and kept
     * encrypted in the UserDB, so the node can still verify but cannot spend until unlocked.
     *
     * Takes the SECOND entry, not a copy of the first. Passing the same string as confirm: made
     * the node compare the password with itself, which always matched - the check looked like it
     * was there and did nothing. The caller must collect two separate entries.
     */
    public static String passwordLock(String password, String confirm) {
        if (!ResyncJob.validPassword(password) || !ResyncJob.validPassword(confirm)) return null;
        if (!password.equals(confirm)) return null;
        return "vault action:passwordlock password:\"" + password + "\" confirm:\"" + confirm + "\"";
    }

    /** Decrypt the private keys again. */
    public static String passwordUnlock(String password) {
        if (!ResyncJob.validPassword(password)) return null;
        return "vault action:passwordunlock password:\"" + password + "\"";
    }

    /**
     * Wipe the private keys, keeping the public keys and modifiers.
     *
     * The node requires the seed back ("TO SHOW THEY KNOW IT", vault.java) and refuses if it
     * does not match. That is the whole safety mechanism: without the seed or phrase recorded
     * somewhere, a wipe is permanent.
     */
    public static String wipeKeys(String seedHex) {
        if (!ResyncJob.validSeedHex(seedHex)) return null;
        return "vault action:wipekeys seed:" + seedHex;
    }

    /** Recreate the private keys from the seed phrase, undoing a wipe. */
    public static String restoreKeys(String phrase) {
        String tidy = ResyncJob.tidyPhrase(phrase);
        if (!ResyncJob.validPhrase(tidy)) return null;
        return "vault action:restorekeys phrase:\"" + tidy + "\"";
    }
}
