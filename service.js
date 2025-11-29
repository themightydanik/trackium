// service.js — HTTP POST inbound version

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

    // === HTTP POST INBOUND (Android → MiniDapp) ===
    if (msg.event === "inboundPOST") {
        // msg.data = строка JSON
        MDS.log("📨 HTTP POST inbound: " + msg.data);

        try {
            const body = JSON.parse(msg.data);
            processInboundLocation(body);
        } catch (e) {
            MDS.log("❌ inboundPOST JSON parse error: " + e);
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

    if (msg.event === "NEWBLOCK") {
        MDS.log("⛓️ New block: " + msg.data.txpow.header.block);
        return;
    }

    if (msg.event === "NEWBALANCE") {
        MDS.log("💰 Balance updated");
        return;
    }

    if (msg.event === "MDS_TIMER_1HOUR") {
        MDS.log("🧹 Hourly maintenance");
        performMaintenance();
        return;
    }

    if (msg.event === "MDS_SHUTDOWN") {
        MDS.log("🛑 Trackium shutting down");
        updateServiceStatus(false);
        return;
    }
});


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
    const sql = `
        INSERT INTO movements 
            (device_id, latitude, longitude, altitude, speed, accuracy)
        VALUES 
            ('${deviceId}', ${latitude}, ${longitude}, 0, 0, ${accuracy});
    `;

    let res = await MDS.sql(sql);
    if (!res.status) {
        MDS.log("❌ DB insert failed: " + res.error);
        return;
    }

    MDS.log(`✅ Movement saved for ${deviceId}`);

    await MDS.sql(`
        UPDATE devices SET 
            status='online', 
            last_sync=CURRENT_TIMESTAMP 
        WHERE device_id='${deviceId}'
    `);

    // 2) Blockchain (optional)
    sendToBlockchain(update);

    // 3) Update MiniDapp local status
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

    const escaped = payload.replace(/"/g, '\\"');

    MDS.log("🔗 Creating blockchain transaction...");

    MDS.cmd("txncreate id:trackium_tx", function() {
        MDS.cmd(`txnadddata id:trackium_tx data:"${escaped}"`, function() {
            MDS.cmd("txnsign id:trackium_tx", function() {
                MDS.cmd("txnpost id:trackium_tx", function(res) {
                    if (res.status) MDS.log("✅ Blockchain TX posted");
                    else MDS.log("❌ Blockchain TX failed: " + res.message);
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

MDS.log("📡 Trackium Service Ready (HTTP POST mode)");
