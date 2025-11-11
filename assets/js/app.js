// app.js - Главное приложение Trackium (ИСПРАВЛЕНО)

let db;
let blockchain;
let deviceManager;
let qrGenerator;
let ui;
let currentDeviceId = null;

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
      onMDSReady();
    } else if (msg.event === "NEWBALANCE") {
      console.log("💰 Balance updated");
      updateBlockchainInfo();
    } else if (msg.event === "NEWBLOCK") {
      console.log("🔗 New block:", msg.data?.txpow?.header?.block);
    }
  });
}

// MDS готов - ИСПРАВЛЕННАЯ ВЕРСИЯ
async function onMDSReady() {
  try {
    console.log("⏳ Starting initialization sequence...");
    
    // 1. Инициализация базы данных
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
    
    // 2. Инициализация blockchain
    blockchain = new TrackiumBlockchain(db);
    const blockchainReady = await blockchain.init();
    if (!blockchainReady) {
      console.warn("⚠️  Blockchain init failed, continuing anyway");
    } else {
      console.log("✅ Blockchain initialized");
    }
    
    // 3. Инициализация менеджера устройств
    deviceManager = new DeviceManager(db);
    console.log("✅ Device Manager initialized");
    
    // 4. Инициализация QR генератора
    qrGenerator = new QRGenerator();
    console.log("✅ QR Generator initialized");
    
    // 5. Загрузить dashboard
    console.log("📊 Loading dashboard...");
    loadDashboard();
    
    // 6. Показать главный экран через 1 секунду
    setTimeout(() => {
      console.log("🎉 Trackium ready!");
      console.log("📺 Switching to dashboard screen...");
      
      // Убрать загрузочный экран
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.classList.remove('active');
        console.log("✅ Loading screen removed");
      }
      
      // Показать dashboard
      ui.showScreen('dashboard');
      
      // Проверка что всё сработало
      setTimeout(() => {
        const dashboardScreen = document.getElementById('dashboard');
        if (dashboardScreen && dashboardScreen.classList.contains('active')) {
          console.log("✅ Dashboard is now visible");
        } else {
          console.error("❌ Dashboard failed to show!");
        }
      }, 100);
    }, 1000);
    
  } catch (error) {
    console.error("❌ Initialization error:", error);
    document.querySelector('.loading-text').textContent = 'Error: ' + error.message;
    document.querySelector('.loading-text').style.color = 'var(--danger-red)';
    
    // Показать dashboard даже при ошибке через 3 секунды
    setTimeout(() => {
      console.log("⚠️  Showing dashboard despite errors");
      ui.showScreen('dashboard');
    }, 3000);
  }
}

// Загрузить dashboard
function loadDashboard() {
  if (!db || !db.initialized) {
    console.warn("Database not ready for loadDashboard");
    return;
  }
  
  // Загрузить статистику
  db.getStatistics((stats) => {
    ui.updateDashboardStats(stats);
  });
  
  // Загрузить недавнюю активность
  db.getRecentActivity(10, (events) => {
    ui.renderRecentActivity(events);
  });
  
  // Обновить информацию о ноде
  updateBlockchainInfo();
  
  // Загрузить настройки
  loadSettings();
}

// Обновить информацию блокчейна
function updateBlockchainInfo() {
  if (!blockchain) return;
  
  const info = blockchain.getBlockchainInfo();
  ui.updateNodeInfo(info.nodeAddress, info.balance);
}

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
  if (!deviceManager) {
    ui.showNotification('System not ready', 'error');
    return;
  }
  const deviceId = deviceManager.generateDeviceId();
  document.getElementById('device-id').value = deviceId;
}

async function addDevice() {
  if (!deviceManager || !db) {
    console.error('System not ready:', { deviceManager, db });
    ui.showNotification('System not ready', 'error');
    return;
  }
  
  const deviceType = document.getElementById('device-type').value;
  const deviceId = document.getElementById('device-id').value;
  const deviceName = document.getElementById('device-name').value;
  const deviceLocation = document.getElementById('device-location').value;
  const blockchainProof = document.getElementById('enable-blockchain-proof').checked;
  
  console.log('📝 Adding device:', {
    deviceType, deviceId, deviceName, deviceLocation, blockchainProof
  });
  
  if (!deviceId || !deviceName) {
    ui.showNotification('Please fill all required fields', 'error');
    return;
  }
  
  const device = await deviceManager.registerDevice({
    deviceId: deviceId,
    name: deviceName,
    type: deviceType,
    location: deviceLocation,
    blockchainProof: blockchainProof
  });
  
  if (!device) {
    console.error('❌ Failed to register device');
    ui.showNotification('Failed to register device', 'error');
    return;
  }

  console.log('✅ Device registered:', device);
  ui.showNotification('Device registered successfully!', 'success');
  
  // Активация GPS ТОЛЬКО для tracker/smartphone
  if (deviceType === 'tracker' || deviceType === 'smartphone') {
    console.log('🛰️ Activating GPS for', deviceId);
    ui.showNotification('Activating GPS tracking...', 'info');
    
    const result = await deviceManager.activateDevice(device.deviceId, deviceType);
    
    console.log('GPS activation result:', result);
    
    if (result.success) {
      if (result.type === 'real') {
        ui.showNotification('✅ Real GPS activated!', 'success');
      } else if (result.type === 'simulated') {
        ui.showNotification('⚠️ GPS simulation activated', 'warning');
      }
    }
  } else {
    await deviceManager.activateDevice(device.deviceId, deviceType);
    ui.showNotification('Device activated', 'success');
  }
  
  // Задержка для сохранения в БД
  setTimeout(() => {
    console.log('🔄 Refreshing devices list...');
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
  if (!db) return;
  
  currentDeviceId = deviceId;
  window.currentDeviceId = deviceId; // Глобальная переменная для кнопок
  
  console.log('📱 Loading device detail:', deviceId);
  
  db.getDevice(deviceId, (device) => {
    if (!device) {
      ui.showNotification('Device not found', 'error');
      return;
    }
    
    console.log('📦 Device data:', device);
    
    deviceManager.getCurrentPosition(deviceId, async (position) => {
      console.log('📍 Current position:', position);
      
      // Отобразить позицию с названием места
      if (typeof renderPositionWithLocation === 'function' && position) {
        await renderPositionWithLocation(position, 'device-coordinates');
      }
      
      db.getMovementHistory(deviceId, 50, (movements) => {
        console.log('📊 Movement history:', movements.length, 'records');
        
        db.getBlockchainProofs(deviceId, 20, (proofs) => {
          console.log('⛓️ Blockchain proofs:', proofs.length, 'records');
          
          ui.renderDeviceDetail(device, position, movements, proofs);
          ui.showScreen('device-detail');
          
          // Автообновление позиции каждые 10 секунд
          if (window.positionUpdateInterval) {
            clearInterval(window.positionUpdateInterval);
          }
          
          window.positionUpdateInterval = setInterval(() => {
            if (window.currentDeviceId === deviceId) {
              deviceManager.getCurrentPosition(deviceId, async (newPos) => {
                if (newPos && typeof renderPositionWithLocation === 'function') {
                  await renderPositionWithLocation(newPos, 'device-coordinates');
                }
              });
            } else {
              clearInterval(window.positionUpdateInterval);
            }
          }, 10000);
        });
      });
    });
  });
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
    validityEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
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

function deleteDevice(deviceId) {
  if (!deviceId || !deviceManager) return;
  
  if (!confirm('Are you sure you want to delete this device?')) {
    return;
  }
  
  deviceManager.removeDevice(deviceId, (success) => {
    if (success) {
      ui.showNotification('Device deleted', 'success');
      showScreen('devices');
      loadDashboard();
    } else {
      ui.showNotification('Failed to delete device', 'error');
    }
  });
}

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
      document.getElementById('auto-proof').checked = value;
    }
  });
  
  db.getSetting('proof_frequency', (value) => {
    if (value !== null) {
      document.getElementById('proof-frequency').value = value;
    }
  });
  
  db.getSetting('alert_movement', (value) => {
    if (value !== null) {
      document.getElementById('alert-movement').checked = value;
    }
  });
  
  db.getSetting('alert_lock', (value) => {
    if (value !== null) {
      document.getElementById('alert-lock').checked = value;
    }
  });
}

function saveSettings() {
  if (!db) return;
  
  const autoProof = document.getElementById('auto-proof').checked;
  const proofFrequency = document.getElementById('proof-frequency').value;
  const alertMovement = document.getElementById('alert-movement').checked;
  const alertLock = document.getElementById('alert-lock').checked;
  
  db.saveSetting('auto_proof', autoProof);
  db.saveSetting('proof_frequency', proofFrequency);
  db.saveSetting('alert_movement', alertMovement);
  db.saveSetting('alert_lock', alertLock);
  
  ui.showNotification('Settings saved', 'success');
}

function loadAnalytics() {
  ui.showNotification('Analytics feature coming soon!', 'info');
}

function updateDeviceTypeInfo() {
  const deviceType = document.getElementById('device-type').value;
  const infoEl = document.getElementById('device-type-info');
  
  if (!infoEl) return;
  
  const descriptions = {
    'tracker': '📍 GPS tracker for cargo. Requires GPS access.',
    'smartlock': '🔒 GPS tracking + remote lock/unlock via QR codes.',
    'smartphone': '📱 Use your phone as a tracker for testing.'
  };
  
  infoEl.textContent = descriptions[deviceType] || '';
}

// Подтверждение удаления устройства
window.confirmDeleteDevice = function(deviceId, deviceName) {
  if (!confirm(`⚠️ Delete device "${deviceName}"?\n\nThis will permanently remove:\n- Device data\n- Movement history\n- Blockchain proofs\n\nThis cannot be undone!`)) {
    return;
  }
  
  deleteDevice(deviceId);
};

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

// Экспорт функций
window.showScreen = showScreen;
window.generateDeviceId = generateDeviceId;
window.addDevice = addDevice;
window.updateDeviceTypeInfo = updateDeviceTypeInfo;
window.refreshDevices = refreshDevices;
window.showDeviceDetail = showDeviceDetail;
window.toggleLock = toggleLock;
window.generateUnlockQR = generateUnlockQR;
window.closeQRModal = closeQRModal;
window.deleteDevice = deleteDevice;
window.submitProofOfMovement = submitProofOfMovement;
window.createShipment = createShipment;

// Запуск приложения
window.addEventListener('DOMContentLoaded', initApp);
