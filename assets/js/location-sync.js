// location-sync.js

console.log("📡 Trackium Location Sync loaded");

// Подписаться на изменения keypair
Minima.events.addListener("newkey", function(evt) {
    if (!evt.key) return;

    if (evt.key.name === "pending_location_updates") {
        console.log("📍 New pending location data detected");
        processLocationUpdates();
    }
});

async function processLocationUpdates() {
    try {
        // Получить значение keypair
        let res = await MDS.cmd("keypair action:get name:pending_location_updates");
        if (!res.status) return;

        let json = JSON.parse(res.response.value);
        if (!json || json.length === 0) return;

        console.log("🔍 Processing updates:", json);

        for (let upd of json) {
            await saveLocationOnChain(upd);
            await updateDeviceInDatabase(upd);
        }

        // Очистить keypair
        await MDS.cmd("keypair action:set name:pending_location_updates value:[]");

        console.log("✅ All updates processed");

    } catch (e) {
        console.error("❌ Location processing error:", e);
    }
}

async function saveLocationOnChain(update) {
    console.log("⛓️ Creating blockchain TX", update);

    const data = JSON.stringify(update);

    // Создать транзакцию
    let create = await MDS.cmd("txncreate id:loc");
    if (!create.status) throw create.error;

    // (пример: сохраняем в data output NFT / или просто data)
    let out = await MDS.cmd(`txnoutput id:loc amount:0.001 data:'${data}'`);
    if (!out.status) throw out.error;

    let sign = await MDS.cmd("txnsign id:loc");
    let post = await MDS.cmd("txnpost id:loc");

    console.log("📤 TX posted:", post);
}

async function updateDeviceInDatabase(update) {
    // здесь вызывается твоя логика DB
    if (window.db) {
        console.log("🗄️ Updating device", update.deviceId);

        db.saveDeviceLocation(update.deviceId, update.latitude, update.longitude, update.timestamp);
    }
}
