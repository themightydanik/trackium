// ======================================================================
// Trackium MiniDapp - ANDROID PULL MODE (FINAL CLEAN VERSION)
// ======================================================================

MDS.load("./assets/js/database.js");

let db = null;

// Опрос Android companion каждые 3 минуты
const POLL_INTERVAL = 3 * 60 * 1000;

// Все зарегистрированные девайсы (device_id[])
let deviceRegistry = [];


// ======================================================================
// INIT
// ======================================================================
MDS.init(async function(msg) {

    if (msg.event === "inited") {
        MDS.log("=== Trackium: Android Pull Mode Started ===");

        // Инициализация БД
        db = new TrackiumDatabase();
        db.init((ok) => {
            if (ok) MDS.log("✅ Database initialized");
            else MDS.log("❌ Database init FAILED");
        });

        // Загрузить список девайсов
        await loadDeviceRegistry();

        // Старт цикла опроса
        startPollingLoop();
        return;
    }

    if (msg.event === "MDS_SHUTDOWN") {
        MDS.log("🛑 Trackium shutting down...");
        return;
    }
});


// ======================================================================
// LOAD DEVICES FROM /devices TABLE
// ======================================================================
async function loadDeviceRegistry() {
    const res = await MDS.sql(`
        SELECT device_id FROM devices ORDER BY created_at ASC
    `);

    if (res.status && res.rows?.length) {
        deviceRegistry = res.rows.map(r => r.device_id || r.DEVICE_ID);
        MDS.log("📦 Loaded devices: " + JSON.stringify(deviceRegistry));
    } else {
        MDS.log("⚠️ No devices found");
        deviceRegistry = [];
    }
}


// ======================================================================
// POLLING LOOP
// ======================================================================
function startPollingLoop() {
    MDS.log(`⏳ Polling Android every ${POLL_INTERVAL / 60000} minutes...`);

    pollOnce(); // Первый опрос сразу

    setInterval(pollOnce, POLL_INTERVAL);
}


// ======================================================================
// ONE POLL CYCLE
// ======================================================================
async function pollOnce() {

    if (deviceRegistry.length === 0) {
        MDS.log("⚠️ No devices to update");
        return;
    }

    for (const deviceId of deviceRegistry) {
        await pullFromAndroid(deviceId);
    }
}


// ======================================================================
// PULL FROM ANDROID COMPANION
// ======================================================================
async function pullFromAndroid(deviceId) {
    const url = "http://127.0.0.1:8123/location";

    MDS.log(`🌐 Requesting Android location for ${deviceId}...`);

    try {
        const res = await MDS.http.get(url);

        if (!res.status) {
            MDS.log(`❌ Android HTTP error: ${res.error}`);
            return;
        }

        const data = JSON.parse(res.response);

        if (!data.deviceId) {
            MDS.log(`⚠️ Android did not send deviceId`);
            return;
        }

        if (!data.latitude || !data.longitude) {
            MDS.log(`⚠️ Invalid coordinates from Android`);
            return;
        }

        MDS.log(`📍 Android → ${data.latitude}, ${data.longitude}`);

        await saveMovementToDB(data);

    } catch (err) {
        MDS.log("❌ Fetch failed: " + err);
    }
}


// ======================================================================
// SAVE MOVEMENT INTO DB
// ======================================================================
async function saveMovementToDB(loc) {

    const deviceId = loc.deviceId;
    const lat      = Number(loc.latitude);
    const lon      = Number(loc.longitude);
    const acc      = Number(loc.accuracy || 0);
    const batt     = Number(loc.battery  || 0);
    const ts       = loc.timestamp || Date.now();

    // 1. movements
    await MDS.sql(`
        INSERT INTO movements 
        (device_id, latitude, longitude, altitude, speed, accuracy, recorded_at)
        VALUES (
            '${deviceId}',
            ${lat},
            ${lon},
            0,
            0,
            ${acc},
            ${ts}
        )
    `);

    // 2. devices — battery + status + last_sync
    await MDS.sql(`
        UPDATE devices
        SET battery=${batt},
            status='online',
            last_sync=CURRENT_TIMESTAMP
        WHERE device_id='${deviceId}'
    `);

    // 3. events — for Recent Activity
    await MDS.sql(`
        INSERT INTO events (device_id, event_type, event_data)
        VALUES ('${deviceId}', 'movement_detected', '{}')
    `);

    MDS.log(`✅ Movement saved: ${deviceId}`);

    // 4. Update UI
    refreshUI(deviceId);
}


// ======================================================================
// UI AUTO-REFRESH
// ======================================================================
function refreshUI(deviceId) {

    try {
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
            window.refreshDevicePosition) 
        {
            window.refreshDevicePosition(deviceId);
        }

    } catch (err) {
        MDS.log("⚠️ UI refresh failed: " + err);
    }
}


// ======================================================================
// READY
// ======================================================================
MDS.log("📡 Trackium MiniDapp Ready (Android Pull Mode)");
