// ES5/Rhino-only initializer for the unchanged legacy tables used by service.js.
// Browser helpers stay in assets/js/database.js; no Promise or Gateway code is loaded.
(function (root) {
  'use strict';
  function TrackiumBackgroundDatabase() {
    this.initialized = false;
  }
  TrackiumBackgroundDatabase.prototype.init = function (callback) {
    var self = this;
    var queries = [
      "CREATE TABLE IF NOT EXISTS devices (id INT AUTO_INCREMENT PRIMARY KEY,device_id VARCHAR(256) UNIQUE NOT NULL,device_name VARCHAR(128) NOT NULL,device_type VARCHAR(32) NOT NULL,transport_type VARCHAR(32) DEFAULT 'ground',category VARCHAR(64),location VARCHAR(256),status VARCHAR(32) DEFAULT 'offline',battery INT DEFAULT 100,signal_strength VARCHAR(32),locked BOOLEAN DEFAULT FALSE,blockchain_proof BOOLEAN DEFAULT TRUE,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      'CREATE TABLE IF NOT EXISTS movements (id BIGINT AUTO_INCREMENT PRIMARY KEY,device_id VARCHAR(256) NOT NULL,latitude DECIMAL(10, 8) NOT NULL,longitude DECIMAL(11, 8) NOT NULL,altitude DECIMAL(10, 2),speed DECIMAL(10, 2),accuracy DECIMAL(10, 2),recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,proof_submitted BOOLEAN DEFAULT FALSE,proof_txid VARCHAR(256))',
      'CREATE TABLE IF NOT EXISTS events (id BIGINT AUTO_INCREMENT PRIMARY KEY,device_id VARCHAR(256) NOT NULL,event_type VARCHAR(64) NOT NULL,event_data VARCHAR(2048),event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      'CREATE INDEX IF NOT EXISTS idx_devices_id ON devices(device_id)',
      'CREATE INDEX IF NOT EXISTS idx_movements_device ON movements(device_id)',
      'CREATE INDEX IF NOT EXISTS idx_events_device ON events(device_id)',
      'CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(event_timestamp)'
    ];
    var position = 0;
    function next() {
      if (position === queries.length) {
        self.initialized = true;
        callback(true);
        return;
      }
      MDS.sql(queries[position++], function (result) {
        if (!result || !result.status) {
          self.initialized = false;
          callback(false);
          return;
        }
        next();
      });
    }
    next();
  };
  root.TrackiumBackgroundDatabase = TrackiumBackgroundDatabase;
})(this);
