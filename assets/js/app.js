// app.js - Главное приложение Trackium

// Глобальные переменры
let db;
let blockchain;
let deviceManager;
let gpsTracker;
let qrGenerator;
let ui;
let currentDeviceId = null;

// Инициализация приложения
function initApp() {
  console.log("Initializing Trackium...");
  
  ui = new UIManager();
  ui.showScreen('loading-screen');
  
  // Инициализация MDS
  MDS.init(function(msg) {
    if (msg.event === "inited") {
      console.log("MDS initialized");
      onMDSReady();
    } else if (msg.event === "NEWBALANCE") {
      console.log("Balance updated");
      updateBlockchainInfo();
    } else if (msg.event === "NEWBLOCK") {
      console.log("New block:", msg.data.txpow.header.block);
    }
  });
}

// MDS готов
async function onMDSReady() {
  try {
    // Инициализация базы данных
    db = new TrackiumDatabase();
    await new Promise(resolve => db.init(resolve));
    console.log("Database initialized");
    
    // Инициализация blockchain
    blockchain = new TrackiumBlockchain(db);
    await blockchain.init();
    console.log("Blockchain initialized");
    
    // Инициализация менеджера устройств (БЕЗ GPS!)
    deviceManager = new DeviceManager(db);
    console.log("Device Manager initialized");
    
    // Инициализация QR генератора
    qrGenerator = new QRGenerator();
    console.log("QR Generator initialized");
    
    // Загрузить dashboard
    loadDashboard();
    
    // Показать главный экран
    setTimeout(() => {
      ui.showScreen('dashboard');
    }, 1000);
    
    console.log("Trackium initialized successfully!");
    
  } catch (error) {
    console.error("Initialization error:", error);
    document.querySelector('.loading-text').textContent = 'Error: ' + error.message;
  }
}

// Загрузить dashboard
function loadDashboard() {
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

// Показать форму добавления устройства
function showScreen(screenId) {
  ui.showScreen(screenId);
  
  // Загрузить данные для экрана
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

// Генерировать Device ID
function generateDeviceId() {
  const deviceId = deviceManager.generateDeviceId();
  document.getElementById('device-id').value = deviceId;
}

// Добавить устройство
async function addDevice() {
  const deviceType = document.getElementById('device-type').value;
  const deviceId = document.getElementById('device-id').value;
  const deviceName = document.getElementById('device-name').value;
  const deviceLocation = document.getElementById('device-location').value;
  const blockchainProof = document.getElementById('enable-blockchain-proof').checked;
  
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
    ui.showNotification('Failed to register device', 'error');
    return;
  }

  ui.showNotification('Device registered successfully!', 'success');
  
  // Активация GPS ТОЛЬКО для tracker/smartphone типов
  if (deviceType === 'tracker' || deviceType === 'smartphone') {
    ui.showNotification('Activating GPS tracking...', 'info');
    
    const result = await deviceManager.activateDevice(device.deviceId, deviceType);
    
    if (result.success) {
      if (result.type === 'real') {
        ui.showNotification('✅ Real GPS activated!', 'success');
      } else if (result.type === 'simulated') {
        ui.showNotification('⚠️ GPS simulation activated (real GPS not available)', 'warning');
      }
    } else {
      ui.showNotification('GPS activation failed, device added without tracking', 'warning');
    }
  } else {
    // Для smartlock просто активируем без GPS
    await deviceManager.activateDevice(device.deviceId, deviceType);
    ui.showNotification('Device activated (no GPS tracking)', 'success');
  }
  
  // Перейти к списку устройств
  showScreen('devices');
  loadDashboard();
}

// Обновить список устройств
function refreshDevices() {
  deviceManager.getDevicesStatus((devices) => {
    ui.renderDevicesList(devices);
  });
}

// Показать детали устройства
function showDeviceDetail(deviceId) {
  currentDeviceId = deviceId;
  
  db.getDevice(deviceId, (device) => {
    if (!device) {
      ui.showNotification('Device not found', 'error');
      return;
    }
    
    // Получить текущую позицию
    deviceManager.getCurrentPosition(deviceId, (position) => {
      // Получить историю движений
      db.getMovementHistory(deviceId, 50, (movements) => {
        // Получить blockchain proofs
        db.getBlockchainProofs(deviceId, 20, (proofs) => {
          ui.renderDeviceDetail(device, position, movements, proofs);
          ui.showScreen('device-detail');
        });
      });
    });
  });
}

// Переключить замок
function toggleLock() {
  if (!currentDeviceId) return;
  
  deviceManager.toggleLock(currentDeviceId, (success) => {
    if (success) {
      ui.showNotification('Lock status changed', 'success');
      // Обновить детали устройства
      showDeviceDetail(currentDeviceId);
    } else {
      ui.showNotification('Failed to change lock status', 'error');
    }
  });
}

// Генерировать QR для разблокировки
function generateUnlockQR() {
  if (!currentDeviceId) return;
  
  const qrData = qrGenerator.createUnlockQR(currentDeviceId, 5);
  const container = document.getElementById('qr-code-container');
  
  qrGenerator.renderQR(qrData, container);
  ui.showQRModal();
  
  // Обновить таймер
  let timeLeft = 300; // 5 минут
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

// Удалить устройство
function deleteDevice(deviceId) {
  if (!deviceId) return;
  
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

// Отправить proof-of-movement
async function submitProofOfMovement() {
  if (!currentDeviceId) return;
  
  ui.showNotification('Submitting proof to blockchain...', 'info');
  
  // Получить последнюю позицию
  db.getLastPosition(currentDeviceId, async (movement) => {
    if (!movement) {
      ui.showNotification('No movement data to submit', 'warning');
      return;
    }
    
    const result = await blockchain.submitProofOfMovement(currentDeviceId, movement);
    
    if (result) {
      ui.showNotification('Proof submitted successfully!', 'success');
      
      // Обновить запись движения
      db.updateMovementProof(movement.id, result.txid);
      
      // Обновить детали устройства
      showDeviceDetail(currentDeviceId);
    } else {
      ui.showNotification('Failed to submit proof', 'error');
    }
  });
}

// ========== SHIPMENTS ==========

// Загрузить список отправлений
function loadShipments() {
  db.getShipments((shipments) => {
    db.getDevices((devices) => {
      ui.renderShipmentsList(shipments, devices);
    });
  });
}

// Загрузить устройства для создания отправления
function loadDevicesForShipment() {
  db.getDevices((devices) => {
    ui.populateDeviceSelect(devices);
  });
}

// Создать отправление
function createShipment() {
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
      
      // Добавить событие
      db.addEvent(deviceId, 'shipment_created', { shipmentId: shipmentId });
      
      showScreen('shipments');
      loadDashboard();
    } else {
      ui.showNotification('Failed to create shipment', 'error');
    }
  });
}

// ========== ANALYTICS ==========

// Загрузить аналитику
function loadAnalytics() {
  // Здесь можно добавить графики и статистику
  ui.showNotification('Analytics feature coming soon!', 'info');
}

// ========== SETTINGS ==========

// Загрузить настройки
function loadSettings() {
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

// Сохранить настройки (вызывается при изменении)
function saveSettings() {
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

// Добавить обработчики для настроек
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

// ========== SMARTPHONE MODE ==========

// Активировать режим смартфона (для тестирования)
function activateSmartphoneMode() {
  if (!deviceManager.checkGeolocationSupport()) {
    ui.showNotification('Geolocation not supported on this device', 'error');
    return;
  }
  
  deviceManager.activateSmartphoneMode('Test Smartphone');
  ui.showNotification('Smartphone mode activated! GPS tracking started.', 'success');
  
  setTimeout(() => {
    refreshDevices();
    loadDashboard();
  }, 1000);
}

// ========== DEMO / TESTING ==========

// Симулировать маршрут (для демонстрации)
function simulateTestRoute(deviceId) {
  if (!deviceId) {
    ui.showNotification('Please select a device first', 'error');
    return;
  }
  
  // Маршрут: Киев -> Львов (примерно)
  const startLat = 50.4501;
  const startLng = 30.5234;
  const endLat = 49.8397;
  const endLng = 24.0297;
  const durationMinutes = 10; // 10 минут симуляции
  
  deviceManager.simulateRoute(deviceId, startLat, startLng, endLat, endLng, durationMinutes);
  
  ui.showNotification(`Simulating route from Kyiv to Lviv (${durationMinutes} minutes)`, 'success');
}

// Запуск приложения
window.addEventListener('DOMContentLoaded', initApp);

// Обновить информацию о типе устройства
function updateDeviceTypeInfo() {
  const deviceType = document.getElementById('device-type').value;
  const infoEl = document.getElementById('device-type-info');
  
  if (!infoEl) return;
  
  const descriptions = {
    'tracker': '📍 Will use GPS to track cargo/shipment location. Requires GPS access.',
    'smartlock': '🔒 GPS tracking + remote lock/unlock control via QR codes.',
    'smartphone': '📱 Use your phone as a tracker. Good for testing or personal monitoring.'
  };
  
  infoEl.textContent = descriptions[deviceType] || '';
  infoEl.style.color = 'var(--text-secondary)';
  infoEl.style.fontSize = '13px';
  infoEl.style.marginTop = '8px';
}

// Экспорт функций для использования в HTML
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
window.activateSmartphoneMode = activateSmartphoneMode;
window.simulateTestRoute = simulateTestRoute;
window.currentDeviceId = null;
