package com.eurobuddha.minimacore.main.backup;

import org.junit.Test;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.utils.MinimaCMDListener;

import static org.junit.Assert.*;

/**
 * Pins the shape of a real `backup` reply.
 *
 * This is a regression test for a shipped bug: the details were read from response.backup, which
 * is what a companion app sees over the broadcast IPC, but in-process the reply IS the command's
 * own object and backup.java does ret.put("backup", resp) - top level. The file was written every
 * time and the screen still said "Backup failed".
 */
public class BackupRunTest {

    private static class FakeRunner implements BackupRun.Runner {
        String command;
        MinimaCMDListener callback;
        @Override public void run(String command, MinimaCMDListener callback) {
            this.command = command;
            this.callback = callback;
        }
    }

    /** Exactly what backup.java builds: getJSONReply() plus a top-level "backup". */
    private static JSONObject realReply() {
        JSONObject details = new JSONObject();
        details.put("block", 1234567L);
        details.put("uncompressed", "180.2 MB");
        details.put("file", "/data/user/0/com.eurobuddha.minimacore/files/minima-backup-20260916-101500.bak");
        details.put("size", "42.7 MB");
        details.put("auto", false);

        JSONObject reply = new JSONObject();
        reply.put("command", "backup");
        reply.put("status", true);
        reply.put("pending", false);
        reply.put("backup", details);
        return reply;
    }

    @Test public void detailsAreReadFromTheTopLevelWhereTheNodePutsThem() {
        FakeRunner runner = new FakeRunner();
        BackupRun run = new BackupRun(runner);
        assertTrue(run.start("minima-backup-20260916-101500.bak", "pass123", "pass123"));
        runner.callback.cmdResult(realReply());

        assertEquals(BackupRun.State.SUCCEEDED, run.state());
        assertEquals("/data/user/0/com.eurobuddha.minimacore/files/minima-backup-20260916-101500.bak",
                run.path());
        assertEquals("minima-backup-20260916-101500.bak", run.filename());
        assertEquals("42.7 MB", run.size());
        assertEquals("1234567", run.block());
        run.reset();
    }

    @Test public void theNestedIpcShapeIsAlsoAccepted() {
        FakeRunner runner = new FakeRunner();
        BackupRun run = new BackupRun(runner);
        run.start("backup.bak", "pass123", "pass123");

        JSONObject nested = new JSONObject();
        nested.put("status", true);
        JSONObject response = new JSONObject();
        response.put("backup", realReply().get("backup"));
        nested.put("response", response);
        runner.callback.cmdResult(nested);

        assertEquals(BackupRun.State.SUCCEEDED, run.state());
        assertTrue(run.path().endsWith(".bak"));
        run.reset();
    }

    @Test public void aSuccessWithNoDetailsIsNotReportedAsAFailure() {
        // The node said status:true, so the file exists. Calling that "failed" is a lie the
        // user can disprove by looking in the folder - which is exactly what happened.
        FakeRunner runner = new FakeRunner();
        BackupRun run = new BackupRun(runner);
        run.start("backup.bak", "pass123", "pass123");

        JSONObject bare = new JSONObject();
        bare.put("status", true);
        runner.callback.cmdResult(bare);

        assertEquals(BackupRun.State.SUCCEEDED, run.state());
        assertEquals("", run.error());
        // No path means nothing can be exported, and the screen must not offer it.
        assertEquals("", run.path());
        run.reset();
    }

    @Test public void aRealFailureStillFails() {
        FakeRunner runner = new FakeRunner();
        BackupRun run = new BackupRun(runner);
        run.start("backup.bak", "pass123", "pass123");

        JSONObject failure = new JSONObject();
        failure.put("status", false);
        failure.put("error", "Please wait for ALL your keys to be created.");
        runner.callback.cmdResult(failure);

        assertEquals(BackupRun.State.FAILED, run.state());
        assertTrue(run.error().contains("keys to be created"));
        run.reset();
    }

    @Test public void theCommandCarriesTheSecondEntryAsConfirm() {
        FakeRunner runner = new FakeRunner();
        BackupRun run = new BackupRun(runner);
        run.start("backup.bak", "pass123", "pass123");
        assertEquals("backup file:\"backup.bak\" password:\"pass123\" confirm:\"pass123\"",
                runner.command);
        run.reset();
    }

    @Test public void anInvalidNameOrPasswordNeverReachesTheNode() {
        FakeRunner runner = new FakeRunner();
        BackupRun run = new BackupRun(runner);
        assertFalse(run.start("../escape.bak", "pass123", "pass123"));
        assertFalse(run.start("backup.bak", "has\" quote", "has\" quote"));
        // A confirmation that does not match must not reach the node either - the node's own
        // confirm: check is useless if we hand it a copy of the first entry.
        assertFalse(run.start("backup.bak", "pass123", "pass124"));
        assertNull(runner.command);
    }
}
