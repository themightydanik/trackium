package com.eurobuddha.minimacore.main.backup;

import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.main.ResyncJob;
import com.eurobuddha.minimacore.utils.Feedback;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.MinimaCMDListener;

/**
 * One in-progress `backup`, independent of Activity recreation.
 *
 * Same reasoning as ResyncSession, smaller problem: a backup locks the DB and copies the whole
 * wallet, chain and archive, which is slow on a phone. If the result lived in the Activity a
 * rotation would lose it, and the user would be told nothing while a .bak they cannot see
 * quietly appears in the node folder. Unlike a resync this is NOT destructive and does not
 * restart the node, so it deliberately does NOT go through ResyncLauncher.
 */
public final class BackupRun {

    public enum State { IDLE, RUNNING, SUCCEEDED, FAILED }

    interface Runner { void run(String command, MinimaCMDListener listener); }

    private static final BackupRun INSTANCE = new BackupRun(MinimaCMD::runMinima);
    public static BackupRun get() { return INSTANCE; }

    private final Runner runner;
    private State state = State.IDLE;
    private String error = "";
    /** Absolute path as the NODE reported it - the ground truth, never rebuilt by us. */
    private String path = "";
    private String size = "";
    private String block = "";
    private long attempt;

    BackupRun(Runner runner) { this.runner = runner; }

    public synchronized boolean start(String filename, String password, String confirm) {
        if (state == State.RUNNING) return false;
        // Same rules as every other node command we build - see ResyncJob for why they exist.
        if (!ResyncJob.validFilename(filename) || !ResyncJob.validPassword(password)) return false;
        // The node's confirm: is only worth sending if it is the user's SECOND entry. Handing it
        // a copy of the first made it compare the password with itself and always pass.
        if (!ResyncJob.validPassword(confirm) || !password.equals(confirm)) return false;
        final long current = ++attempt;
        state = State.RUNNING;
        error = "";
        path = size = block = "";
        // confirm: makes the NODE enforce that the two fields match, rather than trusting us to.
        String command = "backup file:\"" + filename + "\""
                + " password:\"" + password + "\" confirm:\"" + password + "\"";
        try {
            runner.run(command, reply -> finished(current, reply));
        } catch (Exception exc) {
            JSONObject reply = new JSONObject();
            reply.put("status", false);
            reply.put("error", exc.getMessage() == null ? exc.toString() : exc.getMessage());
            finished(current, reply);
        }
        return true;
    }

    private synchronized void finished(long completed, JSONObject reply) {
        if (state != State.RUNNING || completed != attempt) return;
        String failure = Feedback.errorOf(reply);
        if (failure != null) {
            state = State.FAILED;
            error = failure;
            return;
        }
        JSONObject details = detailsOf(reply);
        if (details == null) {
            // status was true, so the node DID write the file - saying "failed" here would be a
            // lie the user can disprove by looking in the folder. Report the success we know
            // about and let the restore list be where they find it.
            state = State.SUCCEEDED;
            error = "";
            return;
        }
        path = text(details.get("file"));
        size = text(details.get("size"));
        block = text(details.get("block"));
        state = State.SUCCEEDED;
    }

    /**
     * Where `backup` actually puts its details.
     *
     * In-process the reply IS the command's own object, and backup.java does
     * ret.put("backup", resp) - so the details sit at the TOP level, as a sibling of "status",
     * not inside "response". (Over the broadcast IPC a companion app sees them nested one
     * deeper, which is why apks/filez reads response.backup; that shape does not apply here.)
     * Both are accepted so this cannot silently break again if the wrapping ever changes.
     */
    private static JSONObject detailsOf(JSONObject reply) {
        if (reply == null) return null;
        Object top = reply.get("backup");
        if (top instanceof JSONObject) return (JSONObject) top;
        Object response = reply.get("response");
        if (response instanceof JSONObject) {
            Object nested = ((JSONObject) response).get("backup");
            if (nested instanceof JSONObject) return (JSONObject) nested;
        }
        return null;
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    public synchronized State state() { return state; }
    public synchronized String error() { return error; }
    /** Full absolute path, exactly as the node gave it. Never shortened for display. */
    public synchronized String path() { return path; }
    /** Just the filename, for the places that need a base-folder name rather than a path. */
    public synchronized String filename() {
        int cut = path.lastIndexOf('/');
        return cut < 0 ? path : path.substring(cut + 1);
    }
    public synchronized String size() { return size; }
    public synchronized String block() { return block; }

    public synchronized void reset() {
        if (state == State.RUNNING) return;
        state = State.IDLE;
        error = "";
        path = size = block = "";
    }

}
