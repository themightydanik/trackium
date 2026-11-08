package com.eurobuddha.minimacore.main.backup;

import android.app.Application;
import android.content.Context;

import com.eurobuddha.minimacore.chat.ChatDb;
import com.eurobuddha.minimacore.lock.VaultCrypto;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.Assert.*;

/** Export on "phone A", restore on "phone B": identities replaced, chats merged, nothing escapes. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34, application = Application.class)
public class ChatBackupTest {

    private static final String PEER = "0x" + "a1".repeat(32);

    @Test public void roundTripReplacesIdentitiesAndMergesChats() throws Exception {
        Context c = RuntimeEnvironment.getApplication();
        byte[] seedA = new byte[32];
        Arrays.fill(seedA, (byte) 7);
        File keypair = ChatBackup.keypairFile(c);
        keypair.getParentFile().mkdirs();
        Files.write(keypair.toPath(), seedA);
        c.getSharedPreferences("maxchat", Context.MODE_PRIVATE).edit().putString("seed", "0xAAAA").commit();
        File maxChat = new File(c.getFilesDir(), "maxchat/chat/threads.json");
        maxChat.getParentFile().mkdirs();
        Files.write(maxChat.toPath(), "A-history".getBytes());

        ChatDb db = ChatDb.get(c);
        db.ensureContact(PEER, "Alice");
        db.addMessage(msg("m1", "hello from A"));

        int[] counts = new int[2];
        byte[] file = ChatBackup.export(c, "correct horse", counts);
        assertEquals(1, counts[0]);
        assertEquals(1, counts[1]);

        try {
            ChatBackup.open(file, "wrong password");
            fail("a wrong password must not open the backup");
        } catch (VaultCrypto.BadPassphraseException expected) { }

        // "Phone B": its own identities, no A history, one chat of its own.
        Files.write(keypair.toPath(), new byte[32]);
        c.getSharedPreferences("maxchat", Context.MODE_PRIVATE).edit().putString("seed", "0xBBBB").commit();
        Files.write(maxChat.toPath(), "B-history".getBytes());
        File stray = new File(c.getFilesDir(), "maxchat/node/stray");
        stray.getParentFile().mkdirs();
        Files.write(stray.toPath(), "B".getBytes());
        db.getWritableDatabase().execSQL("DELETE FROM messages");
        db.addMessage(msg("m2", "B's own message"));

        ChatBackup.Contents opened = ChatBackup.open(file, "correct horse");
        assertEquals(1, opened.contacts);
        ChatBackup.stage(c, opened);
        ChatBackup.applyPending(c);

        assertArrayEquals(seedA, Files.readAllBytes(keypair.toPath()));
        assertEquals("0xAAAA", c.getSharedPreferences("maxchat", Context.MODE_PRIVATE).getString("seed", ""));
        assertEquals("A-history", new String(Files.readAllBytes(maxChat.toPath())));
        assertFalse("MaxChat stores are replaced, not mixed", stray.exists());
        assertEquals(2, db.thread(PEER).size());
        assertFalse(new File(c.getFilesDir(), "chat-restore.zip").exists());

        // Applying twice (process died before the delete) changes nothing.
        ChatBackup.stage(c, opened);
        ChatBackup.applyPending(c);
        assertEquals(2, db.thread(PEER).size());
    }

    @Test public void pathEscapeIsRejected() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry("maxchat/node/../../shared_prefs/main_prefs.xml"));
            zip.write(1);
            zip.closeEntry();
        }
        try {
            ChatBackup.unzip(bytes.toByteArray());
            fail("a path escape must be rejected");
        } catch (java.io.IOException expected) { }
    }

    private static ChatDb.Msg msg(String id, String body) {
        ChatDb.Msg m = new ChatDb.Msg();
        m.msgid = id; m.pubkey = PEER; m.body = body; m.name = ""; m.ref = ""; m.via = "";
        m.ts = System.currentTimeMillis(); m.incoming = true;
        return m;
    }
}
