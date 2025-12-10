// database.js - SQL Database для Trackium (ES5 совместимая версия для Rhino)

(function() {
  'use strict';

  // ========== CONSTRUCTOR ==========
  function TrackiumDatabase() {
    this.initialized = false;
  }

  // ========== SQL WRAPPER ==========
  TrackiumDatabase.prototype.sql = function(query, callback) {
    MDS.sql(query, callback);
  };

  // ========== INITIALIZATION ==========
  TrackiumDatabase.prototype.init = function(callback) {
    var self = this;
    
    var queries = [
      // Таблица устройств
      "CREATE TABLE IF NOT EXISTS devices (" +
        "id INT AUTO_INCREMENT PRIMARY KEY," +
        "device_id VARCHAR(256) UNIQUE NOT NULL," +
        "device_name VARCHAR(128) NOT NULL," +
        "device_type VARCHAR(32) NOT NULL," +
        "transport_type VARCHAR(32) DEFAULT 'ground'," +
        "category VARCHAR(64)," +
        "location VARCHAR(256)," +
        "status VARCHAR(32) DEFAULT 'offline'," +
        "battery INT DEFAULT 100," +
        "signal_strength VARCHAR(32)," +
        "locked BOOLEAN DEFAULT FALSE," +
        "blockchain_proof BOOLEAN DEFAULT TRUE," +
        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
        "last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
      ")",
      
      // Таблица движений GPS
      "CREATE TABLE IF NOT EXISTS movements (" +
        "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
        "device_id VARCHAR(256) NOT NULL," +
        "latitude DECIMAL(10, 8) NOT NULL," +
        "longitude DECIMAL(11, 8) NOT NULL," +
        "altitude DECIMAL(10, 2)," +
        "speed DECIMAL(10, 2)," +
        "accuracy DECIMAL(10, 2)," +
        "recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
        "proof_submitted BOOLEAN DEFAULT FALSE," +
        "proof_txid VARCHAR(256)" +
      ")",
      
      // Таблица отправлений
      "CREATE TABLE IF NOT EXISTS shipments (" +
        "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
        "shipment_id VARCHAR(256) UNIQUE NOT NULL," +
        "device_id VARCHAR(256) NOT NULL," +
        "cargo_description VARCHAR(1024)," +
        "origin VARCHAR(256)," +
        "destination VARCHAR(256)," +
        "status VARCHAR(32) DEFAULT 'in_transit'," +
        "expected_delivery TIMESTAMP," +
        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
        "delivered_at TIMESTAMP" +
      ")",
      
      // Таблица блокчейн-подтверждений
      "CREATE TABLE IF NOT EXISTS blockchain_proofs (" +
        "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
        "device_id VARCHAR(256) NOT NULL," +
        "proof_type VARCHAR(32) NOT NULL," +
        "proof_hash VARCHAR(256) NOT NULL," +
        "transaction_id VARCHAR(256)," +
        "block_number BIGINT," +
        "data_hash VARCHAR(256)," +
        "verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
        "verified BOOLEAN DEFAULT FALSE" +
      ")",
      
      // Таблица событий
      "CREATE TABLE IF NOT EXISTS events (" +
        "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
        "device_id VARCHAR(256) NOT NULL," +
        "event_type VARCHAR(64) NOT NULL," +
        "event_data VARCHAR(2048)," +
        "event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
      ")",
      
      // Таблица настроек
      "CREATE TABLE IF NOT EXISTS settings (" +
        "setting_key VARCHAR(128) PRIMARY KEY," +
        "setting_value VARCHAR(2048)," +
        "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
      ")"
    ];

    var lifeModeTables = [
      // Таблица пользователей Life режима
      "CREATE TABLE IF NOT EXISTS life_users (" +
        "id INT AUTO_INCREMENT PRIMARY KEY," +
        "username VARCHAR(128) NOT NULL," +
        "level INT DEFAULT 1," +
        "experience INT DEFAULT 0," +
        "avatar VARCHAR(64) DEFAULT 'default'," +
        "avatar_color VARCHAR(16) DEFAULT '#0066CC'," +
        "total_goals INT DEFAULT 0," +
        "completed_goals INT DEFAULT 0," +
        "current_streak INT DEFAULT 0," +
        "longest_streak INT DEFAULT 0," +
        "total_rewards DECIMAL(20, 8) DEFAULT 0," +
        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
        "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
      ")",
      
      // Таблица целей
      "CREATE TABLE IF NOT EXISTS life_goals (" +
        "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
        "user_id INT NOT NULL," +
        "title VARCHAR(256) NOT NULL," +
        "description VARCHAR(1024)," +
        "target_lat DECIMAL(10, 8) NOT NULL," +
        "target_lng DECIMAL(11, 8) NOT NULL," +
        "target_radius INT DEFAULT 100," +
        "reward_amount DECIMAL(20, 8) NOT NULL," +
        "category VARCHAR(64) DEFAULT 'general'," +
        "repeat_type VARCHAR(32) DEFAULT 'once'," +
        "status VARCHAR(32) DEFAULT 'active'," +
        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
      ")",
      
      // Таблица выполнений целей
      "CREATE TABLE IF NOT EXISTS life_completions (" +
        "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
        "user_id INT NOT NULL," +
        "goal_id BIGINT NOT NULL," +
        "completed_lat DECIMAL(10, 8) NOT NULL," +
        "completed_lng DECIMAL(11, 8) NOT NULL," +
        "reward_earned DECIMAL(20, 8) NOT NULL," +
        "experience_earned INT DEFAULT 0," +
        "completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
      ")",
      
      // Таблица достижений (NFTs)
      "CREATE TABLE IF NOT EXISTS life_achievements (" +
        "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
        "user_id INT NOT NULL," +
        "type VARCHAR(64) NOT NULL," +
        "level INT," +
        "token_id VARCHAR(256)," +
        "metadata VARCHAR(2048)," +
        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
      ")"
    ];

    var completed = 0;
    var total = queries.length + lifeModeTables.length;

    function checkComplete() {
      completed++;
      if (completed === total) {
        self.createIndexes(function() {
          self.initialized = true;
          MDS.log("✅ Trackium Database initialized successfully");
          if (callback) callback(true);
        });
      }
    }

    for (var i = 0; i < queries.length; i++) {
      (function(query, index) {
        MDS.sql(query, function(res) {
          if (!res.status) {
            MDS.log("Failed to create table " + index + ":" + res.error);
          }
          checkComplete();
        });
      })(queries[i], i);
    }

    for (var j = 0; j < lifeModeTables.length; j++) {
      (function(query, index) {
        MDS.sql(query, function(res) {
          if (!res.status) {
            MDS.log("Failed to create life table " + index + ":" + res.error);
          }
          checkComplete();
        });
      })(lifeModeTables[j], j);
    }
  };

  // ========== CREATE INDEXES ==========
  TrackiumDatabase.prototype.createIndexes = function(callback) {
    var indexes = [
      "CREATE INDEX IF NOT EXISTS idx_devices_id ON devices(device_id)",
      "CREATE INDEX IF NOT EXISTS idx_movements_device ON movements(device_id)",
      "CREATE INDEX IF NOT EXISTS idx_events_device ON events(device_id)",
      "CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(event_timestamp)"
    ];

    var indexCompleted = 0;
    
    for (var i = 0; i < indexes.length; i++) {
      (function(indexQuery) {
        MDS.sql(indexQuery, function(res) {
          if (!res.status) {
            MDS.log('Failed to create index:' + res.error);
          }
          indexCompleted++;
          if (indexCompleted === indexes.length && callback) {
            callback();
          }
        });
      })(indexes[i]);
    }
  };

  // ========== RECENT ACTIVITY WITH DETAILS ==========
  TrackiumDatabase.prototype.getRecentActivityWithDetails = function(limit, callback) {
    var query = 
      "SELECT " +
        "e.id, e.device_id, e.event_type, e.event_data, e.event_timestamp, " +
        "d.device_name, d.category " +
      "FROM events e " +
      "LEFT JOIN devices d ON e.device_id = d.device_id " +
      "ORDER BY e.event_timestamp DESC " +
      "LIMIT " + (limit || 10);
    
    this.sql(query, function(res) {
      var events = (res.rows || []).map(function(event) {
        return {
          id: event.id || event.ID,
          device_id: event.device_id || event.DEVICE_ID,
          event_type: event.event_type || event.EVENT_TYPE,
          event_data: event.event_data || event.EVENT_DATA,
          timestamp: event.event_timestamp || event.EVENT_TIMESTAMP,
          device_name: event.device_name || event.DEVICE_NAME || 'Unknown Device',
          category: event.category || event.CATEGORY || 'Uncategorized'
        };
      });
      
      MDS.log('📊 Recent activity with details:' + events);
      callback(events);
    });
  };

  // ========== DEVICES ==========
  
  TrackiumDatabase.prototype.addDevice = function(device, callback) {
    var query = "INSERT INTO devices " +
      "(device_id, device_name, device_type, transport_type, category, location, blockchain_proof, status) " +
      "VALUES ('" + device.deviceId + "', '" + this._escape(device.name) + "', '" + device.type + "', " +
              "'" + (device.transportType || 'ground') + "', '" + this._escape(device.category || '') + "', " +
              "'" + this._escape(device.location || '') + "', " + (device.blockchainProof ? 1 : 0) + ", 'offline')";
    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status);
    });
  };

TrackiumDatabase.prototype.getDevices = function(callback) {

    const sql = `
        SELECT 
            d.*,

            -- Последняя широта
            (SELECT latitude FROM movements m 
             WHERE m.device_id = d.device_id
             ORDER BY recorded_at DESC LIMIT 1) AS last_latitude,

            -- Последняя долгота
            (SELECT longitude FROM movements m 
             WHERE m.device_id = d.device_id
             ORDER BY recorded_at DESC LIMIT 1) AS last_longitude,

            -- Последняя точность
            (SELECT accuracy FROM movements m 
             WHERE m.device_id = d.device_id
             ORDER BY recorded_at DESC LIMIT 1) AS last_accuracy,

            -- Последнее время обновления
            (SELECT recorded_at FROM movements m 
             WHERE m.device_id = d.device_id
             ORDER BY recorded_at DESC LIMIT 1) AS last_timestamp

        FROM devices d
        ORDER BY d.created_at DESC;
    `;

    MDS.sql(sql, function(res) {

        MDS.log("📊 Raw devices from DB:" + JSON.stringify(res.rows));

        if (!res.status || !res.rows) {
            callback([]);
            return;
        }

        // === НОРМАЛИЗАЦИЯ КАЖДОЙ СТРОКИ ===
        const devices = res.rows.map(function(row) {

            const deviceId  = row.device_id || row.DEVICE_ID || "Unknown-ID";
            const deviceName = row.device_name || row.DEVICE_NAME || "Unnamed Device";
            const deviceType = row.device_type || row.DEVICE_TYPE || "tracker";

            // --- Last position (добавлено) ---
            const lastPos = {
                latitude:  row.last_latitude !== null ? parseFloat(row.last_latitude) : null,
                longitude: row.last_longitude !== null ? parseFloat(row.last_longitude) : null,
                accuracy:  row.last_accuracy !== null ? parseFloat(row.last_accuracy) : null,
                timestamp: row.last_timestamp || null
            };

            return {
                id: row.ID,

                // === snake_case ===
                device_id: deviceId,
                device_name: deviceName,
                device_type: deviceType,
                transport_type: row.transport_type || row.TRANSPORT_TYPE || "ground",
                category: row.category || row.CATEGORY || "",
                location: row.location || row.LOCATION || "",
                status: row.status || row.STATUS || "offline",
                battery: parseInt(row.battery || row.BATTERY || 0),
                signal_strength: row.signal_strength || row.SIGNAL_STRENGTH || null,
                locked: row.locked === "true" || row.LOCKED === "true" || false,
                blockchain_proof: row.blockchain_proof || row.BLOCKCHAIN_PROOF || "false",
                created_at: row.created_at || row.CREATED_AT || null,
                last_sync: row.last_sync || row.LAST_SYNC || null,

                // === camelCase aliases (UI использует ИХ) ===
                deviceId: deviceId,
                deviceName: deviceName,
                deviceType: deviceType,
                transportType: row.transport_type || row.TRANSPORT_TYPE || "ground",
                signalStrength: row.signal_strength || row.SIGNAL_STRENGTH || null,
                blockchainProof: row.blockchain_proof || row.BLOCKCHAIN_PROOF || "false",
                createdAt: row.created_at || row.CREATED_AT || null,
                lastSync: row.last_sync || row.LAST_SYNC || null,

                // === ДОБАВЛЕНО: передаём в UI последнюю координату ===
                lastPosition: lastPos
            };
        });

        MDS.log("✅ Mapped devices:" + JSON.stringify(devices));
        callback(devices);
    });
};



TrackiumDatabase.prototype.getDevice = function(deviceId, callback) {

    const sql = `
        SELECT *
        FROM devices
        WHERE device_id='${deviceId}' OR DEVICE_ID='${deviceId}'
        LIMIT 1
    `;

    MDS.sql(sql, function(res) {

        if (!res.status || !res.rows || res.rows.length === 0) {
            callback(null);
            return;
        }

        const d = res.rows[0];

        // === НОРМАЛИЗАЦИЯ ВСЕХ ПОЛЕЙ ===
        const device_id = d.device_id || d.DEVICE_ID || deviceId;
        const device_name = d.device_name || d.DEVICE_NAME || "Unknown Device";
        const device_type = d.device_type || d.DEVICE_TYPE || "tracker";

        const normalized = {

            // snake_case
            device_id: device_id,
            device_name: device_name,
            device_type: device_type,

            transport_type: d.transport_type || d.TRANSPORT_TYPE || "ground",
            category: d.category || d.CATEGORY || "",
            location: d.location || d.LOCATION || "",
            status: d.status || d.STATUS || "offline",
            battery: parseInt(d.battery || d.BATTERY || 0),
            signal_strength: d.signal_strength || d.SIGNAL_STRENGTH || null,
            locked: d.locked === "true" || d.LOCKED === "true" || false,
            blockchain_proof: d.blockchain_proof || d.BLOCKCHAIN_PROOF || "false",
            created_at: d.created_at || d.CREATED_AT || null,
            last_sync: d.last_sync || d.LAST_SYNC || null,

            // camelCase — UI использует ИХ
            deviceId: device_id,
            deviceName: device_name,
            deviceType: device_type,
            transportType: d.transport_type || d.TRANSPORT_TYPE || "ground",
            signalStrength: d.signal_strength || d.SIGNAL_STRENGTH || null,
            blockchainProof: d.blockchain_proof || d.BLOCKCHAIN_PROOF || "false",
            createdAt: d.created_at || d.CREATED_AT || null,
            lastSync: d.last_sync || d.LAST_SYNC || null
        };

        callback(normalized);
    });
};


  TrackiumDatabase.prototype.updateDeviceStatus = function(deviceId, status, callback) {
    var query = "UPDATE devices " +
      "SET status = '" + status + "', last_sync = CURRENT_TIMESTAMP " +
      "WHERE device_id = '" + deviceId + "'";
    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status);
    });
  };

  TrackiumDatabase.prototype.updateDeviceSignal = function(deviceId, strength, callback) {
    var query = "UPDATE devices " +
      "SET signal_strength = '" + strength + "', last_sync = CURRENT_TIMESTAMP " +
      "WHERE device_id = '" + deviceId + "'";
    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status);
    });
  };

  TrackiumDatabase.prototype.getDevicesByCategory = function(category, callback) {
    var query = category === 'all' ? 
      "SELECT * FROM devices ORDER BY created_at DESC" :
      "SELECT * FROM devices WHERE category = '" + this._escape(category) + "' ORDER BY created_at DESC";
    
    var self = this;
    MDS.sql(query, function(res) {
      var devices = (res.rows || []).map(function(device) {
        return {
          device_id: device.device_id,
          deviceId: device.device_id,
          deviceName: device.device_name,
          deviceType: device.device_type,
          transportType: device.transport_type,
          signalStrength: device.signal_strength
        };
      });
      callback(devices);
    });
  };

  TrackiumDatabase.prototype.getAllCategories = function(callback) {
    var query = "SELECT DISTINCT category FROM devices WHERE category IS NOT NULL AND category != ''";
    
    MDS.sql(query, function(res) {
      var categories = (res.rows || []).map(function(row) {
        return row.category;
      });
      callback(categories);
    });
  };

  TrackiumDatabase.prototype.updateDeviceBattery = function(deviceId, battery, callback) {
    var query = "UPDATE devices " +
      "SET battery = " + battery + ", last_sync = CURRENT_TIMESTAMP " +
      "WHERE device_id = '" + deviceId + "'";
    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status);
    });
  };

  TrackiumDatabase.prototype.updateLockStatus = function(deviceId, locked, callback) {
    var query = "UPDATE devices " +
      "SET locked = " + (locked ? 1 : 0) + ", last_sync = CURRENT_TIMESTAMP " +
      "WHERE device_id = '" + deviceId + "'";
    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status);
    });
  };

  TrackiumDatabase.prototype.deleteDevice = function(deviceId, callback) {
    MDS.sql("DELETE FROM devices WHERE device_id = '" + deviceId + "'", function(res) {
      if (callback) callback(res.status);
    });
  };

  TrackiumDatabase.prototype.saveDeviceLocation = function(deviceId, lat, lon, timestamp, callback) {

    // movements
var query1 = `
    INSERT INTO movements (device_id, latitude, longitude, altitude, speed, accuracy, recorded_at)
    VALUES ('${deviceId}', ${lat}, ${lon}, 0, 0, 0, datetime(${timestamp}/1000, 'unixepoch'))
`;


    // update device table
    var query2 = `
        UPDATE devices
        SET last_sync = CURRENT_TIMESTAMP
        WHERE device_id='${deviceId}'
    `;

    var self = this;

    MDS.sql(query1, function(res1) {
        MDS.sql(query2, function(res2) {
            if (callback) callback(res1.status && res2.status);
        });
    });
};


  // ========== MOVEMENTS ==========
  
  TrackiumDatabase.prototype.addMovement = function(movement, callback) {
    var query = "INSERT INTO movements " +
 "(device_id, latitude, longitude, altitude, speed, accuracy, recorded_at) " +
"VALUES ('" + movement.deviceId + "', " + movement.latitude + ", " + movement.longitude + ", " +
(movement.altitude || 0) + ", " + (movement.speed || 0) + ", " + (movement.accuracy || 0) + ", " +
"datetime(" + movement.timestamp + "/1000, 'unixepoch'))"

    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status ? (res.response && res.response.id || true) : null);
    });
  };

TrackiumDatabase.prototype.getMovementHistory = function(deviceId, limit, callback) {
const sql = `
    SELECT *
    FROM movements
    WHERE device_id='${deviceId}'
    ORDER BY recorded_at DESC
    LIMIT ${limit || 200}
`;

    MDS.sql(sql, function(res) {
        if (!res.status || !res.rows) {
            callback([]);
            return;
        }

const mapped = res.rows.map(function(r) {
    return {
        id: r.ID || r.id,
        deviceId: r.DEVICE_ID || r.device_id,
        latitude: parseFloat(r.LATITUDE || r.latitude),
        longitude: parseFloat(r.LONGITUDE || r.longitude),
        altitude: parseFloat(r.ALTITUDE || r.altitude || 0),
        speed: parseFloat(r.SPEED || r.speed || 0),
        accuracy: parseFloat(r.ACCURACY || r.accuracy || 0),
        timestamp: r.recorded_at || r.RECORDED_AT
    };
});

        callback(mapped);
    });
};


TrackiumDatabase.prototype.getLastPosition = function(deviceId, callback) {
const sql = `
    SELECT *
    FROM movements
    WHERE device_id='${deviceId}'
    ORDER BY recorded_at DESC
    LIMIT 1
`;

    MDS.sql(sql, function(res) {
        if (!res.status || !res.rows || res.rows.length === 0) {
            callback(null);
            return;
        }

        const r = res.rows[0];

        const movement = {
            id: r.ID,
            deviceId: r.DEVICE_ID || r.device_id,
            latitude: parseFloat(r.LATITUDE),
            longitude: parseFloat(r.LONGITUDE),
            altitude: parseFloat(r.ALTITUDE),
            speed: parseFloat(r.SPEED),
            accuracy: parseFloat(r.ACCURACY),
            timestamp: r.recorded_at
        };

        callback(movement);
    });
};


  TrackiumDatabase.prototype.updateMovementProof = function(movementId, txid, callback) {
    var query = "UPDATE movements " +
      "SET proof_submitted = TRUE, proof_txid = '" + txid + "' " +
      "WHERE id = " + movementId;
    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status);
    });
  };

  // ========== SHIPMENTS ==========
  
  TrackiumDatabase.prototype.createShipment = function(shipment, callback) {
    var query = "INSERT INTO shipments " +
      "(shipment_id, device_id, cargo_description, origin, destination, expected_delivery) " +
      "VALUES ('" + shipment.shipmentId + "', '" + shipment.deviceId + "', " +
              "'" + this._escape(shipment.cargo) + "', '" + this._escape(shipment.origin) + "', " +
              "'" + this._escape(shipment.destination) + "', '" + shipment.expectedDelivery + "')";
    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status);
    });
  };

  TrackiumDatabase.prototype.getShipments = function(callback) {
    MDS.sql("SELECT * FROM shipments ORDER BY created_at DESC", function(res) {
      callback(res.rows || []);
    });
  };

  TrackiumDatabase.prototype.getActiveShipments = function(callback) {
    var query = "SELECT * FROM shipments " +
      "WHERE status = 'in_transit' " +
      "ORDER BY created_at DESC";
    
    MDS.sql(query, function(res) {
      callback(res.rows || []);
    });
  };

  TrackiumDatabase.prototype.updateShipmentStatus = function(shipmentId, status, callback) {
    var query = "UPDATE shipments " +
      "SET status = '" + status + "' " +
      "WHERE shipment_id = '" + shipmentId + "'";
    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status);
    });
  };

  // ========== BLOCKCHAIN PROOFS ==========
  
  TrackiumDatabase.prototype.addBlockchainProof = function(proof, callback) {
    var query = "INSERT INTO blockchain_proofs " +
      "(device_id, proof_type, proof_hash, transaction_id, data_hash) " +
      "VALUES ('" + proof.deviceId + "', '" + proof.type + "', '" + proof.proofHash + "', " +
              "'" + (proof.txid || '') + "', '" + proof.dataHash + "')";
    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status);
    });
  };

  TrackiumDatabase.prototype.getBlockchainProofs = function(deviceId, limit, callback) {
    var query = "SELECT * FROM blockchain_proofs " +
      "WHERE device_id = '" + deviceId + "' " +
      "ORDER BY verified_at DESC " +
      "LIMIT " + (limit || 50);
    
    MDS.sql(query, function(res) {
      callback(res.rows || []);
    });
  };

  TrackiumDatabase.prototype.verifyProof = function(proofId, blockNumber, callback) {
    var query = "UPDATE blockchain_proofs " +
      "SET verified = TRUE, block_number = " + blockNumber + " " +
      "WHERE id = " + proofId;
    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status);
    });
  };

  // ========== EVENTS ==========
  
  TrackiumDatabase.prototype.addEvent = function(deviceId, eventType, eventData, callback) {
    var dataStr = typeof eventData === 'object' ? 
      this._escape(JSON.stringify(eventData)) : this._escape(String(eventData));
    
    var query = "INSERT INTO events " +
      "(device_id, event_type, event_data) " +
      "VALUES ('" + deviceId + "', '" + eventType + "', '" + dataStr + "')";
    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status);
    });
  };

  TrackiumDatabase.prototype.getEvents = function(deviceId, limit, callback) {
    var query = "SELECT * FROM events " +
      "WHERE device_id = '" + deviceId + "' " +
      "ORDER BY event_timestamp DESC " +
      "LIMIT " + (limit || 50);
    
    MDS.sql(query, function(res) {
      callback(res.rows || []);
    });
  };

  TrackiumDatabase.prototype.getRecentActivity = function(limit, callback) {
    var query = "SELECT * FROM events " +
      "ORDER BY event_timestamp DESC " +
      "LIMIT " + (limit || 10);
    
    MDS.sql(query, function(res) {
      callback(res.rows || []);
    });
  };

  // ========== SETTINGS ==========
  
  TrackiumDatabase.prototype.saveSetting = function(key, value, callback) {
    var valueStr = typeof value === 'object' ? 
      this._escape(JSON.stringify(value)) : this._escape(String(value));
    
    var query = "MERGE INTO settings (setting_key, setting_value, updated_at) " +
      "KEY(setting_key) VALUES ('" + key + "', '" + valueStr + "', CURRENT_TIMESTAMP)";
    
    MDS.sql(query, function(res) {
      if (callback) callback(res.status);
    });
  };

  TrackiumDatabase.prototype.getSetting = function(key, callback) {
    MDS.sql("SELECT setting_value FROM settings WHERE setting_key = '" + key + "'", function(res) {
      if (res.rows && res.rows.length > 0) {
        try {
          callback(JSON.parse(res.rows[0].setting_value));
        } catch (e) {
          callback(res.rows[0].setting_value);
        }
      } else {
        callback(null);
      }
    });
  };

  // ========== STATISTICS ==========
  
  TrackiumDatabase.prototype.getStatistics = function(callback) {
    var stats = {
      totalDevices: 0,
      activeShipments: 0,
      lockedDevices: 0,
      verifiedProofs: 0
    };
    
    var completed = 0;
    
    function checkComplete() {
      completed++;
      if (completed === 4) callback(stats);
    }
    
    MDS.sql("SELECT COUNT(*) as cnt FROM devices", function(res) {
      stats.totalDevices = (res.rows && res.rows[0] && res.rows[0].cnt) || 0;
      checkComplete();
    });
    
    MDS.sql("SELECT COUNT(*) as cnt FROM shipments WHERE status = 'in_transit'", function(res) {
      stats.activeShipments = (res.rows && res.rows[0] && res.rows[0].cnt) || 0;
      checkComplete();
    });
    
    MDS.sql("SELECT COUNT(*) as cnt FROM devices WHERE locked = TRUE", function(res) {
      stats.lockedDevices = (res.rows && res.rows[0] && res.rows[0].cnt) || 0;
      checkComplete();
    });
    
    MDS.sql("SELECT COUNT(*) as cnt FROM blockchain_proofs WHERE verified = TRUE", function(res) {
      stats.verifiedProofs = (res.rows && res.rows[0] && res.rows[0].cnt) || 0;
      checkComplete();
    });
  };

  // ========== HELPER ==========
  
  TrackiumDatabase.prototype._escape = function(str) {
    return String(str).replace(/'/g, "''");
  };

// =============================
// PROMISE HELPERS FOR DEVICE MANAGER
// =============================

TrackiumDatabase.prototype.sqlPromise = function(query) {
    return new Promise((resolve, reject) => {
        MDS.sql(query, (res) => {
            if (res.status) resolve(res);
            else reject(res.error || "SQL error");
        });
    });
};

TrackiumDatabase.prototype.addMovementPromise = function(movement) {
    const q = `
        INSERT INTO movements (device_id, latitude, longitude, altitude, speed, accuracy)
        VALUES ('${movement.deviceId}', ${movement.latitude}, ${movement.longitude},
                ${movement.altitude || 0}, ${movement.speed || 0}, ${movement.accuracy || 0})
    `;
    return this.sqlPromise(q);
};

TrackiumDatabase.prototype.updateDeviceStatusPromise = function(deviceId, status) {
    return this.sqlPromise(`
        UPDATE devices
        SET status='${status}', last_sync=CURRENT_TIMESTAMP
        WHERE device_id='${deviceId}'
    `);
};

TrackiumDatabase.prototype.updateDeviceBatteryPromise = function(deviceId, battery) {
    return this.sqlPromise(`
        UPDATE devices
        SET battery=${battery}, last_sync=CURRENT_TIMESTAMP
        WHERE device_id='${deviceId}'
    `);
};

TrackiumDatabase.prototype.addEventPromise = function(deviceId, type, data) {
    const escaped = String(JSON.stringify(data || {})).replace(/'/g, "''");
    return this.sqlPromise(`
        INSERT INTO events (device_id, event_type, event_data)
        VALUES ('${deviceId}', '${type}', '${escaped}')
    `);
};




  // ========== EXPORT ==========
globalThis.TrackiumDatabase = TrackiumDatabase;

})();
