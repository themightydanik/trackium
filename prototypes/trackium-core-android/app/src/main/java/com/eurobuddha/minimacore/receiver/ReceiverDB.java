package com.eurobuddha.minimacore.receiver;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;

public class ReceiverDB extends SQLiteOpenHelper {
    // If you change the database schema, you must increment the database version.
    public static final int DATABASE_VERSION = 2;   // 2: verified + nonce (security review 2026-11-07, M-2)
    public static final String DATABASE_NAME = "receive.db";

    //The Handle to the DB
    SQLiteDatabase mDB;

    //All the Columns
    String[] ALL_COLUMNS = new String[] {"_id","package", "packageid", "minimaid", "penabled", "admin", "lastused", "verified", "nonce"};

    // Database creation sql statement
    private static final String DATABASE_CREATE_APPLICATIONS = "create table if not exists applications ( " +
            "_id integer primary key," +
            "package text not null," +
            "packageid text not null," +
            "minimaid text not null," +
            "penabled integer not null," +
            "admin integer not null," +
            "lastused integer not null," +
            "verified integer not null default 0," +
            "nonce text not null default ''" +
            ");";

    public ReceiverDB(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);

        //Get handle..
        mDB = getWritableDatabase();
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL(DATABASE_CREATE_APPLICATIONS);
    }

    public void wipeDB(){
        mDB.execSQL("DROP TABLE IF EXISTS applications");
        onCreate(mDB);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        //1 -> 2 adds the columns IN PLACE. Wiping would unpair every companion. Rows paired before this release count as
        //verified (they predate the attack this closes); only NEW registrations must prove themselves.
        if (oldVersion == 1 && newVersion >= 2) {
            db.execSQL("ALTER TABLE applications ADD COLUMN verified integer not null default 1");
            db.execSQL("ALTER TABLE applications ADD COLUMN nonce text not null default ''");
            //Only ONE row per package is grandfathered, and only one the USER enabled: enabled first, then ADMIN, then most
            //recently used (registering stamps lastused, so a spoof registered just before the upgrade must not win on
            //recency alone). A never-enabled row is never grandfathered. Every other row starts unverified.
            db.execSQL("UPDATE applications SET verified=0 WHERE penabled=0 OR _id NOT IN ("
                    + "SELECT (SELECT b._id FROM applications b WHERE b.package=a.package "
                    + "ORDER BY b.penabled DESC, b.admin DESC, b.lastused DESC, b._id DESC LIMIT 1) "
                    + "FROM applications a GROUP BY a.package)");
            return;
        }
        wipeDB();
    }
    @Override
    public void onDowngrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        wipeDB();
    }

    /** Insert an UNVERIFIED row and return its one-time code (sent only to that package in the REGISTER reply). */
    public String insertApp(String zPackageName, String zPackageID, String zMinimaID){
        byte[] raw = new byte[32];
        new java.security.SecureRandom().nextBytes(raw);
        StringBuilder nonce = new StringBuilder();
        for (byte b : raw) nonce.append(String.format("%02x", b));

        ContentValues values = new ContentValues();
        values.put("package", zPackageName);
        values.put("packageid", zPackageID);
        values.put("minimaid", zMinimaID);
        values.put("penabled", 0);
        values.put("admin", 0);
        values.put("lastused", System.currentTimeMillis());
        values.put("verified", 0);
        values.put("nonce", nonce.toString());

        mDB.insert("applications", null, values);
        return nonce.toString();
    }

    /** The companion echoed its one-time code: mark that exact row verified. False if no such unverified row/code. */
    public boolean verify(String zPackageName, String zPackageID, String zMinimaID, String zNonce){
        JSONObject app = selectApp(zPackageName, zPackageID, zMinimaID);
        if (app == null || zNonce == null || zNonce.isEmpty()) return false;
        if ((int) app.get("verified") == 1) return true;
        String want = (String) app.get("nonce");
        if (want == null || want.isEmpty() || !java.security.MessageDigest.isEqual(want.getBytes(), zNonce.getBytes())) return false;
        ContentValues cv = new ContentValues();
        cv.put("verified", 1);
        cv.put("nonce", "");
        mDB.update("applications", cv, "package=? AND packageid=? AND minimaid=?", new String[]{zPackageName, zPackageID, zMinimaID});
        return true;
    }

    /** A verified registration in use within this window blocks an unverified twin. A genuine reinstall of a companion not
     *  yet rebuilt with the one-time code leaves its old row idle, so after this long the new row can be enabled (with the
     *  warning); a spoof aimed at a companion that is actually running stays blocked. */
    public static final long TWIN_ACTIVE_MS = 24L * 60 * 60 * 1000;

    /** Does a VERIFIED row for this package, other than the given one, exist AND has it been used within TWIN_ACTIVE_MS?
     *  Then an unverified twin is treated as a spoof. */
    public boolean hasVerifiedTwin(String zPackageName, String zPackageID){
        String since = String.valueOf(System.currentTimeMillis() - TWIN_ACTIVE_MS);
        Cursor c = mDB.query("applications", new String[]{"_id"}, "package=? AND packageid<>? AND verified=1 AND lastused>=?",
                new String[]{zPackageName, zPackageID, since}, null, null, null);
        if (c == null) return false;
        try { return c.moveToFirst(); } finally { c.close(); }
    }

    private JSONObject convertCursor(Cursor zCursor){
        JSONObject app = new JSONObject();

        app.put("_id", zCursor.getInt(0));
        app.put("package", zCursor.getString(1));
        app.put("packageid", zCursor.getString(2));
        app.put("minimaid", zCursor.getString(3));
        app.put("penabled", zCursor.getInt(4));
        app.put("admin", zCursor.getInt(5));
        app.put("lastused", zCursor.getLong(6));
        app.put("verified", zCursor.getInt(7));
        app.put("nonce", zCursor.getString(8));

        return app;
    }

    public JSONArray selectAllApps() {

        JSONArray results = new JSONArray();

        Cursor cursor = mDB.query(false, "applications", ALL_COLUMNS,null, null, null, null, null, null);
        if (cursor != null) {

            try {
                while (cursor.moveToNext()) {
                    results.add(convertCursor(cursor));
                }
            } finally {
                cursor.close();
            }
        }

        return results;
    }

    public JSONObject selectApp(String zPackageName, String zpackageID, String zMinimaID){

        String[] args = new String[] {zPackageName, zpackageID, zMinimaID};
        Cursor cursor = mDB.query(true, "applications", ALL_COLUMNS,"package=? AND packageid=? AND minimaid=?",
                args, null, null, null, null);
        if (cursor != null) {
            try {
                while (cursor.moveToNext()) {
                    return convertCursor(cursor);
                }
            } finally {
                cursor.close();
            }
        }

        return null;
    }

    public boolean exists(String zPackageName, String zPackageID, String zMinimaID){
        return selectApp(zPackageName,zPackageID,zMinimaID) != null;
    }

    public void setEnabled(String zPackageName, String zPackageID, boolean zEnabled){
        ContentValues cv = new ContentValues();
        if(zEnabled){
            cv.put("penabled",1);
        }else{
            cv.put("penabled",0);
        }

        mDB.update("applications", cv, "package=? AND packageid=?", new String[]{zPackageName, zPackageID});
    }

    public void setAdmin(String zPackageName, String zPackageID, boolean zAdmin){
        ContentValues cv = new ContentValues();
        if(zAdmin){
            cv.put("admin",1);
        }else{
            cv.put("admin",0);
        }

        mDB.update("applications", cv, "package=? AND packageid=?", new String[]{zPackageName, zPackageID});
    }

    /** An unverified twin that was refused is switched off for good, so it can never resume silently once the verified
     *  row goes idle (the user must re-enable it, through the warning). */
    public void disableRow(String zPackageName, String zPackageID){
        ContentValues cv = new ContentValues();
        cv.put("penabled", 0);
        cv.put("admin", 0);
        mDB.update("applications", cv, "package=? AND packageid=? AND verified=0", new String[]{zPackageName, zPackageID});
    }

    public void updateLastUsed(String zPackageName, String zPackageID){
        ContentValues cv = new ContentValues();
        cv.put("lastused",System.currentTimeMillis());

        mDB.update("applications", cv, "package=? AND packageid=?", new String[]{zPackageName, zPackageID});
    }

    public void delete(String zPackageName, String zPackageID){
        mDB.delete("applications", "package=? AND packageid=?", new String[]{zPackageName, zPackageID});
    }
}
