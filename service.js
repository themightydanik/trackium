// ======================================
// Trackium MiniDapp — ANDROID PULL MODE
// ======================================

MDS.load('./assets/js/database.js');

let db = null;

// Как часто опрашиваем приложение-компаньон (в миллисекундах)
const POLL_INTERVAL = 3 * 60 * 1000; // 3 minutes

// Список устройств (MiniDapp может отслеживать много устройств)
let deviceRegistry = [];


// ======================================
// MDS.init
// ======================================
MDS.init(async function(msg) {

    if (msg.event === "inited") {
        MDS.log("=== Trackium: Android Pull Mode Started ===");

        // Init DB
        db = new TrackiumDatabase();
        db.init((ok) => {
            if (ok) MDS.log("✅ Database loaded");
            else    MDS.log("❌ Database init failed");
        });

        // Load existing devices
        loadDeviceRegistry();

        // Start polling loop
        startPollingLoop();

        return;
    }

    if (msg.event === "MDS_SHUTDOWN") {
        MDS.log("🛑 Trackium shutting down");
        return;
    }
});


// ======================================
// LOAD DEVICES FROM DB
// ======================================
async function loadDeviceRegistry() {
    const res = await MDS.sql("SELECT id FROM device_registry ORDER BY id ASC");

    if (res.status && res.rows && res.rows.length > 0) {
        deviceRegistry = res.rows.map(r => r.ID || r.id);
        MDS.log("📦 Loaded devices: " + JSON.stringify(deviceRegistry));
    } else {
        MDS.log("⚠️ No devices found in registry");
    }
}


// ======================================
// POLLING LOOP
// ======================================
function startPollingLoop() {
    MDS.log("⏳ Starting polling every 3 min...");

    setInterval(async () => {
        for (let deviceId of deviceRegistry) {
            await fetchDeviceFromAndroid(deviceId);
        }
    }, POLL_INTERVAL);
}


// ======================================
// FETCH FROM ANDROID COMPANION
// ======================================
async function fetchDeviceFromAndroid(deviceId) {
    const url = `http://127.0.0.1:7331/device/${deviceId}`;

    MDS.log(`🌐 Pulling Android data for ${deviceId} ...`);

    try {
        const res = await MDS.http.get(url);

        if (!res.status) {
            MDS.log(`❌ Android API error for ${deviceId}: ${res.error}`);
            return;
        }

        const data = JSON.parse(res.response);

        // Validate minimal fields
        if (!data.latitude || !data.longitude) {
            MDS.log(`⚠️ Invalid data for ${deviceId}`);
            return;
        }

        MDS.log(`📍 Android data received for ${deviceId}`);
        await saveLocationToDB(data);

    } catch (e) {
        MDS.log("❌ HTTP fetch failed: " + e);
    }
}


// ======================================
// SAVE MOVEMENT INTO DB
// ======================================
async function saveLocationToDB(data) {

    const deviceId = data.deviceId;
    const lat      = data.latitude;
    const lon      = data.longitude;
    const acc      = data.accuracy || 0;
    const batt     = data.battery || 0;

    // === movements ===
    await MDS.sql(`
        INSERT INTO movements (device_id, latitude, longitude, altitude, speed, accuracy)
        VALUES ('${deviceId}', ${lat}, ${lon}, 0, 0, ${acc})
    `);

    // === device_registry ===
    await MDS.sql(`
        INSERT OR IGNORE INTO device_registry (id, name, description, type)
        VALUES ('${deviceId}', '${deviceId}', 'Tracked device', 'tracker')
    `);

    // === device_states ===
    await MDS.sql(`
        INSERT OR REPLACE INTO device_states 
        (id, status, battery, last_sync)
        VALUES ('${deviceId}', 'online', ${batt}, CURRENT_TIMESTAMP)
    `);

    // === metadata ===
    const metadata = {
        accuracy: acc,
        source: "android",
        last_lat: lat,
        last_lon: lon,
        last_update: Date.now()
    };

    await MDS.sql(`
        INSERT OR REPLACE INTO device_metadata (id, meta)
        VALUES ('${deviceId}', '${JSON.stringify(metadata).replace(/'/g, "''")}')
    `);

    MDS.log(`✅ Saved Android position for ${deviceId}`);
}


// ======================================
// READY
// ======================================
MDS.log("📡 Trackium MiniDapp Ready (Android Pull Mode)");
