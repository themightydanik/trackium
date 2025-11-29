// ============================
// service.js — FINISHED RPC VERSION
// ============================

MDS.load('./assets/js/database.js');

let db = null;
let locationServiceStatus = {
    active: false,
    lastUpdate: null,
    connectedDevices: new Set()
};

// ===================================
// MDS.init — обработка всех событий
// ===================================
MDS.init(function(msg) {

    // === ANDROID → MiniDapp (ОФИЦИАЛЬНЫЙ RPC INBOUND) ===
    if (msg.event === "inbound") {
        try {
            // msg.data — ЭТО СТРОКА которую мы отправили из RPC
            const data = JSON.parse(msg.data);
            MDS.log("📨 RPC inbound: " + JSON.stringify(data));
            processInboundLocation(data);
        } catch (e) {
            MDS.log("❌ RPC inbound JSON parse error: " + e);
        }
        return;
    }

    // === МИНИДАП ЗАГРУЗИЛСЯ ===
    if (msg.event === "inited") {
        MDS.log("=== Trackium Service Booting ===");

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
        MDS.log("⛓ NEWBLOCK " + msg.data.txpow.header.block);
        return;
    }

    if (msg.event === "NEWBALANCE") {
        MDS.log("💰 Balance updated");
        return;
    }

    if (msg.event === "MDS_TIMER_1HOUR") {
        MDS.log("🧹 Maintenance triggered");
        performMaintenance();
        return;
    }

    if (msg.event === "MDS_SHUTDOWN") {
        MDS.log("🛑 Shutting down");
        updateServiceStatus(false);
        return;
    }
});


// ============================
// SERVICE STATUS
// ============================
function initServiceStatus() {
    updateServiceStatus(true);
    MDS.log("📡 Location service active");
}

function updateServiceStatus(active) {
    locationServiceStatus.active = active;
    locationServiceStatus.lastUpdate = new Date().toISOString();
}


// ============================
// PROCESS LOCATION
// ============================
async function processInboundLocation(update) {
    const { deviceId, latitude, longitude, accuracy } = update;

    MDS.log(`📍 Processing location for ${deviceId}`);

    // === 1) movements ===
    const sql = `
        INSERT INTO movements 
            (device_id, latitude, longitude, altitude, speed, accuracy)
        VALUES 
            ('${deviceId}', ${latitude}, ${longitude}, 0, 0, ${accuracy});
    `;
    const res = await MDS.sql(sql);
    if (!res.status) {
        MDS.log("❌ DB insert failed: " + res.error);
        return;
    }
    MDS.log(`✅ Movement saved for ${deviceId}`);

    // === 2) registry (если нет — создаём) ===
    await MDS.sql(`
        INSERT OR IGNORE INTO device_registry (id, name, description, type)
        VALUES ('${deviceId}', '${deviceId}', 'Tracked device', 'tracker')
    `);

    // === 3) device_states (для UI списков) ===
    await MDS.sql(`
        INSERT OR REPLACE INTO device_states (id, status, battery, last_sync)
        VALUES ('${deviceId}', 'online', ${update.battery || 0}, CURRENT_TIMESTAMP)
    `);

    // === 4) metadata — ОБЯЗАТЕЛЬНО для UI устройства ===
    const metadata = {
        accuracy: update.accuracy,
        source: update.source || "gps",
        last_lat: update.latitude,
        last_lon: update.longitude,
        last_update: Date.now()
    };

    await MDS.sql(`
        INSERT OR REPLACE INTO device_metadata (id, meta)
        VALUES ('${deviceId}', '${JSON.stringify(metadata).replace(/'/g, "''")}')
    `);

    // === BLOCKCHAIN (опционально) ===
    sendToBlockchain(update);

    // === Update local status ===
    locationServiceStatus.active = true;
    locationServiceStatus.lastUpdate = new Date().toISOString();
    locationServiceStatus.connectedDevices.add(deviceId);

    MDS.log(`🏁 Completed for ${deviceId}`);
}


// ============================
// BLOCKCHAIN TX (optional)
// ============================
function sendToBlockchain(update) {
    const payload = JSON.stringify({
        deviceId: update.deviceId,
        lat: update.latitude,
        lon: update.longitude,
        accuracy: update.accuracy,
        battery: update.battery || null,
        ts: Date.now()
    }).replace(/"/g, '\\"');

    MDS.log("🔗 Building blockchain TX");

    MDS.cmd("txncreate id:trackium_tx", function() {
        MDS.cmd(`txnadddata id:trackium_tx data:"${payload}"`, function() {
            MDS.cmd("txnsign id:trackium_tx", function() {
                MDS.cmd("txnpost id:trackium_tx", function(res) {
                    if (res.status) {
                        MDS.log("✅ Blockchain TX posted");
                    } else {
                        MDS.log("❌ Blockchain TX failed: " + res.message);
                    }
                });
            });
        });
    });
}


// ============================
// MAINTENANCE
// ============================
function performMaintenance() {
    const thirty = new Date(Date.now() - 30*24*60*60*1000).toISOString();

    MDS.sql(`DELETE FROM events WHERE timestamp < '${thirty}'`);

    const ten = new Date(Date.now() - 10*60*1000).toISOString();

    MDS.sql(`
        UPDATE devices 
        SET status='offline'
        WHERE last_sync < '${ten}' AND status='online'
    `);
}


// ============================
// READY
// ============================
MDS.log("📡 Trackium Service Ready (RPC mode)");
