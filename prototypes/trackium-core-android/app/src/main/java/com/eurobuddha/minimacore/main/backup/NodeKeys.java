package com.eurobuddha.minimacore.main.backup;

import org.minima.database.wallet.Wallet;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import org.minima.system.Main;

/**
 * Whether the node has finished creating its initial keys.
 *
 * Every command on the Backup &amp; Recovery screens - backup included, not just the restores -
 * begins with vault.checkAllKeysCreated() and throws if they are not ready
 * (backup.java:78, vault.java:290). Asking the node once, up front, turns what would otherwise be
 * six identical mid-operation failures into one honest "not yet, here is the progress" banner.
 */
public final class NodeKeys {

    public static final class Status {
        /** False when the node process is not up at all - nothing here can run. */
        public final boolean nodeRunning;
        /** True when every initial key exists and the commands will be accepted. */
        public final boolean ready;
        public final int created;
        public final int total;

        Status(boolean nodeRunning, boolean ready, int created, int total) {
            this.nodeRunning = nodeRunning;
            this.ready = ready;
            this.created = created;
            this.total = total;
        }

        /** The banner text, phrased the way the node itself phrases it. */
        public CharSequence message() {
            if (!nodeRunning) return Language.msg(l10n_backup_node_stopped);
            if (ready) return "";
            return Language.msg(l10n_backup_keys_pending, created, total);
        }
    }

    private NodeKeys() {}

    public static Status read() {
        Main node = Main.getInstance();
        if (node == null) return new Status(false, false, 0, Wallet.NUMBER_GETADDRESS_KEYS);
        return new Status(true, node.getAllKeysCreated(),
                node.getAllDefaultKeysSize(), Wallet.NUMBER_GETADDRESS_KEYS);
    }
}
