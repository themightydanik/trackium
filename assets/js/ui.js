// ui.js - UI Management для Trackium

class UIManager {
  constructor() {
    this.currentScreen = 'loading-screen';
    this.currentDeviceId = null;
  }

  // Показать экран
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = screenId;
    }
  }

  // Обновить статистику на dashboard
  updateDashboardStats(stats) {
    document.getElementById('total-devices').textContent = stats.totalDevices || 0;
    document.getElementById('active-shipments').textContent = stats.activeShipments || 0;
    document.getElementById('locked-devices').textContent = stats.lockedDevices || 0;
    document.getElementById('verified-proofs').textContent = stats.verifiedProofs || 0;
  }

  // Отобразить список устройств
  renderDevicesList(devices) {
    const container = document.getElementById('devices-list');
    if (!container) return;

    container.innerHTML = '';

    if (devices.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-secondary);">No devices yet. Add your first Trackium device!</p>';
      return;
    }

    devices.forEach(device => {
      const card = document.createElement('div');
      card.className = 'device-card';
      card.onclick = () => showDeviceDetail(device.device_id);

      const statusClass = device.status === 'online' ? 'status-online' : 'status-offline';
      const deviceIcon = device.device_type === 'smartlock' ? '🔒' : 
                        device.device_type === 'smartphone' ? '📱' : '📦';

      card.innerHTML = `
        <div class="device-header">
          <div class="device-icon">${deviceIcon}</div>
          <div class="device-status ${statusClass}">${device.status}</div>
        </div>
        <div class="device-info">
          <h4>${device.device_name}</h4>
          <p>ID: ${device.device_id}</p>
          <p>Battery: ${device.battery}% | GPS: ${device.gps_signal ? '✅' : '❌'}</p>
          ${device.locked ? '<p style="color: var(--warning-orange);">🔒 Locked</p>' : ''}
        </div>
      `;

      container.appendChild(card);
    });
  }

  // Отобразить детали устройства
  renderDeviceDetail(device, position, movements, proofs) {
    this.currentDeviceId = device.device_id;

    document.getElementById('device-detail-name').textContent = device.device_name;
    document.getElementById('detail-device-id').textContent = device.device_id;
    document.getElementById('detail-device-type').textContent = device.device_type.toUpperCase();
    document.getElementById('detail-device-status').textContent = device.status.toUpperCase();
    document.getElementById('detail-device-battery').textContent = device.battery + '%';
    document.getElementById('detail-device-gps').textContent = device.gps_signal ? '✅ Strong' : '❌ Weak';
    document.getElementById('detail-device-sync').textContent = new Date(device.last_sync).toLocaleString();

    // Показать координаты
    if (position) {
      const coordsEl = document.getElementById('device-coordinates');
      coordsEl.innerHTML = `
        📍 ${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}<br>
        <small>Accuracy: ${position.accuracy?.toFixed(1) || 'N/A'}m | Speed: ${position.speed?.toFixed(1) || 0} km/h</small><br>
        <a href="https://www.google.com/maps?q=${position.latitude},${position.longitude}" target="_blank" style="color: var(--primary-blue); text-decoration: none;">
          🗺️ Open in Google Maps
        </a>
      `;
    }

    // Smart Lock контроли
    if (device.device_type === 'smartlock' || device.device_type === 'smartphone') {
      document.getElementById('lock-controls').style.display = 'block';
      const lockIcon = document.getElementById('lock-icon');
      const lockText = document.getElementById('lock-status-text');
      
      if (device.locked) {
        lockIcon.textContent = '🔒';
        lockText.textContent = 'Locked';
      } else {
        lockIcon.textContent = '🔓';
        lockText.textContent = 'Unlocked';
      }
    } else {
      document.getElementById('lock-controls').style.display = 'none';
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
      container.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-secondary);">No shipments yet. Create your first shipment!</p>';
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
      
      item.innerHTML = `
        <p>${eventIcon} <strong>${this.getEventTitle(event.event_type)}</strong></p>
        <p>Device: ${event.device_id}</p>
        <p class="activity-time">${new Date(event.timestamp).toLocaleString()}</p>
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
    // Можно использовать MDS.notify
    if (typeof MDS !== 'undefined') {
      MDS.notify(message);
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
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
    document.getElementById('node-address').textContent = address || '-';
    document.getElementById('node-balance').textContent = balance !== null ? 
      `${balance} Minima` : '-';
  }
}

// Экспорт
window.UIManager = UIManager;
