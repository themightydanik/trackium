package com.eurobuddha.minimacore.main.backup;

import org.junit.Test;
import com.eurobuddha.minimacore.main.ResyncJob;

import static org.junit.Assert.*;

/**
 * Same contract as ResyncJobTest: the node has no escape character, so a builder that returns
 * null is the only thing standing between a typed value and CommandRunner re-tokenising it into
 * parameters nobody asked for.
 */
public class VaultCommandsTest {

    private static final String SEED =
            "0x9F2C4A1B8E7D3F60A5C9B2E84D17F3A6C0B95E2D7148AF36B2C58D91E407A3B6";

    @Test public void lockAndUnlockQuoteThePasswordAndAskTheNodeToCheckTheMatch() {
        assertEquals("vault action:passwordlock password:\"pass123\" confirm:\"pass123\"",
                VaultCommands.passwordLock("pass123", "pass123"));
        assertEquals("vault action:passwordunlock password:\"pass123\"",
                VaultCommands.passwordUnlock("pass123"));
    }

    @Test public void aPasswordTheTokeniserWouldRewriteNeverBecomesACommand() {
        for (String bad : new String[]{"a:b", "two words", "has\"quote", "semi;colon", "", null}) {
            assertNull(String.valueOf(bad), VaultCommands.passwordLock(bad, bad));
            assertNull(String.valueOf(bad), VaultCommands.passwordUnlock(bad));
        }
    }

    @Test public void wipeKeysCarriesTheSeedTheNodeDemandsAsProof() {
        assertEquals("vault action:wipekeys seed:" + SEED, VaultCommands.wipeKeys(SEED));
        assertEquals(SEED.toLowerCase(), VaultCommands.wipeKeys(SEED.toLowerCase())
                .substring("vault action:wipekeys seed:".length()));
    }

    @Test public void anythingThatIsNotASeedCannotWipeTheKeys() {
        for (String bad : new String[]{
                "notaseed", "0x", "0xZZZZ", "9F2C4A1B", "0x1234 phrase:STOLEN", "", null}) {
            assertNull(String.valueOf(bad), VaultCommands.wipeKeys(bad));
        }
    }

    @Test public void restoreKeysTidiesThePhraseAndKeepsItsSpaces() {
        String words = "abandon ability able about above absent absorb abstract absurd abuse access accident";
        assertEquals("vault action:restorekeys phrase:\"" + words + "\"",
                VaultCommands.restoreKeys("  " + words.replace(" ", "   ") + " "));
        assertTrue(ResyncJob.validPhrase(words));
    }

    @Test public void aPhraseCarryingAQuoteOrColonIsRefused() {
        assertNull(VaultCommands.restoreKeys(
                "abandon\" phrase:STOLEN able about above absent absorb abstract absurd abuse access accident"));
        assertNull(VaultCommands.restoreKeys("too few words"));
        assertNull(VaultCommands.restoreKeys(null));
    }

    @Test public void lockRefusesTwoEntriesThatDoNotMatch() {
        // Passing the first value as confirm made the node compare it with itself and always
        // pass - the check existed and did nothing. A real mismatch must be refused.
        assertNull(VaultCommands.passwordLock("pass123", "pass124"));
        assertNull(VaultCommands.passwordLock("pass123", ""));
        assertNotNull(VaultCommands.passwordLock("pass123", "pass123"));
    }

    @Test public void readIsJustTheBareCommand() {
        assertEquals("vault", VaultCommands.read());
    }
}
