package tech.trackium.core;

import java.lang.reflect.Modifier;
import org.junit.Test;
import org.minima.database.wallet.Wallet;
import org.minima.objects.base.MiniData;
import org.minima.system.commands.CommandRunner;
import static org.junit.Assert.*;

/** Exercises the exact Android JAR, not a replacement build from an older fork. */
public class NodeSafetyTest {
    @Test public void walletSigningAndCounterUpdatesRetainTheirSynchronizedBoundary() throws Exception {
        assertTrue(Modifier.isSynchronized(Wallet.class.getMethod("signData", String.class, MiniData.class).getModifiers()));
        assertTrue(Modifier.isSynchronized(Wallet.class.getDeclaredMethod("updateUses", int.class, String.class).getModifiers()));
    }
    @Test public void transactionInspectionAndMutationRemainPrivileged() {
        CommandRunner runner = CommandRunner.getRunner();
        for (String cmd : new String[]{"txnsign", "txnlist", "txnexport", "txnstate", "txncreate"})
            assertFalse(cmd + " must not be available as an unrestricted READ command", runner.isCommandAllowed(cmd));
        assertTrue(runner.isCommandAllowed("status"));
        // Upstream deliberately permits import into a NEW named row. Its runner
        // separately denies overwriting an existing row; OfflineNodeProbe exercises it.
        assertTrue(runner.isCommandAllowed("txnimport"));
    }
}
