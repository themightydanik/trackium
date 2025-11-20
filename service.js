// service.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

MDS.load('./assets/js/database.js');

let db = null;
let locationServiceStatus = {
  active: false,
  lastUpdate: null,
  connectedDevices: new Set()
};

// Simple HTTP server через MDS
const PORT = 9003;

MDS.init(function(msg) {
  
  if (msg.event === "inited") {
    MDS.log("=== Trackium Background Service Started ===");
    
    // Инициализировать базу данных
    db = new TrackiumDatabase();
    db.init(() => {
      MDS.log("Database initialized in background service");
    });
    
    // Запустить polling для location updates
    startLocationPolling();
  }
  
  if (msg.event === "NEWBLOCK") {
    MDS.log("New block detected: " + msg.data.txpow.header.block);
  }
  
  if (msg.event === "NEWBALANCE") {
    MDS.log("Balance updated");
  }
  
  if (msg.event === "MDS_TIMER_1HOUR") {
    MDS.log("Hourly maintenance");
    performMaintenance();
  }
  
  if (msg.event === "MDS_SHUTDOWN") {
    MDS.log("Trackium Service shutting down");
  }
  
});

// ========== LOCATION POLLING ==========

/**
 * Polling для получения location updates из keypair storage
 */
function startLocationPolling() {
  MDS.log("📡 Starting location polling...");
  
  setInterval(() => {
    checkForLocationUpdates();
  }, 10000); // Каждые 10 секунд
}

/**
 * Проверить наличие новых данных локации
 */
function checkForLocationUpdates() {
  if (!db) return;
  
  // Получить ожидающие обновления из keypair
  MDS.keypair.get('pending_location_updates', (res) => {
    if (res && res.value) {
      try {
        const updates = JSON.parse(res.value);
        
        if (Array.isArray(updates) && updates.length > 0) {
          MDS.log(`📍 Processing ${updates.length} location updates`);
          
          updates.forEach(update => {
            processLocationUpdate(update);
          });
          
          // Очистить обработанные
          MDS.keypair.set('pending_location_updates', '[]', () => {
            MDS.log("✅ Updates processed and cleared");
          });
        }
      } catch (err) {
        MDS.log("Error processing location updates: " + err.message);
      }
    }
  });
}

/**
 * Обработать обновление локации
 */
function processLocationUpdate(update) {
  const { deviceId, latitude, longitude, accuracy, timestamp, source } = update;
  
  MDS.log(`📍 Location update for ${deviceId}: ${latitude}, ${longitude}`);
  
  // Сохранить в movements
  const query = `INSERT INTO movements 
    (device_id, latitude, longitude, altitude, speed, accuracy)
    VALUES ('${deviceId}', ${latitude}, ${longitude}, 
            ${update.altitude || 0}, ${update.speed || 0}, ${accuracy || 0})`;
  
  db.sql(query, (res) => {
    if (res.status) {
      MDS.log(`✅ Movement saved for ${deviceId}`);
      
      // Обновить статус устройства
      db.sql(`UPDATE devices 
        SET status = 'online', last_sync = CURRENT_TIMESTAMP 
        WHERE device_id = '${deviceId}'`, () => {});
      
      // Добавить событие
      db.sql(`INSERT INTO events 
        (device_id, event_type, event_data)
        VALUES ('${deviceId}', 'location_update', 
                '{"source":"${source}","accuracy":${accuracy}}')`, () => {});
      
      // Обновить статус сервиса
      locationServiceStatus.active = true;
      locationServiceStatus.lastUpdate = new Date().toISOString();
      locationServiceStatus.connectedDevices.add(deviceId);
    }
  });
}

// ========== MAINTENANCE ==========

function performMaintenance() {
  if (!db) return;
  
  MDS.log("🔧 Performing maintenance...");
  
  // Удалить старые события (старше 30 дней)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  db.sql(`DELETE FROM events WHERE timestamp < '${thirtyDaysAgo}'`, (res) => {
    if (res.status) {
      MDS.log("Cleaned up old events");
    }
  });
}

MDS.log("📡 Trackium Service Ready");
