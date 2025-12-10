// ======================================================================
// Trackium MiniDapp - ANDROID PULL MODE (Rhino ES5 SAFE)
// ======================================================================

MDS.load("./assets/js/database.js");

// Интервал опроса Android (3 минуты)
var POLL_INTERVAL_MS = 3 * 60 * 1000;

// Время последнего опроса (по NEWBLOCK)
var lastPollTs = 0;

// Флаг и ссылка на БД
var db = null;

// ======================================================================
// INIT (события MDS)
// ======================================================================
MDS.init(function (msg) {

    // --- Первый запуск сервиса ---
    if (msg.event === "inited") {
        MDS.log("=== Trackium: Android Pull Mode (ES5) Started ===");

        // Инициализация БД
        db = new TrackiumDatabase();
        db.init(function (ok) {
            if (ok) {
                MDS.log("✅ Trackium Database initialized successfully");
                // Можно сразу попробовать один опрос (скорее всего устройств ещё нет)
                pollOnce();
            } else {
                MDS.log("❌ Trackium Database init FAILED");
            }
        });

        return;
    }

    // --- Каждое появление нового блока ---
    if (msg.event === "NEWBLOCK") {
        // Блоки идут довольно часто — throttling по времени
        var now = new Date().getTime();
        if (now - lastPollTs >= POLL_INTERVAL_MS) {
            lastPollTs = now;
            pollOnce();
        }
        return;
    }

    if (msg.event === "MDS_SHUTDOWN") {
        MDS.log("🛑 Trackium shutting down...");
        return;
    }
});


// ======================================================================
// ONE POLL CYCLE  — каждый раз перечитываем devices из БД
// ======================================================================
function pollOnce() {

    if (!db || !db.initialized) {
        MDS.log("⏳ pollOnce: DB not ready yet");
        return;
    }

    // Каждый опрос заново читаем список устройств
    var sql = "SELECT device_id FROM devices ORDER BY created_at ASC";

    MDS.sql(sql, function (res) {

        if (!res.status || !res.rows || res.rows.length === 0) {
            MDS.log("⚠️ No devices to update");
            return;
        }

        MDS.log("📦 Devices to update: " + JSON.stringify(res.rows));

        for (var i = 0; i < res.rows.length; i++) {
            var row = res.rows[i];
            var deviceId = row.device_id || row.DEVICE_ID;

            if (deviceId) {
                pullFromAndroid(deviceId);
            } else {
                MDS.log("⚠️ Device row without device_id: " + JSON.stringify(row));
            }
        }
    });
}


// ======================================================================
// PULL FROM ANDROID COMPANION (HTTP GET → /location)
// ======================================================================
function pullFromAndroid(deviceId) {
    var url = "http://127.0.0.1:8123/location";

    MDS.log("🌐 Requesting Android location for " + deviceId + "...");

    // В Rhino используем колбэк-версию MDS.http.get
    MDS.http.get(url, function (res) {

        if (!res || !res.status) {
            var err = (res && res.error) ? res.error : "unknown";
            MDS.log("❌ Android HTTP error: " + err);
            return;
        }

        var data;
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

        if (data.latitude === undefined || data.longitude === undefined) {
            MDS.log("⚠️ Invalid coordinates from Android: " + JSON.stringify(data));
            return;
        }

        MDS.log("📍 Android → " + data.latitude + ", " + data.longitude);

        saveMovementToDB(data);
    });
}


// ======================================================================
// SAVE MOVEMENT INTO DB
// ======================================================================
function saveMovementToDB(loc) {

    var deviceId = (loc.deviceId || "").toString().replace(/'/g, "''");
    var lat = Number(loc.latitude);
    var lon = Number(loc.longitude);
    var acc = Number(loc.accuracy || 0);
    var batt = Number(loc.battery || 0);
    var ts = loc.timestamp || (new Date().getTime());

    // 1) movements
    var sql1 =
        "INSERT INTO movements " +
        "(device_id, latitude, longitude, altitude, speed, accuracy, recorded_at) " +
        "VALUES (" +
        "'" + deviceId + "', " +
        lat + ", " +
        lon + ", " +
        "0, " +      // altitude
        "0, " +      // speed
        acc + ", " +
        ts +
        ")";

    // 2) devices — battery + status + last_sync
    var sql2 =
        "UPDATE devices " +
        "SET battery=" + batt + ", " +
        "    status='online', " +
        "    last_sync=CURRENT_TIMESTAMP " +
        "WHERE device_id='" + deviceId + "'";

    // 3) events — для Recent Activity
    var sql3 =
        "INSERT INTO events (device_id, event_type, event_data) " +
        "VALUES (" +
        "'" + deviceId + "', " +
        "'movement_detected', '{}'" +
        ")";

    MDS.sql(sql1, function (r1) {
        if (!r1.status) {
            MDS.log("❌ Insert into movements failed: " + r1.error);
        }

        MDS.sql(sql2, function (r2) {
            if (!r2.status) {
                MDS.log("⚠️ Update devices failed: " + r2.error);
            }

            MDS.sql(sql3, function (r3) {
                if (!r3.status) {
                    MDS.log("⚠️ Insert into events failed: " + r3.error);
                }

                MDS.log("✅ Movement saved for " + deviceId);
                refreshUI(deviceId);
            });
        });
    });
}


// ======================================================================
// UI AUTO-REFRESH (в Rhino window, скорее всего, undefined, защита через try)
// ======================================================================
function refreshUI(deviceId) {
    try {
        if (typeof window === "undefined") {
            // Сервис работает без UI — ок
            return;
        }

        // Dashboard (recent events, stats)
        if (window.loadDashboard) {
            window.loadDashboard();
        }

        // Devices list
        if (window.refreshDevices) {
            window.refreshDevices();
        }

        // Device detail currently open?
        if (window.currentDeviceId === deviceId &&
            window.refreshDevicePosition) {
            window.refreshDevicePosition(deviceId);
        }

    } catch (err) {
        MDS.log("⚠️ UI refresh failed: " + err);
    }
}


// ======================================================================
// READY LOG
// ======================================================================
MDS.log("📡 Trackium MiniDapp Ready (Android Pull Mode ES5)");
