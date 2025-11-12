// database.js - SQL Database для Trackium (ИСПРАВЛЕНО)

class TrackiumDatabase {
  constructor() {
    this.initialized = false;
  }

    // Обёртка для вызова SQL-запросов
  sql(query, callback) {
    MDS.sql(query, callback);
  }

  // Инициализация базы данных
  init(callback) {
    const queries = [
      // Таблица устройств
      `CREATE TABLE IF NOT EXISTS devices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(256) UNIQUE NOT NULL,
        device_name VARCHAR(128) NOT NULL,
        device_type VARCHAR(32) NOT NULL,
        transport_type VARCHAR(32) DEFAULT 'ground',
        category VARCHAR(64),
        location VARCHAR(256),
        status VARCHAR(32) DEFAULT 'offline',
        battery INT DEFAULT 100,
        signal_strength VARCHAR(32),
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
        cargo_description VARCHAR(1024),
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
        event_data VARCHAR(2048),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Таблица настроек
      `CREATE TABLE IF NOT EXISTS settings (
        setting_key VARCHAR(128) PRIMARY KEY,
        setting_value VARCHAR(2048),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    let completed = 0;
    const total = queries.length;

    queries.forEach((query, index) => {
      MDS.sql(query, (res) => {
        if (!res.status) {
          console.error(`Failed to create table ${index}:`, res.error);
        }
        completed++;
        
        if (completed === total) {
          this.initialized = true;
          console.log("✅ Trackium Database initialized successfully");
          if (callback) callback(true);
        }
      });
    });
  }

  // ========== DEVICES ==========

  addDevice(device, callback) {
    const query = `INSERT INTO devices 
      (device_id, device_name, device_type, location, blockchain_proof, status)
      VALUES ('${device.deviceId}', '${this._escape(device.name)}', '${device.type}', 
              '${this._escape(device.location || '')}', ${device.blockchainProof}, 'online')`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  getDevices(callback) {
    MDS.sql(`SELECT * FROM devices ORDER BY created_at DESC`, (res) => {
      const devices = (res.rows || []).map(device => ({
        ...device,
        deviceId: device.device_id,
        deviceName: device.device_name,
        deviceType: device.device_type,
        transportType: device.transport_type,
        signalStrength: device.signal_strength,
        blockchainProof: device.blockchain_proof,
        createdAt: device.created_at,
        lastSync: device.last_sync
      }));
      callback(devices);
    });
  }

  getDevice(deviceId, callback) {
    MDS.sql(`SELECT * FROM devices WHERE device_id = '${deviceId}'`, (res) => {
      if (res.rows && res.rows.length > 0) {
        const device = res.rows[0];
        callback({
          ...device,
          deviceId: device.device_id,
          deviceName: device.device_name,
          deviceType: device.device_type,
          transportType: device.transport_type,
          signalStrength: device.signal_strength,
          blockchainProof: device.blockchain_proof,
          createdAt: device.created_at,
          lastSync: device.last_sync
        });
      } else {
        callback(null);
      }
    });
  }

  updateDeviceStatus(deviceId, status, callback) {
    const query = `UPDATE devices 
      SET status = '${status}', last_sync = CURRENT_TIMESTAMP 
      WHERE device_id = '${deviceId}'`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // Обновить сигнал
  updateDeviceSignal(deviceId, strength, callback) {
    const query = `UPDATE devices 
      SET signal_strength = '${strength}', last_sync = CURRENT_TIMESTAMP 
      WHERE device_id = '${deviceId}'`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // Получить устройства по категории
  getDevicesByCategory(category, callback) {
    const query = category === 'all' ? 
      `SELECT * FROM devices ORDER BY created_at DESC` :
      `SELECT * FROM devices WHERE category = '${this._escape(category)}' ORDER BY created_at DESC`;
    
    MDS.sql(query, (res) => {
      const devices = (res.rows || []).map(device => ({
        ...device,
        deviceId: device.device_id,
        deviceName: device.device_name,
        deviceType: device.device_type,
        transportType: device.transport_type,
        signalStrength: device.signal_strength
      }));
      callback(devices);
    });
  }

  // Получить все категории
  getAllCategories(callback) {
    const query = `SELECT DISTINCT category FROM devices WHERE category IS NOT NULL AND category != ''`;
    
    MDS.sql(query, (res) => {
      const categories = (res.rows || []).map(row => row.category);
      callback(categories);
    });
  }

  updateDeviceBattery(deviceId, battery, callback) {
    const query = `UPDATE devices 
      SET battery = ${battery}, last_sync = CURRENT_TIMESTAMP 
      WHERE device_id = '${deviceId}'`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  updateDeviceGPS(deviceId, hasSignal, callback) {
    const query = `UPDATE devices 
      SET gps_signal = ${hasSignal}, last_sync = CURRENT_TIMESTAMP 
      WHERE device_id = '${deviceId}'`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  updateLockStatus(deviceId, locked, callback) {
    const query = `UPDATE devices 
      SET locked = ${locked}, last_sync = CURRENT_TIMESTAMP 
      WHERE device_id = '${deviceId}'`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  deleteDevice(deviceId, callback) {
    MDS.sql(`DELETE FROM devices WHERE device_id = '${deviceId}'`, (res) => {
      if (callback) callback(res.status);
    });
  }

  // ========== MOVEMENTS ==========

  addMovement(movement, callback) {
    const query = `INSERT INTO movements 
      (device_id, latitude, longitude, altitude, speed, accuracy)
      VALUES ('${movement.deviceId}', ${movement.latitude}, ${movement.longitude}, 
              ${movement.altitude || 0}, ${movement.speed || 0}, ${movement.accuracy || 0})`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status ? (res.response?.id || true) : null);
    });
  }

  getMovementHistory(deviceId, limit, callback) {
    const query = `SELECT * FROM movements 
      WHERE device_id = '${deviceId}' 
      ORDER BY timestamp DESC 
      LIMIT ${limit || 100}`;
    
    MDS.sql(query, (res) => {
      callback(res.rows || []);
    });
  }

  getLastPosition(deviceId, callback) {
    const query = `SELECT * FROM movements 
      WHERE device_id = '${deviceId}' 
      ORDER BY timestamp DESC 
      LIMIT 1`;
    
    MDS.sql(query, (res) => {
      callback(res.rows && res.rows.length > 0 ? res.rows[0] : null);
    });
  }

  updateMovementProof(movementId, txid, callback) {
    const query = `UPDATE movements 
      SET proof_submitted = TRUE, proof_txid = '${txid}' 
      WHERE id = ${movementId}`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // ========== SHIPMENTS ==========

  createShipment(shipment, callback) {
    const query = `INSERT INTO shipments 
      (shipment_id, device_id, cargo_description, origin, destination, expected_delivery)
      VALUES ('${shipment.shipmentId}', '${shipment.deviceId}', 
              '${this._escape(shipment.cargo)}', '${this._escape(shipment.origin)}', 
              '${this._escape(shipment.destination)}', '${shipment.expectedDelivery}')`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  getShipments(callback) {
    MDS.sql(`SELECT * FROM shipments ORDER BY created_at DESC`, (res) => {
      callback(res.rows || []);
    });
  }

  getActiveShipments(callback) {
    const query = `SELECT * FROM shipments 
      WHERE status = 'in_transit' 
      ORDER BY created_at DESC`;
    
    MDS.sql(query, (res) => {
      callback(res.rows || []);
    });
  }

  updateShipmentStatus(shipmentId, status, callback) {
    const query = `UPDATE shipments 
      SET status = '${status}' 
      WHERE shipment_id = '${shipmentId}'`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // ========== BLOCKCHAIN PROOFS ==========

  addBlockchainProof(proof, callback) {
    const query = `INSERT INTO blockchain_proofs 
      (device_id, proof_type, proof_hash, transaction_id, data_hash)
      VALUES ('${proof.deviceId}', '${proof.type}', '${proof.proofHash}', 
              '${proof.txid || ''}', '${proof.dataHash}')`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  getBlockchainProofs(deviceId, limit, callback) {
    const query = `SELECT * FROM blockchain_proofs 
      WHERE device_id = '${deviceId}' 
      ORDER BY timestamp DESC 
      LIMIT ${limit || 50}`;
    
    MDS.sql(query, (res) => {
      callback(res.rows || []);
    });
  }

  verifyProof(proofId, blockNumber, callback) {
    const query = `UPDATE blockchain_proofs 
      SET verified = TRUE, block_number = ${blockNumber} 
      WHERE id = ${proofId}`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  // ========== EVENTS ==========

  addEvent(deviceId, eventType, eventData, callback) {
    const dataStr = typeof eventData === 'object' ? 
      this._escape(JSON.stringify(eventData)) : this._escape(String(eventData));
    
    const query = `INSERT INTO events 
      (device_id, event_type, event_data)
      VALUES ('${deviceId}', '${eventType}', '${dataStr}')`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  getEvents(deviceId, limit, callback) {
    const query = `SELECT * FROM events 
      WHERE device_id = '${deviceId}' 
      ORDER BY timestamp DESC 
      LIMIT ${limit || 50}`;
    
    MDS.sql(query, (res) => {
      callback(res.rows || []);
    });
  }

  getRecentActivity(limit, callback) {
    const query = `SELECT * FROM events 
      ORDER BY timestamp DESC 
      LIMIT ${limit || 10}`;
    
    MDS.sql(query, (res) => {
      callback(res.rows || []);
    });
  }

  // ========== SETTINGS ==========

  saveSetting(key, value, callback) {
    const valueStr = typeof value === 'object' ? 
      this._escape(JSON.stringify(value)) : this._escape(String(value));
    
    const query = `MERGE INTO settings (setting_key, setting_value, updated_at) 
      KEY(setting_key) VALUES ('${key}', '${valueStr}', CURRENT_TIMESTAMP)`;
    
    MDS.sql(query, (res) => {
      if (callback) callback(res.status);
    });
  }

  getSetting(key, callback) {
    MDS.sql(`SELECT setting_value FROM settings WHERE setting_key = '${key}'`, (res) => {
      if (res.rows && res.rows.length > 0) {
        try {
          callback(JSON.parse(res.rows[0].setting_value));
        } catch {
          callback(res.rows[0].setting_value);
        }
      } else {
        callback(null);
      }
    });
  }

  // ========== STATISTICS ==========

  getStatistics(callback) {
    const stats = {
      totalDevices: 0,
      activeShipments: 0,
      lockedDevices: 0,
      verifiedProofs: 0
    };
    
    let completed = 0;
    const checkComplete = () => {
      completed++;
      if (completed === 4) callback(stats);
    };
    
    MDS.sql("SELECT COUNT(*) as cnt FROM devices", (res) => {
      stats.totalDevices = res.rows?.[0]?.cnt || 0;
      checkComplete();
    });
    
    MDS.sql("SELECT COUNT(*) as cnt FROM shipments WHERE status = 'in_transit'", (res) => {
      stats.activeShipments = res.rows?.[0]?.cnt || 0;
      checkComplete();
    });
    
    MDS.sql("SELECT COUNT(*) as cnt FROM devices WHERE locked = TRUE", (res) => {
      stats.lockedDevices = res.rows?.[0]?.cnt || 0;
      checkComplete();
    });
    
    MDS.sql("SELECT COUNT(*) as cnt FROM blockchain_proofs WHERE verified = TRUE", (res) => {
      stats.verifiedProofs = res.rows?.[0]?.cnt || 0;
      checkComplete();
    });
  }

  // Helper: Escape SQL strings
  _escape(str) {
    return String(str).replace(/'/g, "''");
  }
}

window.TrackiumDatabase = TrackiumDatabase;
