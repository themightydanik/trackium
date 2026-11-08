package com.eurobuddha.minimacore.receiver;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import org.robolectric.RuntimeEnvironment;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.minima.utils.json.JSONObject;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

/** Security review 2026-11-07 (M-2): the 1 -> 2 upgrade must ADD the columns in place (a wipe would unpair every
 *  companion), grandfather existing rows as verified, and new rows must start unverified with a one-time code. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class ReceiverDBUpgradeTest {
    @Test public void upgradeKeepsPairingsAndNewRowsMustProveThemselves() {
        Context ctx = RuntimeEnvironment.getApplication();
        ctx.deleteDatabase(ReceiverDB.DATABASE_NAME);
        SQLiteDatabase v1 = SQLiteDatabase.openOrCreateDatabase(ctx.getDatabasePath(ReceiverDB.DATABASE_NAME), null);
        v1.execSQL("create table applications ( _id integer primary key, package text not null, packageid text not null, "
                + "minimaid text not null, penabled integer not null, admin integer not null, lastused integer not null)");
        long now = System.currentTimeMillis();
        v1.execSQL("insert into applications (package,packageid,minimaid,penabled,admin,lastused) values ('com.eurobuddha.dexicon','old','node',1,1," + now + ")");
        // a pre-existing spoof row for the same package, registered LATER (registration stamps lastused) but never enabled:
        // it must not win the grandfathering on recency
        v1.execSQL("insert into applications (package,packageid,minimaid,penabled,admin,lastused) values ('com.eurobuddha.dexicon','spoof','x',0,0," + (now + 1000) + ")");
        // an idle verified companion (not used for 2 days): a genuine reinstall of it must not be blocked
        v1.execSQL("insert into applications (package,packageid,minimaid,penabled,admin,lastused) values ('com.eurobuddha.wallet','w-old','node',1,1," + (now - 2L*24*60*60*1000) + ")");
        v1.setVersion(1); v1.close();

        ReceiverDB db = new ReceiverDB(ctx);
        JSONObject kept = db.selectApp("com.eurobuddha.dexicon", "old", "node");
        assertNotNull("the existing pairing survives the upgrade", kept);
        assertEquals(1, ((Number) kept.get("penabled")).intValue());
        assertEquals("and is grandfathered as verified", 1, ((Number) kept.get("verified")).intValue());

        assertEquals("a never-enabled row is never grandfathered, however recent", 0,
                ((Number) db.selectApp("com.eurobuddha.dexicon", "spoof", "x").get("verified")).intValue());
        db.insertApp("com.eurobuddha.wallet", "w-new", "node");
        assertFalse("an idle verified row does not block a reinstall", db.hasVerifiedTwin("com.eurobuddha.wallet", "w-new"));

        String code = db.insertApp("com.eurobuddha.dexicon", "fake", "node2");
        assertEquals(64, code.length());
        assertEquals(0, ((Number) db.selectApp("com.eurobuddha.dexicon", "fake", "node2").get("verified")).intValue());
        assertTrue("a verified twin exists for the new row", db.hasVerifiedTwin("com.eurobuddha.dexicon", "fake"));
        assertFalse("a wrong code does not verify", db.verify("com.eurobuddha.dexicon", "fake", "node2", "00"));
        assertTrue("the right code does", db.verify("com.eurobuddha.dexicon", "fake", "node2", code));
        assertEquals(1, ((Number) db.selectApp("com.eurobuddha.dexicon", "fake", "node2").get("verified")).intValue());
    }
}
