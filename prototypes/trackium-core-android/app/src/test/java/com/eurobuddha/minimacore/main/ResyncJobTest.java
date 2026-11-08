package com.eurobuddha.minimacore.main;

import org.junit.Test;
import static org.junit.Assert.*;

/**
 * The node has no escape character, so these rules ARE the injection defence - there is no
 * second layer behind them. Each rejected value below is a value that would otherwise reach
 * CommandRunner and be re-tokenised into parameters the user never typed.
 */
public class ResyncJobTest {

    @Test public void hostResyncCommandIsUnchangedFromBeforeTheJobRefactor() {
        ResyncJob job = ResyncJob.hostResync("example.org:9001");
        assertNotNull(job);
        assertEquals("megammrsync action:resync host:example.org:9001", job.command());
        assertEquals("Resync", job.label());
        assertEquals("example.org:9001", job.host());
        assertTrue(job.setsDefaultPeer());
    }

    @Test public void aQuoteInThePasswordCannotEndTheQuotingAndAppendParameters() {
        // "x" phrase:STOLEN would close the quote and inject a seed phrase parameter.
        assertNull(ResyncJob.fileRestore("backup.bak", "x\" phrase:STOLEN"));
        assertFalse(ResyncJob.validPassword("x\" phrase:STOLEN"));
        assertFalse(ResyncJob.validPassword("has\"quote"));
    }

    @Test public void aColonOrSpaceInThePasswordIsRefusedBecauseTheFastTokeniserRewritesIt() {
        // splitterQuotedPattern does replaceAll(":", " : ") BEFORE it handles quotes, so a:b
        // would reach the node as "a : b" - a different password than the user typed.
        assertFalse(ResyncJob.validPassword("a:b"));
        assertFalse(ResyncJob.validPassword("two words"));
        assertFalse(ResyncJob.validPassword(" leading"));
        assertFalse(ResyncJob.validPassword("trailing "));
        assertFalse(ResyncJob.validPassword("line\nbreak"));
        assertFalse(ResyncJob.validPassword("{json}"));
        assertFalse(ResyncJob.validPassword(""));
        assertFalse(ResyncJob.validPassword(null));
    }

    @Test public void passwordRuleMatchesTheCoresOwnDocumentedRule() {
        // backup.java help: "Set a password using letters and numbers only."
        assertTrue(ResyncJob.validPassword("Longsecurepassword456"));
        assertTrue(ResyncJob.validPassword("a"));
    }

    @Test public void filenameCannotEscapeTheNodeBaseFolderOrSplitIntoParameters() {
        for (String bad : new String[]{
                "../../etc/passwd", "sub/dir.bak", "back\\slash.bak", "has space.bak",
                "quote\".bak", "colon:name.bak", "..", "", null}) {
            assertFalse(String.valueOf(bad), ResyncJob.validFilename(bad));
        }
        assertTrue(ResyncJob.validFilename("minima-backup-1757894400000.bak"));
        assertTrue(ResyncJob.validFilename("my_backup.bak"));
    }

    @Test public void fileJobsQuoteTheirValuesAndCarryTheRightLabel() {
        ResyncJob restore = ResyncJob.fileRestore("backup.bak", "pass123");
        assertEquals("restore file:\"backup.bak\" password:\"pass123\"", restore.command());
        assertEquals("Restore", restore.label());
        // A pure local restore has no host, so it must never overwrite the default peer.
        assertEquals("", restore.host());
        assertFalse(restore.setsDefaultPeer());

        ResyncJob both = ResyncJob.fileResync("example.org:9001", "backup.bak", "pass123");
        assertEquals("megammrsync action:resync host:example.org:9001"
                + " file:\"backup.bak\" password:\"pass123\"", both.command());
        assertEquals("Restore", both.label());
        assertTrue(both.setsDefaultPeer());
    }

    @Test public void aSeedPhraseKeepsItsSpacesButNothingElse() {
        // Spaces survive because the value is quoted and both tokenisers keep a quoted run
        // intact; a colon or quote would not, so they are refused.
        assertTrue(ResyncJob.validPhrase(twelveWords()));
        assertFalse(ResyncJob.validPhrase("abandon:ability able about above absent absorb abstract absurd abuse access accident"));
        assertFalse(ResyncJob.validPhrase("abandon\" phrase:STOLEN able about above absent absorb abstract absurd abuse access accident"));
        assertFalse(ResyncJob.validPhrase("only three words"));
        assertFalse(ResyncJob.validPhrase(null));
        // Ragged whitespace from a paste is tidied rather than rejected.
        assertEquals(twelveWords(), ResyncJob.tidyPhrase("  " + twelveWords().replace(" ", "   ") + "  "));
    }

    @Test public void seedResyncCarriesKeyusesAndRefusesAnImpossibleOne() {
        ResyncJob job = ResyncJob.seedResync("example.org:9001", twelveWords(), 2000);
        assertNotNull(job);
        assertEquals("megammrsync action:resync host:example.org:9001"
                + " phrase:\"" + twelveWords() + "\" keyuses:2000", job.command());
        assertEquals("Seed restore", job.label());
        assertNull(ResyncJob.seedResync("example.org:9001", twelveWords(), ResyncJob.maxKeyUses(org.minima.system.params.GeneralParams.USE_BLOCK_AS_KEYUSES) + 1));
        assertNull(ResyncJob.seedResync("example.org:9001", twelveWords(), -1));
    }

    @Test public void keyusesBelowTheNodesOwnDefaultIsRefused() {
        // keyuses:0 says "no keys have been used", so after a seed resync the node signs from
        // index 0 again - and a reused Winternitz index exposes the private key. A low value is
        // not a lesser version of this operation, it is the unsafe version of it.
        assertNull(ResyncJob.seedResync("example.org:9001", twelveWords(), 0));
        assertNull(ResyncJob.seedResync("example.org:9001", twelveWords(), 1));
        assertNull(ResyncJob.seedResync("example.org:9001", twelveWords(), ResyncJob.MIN_KEY_USES - 1));
        assertNotNull(ResyncJob.seedResync("example.org:9001", twelveWords(), ResyncJob.MIN_KEY_USES));
    }

    @Test public void onlyBip39PhraseLengthsAreAccepted() {
        StringBuilder words = new StringBuilder("abandon");
        for (int count = 2; count <= 25; count++) {
            words.append(" abandon");
            boolean bip39 = count == 12 || count == 15 || count == 18 || count == 21 || count == 24;
            assertEquals(count + " words", bip39, ResyncJob.validPhrase(words.toString()));
        }
    }

    @Test public void aTruncatedSeedPasteIsNotASeed() {
        // Whole bytes only - an odd digit count means characters were lost on the way in.
        assertTrue(ResyncJob.validSeedHex("0xAB"));
        assertTrue(ResyncJob.validSeedHex("0xABCD"));
        assertFalse(ResyncJob.validSeedHex("0xABC"));
        assertFalse(ResyncJob.validSeedHex("0x"));
    }

    @Test public void theCommandIsDroppedOnceItHasBeenDispatched() {
        // It carries the backup password and ResyncSession is a process-lifetime singleton.
        ResyncJob job = ResyncJob.fileRestore("backup.bak", "pass123");
        assertTrue(job.command().contains("pass123"));
        job.forgetCommand();
        assertEquals("", job.command());
        // Everything the UI still needs survives.
        assertEquals("Restore", job.label());
        assertFalse(job.selfShutsDown());
    }

    @Test public void restoreLimitFollowsTheModeThatWillDeriveTheKeys() {
        assertNotNull(ResyncJob.seedResync("example.org:9001", twelveWords(), 262144, false));
        assertNull(ResyncJob.seedResync("example.org:9001", twelveWords(), 262145, false));
        assertNotNull(ResyncJob.seedResync("example.org:9001", twelveWords(), 268435456, true));
        assertNull(ResyncJob.seedResync("example.org:9001", twelveWords(), 268435457, true));
    }

    private static String twelveWords() {
        return "abandon ability able about above absent absorb abstract absurd abuse access accident";
    }

    @Test public void onlyTheMegammrsyncFamilyTakesTheNodeDownItself() {
        // megammrsync ends with Main.NotifyMainListenerOfShutDown(), which the service answers
        // with stopSelf(). Plain `restore` returns "Restart Minima for restore to take effect!"
        // and never notifies anyone, so a screen that waits for a shutdown there waits forever.
        assertTrue(ResyncJob.hostResync("example.org:9001").selfShutsDown());
        assertTrue(ResyncJob.fileResync("example.org:9001", "backup.bak", "pass123").selfShutsDown());
        assertTrue(ResyncJob.seedResync("example.org:9001", twelveWords(), 2000).selfShutsDown());
        assertFalse(ResyncJob.fileRestore("backup.bak", "pass123").selfShutsDown());
    }

    @Test public void onlyTheMonitorsResyncIsMarkedAutomatic() {
        // An automatic job has nobody watching the screen, so ResyncLauncher must not cancel
        // the restart alarm for it and must bring the node back itself afterwards.
        assertTrue(ResyncJob.hostResync("example.org:9001", true).automatic());
        assertFalse(ResyncJob.hostResync("example.org:9001").automatic());
        assertFalse(ResyncJob.fileRestore("backup.bak", "pass123").automatic());
        assertFalse(ResyncJob.seedResync("example.org:9001", twelveWords(), 2000).automatic());
    }

    @Test public void anInvalidJobIsNullSoItCanNeverBeStarted() {
        assertNull(ResyncJob.hostResync("node:9001;quit"));
        assertNull(ResyncJob.fileRestore("backup.bak", ""));
        assertNull(ResyncJob.fileResync("bad host", "backup.bak", "pass123"));
    }
}
