package com.eurobuddha.minimacore.main;

import org.junit.Test;
import org.minima.system.params.GeneralParams;
import org.minima.system.params.ParamConfigurer;
import java.util.ArrayList;
import static org.junit.Assert.*;

public class StartupModeTest {
    @Test public void onlyPandamoniumAllowsAnOverrideAndDefaultsToBlockMode() {
        assertTrue(StartupMode.usesBlockKeys(true, true, false));
        assertFalse(StartupMode.usesBlockKeys(true, true, true));
        assertTrue(StartupMode.usesBlockKeys(false, true, true));
        assertTrue(StartupMode.usesBlockKeys(false, true, false));
        assertFalse(StartupMode.usesBlockKeys(false, false, true));
        assertFalse(StartupMode.usesBlockKeys(false, false, false));
    }

    @Test public void chatTabIsTheOnlyOptionalSlot() {
        assertEquals(3, StartupMode.chatPosition(true, true));
        assertEquals(4, StartupMode.chatPosition(false, true));
        assertEquals(-1, StartupMode.chatPosition(true, false));
        assertEquals(-1, StartupMode.chatPosition(false, false));
        assertEquals(4, StartupMode.homePosition(true, true));
        assertEquals(3, StartupMode.homePosition(true, false));   // Node slides into Chat's slot
        assertEquals(0, StartupMode.homePosition(false, true));
        assertEquals(0, StartupMode.homePosition(false, false));
    }

    @Test public void keetsSwitchStripsOnlyItsOwnFlagsWholeToken() {
        assertEquals("-keetsbootstrap h:49737  -keetsmaxconns 8 -port 25001",
                StartupMode.withoutKeetsSwitchFlags("-keetsbootstrap h:49737 -keets -keetsmaxconns 8 -port 25001"));
        assertEquals(" /p  -megammr", StartupMode.withoutKeetsSwitchFlags("-keetssidecar /p -keetssidecarargs -megammr"));
        assertEquals("", StartupMode.withoutKeetsSwitchFlags("-keets"));
        assertEquals("-keetsconnect x", StartupMode.withoutKeetsSwitchFlags("-keetsconnect x"));
    }

    @Test public void nodeParserAppliesBothProfilesAcrossRepeatedRestarts() {
        try {
            for (boolean block : new boolean[]{true, false, true, false}) {
                // This is the reset Minima.main performs on each Android service restart.
                GeneralParams.resetDefaults();
                ArrayList<String> args = new ArrayList<>();
                StartupMode.addArguments(args, block);
                assertEquals(block ? 2 : 0, args.size());
                assertTrue(ParamConfigurer.checkParams(args.toArray(new String[0])));
                assertEquals(block, GeneralParams.USE_BLOCK_AS_KEYUSES);
                assertEquals(block, GeneralParams.USE_SQL_COINDB);
                assertEquals(block, GeneralParams.USE_SQL_TXBLOCKDB);
            }
        } finally { GeneralParams.resetDefaults(); }
    }

    @Test public void oldOverridesAndOptionalValuesCannotDefeatEitherProfile() {
        String extra = "-lowram true -p2pnodes node.example:9001 -blockaskeyuses false "
                + "-sqlcoindb -sqltxblockdb true -limitbandwidth -lowram";
        assertEquals("-p2pnodes node.example:9001 -limitbandwidth", StartupMode.withoutManagedArguments(extra));
        assertEquals("", StartupMode.withoutManagedArguments(" \n -lowram\tfalse  "));
        assertEquals("", StartupMode.withoutManagedArguments(""));
        assertEquals("-p2pnodes lowram.example:9001", StartupMode.withoutManagedArguments("-p2pnodes lowram.example:9001"));
    }
}
