package com.eurobuddha.minimacore.main.backup;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import com.eurobuddha.minimacore.chat.ChatDb;
import com.eurobuddha.minimacore.lock.VaultCrypto;
import com.eurobuddha.minimacore.maxchat.MaxChat;
import com.eurobuddha.minimacore.utils.MinimaCMD;

import org.json.JSONArray;
import org.json.JSONObject;
import org.minima.utils.MinimaLogger;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * Chat backup: the identity and history the node's own .bak never held.
 *
 * One {@link VaultCrypto} container around a zip of:
 *   manifest.json            what is inside, incl. both addresses IN FULL for the confirm dialog
 *   keets/keypair            the sidecar's 32-byte seed = the keets chat address
 *   chat/contacts.json       every keetchat.db contact row
 *   chat/messages.json       every keetchat.db message row
 *   maxchat/seed             the MAX# identity seed (prefs "maxchat")
 *   maxchat/node/**, maxchat/chat/**   MaxChat's contact + conversation stores
 *
 * Restoring never touches live state: the decrypted zip is staged in the app's private folder
 * and {@link #applyPending} loads it at the next service start, before the keets worklet and
 * MaxChat read any of it. Chat rows MERGE (INSERT OR IGNORE); the two identities REPLACE.
 * Photos, voice notes and transferred files are not included (re-fetchable or too large).
 */
public final class ChatBackup {

    static final String FORMAT = "keets-chat-backup";
    static final int VERSION = 1;
    /** A chat backup of 64 MB is far past any real history; refuse rather than OOM. */
    static final int MAX_FILE = 64 * 1024 * 1024;
    private static final String PENDING = "chat-restore.zip";
    private static final String[] TABLES = {"contacts", "messages"};

    private ChatBackup() {}

    /** What the confirm dialog shows before anything is changed. */
    public static final class Contents {
        public final byte[] zip;
        public final String keetsPubkey, maxAddress;
        public final int contacts, messages;
        Contents(byte[] zip, JSONObject m) {
            this.zip = zip;
            keetsPubkey = m.optString("keetsPubkey", "");
            maxAddress = m.optString("maxAddress", "");
            contacts = m.optInt("contacts", 0);
            messages = m.optInt("messages", 0);
        }
    }

    // ---- export -------------------------------------------------------------------------------

    /** Runs on a background thread: PBKDF2 at 210k rounds takes a second or two on a phone. */
    public static byte[] export(Context c, String password, int[] counts) throws Exception {
        Map<String, byte[]> files = new LinkedHashMap<>();
        File keypair = keypairFile(c);
        if (keypair.isFile()) files.put("keets/keypair", Files.readAllBytes(keypair.toPath()));

        SQLiteDatabase db = ChatDb.get(c).getReadableDatabase();
        for (int i = 0; i < TABLES.length; i++) {
            JSONArray rows = dumpTable(db, TABLES[i]);
            counts[i] = rows.length();
            files.put("chat/" + TABLES[i] + ".json", rows.toString().getBytes(StandardCharsets.UTF_8));
        }

        String maxSeed = c.getSharedPreferences("maxchat", Context.MODE_PRIVATE).getString("seed", "");
        if (!maxSeed.isEmpty()) {
            files.put("maxchat/seed", maxSeed.getBytes(StandardCharsets.UTF_8));
            for (String dir : new String[]{"node", "chat"}) addTree(files, new File(c.getFilesDir(), "maxchat/" + dir), "maxchat/" + dir);
        }

        JSONObject manifest = new JSONObject()
                .put("format", FORMAT).put("version", VERSION).put("created", System.currentTimeMillis())
                .put("keetsPubkey", currentKeetsPubkey())
                .put("maxAddress", MaxChat.permanentAddress())
                .put("contacts", counts[0]).put("messages", counts[1])
                .put("chatName", c.getSharedPreferences("main_prefs", Context.MODE_PRIVATE).getString("chat_name", ""));

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            put(zip, "manifest.json", manifest.toString(2).getBytes(StandardCharsets.UTF_8));
            for (Map.Entry<String, byte[]> e : files.entrySet()) put(zip, e.getKey(), e.getValue());
        }
        return VaultCrypto.encrypt(password, bytes.toByteArray());
    }

    /** The address the sidecar is announcing now, in full; empty when keets is not running. */
    public static String currentKeetsPubkey() {
        try {
            if (!MinimaCMD.checkMinimaStarted()) return "";
            org.minima.utils.json.JSONObject r = MinimaCMD.execute("keets action:info");
            if (r == null || !Boolean.TRUE.equals(r.get("status"))) return "";
            Object pk = ((org.minima.utils.json.JSONObject) r.get("response")).get("pubkey");
            return pk == null ? "" : pk.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private static JSONArray dumpTable(SQLiteDatabase db, String table) throws Exception {
        JSONArray rows = new JSONArray();
        try (Cursor cur = db.rawQuery("SELECT * FROM " + table, null)) {
            while (cur.moveToNext()) {
                JSONObject row = new JSONObject();
                for (int i = 0; i < cur.getColumnCount(); i++) {
                    switch (cur.getType(i)) {
                        case Cursor.FIELD_TYPE_NULL: break;
                        case Cursor.FIELD_TYPE_INTEGER: row.put(cur.getColumnName(i), cur.getLong(i)); break;
                        default: row.put(cur.getColumnName(i), cur.getString(i));
                    }
                }
                rows.put(row);
            }
        }
        return rows;
    }

    private static void addTree(Map<String, byte[]> files, File dir, String prefix) throws IOException {
        File[] kids = dir.listFiles();
        if (kids == null) return;
        for (File f : kids) {
            String name = prefix + "/" + f.getName();
            if (f.isDirectory()) addTree(files, f, name);
            else if (f.isFile() && !f.getName().endsWith(".tmp")) files.put(name, Files.readAllBytes(f.toPath()));
        }
    }

    private static void put(ZipOutputStream zip, String name, byte[] data) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(data);
        zip.closeEntry();
    }

    // ---- restore ------------------------------------------------------------------------------

    /** Decrypt and check. Throws VaultCrypto.BadPassphraseException on a wrong password. */
    public static Contents open(byte[] file, String password) throws Exception {
        // VaultCrypto trusts the header's iteration count; a crafted file could ask for billions.
        int iterations = file.length > 10 ? ((file[6] & 0xFF) << 24) | ((file[7] & 0xFF) << 16) | ((file[8] & 0xFF) << 8) | (file[9] & 0xFF) : 0;
        if (iterations != VaultCrypto.DEFAULT_ITERATIONS) throw new VaultCrypto.BadPassphraseException("not a chat backup");
        byte[] zip = VaultCrypto.decrypt(password, file);
        Map<String, byte[]> entries = unzip(zip);
        byte[] m = entries.get("manifest.json");
        if (m == null) throw new IOException("not a chat backup");
        JSONObject manifest = new JSONObject(new String(m, StandardCharsets.UTF_8));
        if (!FORMAT.equals(manifest.optString("format")) || manifest.optInt("version") > VERSION) {
            throw new IOException("not a chat backup (or one made by a newer app)");
        }
        return new Contents(zip, manifest);
    }

    /** Park the decrypted backup in the app's private folder; the next service start loads it. */
    public static void stage(Context c, Contents contents) throws IOException {
        File tmp = new File(c.getFilesDir(), PENDING + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(contents.zip);
            out.getFD().sync();
        }
        if (!tmp.renameTo(new File(c.getFilesDir(), PENDING))) throw new IOException("could not stage the backup");
    }

    /**
     * Called by MinimaService before the node, the keets worklet or MaxChat start. Idempotent:
     * if the process dies half way, the next start applies it again (merges ignore duplicates).
     */
    public static void applyPending(Context c) {
        File pending = new File(c.getFilesDir(), PENDING);
        if (!pending.isFile()) return;
        try {
            apply(c, unzip(Files.readAllBytes(pending.toPath())));
            com.eurobuddha.minimacore.chat.ChatView.forgetMyPub();
            if (!pending.delete()) MinimaLogger.log("Chat backup applied but the staged file could not be deleted");
            MinimaLogger.log("Chat backup restored");
        } catch (Exception e) {
            MinimaLogger.log("Chat backup restore FAILED: " + e);
            // Out of the way, not deleted: it is someone's only copy of their history.
            pending.renameTo(new File(c.getFilesDir(), PENDING + ".failed"));
        }
    }

    static void apply(Context c, Map<String, byte[]> e) throws Exception {
        byte[] keypair = e.get("keets/keypair");
        if (keypair != null) {
            if (keypair.length != 32) throw new IOException("keets keypair is " + keypair.length + " bytes, expected 32");
            writeAtomic(keypairFile(c), keypair);
        }

        byte[] maxSeed = e.get("maxchat/seed");
        if (maxSeed != null) {
            File root = new File(c.getFilesDir(), "maxchat");
            for (String dir : new String[]{"node", "chat"}) deleteTree(new File(root, dir));
            for (Map.Entry<String, byte[]> f : e.entrySet()) {
                String n = f.getKey();
                if (n.startsWith("maxchat/node/") || n.startsWith("maxchat/chat/")) {
                    writeAtomic(new File(c.getFilesDir(), n), f.getValue());
                }
            }
            // This ONE write is the MAX# identity (see MaxChat.identity): synchronous.
            c.getSharedPreferences("maxchat", Context.MODE_PRIVATE).edit()
                    .putString("seed", new String(maxSeed, StandardCharsets.UTF_8).trim()).commit();
        }

        SQLiteDatabase db = ChatDb.get(c).getWritableDatabase();
        db.beginTransaction();
        try {
            for (String table : TABLES) {
                byte[] rows = e.get("chat/" + table + ".json");
                if (rows != null) mergeTable(db, table, new JSONArray(new String(rows, StandardCharsets.UTF_8)));
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }

        byte[] m = e.get("manifest.json");
        String name = m == null ? "" : new JSONObject(new String(m, StandardCharsets.UTF_8)).optString("chatName", "");
        android.content.SharedPreferences prefs = c.getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
        if (!name.isEmpty() && prefs.getString("chat_name", "").isEmpty()) prefs.edit().putString("chat_name", name).commit();
    }

    /** Only columns this app's schema has; rows already here win (same msgid / pubkey). */
    private static void mergeTable(SQLiteDatabase db, String table, JSONArray rows) throws Exception {
        Set<String> cols = new HashSet<>();
        try (Cursor cur = db.rawQuery("PRAGMA table_info(" + table + ")", null)) {
            while (cur.moveToNext()) cols.add(cur.getString(cur.getColumnIndexOrThrow("name")));
        }
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.getJSONObject(i);
            ContentValues v = new ContentValues();
            for (java.util.Iterator<String> k = row.keys(); k.hasNext(); ) {
                String col = k.next();
                if (!cols.contains(col)) continue;
                Object val = row.get(col);
                if (val instanceof Number) v.put(col, ((Number) val).longValue());
                else v.put(col, String.valueOf(val));
            }
            if (v.size() > 0) db.insertWithOnConflict(table, null, v, SQLiteDatabase.CONFLICT_IGNORE);
        }
    }

    // ---- files --------------------------------------------------------------------------------

    /** = GeneralParams.DATA_FOLDER/keets/keypair: the node runs with -data getFilesDir(). */
    static File keypairFile(Context c) {
        return new File(new File(c.getFilesDir(), "keets"), "keypair");
    }

    /** Only the names this format writes; anything else (or a path escape) rejects the file. */
    static Map<String, byte[]> unzip(byte[] zip) throws IOException {
        Map<String, byte[]> out = new LinkedHashMap<>();
        long total = 0;
        try (ZipInputStream in = new ZipInputStream(new java.io.ByteArrayInputStream(zip))) {
            for (ZipEntry e; (e = in.getNextEntry()) != null; ) {
                String n = e.getName();
                boolean known = n.equals("manifest.json") || n.equals("keets/keypair") || n.equals("maxchat/seed")
                        || n.equals("chat/contacts.json") || n.equals("chat/messages.json")
                        || n.startsWith("maxchat/node/") || n.startsWith("maxchat/chat/");
                if (!known || n.contains("..") || n.contains("\\") || e.isDirectory()) throw new IOException("unexpected entry " + n);
                byte[] data = readAll(in, MAX_FILE);
                total += data.length;
                if (total > 4L * MAX_FILE) throw new IOException("backup too large");
                out.put(n, data);
            }
        }
        return out;
    }

    static byte[] readAll(InputStream in, int limit) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        for (int r; (r = in.read(buf)) != -1; ) {
            out.write(buf, 0, r);
            if (out.size() > limit) throw new IOException("file too large");
        }
        return out.toByteArray();
    }

    private static void writeAtomic(File f, byte[] data) throws IOException {
        File dir = f.getParentFile();
        if (dir != null && !dir.isDirectory() && !dir.mkdirs()) throw new IOException("cannot create " + dir);
        File tmp = new File(f.getPath() + ".restore");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(data);
            out.getFD().sync();
        }
        if (!tmp.renameTo(f)) throw new IOException("cannot write " + f);
    }

    private static void deleteTree(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        f.delete();
    }
}
