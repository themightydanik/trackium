// service.js — FIXED VERSION (inbound RPC + correct syntax)

MDS.load('./assets/js/database.js');

let db = null;
let locationServiceStatus = {
    active: false,
    lastUpdate: null,
    connectedDevices: new Set()
};

// ======================
// MDS.init
// ======================
MDS.init(function(msg) {

    // === INBOUND (Android → MiniDapp) ===
    if (msg.event === "inbound") {
        try {
            let data = JSON.parse(msg.data);
            MDS.log("📨 INBOUND from Android: " + JSON.stringify(data));
            processInboundLocation(data);
        } catch (e) {
            MDS.log("❌ INBOUND JSON parse error: " + e);
        }
        return;
    }

    // === INIT ===
    if (msg.event === "inited") {
        MDS.log("=== Trackium Background Service Started ===");

        db = new TrackiumDatabase();
        db.init((success) => {
            if (success) {
                MDS.log("✅ Database initialized");
                initServiceStatus();
            } else {
                MDS.log("❌ Database initialization failed");
            }
        });
        return;
    }

    // === BLOCK ===
    if (msg.event === "NEWBLOCK") {
        MDS.log("⛓️ New block: " + msg.data.txpow.header.block);
        return;
    }

    // === BALANCE ===
    if (msg.event === "NEWBALANCE") {
        MDS.log("💰 Balance updated");
        return;
    }

    // === MAINTENANCE ===
    if (msg.event === "MDS_TIMER_1HOUR") {
        MDS.log("🧹 Hourly maintenance");
        performMaintenance();
        return;
    }

    // === SHUTDOWN ===
    if (msg.event === "MDS_SHUTDOWN") {
        MDS.log("🛑 Trackium shutting down");
        updateServiceStatus(false);
        return;
    }
}); // ← ← ← **ЭТОЙ СКОБКИ У ТЕБЯ НЕ БЫЛО**


// ======================
// SERVICE STATUS
// ======================

function initServiceStatus() {
    updateServiceStatus(true);
    MDS.log("📡 Location service status initialized");
}

function updateServiceStatus(active) {
    locationServiceStatus.active = active;
    locationServiceStatus.lastUpdate = new Date().toISOString();
}


// ======================
// PROCESS LOCATION
// ======================

async function processInboundLocation(update) {

    const { deviceId, latitude, longitude, accuracy } = update;

    MDS.log(`📍 Processing inbound location for ${deviceId}`);

    // 1) Save to DB
    const query = `
        INSERT INTO movements 
            (device_id, latitude, longitude, altitude, speed, accuracy)
        VALUES 
            ('${deviceId}', ${latitude}, ${longitude}, 0, 0, ${accuracy});
    `;

    let res = await MDS.sql(query);
    if (!res.status) {
        MDS.log("❌ DB insert failed: " + res.error);
        return;
    }

    MDS.log(`✅ Movement saved for ${deviceId}`);

    // Update device record
    await MDS.sql(`
        UPDATE devices SET 
            status='online', 
            last_sync=CURRENT_TIMESTAMP 
        WHERE device_id='${deviceId}'
    `);

    // 2) Blockchain
    sendToBlockchain(update);

    // 3) Update local state
    locationServiceStatus.active = true;
    locationServiceStatus.lastUpdate = new Date().toISOString();
    locationServiceStatus.connectedDevices.add(deviceId);

    MDS.log(`🏁 Completed inbound update for ${deviceId}`);
}


// ======================
// SEND TO BLOCKCHAIN
// ======================

function sendToBlockchain(update) {

    const payload = JSON.stringify({
        deviceId: update.deviceId,
        lat: update.latitude,
        lon: update.longitude,
        accuracy: update.accuracy,
        battery: update.battery || null,
        ts: Date.now()
    });

    const clean = payload.replace(/"/g, '\\"');

    MDS.log("🔗 Creating blockchain transaction...");

    MDS.cmd("txncreate id:trackium_tx", function() {

        MDS.cmd(`txnadddata id:trackium_tx data:"${clean}"`, function() {

            MDS.cmd("txnsign id:trackium_tx", function() {

                MDS.cmd("txnpost id:trackium_tx", function(res) {
                    if (res.status) {
                        MDS.log("✅ Data posted to Minima blockchain");
                    } else {
                        MDS.log("❌ Blockchain post failed: " + res.message);
                    }
                });

            });

        });
    });
}


// ======================
// MAINTENANCE
// ======================

function performMaintenance() {
    if (!db) return;

    MDS.log("🔧 Performing maintenance...");

    const thirty = new Date(Date.now() - 30*24*60*60*1000).toISOString();

    MDS.sql(`DELETE FROM events WHERE timestamp < '${thirty}'`);

    const tenMin = new Date(Date.now() - 10*60*1000).toISOString();

    MDS.sql(`
        UPDATE devices 
        SET status = 'offline'
        WHERE last_sync < '${tenMin}' AND status = 'online'
    `);
}


// ======================
// READY
// ======================

MDS.log("📡 Trackium Service Ready");
