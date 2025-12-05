// ======================================
// service.js: Trackium MiniDapp — ANDROID PULL MODE
// ======================================

MDS.load('./assets/js/database.js');

let db = null;

// Интервал опроса Android Companion (в миллисекундах)
const POLL_INTERVAL = 3 * 60 * 1000; // 3 minutes

// Список deviceId всех устройств
let deviceRegistry = [];


// ======================================
// MDS.init
// ======================================
MDS.init(async function (msg) {

    if (msg.event === "inited") {

        MDS.log("=== Trackium: Android Pull Mode Started ===");

        // Init DB
        db = new TrackiumDatabase();
        db.init((ok) => {
            if (ok) MDS.log("✅ Database loaded");
            else MDS.log("❌ Database init failed");
        });

        // Load existing devices
        await loadDeviceRegistry();

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
    const res = await MDS.sql(`
        SELECT device_id
        FROM devices
        ORDER BY created_at ASC
    `);

    if (res.status && res.rows && res.rows.length > 0) {
        deviceRegistry = res.rows.map(r =>
            r.device_id || r.DEVICE_ID
        );
        MDS.log("📦 Loaded devices: " + JSON.stringify(deviceRegistry));
    } else {
        MDS.log("⚠️ No devices found in devices table");
        deviceRegistry = [];
    }
}


// ======================================
// POLLING LOOP
// ======================================
function startPollingLoop() {
    MDS.log(`⏳ Starting polling every ${POLL_INTERVAL / 60000} min...`);

    setInterval(async () => {
        if (deviceRegistry.length === 0) {
            MDS.log("⚠️ No devices to update");
            return;
        }

        for (let deviceId of deviceRegistry) {
            await fetchDeviceFromAndroid(deviceId);
        }
    }, POLL_INTERVAL);
}


// ======================================
// FETCH FROM ANDROID COMPANION
// ======================================
async function fetchDeviceFromAndroid(deviceId) {
    const url = "http://127.0.0.1:8123/location";

    MDS.log(`🌐 Pulling Android data for ${deviceId} ...`);

    try {
        const res = await MDS.http.get(url);

        if (!res.status) {
            MDS.log(`❌ Android API error: ${res.error}`);
            return;
        }

        const data = JSON.parse(res.response);

        if (!data.deviceId) {
            MDS.log("⚠️ Android response missing deviceId");
            return;
        }

        if (!data.latitude || !data.longitude) {
            MDS.log(`⚠️ Invalid GPS data for ${data.deviceId}`);
            return;
        }

        MDS.log(`📍 Android data received: ${data.latitude}, ${data.longitude}`);
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
    const lat = data.latitude;
    const lon = data.longitude;
    const acc = data.accuracy || 0;
    const batt = data.battery || 0;

    // movements
    await MDS.sql(`
        INSERT INTO movements (device_id, latitude, longitude, altitude, speed, accuracy)
        VALUES ('${deviceId}', ${lat}, ${lon}, 0, 0, ${acc})
    `);

    // update device fields
    await MDS.sql(`
        UPDATE devices 
        SET battery=${batt}, 
            status='online', 
            last_sync=CURRENT_TIMESTAMP
        WHERE device_id='${deviceId}'
    `);

    MDS.log(`✅ Saved Android position for ${deviceId}`);
}


// ======================================
// READY
// ======================================
MDS.log("📡 Trackium MiniDapp Ready (Android Pull Mode)");
