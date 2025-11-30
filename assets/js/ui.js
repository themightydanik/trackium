// ui.js - UI Manager (добавить/заменить метод showScreen)

class UIManager {
  constructor() {
    this.currentScreen = 'loading-screen';
    this.currentDeviceId = null;
  }

  // Показать экран - ИСПРАВЛЕННАЯ ВЕРСИЯ
  showScreen(screenId) {
    console.log(`📺 Switching screen: ${this.currentScreen} → ${screenId}`);
    
    // Убрать active у всех экранов
    const allScreens = document.querySelectorAll('.screen');
    allScreens.forEach(screen => {
      screen.classList.remove('active');
    });
    
    // Добавить active новому экрану
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.classList.add('active');
      this.currentScreen = screenId;
      console.log(`✅ Screen switched to: ${screenId}`);
      
      // Скроллить вверх
      targetScreen.scrollTop = 0;
    } else {
      console.error(`❌ Screen not found: ${screenId}`);
    }
  }

  // Обновить статистику на dashboard
  updateDashboardStats(stats) {
    const elements = {
      'total-devices': stats.totalDevices || 0,
      'active-shipments': stats.activeShipments || 0,
      'locked-devices': stats.lockedDevices || 0,
      'verified-proofs': stats.verifiedProofs || 0
    };
    
    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  }

  // Отобразить список устройств
renderDevicesList(devices) {
  const container = document.getElementById('devices-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (devices.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 80px; margin-bottom: 20px;">📦</div>
        <h3 style="color: var(--text-primary); margin-bottom: 10px;">No devices yet</h3>
        <p style="color: var(--text-secondary); margin-bottom: 30px;">
          Add your first Trackium device to start tracking
        </p>
        <button class="primary-btn" onclick="showScreen('add-device')">
          ➕ Add Device
        </button>
      </div>
    `;
    return;
  }
  
devices.forEach(device => {
  // ИСПРАВЛЕНИЕ: Поддержка UPPERCASE и lowercase
  const deviceId = device.device_id || device.DEVICE_ID || device.deviceId || '';
  const deviceName = device.device_name || device.DEVICE_NAME || device.deviceName || 'Unnamed Device';
  const deviceType = device.device_type || device.DEVICE_TYPE || device.deviceType || 'tracker';
  const transportType = device.transport_type || device.TRANSPORT_TYPE || device.transportType || 'ground';
  const category = device.category || device.CATEGORY || 'Uncategorized';
  const battery = device.battery || device.BATTERY || 100;
  const signalStrength = device.signal_strength || device.SIGNAL_STRENGTH || device.signalStrength || 'Unknown';
  const locked = (device.locked || device.LOCKED || 'false') === 'true' || (device.locked || device.LOCKED) === true;
  const status = device.status || device.STATUS || 'offline';
  
  // Проверка валидности device ID
  if (!deviceId || deviceId === '' || deviceId === 'undefined') {
    console.error('❌ Invalid device ID, skipping:', device);
    return;
  }
  
  console.log('✅ Rendering device:', deviceId, deviceName);
  
  // ... остальной код карточки устройства
    
    const card = document.createElement('div');
    card.className = 'device-card';
    
    const statusClass = status === 'online' ? 'status-online' : 'status-offline';
    
    // Иконки
    const transportIcons = {
      'ground': '🚚',
      'sea': '🚢',
      'air': '✈️'
    };
    const transportIcon = transportIcons[transportType] || '📦';
    
    const deviceTypeIcon = deviceType === 'smartlock' ? '🔒' : 
                          deviceType === 'smartphone' ? '📱' : '📡';
    
    card.innerHTML = `
      <div class="device-header">
        <div class="device-icon">${transportIcon}</div>
        <div class="device-status ${statusClass}">${status}</div>
      </div>
      <div class="device-info" onclick="showDeviceDetail('${deviceId}')">
        <h4>${deviceName}</h4>
        <p style="font-size: 11px; color: var(--primary-blue); margin: 3px 0;">
          ${deviceTypeIcon} ${category}
        </p>
        <p style="font-size: 12px; color: var(--text-secondary);">ID: ${deviceId}</p>
        <p style="font-size: 13px; margin-top: 8px;">
          🔋 ${battery}% | 📡 ${signalStrength}
        </p>
        ${locked ? '<p style="color: var(--warning-orange); margin-top: 5px;">🔒 Locked</p>' : ''}
      </div>
      <div style="margin-top: 10px; display: flex; gap: 8px;">
        <button 
          class="secondary-btn" 
          style="flex: 1; padding: 8px; font-size: 12px;"
          onclick="event.stopPropagation(); showDeviceDetail('${deviceId}')">
          👁️ View
        </button>
        <button 
          class="secondary-btn" 
          style="flex: 1; padding: 8px; font-size: 12px; background: var(--danger-red);"
          onclick="event.stopPropagation(); confirmDeleteDevice('${deviceId}', '${deviceName}')">
          🗑️ Delete
        </button>
      </div>
    `;
    
    container.appendChild(card);
  });
}

  // Отобразить детали устройства
renderDeviceDetail(device, position, movements, proofs) {
 // ✅ НОРМАЛИЗАЦИЯ ДАННЫХ
  this.currentDeviceId = device.device_id || device.DEVICE_ID || device.deviceId;

  const updateEl = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || 'Unknown';
  };

  const deviceName = device.device_name || device.DEVICE_NAME || device.deviceName || 'Unknown';
  const deviceId = device.device_id || device.DEVICE_ID || device.deviceId || 'Unknown';
  const deviceType = device.device_type || device.DEVICE_TYPE || device.deviceType || 'unknown';
  const status = device.status || device.STATUS || 'offline';
  const battery = device.battery || device.BATTERY || 0;
  const gpsSignal = device.signal_strength || device.SIGNAL_STRENGTH || device.signalStrength;
  const lastSync = device.last_sync || device.LAST_SYNC || device.lastSync;
  const locked = device.locked || device.LOCKED;

  updateEl('device-detail-name', deviceName);
  updateEl('detail-device-id', deviceId);
  updateEl('detail-device-type', deviceType.toUpperCase());
  updateEl('detail-device-status', status.toUpperCase());
  updateEl('detail-device-battery', `${battery}%`);
  updateEl('detail-device-gps', gpsSignal ? '✅ Strong' : '⚠️ Weak');
  
  try {
    const syncDate = new Date(lastSync || Date.now());
    updateEl('detail-device-sync', isNaN(syncDate.getTime()) ? 'Never' : syncDate.toLocaleString());
  } catch (e) {
    updateEl('detail-device-sync', 'Unknown');
  }

  // Smart Lock контроли (остальное без изменений)
  if (deviceType === 'smartlock' || deviceType === 'smartphone') {
    const lockControls = document.getElementById('lock-controls');
    if (lockControls) lockControls.style.display = 'block';
    
    const lockIcon = document.getElementById('lock-icon');
    const lockText = document.getElementById('lock-status-text');
    
    if (lockIcon && lockText) {
      if (locked) {
        lockIcon.textContent = '🔒';
        lockText.textContent = 'Locked';
      } else {
        lockIcon.textContent = '🔓';
        lockText.textContent = 'Unlocked';
      }
    }
  } else {
    const lockControls = document.getElementById('lock-controls');
    if (lockControls) lockControls.style.display = 'none';
  }

  // История движений
  this.renderMovementHistory(movements);

  // Blockchain proofs
  this.renderBlockchainProofs(proofs);
}

  // Отобразить историю движений
  renderMovementHistory(movements) {
    const container = document.getElementById('movement-history');
    if (!container) return;

    container.innerHTML = '';

    if (movements.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary);">No movement data yet</p>';
      return;
    }

    movements.slice(0, 10).forEach(movement => {
      const item = document.createElement('div');
      item.className = 'history-item';
      
      item.innerHTML = `
        <p><strong>📍 ${movement.latitude.toFixed(6)}, ${movement.longitude.toFixed(6)}</strong></p>
        <p class="history-time">${new Date(movement.timestamp).toLocaleString()}</p>
        <p><small>Accuracy: ${movement.accuracy?.toFixed(1)}m | Speed: ${movement.speed?.toFixed(1)} km/h</small></p>
        ${movement.proof_submitted ? '<p style="color: var(--success-green);">✅ Proof Submitted</p>' : ''}
      `;

      container.appendChild(item);
    });
  }

  // Отобразить blockchain proofs
  renderBlockchainProofs(proofs) {
    const container = document.getElementById('blockchain-proofs');
    if (!container) return;

    container.innerHTML = '';

    if (proofs.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary);">No blockchain proofs yet</p>';
      return;
    }

    proofs.forEach(proof => {
      const item = document.createElement('div');
      item.className = 'proof-item';
      
      const verifiedBadge = proof.verified ? 
        '<span style="color: var(--success-green);">✅ Verified</span>' : 
        '<span style="color: var(--neutral-gray);">⏳ Pending</span>';

      item.innerHTML = `
        <p><strong>Proof Type:</strong> ${proof.proof_type.toUpperCase()}</p>
        <p><strong>Hash:</strong> <code style="font-size: 11px;">${proof.proof_hash}</code></p>
        ${proof.transaction_id ? `<p><strong>TX ID:</strong> <code style="font-size: 11px;">${proof.transaction_id}</code></p>` : ''}
        <p class="proof-time">${new Date(proof.timestamp).toLocaleString()}</p>
        <p>${verifiedBadge}</p>
      `;

      container.appendChild(item);
    });
  }

  // Отобразить список shipments
  renderShipmentsList(shipments, devices) {
    const container = document.getElementById('shipments-list');
    if (!container) return;

    container.innerHTML = '';

    if (shipments.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <div style="font-size: 80px; margin-bottom: 20px;">📦</div>
          <h3 style="color: var(--text-primary); margin-bottom: 10px;">No shipments yet</h3>
          <p style="color: var(--text-secondary); margin-bottom: 30px;">
            Create your first shipment to track cargo
          </p>
          <button class="primary-btn" onclick="showScreen('create-shipment')">
            ➕ Create Shipment
          </button>
        </div>
      `;
      return;
    }

    shipments.forEach(shipment => {
      const device = devices.find(d => d.device_id === shipment.device_id);
      const card = document.createElement('div');
      card.className = 'shipment-card';

      const statusColor = shipment.status === 'in_transit' ? 'var(--primary-blue)' :
                         shipment.status === 'delivered' ? 'var(--success-green)' :
                         'var(--neutral-gray)';

      card.innerHTML = `
        <h4>🚚 ${shipment.shipment_id}</h4>
        <p><strong>Device:</strong> ${device?.device_name || shipment.device_id}</p>
        <p><strong>Cargo:</strong> ${shipment.cargo_description}</p>
        <p><strong>From:</strong> ${shipment.origin}</p>
        <p><strong>To:</strong> ${shipment.destination}</p>
        <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${shipment.status.toUpperCase()}</span></p>
        <p><small>Expected: ${new Date(shipment.expected_delivery).toLocaleString()}</small></p>
      `;

      container.appendChild(card);
    });
  }

  // Отобразить недавнюю активность
renderRecentActivity(events) {
  const container = document.getElementById('recent-activity');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (events.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary);">No recent activity</p>';
    return;
  }
  
  events.forEach(event => {
    const item = document.createElement('div');
    item.className = 'activity-item';
    
    const eventIcon = this.getEventIcon(event.event_type);
    
    // ИСПРАВЛЕНИЕ: Данные уже нормализованы в getRecentActivityWithDetails
    const deviceName = event.device_name || 'Unknown Device';
    const deviceId = event.device_id || 'Unknown';
    const category = event.category || 'Uncategorized';
    const eventType = event.event_type || 'unknown_event';
    
    // Безопасная обработка даты
    let timeString = 'Unknown time';
    try {
      if (event.timestamp) {
        const date = new Date(event.timestamp);
        if (!isNaN(date.getTime())) {
          timeString = date.toLocaleString();
        }
      }
    } catch (e) {
      console.error('Invalid timestamp:', event.timestamp);
    }
    
    item.innerHTML = `
      <p>${eventIcon} <strong>${this.getEventTitle(eventType)}</strong></p>
      <p style="font-size: 12px; color: var(--text-secondary);">
        Device: ${deviceName} (${category})
      </p>
      <p class="activity-time">${timeString}</p>
    `;
    
    container.appendChild(item);
  });
}

  // Получить иконку для типа события
  getEventIcon(eventType) {
    const icons = {
      'device_registered': '✅',
      'device_activated': '🟢',
      'device_deactivated': '🔴',
      'device_locked': '🔒',
      'device_unlocked': '🔓',
      'movement_detected': '📍',
      'proof_submitted': '⛓️',
      'route_simulation_started': '🚗'
    };
    return icons[eventType] || '📋';
  }

  // Получить название события
  getEventTitle(eventType) {
    const titles = {
      'device_registered': 'Device Registered',
      'device_activated': 'Device Activated',
      'device_deactivated': 'Device Deactivated',
      'device_locked': 'Device Locked',
      'device_unlocked': 'Device Unlocked',
      'movement_detected': 'Movement Detected',
      'proof_submitted': 'Proof Submitted',
      'route_simulation_started': 'Route Simulation Started'
    };
    return titles[eventType] || eventType;
  }

  // Заполнить выпадающий список устройств
  populateDeviceSelect(devices) {
    const select = document.getElementById('shipment-device');
    if (!select) return;

    select.innerHTML = '<option value="">Select a device...</option>';

    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.device_id;
      option.textContent = `${device.device_name} (${device.device_id})`;
      select.appendChild(option);
    });
  }

  // Показать уведомление
  showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    if (typeof MDS !== 'undefined') {
      MDS.notify(message);
    }
  }

  // Показать/скрыть модальное окно QR
  showQRModal() {
    const modal = document.getElementById('qr-modal');
    if (modal) {
      modal.classList.add('active');
    }
  }

  closeQRModal() {
    const modal = document.getElementById('qr-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // Обновить настройки в UI
  updateSettings(settings) {
    if (settings.autoProof !== undefined) {
      document.getElementById('auto-proof').checked = settings.autoProof;
    }
    if (settings.proofFrequency !== undefined) {
      document.getElementById('proof-frequency').value = settings.proofFrequency;
    }
    if (settings.alertMovement !== undefined) {
      document.getElementById('alert-movement').checked = settings.alertMovement;
    }
    if (settings.alertLock !== undefined) {
      document.getElementById('alert-lock').checked = settings.alertLock;
    }
  }

  // Обновить информацию о ноде
  updateNodeInfo(address, balance) {
    const addressEl = document.getElementById('node-address');
    const balanceEl = document.getElementById('node-balance');
    
    if (addressEl) addressEl.textContent = address || '-';
    if (balanceEl) balanceEl.textContent = balance !== null ? `${balance} Minima` : '-';
  }
}

// Экспорт
window.UIManager = UIManager;
