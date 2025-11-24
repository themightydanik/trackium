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
        
        // Запустить polling для location updates
        startLocationPolling();
        
        // Инициализировать статус сервиса
        initServiceStatus();
      } else {
        MDS.log("❌ Database initialization failed");
      }
    });
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
  
  // Таймер каждые 10 секунд
  if (msg.event === "MDS_TIMER_10SECONDS") {
    checkForLocationUpdates();
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
  const status = {
    active: active,
    lastUpdate: new Date().toISOString(),
    connectedDevices: Array.from(locationServiceStatus.connectedDevices),
    timestamp: Date.now()
  };
  
  MDS.keypair.set('location_service_status', JSON.stringify(status), (res) => {
    if (res && res.status) {
      MDS.log("✅ Service status updated");
    }
  });
}

// ========== LOCATION POLLING ==========

function startLocationPolling() {
  MDS.log("📡 Starting location polling (via MDS_TIMER_10SECONDS)");
}

function checkForLocationUpdates() {
  if (!db || !db.initialized) return;
  
  MDS.keypair.get('pending_location_updates', (res) => {
    if (res && res.value) {
      try {
        const updates = JSON.parse(res.value);
        
        if (Array.isArray(updates) && updates.length > 0) {
          MDS.log(`📍 Processing ${updates.length} location updates`);
          
          let processed = 0;
          
          updates.forEach(update => {
            processLocationUpdate(update, (success) => {
              if (success) processed++;
              
              if (processed === updates.length) {
                MDS.keypair.set('pending_location_updates', '[]', () => {
                  MDS.log(`✅ ${processed} updates processed and cleared`);
                });
              }
            });
          });
        }
      } catch (err) {
        MDS.log("Error processing location updates: " + err.message);
      }
    }
  });
}

// ========== ОБРАБОТКА ЛОКАЦИИ ==========

function processLocationUpdate(update, callback) {
  const { deviceId, latitude, longitude, accuracy, timestamp, battery, source } = update;
  
  MDS.log(`📍 Location update for ${deviceId}: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);

  // --- Сохраняем в локальную БД ---
  const query = `INSERT INTO movements 
    (device_id, latitude, longitude, altitude, speed, accuracy)
    VALUES ('${deviceId}', ${latitude}, ${longitude}, 
            ${update.altitude || 0}, ${update.speed || 0}, ${accuracy || 0})`;
  
  MDS.sql(query, (res) => {
    if (res.status) {
      MDS.log(`✅ Movement saved for ${deviceId}`);

      // Обновить статус устройства
      MDS.sql(`UPDATE devices 
        SET status = 'online', last_sync = CURRENT_TIMESTAMP 
        WHERE device_id = '${deviceId}'`, () => {});

      // Обновить сигнал
      const signalStrength = source === 'bigdatacloud' ? 'WiFi/Cell (High)' :
                            source === 'ip-api' ? 'IP-based (Medium)' : 
                            'WiFi/Cell';
      
      MDS.sql(`UPDATE devices 
        SET signal_strength = '${signalStrength}' 
        WHERE device_id = '${deviceId}'`, () => {});

      // Добавить событие
      const eventData = JSON.stringify({
        source: source,
        accuracy: accuracy,
        latitude: latitude,
        longitude: longitude,
        battery: battery || null
      }).replace(/'/g, "''");
      
      MDS.sql(`INSERT INTO events 
        (device_id, event_type, event_data)
        VALUES ('${deviceId}', 'location_update', '${eventData}')`, () => {});

      // Обновить статус сервиса
      locationServiceStatus.active = true;
      locationServiceStatus.lastUpdate = new Date().toISOString();
      locationServiceStatus.connectedDevices.add(deviceId);
      
      updateServiceStatus(true);

      // ===========================
      // 🚀 ОТПРАВКА В БЛОКЧЕЙН
      // ===========================
      sendToBlockchain(update);

      if (callback) callback(true);
    } else {
      MDS.log(`❌ Failed to save movement: ${res.error}`);
      if (callback) callback(false);
    }
  });
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
MDS.log("Listening for location updates via keypair...");
