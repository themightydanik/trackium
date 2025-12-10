// app.js - ПОЛНАЯ ВЕРСИЯ со всеми функциями

let db;
let blockchain;
let deviceManager;
let qrGenerator;
let ui;
let currentDeviceId = null;
let simulator;

// Инициализация приложения
function initApp() {
  console.log("🚀 Initializing Trackium...");
  
  ui = new UIManager();
  ui.showScreen('loading-screen');
  
  // Инициализация MDS
  MDS.init(function(msg) {
    console.log("📡 MDS Event:", msg.event);
    
if (msg.event === "inited") {
    console.log("✅ MDS initialized");

    // === INSERT HERE: System Info for Companion App ===
    try {
        // UID MiniDapp
        document.getElementById("mdapp-uid").innerText = MDS.minidapp.uid;

        // Host (IP + port MiniDapp Hub)
        let host = location.origin; 
        document.getElementById("node-host").innerText = host;

        console.log("🔧 System info loaded (UID + Host)");
    } catch (e) {
        console.warn("System info UI elements missing:", e);
    }
    // === END INSERT ===

    onMDSReady();

    } else if (msg.event === "NEWBALANCE") {
      console.log("💰 Balance updated");
      updateBlockchainInfo();
    } else if (msg.event === "NEWBLOCK") {
      console.log("🔗 New block:", msg.data?.txpow?.header?.block);
    }
  });
}

// MDS готов
async function onMDSReady() {
  try {
    console.log("⏳ Starting initialization sequence...");
    
    // 1. Database
    db = new TrackiumDatabase();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Database timeout")), 10000);
      
      db.init((success) => {
        clearTimeout(timeout);
        if (success) {
          console.log("✅ Database initialized");
          resolve();
        } else {
          reject(new Error("Database init failed"));
        }
      });
    });
    
    // 2. Blockchain
    blockchain = new TrackiumBlockchain(db);
    const blockchainReady = await blockchain.init();
    if (!blockchainReady) {
      console.warn("⚠️  Blockchain init failed");
    } else {
      console.log("✅ Blockchain initialized");
    }
    
    // 3. Device Manager (без location tracker)
    deviceManager = new DeviceManager(db);
    console.log("✅ Device Manager initialized");
    
    // 4. QR Generator
    qrGenerator = new QRGenerator();
    console.log("✅ QR Generator initialized");
    
    // 5. Load dashboard
    console.log("📊 Loading dashboard...");
    loadDashboard();

    
    // 6. Показать dashboard
setTimeout(() => {
  console.log("🎉 Trackium ready!");
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) loadingScreen.classList.remove('active');
  
  // Проверить сохраненный режим
  const savedMode = localStorage.getItem('trackium_mode');
  
  if (!savedMode) {
    // ✅ ИСПРАВЛЕНИЕ: По умолчанию сразу Cargo режим
    localStorage.setItem('trackium_mode', 'cargo');
    ui.showScreen('dashboard');
  } else if (savedMode === 'life') {
    initLifeMode();
  } else {
    ui.showScreen('dashboard');
  }
}, 1000);

    // 7. Simulator
simulator = new LocationSimulator(db, deviceManager);
console.log('✅ Simulator initialized');
    
  } catch (error) {
    console.error("❌ Initialization error:", error);
    document.querySelector('.loading-text').textContent = 'Error: ' + error.message;
    document.querySelector('.loading-text').style.color = 'var(--danger-red)';
    
    setTimeout(() => {
      ui.showScreen('dashboard');
    }, 3000);
  }
}

// Загрузить dashboard
function loadDashboard() {
  if (!db || !db.initialized) return;
  
  db.getStatistics((stats) => {
    ui.updateDashboardStats(stats);
  });
  
  // ИСПРАВЛЕНИЕ: Использовать метод с JOIN
  db.getRecentActivityWithDetails(10, (events) => {
    ui.renderRecentActivity(events);
  });
  
  if (typeof loadCategoryFilter === 'function') {
    loadCategoryFilter();
  }
  
  updateBlockchainInfo();
  loadSettings();
  
  // Запустить проверку location service
  startLocationServicePolling();
}

// Обновить blockchain info
function updateBlockchainInfo() {
  if (!blockchain) return;
  const info = blockchain.getBlockchainInfo();
  ui.updateNodeInfo(info.nodeAddress, info.balance);
}

// ========== LOCATION SERVICE INTEGRATION ==========

/**
 * Начать polling для получения данных от Location Service
 */
// function startLocationServicePolling() {
 // console.log('📡 Starting location service polling...');
  
 // setInterval(() => {
   // pollLocationUpdates();
 // }, 10000); // Каждые 10 секунд
// }

/**
 * Эта функция больше не нужна — данные идут из блокчейна
 * Оставляем заглушку для совместимости
 */
// function pollLocationUpdates() {
  // Данные теперь поступают из service.js через blockchain listener
 // console.log('📡 Location updates now come from blockchain');
// }

/**
 * Обработать location update
 */
// function processLocationUpdate(update) {
//  const { deviceId, latitude, longitude, accuracy, source } = update;
  
 // console.log(`📍 Location update for ${deviceId}:`, latitude, longitude);
  
  // Сохранить в БД
 // db.addMovement({
  //  deviceId: deviceId,
  //  latitude: latitude,
  //  longitude: longitude,
  //  altitude: update.altitude || 0,
  //  speed: update.speed || 0,
   // accuracy: accuracy
 // }, (movementId) => {
   // if (movementId) {
   //   console.log('✅ Movement saved:', movementId);
      
      // Обновить статус устройства
   //   db.updateDeviceStatus(deviceId, 'online');
      
      // Обновить UI если это текущее устройство
     // if (currentDeviceId === deviceId) {
    //    refreshDeviceDetail();
    //  }
   // }
//  });
// }

// ========== DEVICE MANAGEMENT ==========

function showScreen(screenId) {
  ui.showScreen(screenId);
  
  if (screenId === 'devices') {
    refreshDevices();
  } else if (screenId === 'shipments') {
    loadShipments();
  } else if (screenId === 'create-shipment') {
    loadDevicesForShipment();
  } else if (screenId === 'analytics') {
    loadAnalytics();
  } else if (screenId === 'settings') {
    loadSettings();
  }
}

function generateDeviceId() {
  // Создать временный менеджер если основной не готов
  const tempManager = deviceManager || new DeviceManager(db);
  const deviceId = tempManager.generateDeviceId();
  
  const input = document.getElementById('device-id');
  if (input) {
    input.value = deviceId;
    console.log('📝 Generated Device ID:', deviceId);
  }
}

async function addDevice() {
  if (!deviceManager || !db) {
    ui.showNotification('System not ready', 'error');
    return;
  }
  
  const deviceType = document.getElementById('device-type').value;
  const deviceId = document.getElementById('device-id').value;
  const deviceName = document.getElementById('device-name').value;
  const deviceLocation = document.getElementById('device-location').value;
  const transportType = document.getElementById('transport-type').value;
  const category = document.getElementById('device-category').value;
  const blockchainProof = document.getElementById('enable-blockchain-proof').checked;
  
  // ВАЛИДАЦИЯ
  if (!deviceId || !deviceName) {
    ui.showNotification('Please fill Device ID and Name', 'error');
    return;
  }
  
  if (!deviceId.match(/^TRACK-[A-Z0-9]+-[A-Z0-9]+$/)) {
    ui.showNotification('Invalid Device ID format. Use: TRACK-XXX-YYY', 'error');
    return;
  }
  
  console.log('📝 Adding device with data:', {
    deviceId,
    deviceName,
    deviceType,
    transportType,
    category,
    deviceLocation,
    blockchainProof
  });
  
  const device = await deviceManager.registerDevice({
    deviceId: deviceId,
    name: deviceName,
    type: deviceType,
    transportType: transportType,
    category: category,
    location: deviceLocation,
    blockchainProof: blockchainProof
  });
  
  if (!device) {
    ui.showNotification('Failed to register device', 'error');
    return;
  }

  ui.showNotification(`Device registered! Device ID: ${device.deviceId}`, 'success');
  
  // Показать инструкцию
  setTimeout(() => {
    alert(`✅ Device registered successfully!\n\n` +
          `Device ID: ${device.deviceId}\n` +
          `Name: ${device.name}\n` +
          `Type: ${device.type}\n\n` +
          `Next step:\n` +
          `1. Download and run Trackium Location Service\n` +
          `2. Enter this Device ID in the service\n` +
          `3. Location tracking will start automatically`);
    
    showScreen('devices');
    loadDashboard();
  }, 500);
}

function refreshDevices() {
  if (!deviceManager) return;
  
  deviceManager.getDevicesStatus((devices) => {
    ui.renderDevicesList(devices);
  });
}

function showDeviceDetail(deviceId) {
  if (!db || !deviceId || deviceId === 'undefined') {
    ui.showNotification('Invalid device ID', 'error');
    return;
  }
  
  currentDeviceId = deviceId;
  globalThis.currentDeviceId = deviceId;
  
  db.getDevice(deviceId, (device) => {
    if (!device) {
      ui.showNotification('Device not found', 'error');
      return;
    }
    
    db.getLastPosition(deviceId, async (position) => {
      if (position && typeof renderPositionWithLocation === 'function') {
        await renderPositionWithLocation(position, 'device-coordinates');
      }
      
      db.getMovementHistory(deviceId, 50, (movements) => {
        db.getBlockchainProofs(deviceId, 20, (proofs) => {
          ui.renderDeviceDetail(device, position, movements, proofs);
          ui.showScreen('device-detail');
          
          // Auto-refresh position
          if (window.positionUpdateInterval) {
            clearInterval(window.positionUpdateInterval);
          }
          
          globalThis.positionUpdateInterval = setInterval(() => {
            if (window.currentDeviceId === deviceId) {
              refreshDevicePosition(deviceId);
            } else {
              clearInterval(window.positionUpdateInterval);
            }
          }, 10000);
        });
      });
    });
  });
}

function refreshDevicePosition(deviceId) {
  db.getLastPosition(deviceId, async (position) => {

    // Ничего нет в БД – просто выходим
    if (!position) {
      console.log("ℹ️ No last position for device:", deviceId);
      return;
    }

    // 1) Обновляем текстовые координаты (под картой)
    if (typeof renderPositionWithLocation === "function") {
      try {
        await renderPositionWithLocation(position, "device-coordinates");
      } catch (e) {
        console.error("renderPositionWithLocation error:", e);
      }
    }

    // 2) Обновляем карту, если MapManager уже инициализирован
    if (window.mapManager) {
      try {
        const lat =
          position.latitude ??
          position.LATITUDE ??
          position.lat ??
          position.LAT;
        const lng =
          position.longitude ??
          position.LONGITUDE ??
          position.lon ??
          position.LON;

        if (typeof lat === "number" && typeof lng === "number") {
          mapManager.updateDevicePosition(lat, lng, {
            accuracy:
              position.accuracy ??
              position.ACCURACY ??
              null,
            speed:
              position.speed ??
              position.SPEED ??
              null,
            timestamp:
              position.timestamp ??
              position.TIMESTAMP ??
              position.recorded_at ??
              position.RECORDED_AT ??
              null,
          });
        } else {
          console.warn("⚠️ refreshDevicePosition: invalid lat/lng", position);
        }
      } catch (e) {
        console.error("Map update error in refreshDevicePosition:", e);
      }
    }
  });
}


function refreshDeviceDetail() {
  if (currentDeviceId) {
    showDeviceDetail(currentDeviceId);
  }
}

function toggleLock() {
  if (!currentDeviceId || !deviceManager) return;
  
  deviceManager.toggleLock(currentDeviceId, (success) => {
    if (success) {
      ui.showNotification('Lock status changed', 'success');
      showDeviceDetail(currentDeviceId);
    } else {
      ui.showNotification('Failed to change lock status', 'error');
    }
  });
}

function generateUnlockQR() {
  if (!currentDeviceId || !qrGenerator) return;
  
  const qrData = qrGenerator.createUnlockQR(currentDeviceId, 5);
  const container = document.getElementById('qr-code-container');
  
  qrGenerator.renderQR(qrData, container);
  ui.showQRModal();
  
  let timeLeft = 300;
  const validityEl = document.getElementById('qr-validity');
  
  const timer = setInterval(() => {
    timeLeft--;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    if (validityEl) {
      validityEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (timeLeft <= 0) {
      clearInterval(timer);
      closeQRModal();
      ui.showNotification('QR code expired', 'warning');
    }
  }, 1000);
}

function closeQRModal() {
  ui.closeQRModal();
}

globalThis.refreshDeviceLocation = function() {
  if (!currentDeviceId || !db) return;
  
  console.log('🔄 Refreshing location for:', currentDeviceId);
  ui.showNotification('Checking for new location data...', 'info');
  
  const coordsEl = document.getElementById('device-coordinates');
  if (coordsEl) {
    coordsEl.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto;"></div>
        <p style="margin-top: 10px; color: var(--text-secondary);">Updating location...</p>
      </div>
    `;
  }
  
  setTimeout(() => {
    refreshDevicePosition(currentDeviceId);
  }, 1000);
};

function deleteDevice(deviceId) {
  if (!deviceId || !deviceManager) return;
  
  deviceManager.removeDevice(deviceId, (success) => {
    if (success) {
      ui.showNotification('Device deleted', 'success');
      setTimeout(() => {
        refreshDevices();
        loadDashboard();
      }, 500);
    } else {
      ui.showNotification('Failed to delete device', 'error');
    }
  });
}

globalThis.confirmDeleteDevice = function(deviceId, deviceName) {
  if (!confirm(`Delete device "${deviceName}"?\n\nThis cannot be undone!`)) return;
  deleteDevice(deviceId);
};

// ========== PROOF OF MOVEMENT ==========

async function submitProofOfMovement() {
  if (!currentDeviceId || !blockchain || !db) return;
  
  ui.showNotification('Submitting proof to blockchain...', 'info');
  
  db.getLastPosition(currentDeviceId, async (movement) => {
    if (!movement) {
      ui.showNotification('No movement data to submit', 'warning');
      return;
    }
    
    const result = await blockchain.submitProofOfMovement(currentDeviceId, movement);
    
    if (result) {
      ui.showNotification('Proof submitted successfully!', 'success');
      db.updateMovementProof(movement.id, result.txid);
      showDeviceDetail(currentDeviceId);
    } else {
      ui.showNotification('Failed to submit proof', 'error');
    }
  });
}

// ========== SHIPMENTS ==========

function loadShipments() {
  if (!db) return;
  
  db.getShipments((shipments) => {
    db.getDevices((devices) => {
      ui.renderShipmentsList(shipments, devices);
    });
  });
}

function loadDevicesForShipment() {
  if (!db) return;
  
  db.getDevices((devices) => {
    ui.populateDeviceSelect(devices);
  });
}

function createShipment() {
  if (!db) return;
  
  const shipmentId = document.getElementById('shipment-id').value || 
                     `SHIP-${Date.now().toString(36).toUpperCase()}`;
  const deviceId = document.getElementById('shipment-device').value;
  const cargo = document.getElementById('shipment-cargo').value;
  const origin = document.getElementById('shipment-origin').value;
  const destination = document.getElementById('shipment-destination').value;
  const delivery = document.getElementById('shipment-delivery').value;
  
  if (!deviceId || !cargo || !origin || !destination) {
    ui.showNotification('Please fill all required fields', 'error');
    return;
  }
  
  const shipment = {
    shipmentId: shipmentId,
    deviceId: deviceId,
    cargo: cargo,
    origin: origin,
    destination: destination,
    expectedDelivery: delivery || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
  
  db.createShipment(shipment, (success) => {
    if (success) {
      ui.showNotification('Shipment created successfully!', 'success');
      db.addEvent(deviceId, 'shipment_created', { shipmentId: shipmentId });
      showScreen('shipments');
      loadDashboard();
    } else {
      ui.showNotification('Failed to create shipment', 'error');
    }
  });
}

// ========== SETTINGS ==========

function loadSettings() {
  if (!db) return;
  
  db.getSetting('auto_proof', (value) => {
    if (value !== null) {
      const el = document.getElementById('auto-proof');
      if (el) el.checked = value;
    }
  });
  
  db.getSetting('proof_frequency', (value) => {
    if (value !== null) {
      const el = document.getElementById('proof-frequency');
      if (el) el.value = value;
    }
  });
  
  db.getSetting('alert_movement', (value) => {
    if (value !== null) {
      const el = document.getElementById('alert-movement');
      if (el) el.checked = value;
    }
  });
  
  db.getSetting('alert_lock', (value) => {
    if (value !== null) {
      const el = document.getElementById('alert-lock');
      if (el) el.checked = value;
    }
  });
}

function saveSettings() {
  if (!db) return;
  
  const autoProof = document.getElementById('auto-proof')?.checked;
  const proofFrequency = document.getElementById('proof-frequency')?.value;
  const alertMovement = document.getElementById('alert-movement')?.checked;
  const alertLock = document.getElementById('alert-lock')?.checked;
  
  if (autoProof !== undefined) db.saveSetting('auto_proof', autoProof);
  if (proofFrequency) db.saveSetting('proof_frequency', proofFrequency);
  if (alertMovement !== undefined) db.saveSetting('alert_movement', alertMovement);
  if (alertLock !== undefined) db.saveSetting('alert_lock', alertLock);
  
  ui.showNotification('Settings saved', 'success');
}

function loadAnalytics() {
  if (typeof window.loadAnalytics === 'function') {
    window.loadAnalytics(); // Вызов из analytics.js
  } else {
    ui.showNotification('Analytics loading...', 'info');
  }
}

function updateDeviceTypeInfo() {
  const deviceType = document.getElementById('device-type')?.value;
  const infoEl = document.getElementById('device-type-info');
  
  if (!infoEl) return;
  
  const descriptions = {
    'tracker': '📍 GPS tracker for cargo. Requires Location Service.',
    'smartlock': '🔒 GPS tracking + remote lock/unlock via QR codes.',
    'smartphone': '📱 Use your phone as a tracker for testing.'
  };
  
  infoEl.textContent = descriptions[deviceType] || '';
}

// Event listeners для настроек
document.addEventListener('DOMContentLoaded', () => {
  const autoProofToggle = document.getElementById('auto-proof');
  const proofFrequencyInput = document.getElementById('proof-frequency');
  const alertMovementToggle = document.getElementById('alert-movement');
  const alertLockToggle = document.getElementById('alert-lock');
  
  if (autoProofToggle) autoProofToggle.addEventListener('change', saveSettings);
  if (proofFrequencyInput) proofFrequencyInput.addEventListener('change', saveSettings);
  if (alertMovementToggle) alertMovementToggle.addEventListener('change', saveSettings);
  if (alertLockToggle) alertLockToggle.addEventListener('change', saveSettings);
});

// ========== LOCATION SERVICE STATUS ==========

/**
 * Проверить статус Location Service
 */
async function checkLocationServiceStatus() {
  try {
    const response = await fetch(MDS.mainhost + 'cmd?uid=' + MDS.minidappuid, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: encodeURIComponent('keypair action:get key:location_service_status')
    });
    
    const data = await response.json();
    
    if (data.status && data.response && data.response.value) {
      const status = JSON.parse(data.response.value);
      console.log('📡 Location Service Status:', status);
      
      // Update UI
      if (status.active) {
        ui.showNotification('Location Service Active ✅', 'success');
      }
      
      return status;
    }
    
    return { active: false };
    
  } catch (error) {
    console.error('Failed to check location service:', error);
    return { active: false };
  }
}

/**
 * Test Location API
 */
async function testLocationAPI() {
  ui.showNotification('Testing location service...', 'info');
  
  const status = await checkLocationServiceStatus();
  
  if (status.active) {
    ui.showNotification(
      `Location Service Active!\nLast update: ${new Date(status.lastUpdate).toLocaleString()}\nDevices: ${status.connectedDevices.length}`,
      'success'
    );
  } else {
    ui.showNotification(
      'Location Service not running. Make sure trackium-location.js is started.',
      'warning'
    );
  }
}

// ===== SIMULATOR CONTROLS =====
function toggleSimulator(enabled) {
  if (!simulator) return;
  
  if (enabled) {
    simulator.start();
    document.getElementById('simulator-controls').style.display = 'block';
    ui.showNotification('Simulator enabled', 'success');
  } else {
    simulator.stop();
    document.getElementById('simulator-controls').style.display = 'none';
    ui.showNotification('Simulator disabled', 'info');
  }
  
  // Сохранить в настройки
  db.saveSetting('simulator_enabled', enabled);
}

function forceSimulatorUpdate() {
  if (!simulator) return;
  simulator.forceUpdate();
}

// ===== BLOCK UPDATER =====
function updateCurrentBlock() {
  MDS.cmd("status", (res) => {
    if (res.status && res.response?.chain?.block) {
      const blockEl = document.getElementById('current-block');
      if (blockEl) {
        blockEl.textContent = `Block ${res.response.chain.block}`;
      }
    }
  });
}

setInterval(updateCurrentBlock, 30000);

// ===== HERO VISIBILITY =====
const originalShowScreen = window.showScreen;
window.showScreen = function(screenId) {
  if (originalShowScreen) originalShowScreen(screenId);
  
  const hero = document.getElementById('hero-section');
  if (hero) {
    hero.style.display = (screenId === 'dashboard') ? 'block' : 'none';
  }
};

// ===== RPC FUNCTIONS =====
async function enableRPC() {
  const btn = document.getElementById('rpc-enable-btn');
  const indicator = document.getElementById('rpc-indicator');
  const statusText = document.getElementById('rpc-status-text');
  
  if (btn) btn.disabled = true;
  if (statusText) statusText.textContent = 'Enabling...';
  
  try {
    const res = await new Promise((resolve) => {
      MDS.cmd("rpc enable:true", resolve);
    });
    
    if (res.status) {
      if (indicator) indicator.classList.add('active');
      if (statusText) statusText.textContent = 'RPC Enabled ✅';
      ui.showNotification('RPC enabled!', 'success');
      
      setTimeout(checkRPCStatus, 2000);
    } else {
      throw new Error(res.error || 'Failed');
    }
  } catch (error) {
    if (statusText) statusText.textContent = '🛠 Confirm the action in Pending MiniDapp';
    ui.showNotification('RPC enable failed', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function checkRPCStatus() {
  try {
    const res = await new Promise((resolve) => {
      MDS.cmd("rpc", resolve);
    });
    
    const indicator = document.getElementById('rpc-indicator');
    const statusText = document.getElementById('rpc-status-text');
    
    if (res.status && res.response?.enabled === true) {
      if (indicator) indicator.classList.add('active');
      if (statusText) statusText.textContent = 'RPC Enabled ✅';
    } else {
      if (indicator) indicator.classList.remove('active');
      if (statusText) statusText.textContent = 'RPC Disabled';
    }
  } catch (error) {
    console.error('RPC check error:', error);
  }
}

// Exports
window.toggleSimulator = toggleSimulator;
window.forceSimulatorUpdate = forceSimulatorUpdate;
window.enableRPC = enableRPC;
window.checkRPCStatus = checkRPCStatus;
window.updateCurrentBlock = updateCurrentBlock;

// Initial
document.addEventListener('DOMContentLoaded', () => {
  updateCurrentBlock();
  
  // Load simulator state
  if (db) {
    db.getSetting('simulator_enabled', (enabled) => {
      if (enabled) {
        const checkbox = document.getElementById('simulator-enabled');
        if (checkbox) checkbox.checked = true;
        toggleSimulator(true);
      }
    });
  }
});

// Export functions
globalThis.checkLocationServiceStatus = checkLocationServiceStatus;
globalThis.testLocationAPI = testLocationAPI;

// Check status on dashboard load
const originalLoadDashboard = window.loadDashboard || loadDashboard;
globalThis.loadDashboard = function() {
  if (originalLoadDashboard) originalLoadDashboard();
  
  // Check location service status
  setTimeout(() => {
    checkLocationServiceStatus();
  }, 1000);
};

// ========== EXPORTS ==========

globalThis.showScreen = showScreen;
globalThis.generateDeviceId = generateDeviceId;
globalThis.addDevice = addDevice;
globalThis.updateDeviceTypeInfo = updateDeviceTypeInfo;
globalThis.refreshDevices = refreshDevices;
globalThis.showDeviceDetail = showDeviceDetail;
globalThis.toggleLock = toggleLock;
globalThis.generateUnlockQR = generateUnlockQR;
globalThis.closeQRModal = closeQRModal;
globalThis.deleteDevice = deleteDevice;
globalThis.submitProofOfMovement = submitProofOfMovement;
globalThis.createShipment = createShipment;

initApp();
