package com.eurobuddha.minimacore.main.backup;

import org.junit.Before;
import org.junit.Test;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

import static org.junit.Assert.*;

/**
 * These are the guardrails MinimaReceiver's FILE bridge used to provide and that running
 * in-process throws away. If they regress, the node's own UI gains the ability to write outside
 * its data folder or into the live chain DB - so they are tested rather than assumed.
 */
public class NodeFilesTest {

    private File base;

    @Before public void setUp() throws IOException {
        base = File.createTempFile("nodefiles", "");
        assertTrue(base.delete());
        assertTrue(base.mkdirs());
    }

    @Test public void aPathCannotClimbOutOfTheBaseFolder() {
        for (String escape : new String[]{"../evil", "../../evil", "sub/../../evil", "/etc/passwd"}) {
            try {
                File resolved = NodeFiles.resolveInBase(base, escape);
                // An absolute path is re-rooted rather than escaping; anything that lands
                // outside must have thrown.
                assertTrue(escape + " resolved to " + resolved,
                        resolved.getCanonicalPath().startsWith(base.getCanonicalPath()));
            } catch (IOException expected) {
                assertEquals("Path outside base folder", expected.getMessage());
            }
        }
    }

    @Test public void writeGuardIndependentlyRejectsOutsidePathsAndTheBaseItself() throws Exception {
        assertThrows(IOException.class, () -> NodeFiles.checkWriteAllowed(base, base));
        assertThrows(IOException.class, () -> NodeFiles.checkWriteAllowed(base, new File(base,"../outside")));
        assertThrows(IOException.class, () -> NodeFiles.checkWriteAllowed(base, new File(base.getPath()+"-sibling","data")));
    }
    @Test public void symlinkCannotRedirectAWriteToLiveDatabasesOrOutsideBase() throws Exception {
        File live=new File(base,"databases"); assertTrue(live.mkdir());
        java.nio.file.Files.createSymbolicLink(new File(base,"linked").toPath(),live.toPath());
        assertThrows(IOException.class, () -> NodeFiles.checkWriteAllowed(base,NodeFiles.resolveInBase(base,"linked/live.db")));
        java.nio.file.Files.createSymbolicLink(new File(base,"outside").toPath(),base.getParentFile().toPath());
        assertThrows(IOException.class, () -> NodeFiles.resolveInBase(base,"outside/target"));
    }

    @Test public void anOrdinaryNameResolvesInsideTheBaseFolder() throws IOException {
        File resolved = NodeFiles.resolveInBase(base, "backup.bak");
        assertEquals(new File(base, "backup.bak").getCanonicalPath(), resolved.getCanonicalPath());
    }

    @Test public void theLiveDatabasesFolderCanNeverBeWritten() throws IOException {
        try {
            NodeFiles.checkWriteAllowed(base, NodeFiles.resolveInBase(base, "databases/txpow.mv.db"));
            fail("Expected the databases folder to be refused");
        } catch (IOException expected) {
            assertTrue(expected.getMessage(), expected.getMessage().contains("protected"));
        }
        // A file that merely starts with the same letters is not the protected folder.
        NodeFiles.checkWriteAllowed(base, NodeFiles.resolveInBase(base, "databases-old.bak"));
        NodeFiles.checkWriteAllowed(base, NodeFiles.resolveInBase(base, "backup.bak"));
    }

    @Test public void aDisplayNameCannotCarryAFolderOrBreakTheCommandTokeniser() {
        assertEquals("passwd", NodeFiles.safeName("../../etc/passwd"));
        assertEquals("evil.bak", NodeFiles.safeName("/tmp/evil.bak"));
        assertEquals("evil.bak", NodeFiles.safeName("C:\\windows\\evil.bak"));
        // Characters the node's tokeniser would rewrite or break on are neutralised, so the
        // imported file can still be named verbatim in `restore file:<name>`.
        assertEquals("my_backup.bak", NodeFiles.safeName("my backup.bak"));
        assertEquals("a_b.bak", NodeFiles.safeName("a:b.bak"));
        assertEquals("x__phrase_STOLEN", NodeFiles.safeName("x\" phrase:STOLEN"));
        assertTrue(com.eurobuddha.minimacore.main.ResyncJob.validFilename(
                NodeFiles.safeName("my backup.bak")));
    }

    @Test public void aLeadingDotCannotProduceAHiddenOrEmptyName() {
        assertEquals("bashrc", NodeFiles.safeName(".bashrc"));
        assertEquals("", NodeFiles.safeName("..."));
    }

    @Test public void importNeverSilentlyOverwritesAnExistingFile() throws IOException {
        assertEquals("backup.bak", NodeFiles.uniqueName(base, "backup.bak"));
        try (FileOutputStream out = new FileOutputStream(new File(base, "backup.bak"))) {
            out.write(new byte[]{1, 2, 3});
        }
        assertEquals("backup-2.bak", NodeFiles.uniqueName(base, "backup.bak"));
        try (FileOutputStream out = new FileOutputStream(new File(base, "backup-2.bak"))) {
            out.write(new byte[]{1});
        }
        assertEquals("backup-3.bak", NodeFiles.uniqueName(base, "backup.bak"));
    }

    @Test public void deleteRemovesTheFileAndNothingElse() throws IOException {
        File keep = new File(base, "keep.bak");
        File go = new File(base, "go.bak");
        try (FileOutputStream out = new FileOutputStream(keep)) { out.write(new byte[]{1}); }
        try (FileOutputStream out = new FileOutputStream(go)) { out.write(new byte[]{1}); }

        NodeFiles.delete(base, "go.bak");
        assertFalse(go.exists());
        assertTrue("an unrelated backup must survive", keep.exists());
    }

    @Test public void deleteRefusesAFolderSoNodeStateCannotBeRemoved() throws IOException {
        // Every root entry the node creates is a directory: databases, mds, ssl, backup,
        // restore, archiverestore. None is ever a backup someone means to delete.
        assertTrue(new File(base, "mds").mkdirs());
        try {
            NodeFiles.delete(base, "mds");
            fail("Expected a folder to be refused");
        } catch (IOException expected) {
            assertTrue(expected.getMessage(), expected.getMessage().contains("folder"));
        }
        assertTrue(new File(base, "mds").isDirectory());
    }

    @Test public void deleteRefusesTheLiveDatabasesFolderAndAnythingInIt() throws IOException {
        File databases = new File(base, "databases");
        assertTrue(databases.mkdirs());
        File live = new File(databases, "txpow.mv.db");
        try (FileOutputStream out = new FileOutputStream(live)) { out.write(new byte[]{1}); }
        try {
            NodeFiles.delete(base, "databases/txpow.mv.db");
            fail("Expected the live chain DB to be refused");
        } catch (IOException expected) {
            assertTrue(expected.getMessage(), expected.getMessage().contains("protected"));
        }
        assertTrue("the live chain DB must still be there", live.isFile());
    }

    @Test public void deleteCannotReachOutsideTheBaseFolder() throws IOException {
        File outside = File.createTempFile("outside", ".bak");
        try {
            NodeFiles.delete(base, "../" + outside.getName());
            // If it resolved without throwing it must not have touched the outside file.
            assertTrue("a file outside base must not be deleted", outside.exists());
        } catch (IOException expected) {
            assertTrue(outside.exists());
        } finally {
            assertTrue(outside.delete() || !outside.exists());
        }
    }

    @Test public void deletingSomethingAlreadyGoneSaysSoRatherThanClaimingSuccess() {
        try {
            NodeFiles.delete(base, "never-existed.bak");
            fail("Expected a missing file to be reported");
        } catch (IOException expected) {
            assertTrue(expected.getMessage(), expected.getMessage().contains("no longer there"));
        }
    }

    @Test public void aTruncatedNameCannotBecomeAnUnusableImport() {
        // Clamping after stripping leading dots could expose a new "." or "-" and produce a name
        // validFilename rejects - imported, listed nowhere, unusable in a restore command.
        StringBuilder raw = new StringBuilder();
        for (int i = 0; i < 200; i++) raw.append('a');
        String longDotted = "..." + raw + ".bak";
        String safe = NodeFiles.safeName(longDotted);
        assertTrue("safe name must be nameable in a command: " + safe,
                com.eurobuddha.minimacore.main.ResyncJob.validFilename(safe));
        assertTrue(safe.length() <= 128);
    }

    @Test public void onlyBakFilesCountAsBackups() {
        // The folder also holds archive exports and txn files; counting them made "this is the
        // only backup" silently fail to fire.
        assertTrue(NodeFiles.isBackup(write("wallet.bak")));
        assertTrue(NodeFiles.isBackup(write("WALLET.BAK")));
        assertFalse(NodeFiles.isBackup(write("archiveexport.gz")));
        assertFalse(NodeFiles.isBackup(write("unsignedtransaction-1.txn")));
        assertFalse(NodeFiles.isBackup(new File(base, "missing.bak")));
    }

    private File write(String name) throws RuntimeException {
        try {
            File file = new File(base, name);
            try (FileOutputStream out = new FileOutputStream(file)) { out.write(new byte[]{1}); }
            return file;
        } catch (IOException exc) { throw new RuntimeException(exc); }
    }

    @Test public void byteCountsAreReportedInUnitsPeopleRead() {
        assertEquals("512 B", NodeFiles.formatBytes(512));
        assertEquals("1.0 KB", NodeFiles.formatBytes(1024));
        assertEquals("1.0 MB", NodeFiles.formatBytes(1024 * 1024));
    }

    @Test public void shortImportPreservesExistingBackupAndRemovesTemporaryFile() throws Exception {
        File destination=write("wallet.bak");
        assertThrows(IOException.class, () -> NodeFiles.replaceFrom(base,destination,new java.io.ByteArrayInputStream(new byte[]{2}),100));
        assertArrayEquals(new byte[]{1},java.nio.file.Files.readAllBytes(destination.toPath()));
        assertArrayEquals(new String[]{"wallet.bak"},base.list());
    }
    @Test public void failedStreamPreservesExistingBackupAndRemovesTemporaryFile() throws Exception {
        File destination=write("wallet.bak");
        java.io.InputStream broken=new java.io.InputStream() {
            public int read() throws IOException { throw new IOException("source disconnected"); }
        };
        assertThrows(IOException.class, () -> NodeFiles.replaceFrom(base,destination,broken,-1));
        assertArrayEquals(new byte[]{1},java.nio.file.Files.readAllBytes(destination.toPath()));
        assertArrayEquals(new String[]{"wallet.bak"},base.list());
    }
    @Test public void completeImportReplacesExistingBackupWithExactBytes() throws Exception {
        File destination=write("wallet.bak"); byte[] bytes={2,3,4};
        assertEquals(3,NodeFiles.replaceFrom(base,destination,new java.io.ByteArrayInputStream(bytes),3));
        assertArrayEquals(bytes,java.nio.file.Files.readAllBytes(destination.toPath()));
        assertArrayEquals(new String[]{"wallet.bak"},base.list());
    }
}
