// database.js - SQL Database для Trackium

class TrackiumDatabase {
  constructor() {
    this.initialized = false;
  }

  // Инициализация базы данных
  init(callback) {
    const queries = [
      // Таблица устройств
      `CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        device_id VARCHAR(256) UNIQUE NOT NULL,
        device_name VARCHAR(128) NOT NULL,
        device_type VARCHAR(32) NOT NULL,
        location VARCHAR(256),
        status VARCHAR(32) DEFAULT 'offline',
        battery INTEGER DEFAULT 100,
        gps_signal BOOLEAN DEFAULT FALSE,
        locked BOOLEAN DEFAULT FALSE,
        blockchain_proof BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Таблица движений GPS
      `CREATE TABLE IF NOT EXISTS movements (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(256) NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        altitude DECIMAL(10, 2),
        speed DECIMAL(10, 2),
        accuracy DECIMAL(10, 2),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        proof_submitted BOOLEAN DEFAULT FALSE,
        proof_txid VARCHAR(256)
      )`,
      
      // Таблица отправлений
      `CREATE TABLE IF NOT EXISTS shipments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        shipment_id VARCHAR(256) UNIQUE NOT NULL,
        device_id VARCHAR(256) NOT NULL,
        cargo_description TEXT,
        origin VARCHAR(256),
        destination VARCHAR(256),
        status VARCHAR(32) DEFAULT 'in_transit',
        expected_delivery TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivered_at TIMESTAMP
      )`,
      
      // Таблица блокчейн-подтверждений
      `CREATE TABLE IF NOT EXISTS blockchain_proofs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(256) NOT NULL,
        proof_type VARCHAR(32) NOT NULL,
        proof_hash VARCHAR(256) NOT NULL,
        transaction_id VARCHAR(256),
        block_number BIGINT,
        data_hash VARCHAR(256),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified BOOLEAN DEFAULT FALSE
      )`,
      
      // Таблица событий
      `CREATE TABLE IF NOT EXISTS events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(256) NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        event_data TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Таблица настроек
      `CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(128) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    let completed = 0;
    queries.forEach(query => {
      MDS.sql(query, (res) => {
        completed++;
        if (completed === queries.length) {
          this.initialized = true;
          console.log("Trackium Database initialized");
          if (callback) callback(true);
        }
      });
    });
  }

  // ========== DEVICES ==========

  // Добавить устройство
  addDevice(device, callback) {
    const query = `INSERT INTO devices 
      (device_id, device_name, device_type, location, blockchain_proof, status)
      VALUES ('${device.deviceId}', '${device.name}', '${device.type}', 
              '${device.location || ''}', ${device.blockchainProof}, 'online')`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // Получить все устройства
  getDevices(callback) {
    const query = `SELECT * FROM devices ORDER BY created_at DESC`;
    
    MDS.sql(query, (res) => {
      callback(res.rows || []);
    });
  }

  // Получить устройство по ID
  getDevice(deviceId, callback) {
    const query = `SELECT * FROM devices WHERE device_id = '${deviceId}'`;
    
    MDS.sql(query, (res) => {
      callback(res.rows && res.rows.length > 0 ? res.rows[0] : null);
    });
  }

  // Обновить статус устройства
  updateDeviceStatus(deviceId, status, callback) {
    const query = `UPDATE devices 
      SET status = '${status}', last_sync = CURRENT_TIMESTAMP 
      WHERE device_id = '${deviceId}'`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // Обновить батарею
  updateDeviceBattery(deviceId, battery, callback) {
    const query = `UPDATE devices 
      SET battery = ${battery}, last_sync = CURRENT_TIMESTAMP 
      WHERE device_id = '${deviceId}'`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // Обновить GPS сигнал
  updateDeviceGPS(deviceId, hasSignal, callback) {
    const query = `UPDATE devices 
      SET gps_signal = ${hasSignal}, last_sync = CURRENT_TIMESTAMP 
      WHERE device_id = '${deviceId}'`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // Обновить статус замка
  updateLockStatus(deviceId, locked, callback) {
    const query = `UPDATE devices 
      SET locked = ${locked}, last_sync = CURRENT_TIMESTAMP 
      WHERE device_id = '${deviceId}'`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // Удалить устройство
  deleteDevice(deviceId, callback) {
    const query = `DELETE FROM devices WHERE device_id = '${deviceId}'`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // ========== MOVEMENTS ==========

  // Добавить точку движения
  addMovement(movement, callback) {
    const query = `INSERT INTO movements 
      (device_id, latitude, longitude, altitude, speed, accuracy)
      VALUES ('${movement.deviceId}', ${movement.latitude}, ${movement.longitude}, 
              ${movement.altitude || 0}, ${movement.speed || 0}, ${movement.accuracy || 0})`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status ? res.lastid : null);
    });
  }

  // Получить историю движений
  getMovementHistory(deviceId, limit = 100, callback) {
    const query = `SELECT * FROM movements 
      WHERE device_id = '${deviceId}' 
      ORDER BY timestamp DESC 
      LIMIT ${limit}`;
    
    MDS.sql(query, (res) => {
      callback(res.rows || []);
    });
  }

  // Получить последнюю позицию
  getLastPosition(deviceId, callback) {
    const query = `SELECT * FROM movements 
      WHERE device_id = '${deviceId}' 
      ORDER BY timestamp DESC 
      LIMIT 1`;
    
    MDS.sql(query, (res) => {
      callback(res.rows && res.rows.length > 0 ? res.rows[0] : null);
    });
  }

  // Обновить proof submission
  updateMovementProof(movementId, txid, callback) {
    const query = `UPDATE movements 
      SET proof_submitted = TRUE, proof_txid = '${txid}' 
      WHERE id = ${movementId}`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // ========== SHIPMENTS ==========

  // Создать отправление
  createShipment(shipment, callback) {
    const query = `INSERT INTO shipments 
      (shipment_id, device_id, cargo_description, origin, destination, expected_delivery)
      VALUES ('${shipment.shipmentId}', '${shipment.deviceId}', 
              '${shipment.cargo}', '${shipment.origin}', '${shipment.destination}', 
              '${shipment.expectedDelivery}')`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // Получить все отправления
  getShipments(callback) {
    const query = `SELECT * FROM shipments ORDER BY created_at DESC`;
    
    MDS.sql(query, (res) => {
      callback(res.rows || []);
    });
  }

  // Получить активные отправления
  getActiveShipments(callback) {
    const query = `SELECT * FROM shipments 
      WHERE status = 'in_transit' 
      ORDER BY created_at DESC`;
    
    MDS.sql(query, (res) => {
      callback(res.rows || []);
    });
  }

  // Обновить статус отправления
  updateShipmentStatus(shipmentId, status, callback) {
    const query = `UPDATE shipments 
      SET status = '${status}' 
      WHERE shipment_id = '${shipmentId}'`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // ========== BLOCKCHAIN PROOFS ==========

  // Добавить blockchain proof
  addBlockchainProof(proof, callback) {
    const query = `INSERT INTO blockchain_proofs 
      (device_id, proof_type, proof_hash, transaction_id, data_hash)
      VALUES ('${proof.deviceId}', '${proof.type}', '${proof.proofHash}', 
              '${proof.txid || ''}', '${proof.dataHash}')`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // Получить blockchain proofs
  getBlockchainProofs(deviceId, limit = 50, callback) {
    const query = `SELECT * FROM blockchain_proofs 
      WHERE device_id = '${deviceId}' 
      ORDER BY timestamp DESC 
      LIMIT ${limit}`;
    
    MDS.sql(query, (res) => {
      callback(res.rows || []);
    });
  }

  // Обновить верификацию proof
  verifyProof(proofId, blockNumber, callback) {
    const query = `UPDATE blockchain_proofs 
      SET verified = TRUE, block_number = ${blockNumber} 
      WHERE id = ${proofId}`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // ========== EVENTS ==========

  // Добавить событие
  addEvent(deviceId, eventType, eventData, callback) {
    const dataStr = typeof eventData === 'object' ? JSON.stringify(eventData) : eventData;
    const query = `INSERT INTO events 
      (device_id, event_type, event_data)
      VALUES ('${deviceId}', '${eventType}', '${dataStr}')`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // Получить события
  getEvents(deviceId, limit = 50, callback) {
    const query = `SELECT * FROM events 
      WHERE device_id = '${deviceId}' 
      ORDER BY timestamp DESC 
      LIMIT ${limit}`;
    
    MDS.sql(query, (res) => {
      callback(res.rows || []);
    });
  }

  // Получить недавнюю активность (все устройства)
  getRecentActivity(limit = 10, callback) {
    const query = `SELECT * FROM events 
      ORDER BY timestamp DESC 
      LIMIT ${limit}`;
    
    MDS.sql(query, (res) => {
      callback(res.rows || []);
    });
  }

  // ========== SETTINGS ==========

  // Сохранить настройку
  saveSetting(key, value, callback) {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
    const query = `INSERT OR REPLACE INTO settings (key, value, updated_at) 
      VALUES ('${key}', '${valueStr}', CURRENT_TIMESTAMP)`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // Получить настройку
  getSetting(key, callback) {
    const query = `SELECT value FROM settings WHERE key = '${key}'`;
    
    MDS.sql(query, (res) => {
      if (res.rows && res.rows.length > 0) {
        try {
          callback(JSON.parse(res.rows[0].value));
        } catch {
          callback(res.rows[0].value);
        }
      } else {
        callback(null);
      }
    });
  }

  // ========== STATISTICS ==========

  // Получить статистику
  getStatistics(callback) {
    const stats = {};
    
    // Total devices
    MDS.sql("SELECT COUNT(*) as count FROM devices", (res1) => {
      stats.totalDevices = res1.rows[0].count;
      
      // Active shipments
      MDS.sql("SELECT COUNT(*) as count FROM shipments WHERE status = 'in_transit'", (res2) => {
        stats.activeShipments = res2.rows[0].count;
        
        // Locked devices
        MDS.sql("SELECT COUNT(*) as count FROM devices WHERE locked = TRUE", (res3) => {
          stats.lockedDevices = res3.rows[0].count;
          
          // Verified proofs
          MDS.sql("SELECT COUNT(*) as count FROM blockchain_proofs WHERE verified = TRUE", (res4) => {
            stats.verifiedProofs = res4.rows[0].count;
            
            callback(stats);
          });
        });
      });
    });
  }
}

// Экспорт
window.TrackiumDatabase = TrackiumDatabase;
