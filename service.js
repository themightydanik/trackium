// ======================================
// service.js — FINAL VERSION (Blockchain TX mode)
// ======================================

MDS.load('./assets/js/database.js');

let db = null;

// ======================================
// INIT
// ======================================
MDS.init(async function(msg) {

    if (msg.event === "inited") {
        MDS.log("=== Trackium TX Listener Started ===");

        db = new TrackiumDatabase();
        db.init((ok) => {
            if (ok) MDS.log("✅ Database loaded");
            else MDS.log("❌ Database init failed");
        });

        return;
    }

    // ==========================
    // NEW BLOCK → CHECK TXs
    // ==========================
    if (msg.event === "NEWBLOCK") {
        const blk = msg.data.txpow.header.block;
        MDS.log("⛓ New block: " + blk);

        scanForTrackiumTransactions();
        return;
    }

    if (msg.event === "MDS_SHUTDOWN") {
        MDS.log("🛑 Trackium shutting down");
        return;
    }
});


// ======================================
// SCAN BLOCKCHAIN
// ======================================
async function scanForTrackiumTransactions() {

    // Поиск всех транзакций за последние 10 блоков
    const search = await MDS.cmd(
        "txpowsearch blockdepth:10 includemempool:true"
    );

    if (!search.status || !search.response) {
        MDS.log("❌ txpowsearch failed");
        return;
    }

    const list = search.response;
    for (let tx of list) {
        if (!tx.data || !tx.data.length) continue;

        for (let d of tx.data) {

            // Каждая data — заэскейпленный JSON
            let raw = d.data;

            if (!raw) continue;

            try {
                const clean = raw.replace(/\\"/g, '"');
                const json = JSON.parse(clean);

                // Проверяем, что это наши данные Android-компаньона
                if (json.deviceId && json.lat && json.lon) {
                    MDS.log("📨 TX location received for " + json.deviceId);
                    await processLocationTX(json);
                }

            } catch (e) {
                MDS.log("❌ TX decode failed: " + e);
            }
        }
    }
}


// ======================================
// PROCESS LOCATION FROM TX
// ======================================
async function processLocationTX(data) {

    const deviceId = data.deviceId;
    const latitude = data.lat;
    const longitude = data.lon;
    const accuracy = data.accuracy || 0;

    MDS.log(`📍 Saving TX location for ${deviceId}`);

    // === movements ===
    await MDS.sql(`
        INSERT INTO movements (device_id, latitude, longitude, altitude, speed, accuracy)
        VALUES ('${deviceId}', ${latitude}, ${longitude}, 0, 0, ${accuracy})
    `);

    // === device_registry ===
    await MDS.sql(`
        INSERT OR IGNORE INTO device_registry (id, name, description, type)
        VALUES ('${deviceId}', '${deviceId}', 'Tracked device', 'tracker')
    `);

    // === device_states ===
    await MDS.sql(`
        INSERT OR REPLACE INTO device_states (id, status, battery, last_sync)
        VALUES ('${deviceId}', 'online', ${data.battery || 0}, CURRENT_TIMESTAMP)
    `);

    // === metadata ===
    const metadata = {
        accuracy: accuracy,
        source: "tx",
        last_lat: latitude,
        last_lon: longitude,
        last_update: Date.now()
    };

    await MDS.sql(`
        INSERT OR REPLACE INTO device_metadata (id, meta)
        VALUES ('${deviceId}', '${JSON.stringify(metadata).replace(/'/g, "''")}')
    `);

    MDS.log(`✅ TX saved for ${deviceId}`);
}


// ======================================
// READY
// ======================================
MDS.log("📡 Trackium MiniDapp Ready (Blockchain TX mode)");
