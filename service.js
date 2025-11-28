// service.js - ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ (обновлена + отправка в блокчейн)

MDS.load('./assets/js/database.js');

let db = null;
let locationServiceStatus = {
  active: false,
  lastUpdate: null,
  connectedDevices: new Set()
};

// Инициализация MDS
MDS.init(function(msg) {
  
  if (msg.event === "inited") {
    MDS.log("=== Trackium Background Service Started ===");
    
    // Инициализировать базу данных
    db = new TrackiumDatabase();
    db.init((success) => {
      if (success) {
        MDS.log("✅ Database initialized in background service");
        
        // Инициализировать статус сервиса
        initServiceStatus();
      } else {
        MDS.log("❌ Database initialization failed");
      }
    });
  }

  if (msg.event === "inbound") {
    try {
        let data = JSON.parse(msg.data);
        MDS.log("📨 Incoming Android data: " + JSON.stringify(data));

        processInboundLocation(data);
    } catch (e) {
        MDS.log("❌ Error parsing inbound data: " + e);
    }
  }  

  
  // Новый блок
  if (msg.event === "NEWBLOCK") {
    MDS.log("New block detected: " + msg.data.txpow.header.block);
  }
  
  // Обновление баланса
  if (msg.event === "NEWBALANCE") {
    MDS.log("Balance updated");
  }
  
  // Таймер каждый час
  if (msg.event === "MDS_TIMER_1HOUR") {
    MDS.log("Hourly maintenance");
    performMaintenance();
  }

  
  // Shutdown
  if (msg.event === "MDS_SHUTDOWN") {
    MDS.log("Trackium Service shutting down");
    updateServiceStatus(false);
  }
  
});

// ========== SERVICE STATUS ==========

function initServiceStatus() {
  updateServiceStatus(true);
  MDS.log("📡 Location service status initialized");
}

function updateServiceStatus(active) {
  locationServiceStatus.active = active;
  locationServiceStatus.lastUpdate = new Date().toISOString();
}


// ========== ОБРАБОТКА ЛОКАЦИИ ==========

async function processInboundLocation(update) {
    const { deviceId, latitude, longitude, accuracy, timestamp } = update;

    MDS.log(`📍 Processing inbound location for ${deviceId}`);

    // ========== 1. Сохранение в DB ==========

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

    // Обновить таблицу devices
    await MDS.sql(`
        UPDATE devices SET 
            status='online', 
            last_sync=CURRENT_TIMESTAMP 
        WHERE device_id='${deviceId}'
    `);

    // ========== 2. Создание blockchain-транзакции ==========

    sendToBlockchain(update);

    // ========== 3. Обновить локальный статус ==========

    locationServiceStatus.active = true;
    locationServiceStatus.lastUpdate = new Date().toISOString();
    locationServiceStatus.connectedDevices.add(deviceId);

    updateServiceStatus(true);

    MDS.log(`🏁 Completed inbound update for ${deviceId}`);
}


// ========== SEND TO BLOCKCHAIN ==========

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

  // 1. Создать пустую транзакцию
  MDS.cmd("txncreate id:trackium_tx", function() {

    // 2. Добавить данные
    MDS.cmd(`txnadddata id:trackium_tx data:"${clean}"`, function() {

      // 3. Подписать
      MDS.cmd("txnsign id:trackium_tx", function() {

        // 4. Отправить
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

// ========== MAINTENANCE ==========

function performMaintenance() {
  if (!db) return;
  
  MDS.log("🔧 Performing maintenance...");
  
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  MDS.sql(`DELETE FROM events WHERE timestamp < '${thirtyDaysAgo}'`, (res) => {
    if (res.status) MDS.log("Cleaned up old events");
  });
  
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  MDS.sql(`UPDATE devices 
    SET status = 'offline' 
    WHERE last_sync < '${tenMinutesAgo}' AND status = 'online'`, (res) => {
    if (res.status) MDS.log("Updated offline devices");
  });
}

// ========== API HANDLERS ==========

function getLocationServiceStatus(callback) {
  const status = {
    active: locationServiceStatus.active,
    lastUpdate: locationServiceStatus.lastUpdate,
    connectedDevices: Array.from(locationServiceStatus.connectedDevices),
    timestamp: new Date().toISOString()
  };
  
  callback(status);
}

MDS.log("📡 Trackium Service Ready");
