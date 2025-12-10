// ======================================================================
// Trackium MiniDapp - ANDROID PULL MODE (RHINO ES5 VERSION)
// ======================================================================

MDS.load("./assets/js/database.js");

var db = null;
var POLL_INTERVAL = 3 * 60 * 1000; // 3 min
var deviceRegistry = []; // array of device_id strings

// ======================================================================
// INIT
// ======================================================================
MDS.init(function(msg) {

    if (msg.event === "inited") {

        MDS.log("=== Trackium: Android Pull Mode (ES5) Started ===");

        // Init DB
        db = new TrackiumDatabase();
        db.init(function(ok) {
            if (ok) {
                MDS.log("✅ Database initialized");
                loadDeviceRegistry();
            } else {
                MDS.log("❌ Database init FAILED");
            }
        });

        return;
    }

    if (msg.event === "MDS_SHUTDOWN") {
        MDS.log("🛑 Trackium shutting down...");
    }
});


// ======================================================================
// LOAD DEVICES FROM DB
// ======================================================================
function loadDeviceRegistry() {

    MDS.sql("SELECT device_id FROM devices ORDER BY created_at ASC", function(res) {

        if (res.status && res.rows && res.rows.length > 0) {

            deviceRegistry = [];
            for (var i = 0; i < res.rows.length; i++) {
                var row = res.rows[i];
                var id = row.device_id || row.DEVICE_ID;
                if (id) deviceRegistry.push(id);
            }

            MDS.log("📦 Loaded devices: " + JSON.stringify(deviceRegistry));

            startPollingLoop();
        } else {
            MDS.log("⚠️ No devices found");
            deviceRegistry = [];
            startPollingLoop();
        }

    });
}


// ======================================================================
// POLLING LOOP
// ======================================================================
function startPollingLoop() {

    MDS.log("⏳ Polling Android every " + (POLL_INTERVAL / 60000) + " minutes...");

    pollOnce(); // first run immediately

    setInterval(function() {
        pollOnce();
    }, POLL_INTERVAL);
}


// ======================================================================
// ONE POLL CYCLE
// ======================================================================
function pollOnce() {

    if (deviceRegistry.length === 0) {
        MDS.log("⚠️ No devices to update");
        return;
    }

    for (var i = 0; i < deviceRegistry.length; i++) {
        var deviceId = deviceRegistry[i];
        pullFromAndroid(deviceId);
    }
}


// ======================================================================
// PULL FROM ANDROID COMPANION
// ======================================================================
function pullFromAndroid(deviceId) {

    var url = "http://127.0.0.1:8123/location";
    MDS.log("🌐 Requesting Android location for " + deviceId + " ...");

    MDS.http.get(url, function(res) {

        if (!res.status) {
            MDS.log("❌ Android HTTP error: " + res.error);
            return;
        }

        var data = null;
        try {
            data = JSON.parse(res.response);
        } catch (e) {
            MDS.log("❌ JSON parse error: " + e);
            return;
        }

        if (!data.deviceId) {
            MDS.log("⚠️ Android did not send deviceId");
            return;
        }

        if (!data.latitude || !data.longitude) {
            MDS.log("⚠️ Invalid coordinates from Android");
            return;
        }

        MDS.log("📍 Android → " + data.latitude + ", " + data.longitude);

        saveMovementToDB(data, deviceId);
    });
}


// ======================================================================
// SAVE MOVEMENT INTO DB
// ======================================================================
function saveMovementToDB(loc, deviceId) {

    var id   = loc.deviceId;
    var lat  = Number(loc.latitude);
    var lon  = Number(loc.longitude);
    var acc  = Number(loc.accuracy || 0);
    var batt = Number(loc.battery  || 0);
    var ts   = loc.timestamp || Date.now();

    // 1. movements
    var sql1 =
        "INSERT INTO movements " +
        "(device_id, latitude, longitude, altitude, speed, accuracy, recorded_at) VALUES (" +
        "'" + id + "', " +
        lat + ", " +
        lon + ", 0, 0, " + acc + ", " + ts +
        ")";

    MDS.sql(sql1, function(r1) {

        if (!r1.status) {
            MDS.log("❌ Failed to insert movement: " + r1.error);
            return;
        }

        // 2. update devices
        var sql2 =
            "UPDATE devices SET " +
            "battery=" + batt + ", " +
            "status='online', " +
            "last_sync=CURRENT_TIMESTAMP " +
            "WHERE device_id='" + id + "'";

        MDS.sql(sql2, function(r2) {

            if (!r2.status) {
                MDS.log("⚠️ Failed updating device: " + r2.error);
            }

            // 3. add event
            var sql3 =
                "INSERT INTO events (device_id, event_type, event_data) " +
                "VALUES ('" + id + "', 'movement_detected', '{}')";

            MDS.sql(sql3, function(r3) {

                if (!r3.status) {
                    MDS.log("⚠️ Failed to insert event: " + r3.error);
                }

                MDS.log("✅ Movement saved for " + id);

                refreshUI(id);
            });
        });
    });
}


// ======================================================================
// UI AUTO REFRESH (only if running inside MiniDapp UI)
// ======================================================================
function refreshUI(deviceId) {

    try {

        if (typeof window !== "undefined") {

            if (window.loadDashboard) {
                window.loadDashboard();
            }

            if (window.refreshDevices) {
                window.refreshDevices();
            }

            if (window.currentDeviceId === deviceId &&
                window.refreshDevicePosition) {
                window.refreshDevicePosition(deviceId);
            }
        }

    } catch (e) {
        MDS.log("⚠️ UI refresh error: " + e);
    }
}


// ======================================================================
// MANUAL UPDATE
// ======================================================================
globalThis.forceUpdateNow = function(deviceId) {

    MDS.log("🔄 Manual update triggered...");

    if (deviceId) {
        pullFromAndroid(deviceId);
        return;
    }

    pollOnce();
};


// ======================================================================
// READY
// ======================================================================
MDS.log("📡 Trackium MiniDapp Ready (Android Pull Mode, ES5)");
