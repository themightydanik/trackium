// service.js - UPDATED WITH API ENDPOINTS

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
    db.init(() => {
      MDS.log("Database initialized in background service");
    });
    
    // Запустить HTTP server для приема геолокации
    startLocationAPI();
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
  }
  
});

// ========== LOCATION API ==========

/**
 * Запустить HTTP API для приема локации
 */
function startLocationAPI() {
  MDS.log("📡 Starting Location API...");
  
  // Примечание: В Minima MDS нет встроенного HTTP сервера
  // Используем polling через MDS.keypair для обмена данными
  
  // Проверять новые данные каждые 10 секунд
  setInterval(checkForLocationUpdates, 10000);
  
  MDS.log("✅ Location API ready (polling mode)");
}

/**
 * Проверить наличие новых данных локации
 */
function checkForLocationUpdates() {
  if (!db) return;
  
  // Получить ожидающие обновления
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
          MDS.keypair.set('pending_location_updates', '[]');
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
  db.addMovement({
    deviceId: deviceId,
    latitude: latitude,
    longitude: longitude,
    altitude: update.altitude || 0,
    speed: update.speed || 0,
    accuracy: accuracy
  }, (movementId) => {
    if (movementId) {
      MDS.log(`✅ Movement saved: ${movementId}`);
      
      // Обновить статус устройства
      db.updateDeviceStatus(deviceId, 'online');
      
      // Добавить событие
      db.addEvent(deviceId, 'location_update', {
        source: source,
        accuracy: accuracy
      });
      
      // Обновить статус сервиса
      locationServiceStatus.active = true;
      locationServiceStatus.lastUpdate = new Date().toISOString();
      locationServiceStatus.connectedDevices.add(deviceId);
    }
  });
}

/**
 * Получить статус Location Service
 */
function getLocationServiceStatus(callback) {
  const status = {
    active: locationServiceStatus.active,
    lastUpdate: locationServiceStatus.lastUpdate,
    connectedDevices: Array.from(locationServiceStatus.connectedDevices),
    timestamp: new Date().toISOString()
  };
  
  callback(status);
}

// ========== MAINTENANCE ==========

function performMaintenance() {
  if (!db) return;
  
  MDS.log("🔧 Performing maintenance...");
  
  // Удалить старые события (старше 30 дней)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const sql = `DELETE FROM events WHERE timestamp < '${thirtyDaysAgo}'`;
  
  MDS.sql(sql, (res) => {
    if (res.status) {
      MDS.log(`Cleaned up old events: ${res.count || 0} deleted`);
    }
  });
}

// ========== EXTERNAL API (через MDS.net) ==========

/**
 * Обработка внешних запросов через MDS
 */
MDS.keypair.get('api_requests', (res) => {
  if (res && res.value) {
    try {
      const requests = JSON.parse(res.value);
      
      requests.forEach(req => {
        handleAPIRequest(req);
      });
      
      // Очистить
      MDS.keypair.set('api_requests', '[]');
    } catch (err) {
      MDS.log("Error handling API requests: " + err);
    }
  }
});

function handleAPIRequest(request) {
  const { action, params, requestId } = request;
  
  switch (action) {
    case 'location_status':
      getLocationServiceStatus((status) => {
        sendAPIResponse(requestId, status);
      });
      break;
      
    case 'location_update':
      processLocationUpdate(params);
      sendAPIResponse(requestId, { success: true });
      break;
      
    default:
      sendAPIResponse(requestId, { error: 'Unknown action' });
  }
}

function sendAPIResponse(requestId, data) {
  MDS.keypair.get('api_responses', (res) => {
    let responses = [];
    
    if (res && res.value) {
      try {
        responses = JSON.parse(res.value);
      } catch (err) {}
    }
    
    responses.push({
      requestId: requestId,
      data: data,
      timestamp: new Date().toISOString()
    });
    
    MDS.keypair.set('api_responses', JSON.stringify(responses));
  });
}

MDS.log("📡 Trackium Service Ready");
MDS.log("Listening for location updates...");
