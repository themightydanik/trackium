// ui-location.js - Отображение локации для Trackium (ПОЛНАЯ ВЕРСИЯ)

/**
 * Получить название города/места по координатам через OpenStreetMap Nominatim API
 * @param {number} lat - Широта
 * @param {number} lng - Долгота
 * @returns {Promise<string>} Название места
 */
async function getLocationNameFromCoords(lat, lng) {
  try {
    console.log('🌍 Getting location name for:', lat, lng);
    
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Trackium/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.address) {
      const parts = [];
      
      // Город/населенный пункт
      if (data.address.city) parts.push(data.address.city);
      else if (data.address.town) parts.push(data.address.town);
      else if (data.address.village) parts.push(data.address.village);
      else if (data.address.municipality) parts.push(data.address.municipality);
      
      // Регион/область
      if (data.address.state) parts.push(data.address.state);
      
      // Страна
      if (data.address.country) parts.push(data.address.country);
      
      const locationName = parts.length > 0 ? parts.join(', ') : data.display_name;
      console.log('📍 Location name:', locationName);
      return locationName;
    }
    
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.error('❌ Failed to get location name:', error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

/**
 * Отобразить координаты с названием места и интерактивными элементами
 * @param {Object} position - Объект позиции с координатами
 * @param {string} elementId - ID элемента для вставки
 */
async function renderPositionWithLocation(position, elementId) {
  const coordsEl = document.getElementById(elementId);
  if (!coordsEl) {
    console.warn('⚠️ Element not found:', elementId);
    return;
  }
  
  // Если нет позиции - показать ожидание
  if (!position) {
    coordsEl.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <span style="font-size: 48px;">📍</span>
        <p style="margin: 10px 0; color: var(--text-primary);">Waiting for GPS signal...</p>
        <p style="font-size: 12px; color: var(--text-secondary);">
          Make sure GPS is enabled on your device
        </p>
        <div style="margin-top: 15px;">
          <div class="loading-spinner" style="width: 30px; height: 30px; margin: 0 auto;"></div>
        </div>
      </div>
    `;
    return;
  }
  
  // Показать загрузку названия места
  coordsEl.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <span style="font-size: 48px;">📍</span>
      <p style="font-size: 16px; font-weight: bold; margin: 10px 0;">
        ${position.latitude.toFixed(6)}°, ${position.longitude.toFixed(6)}°
      </p>
      <p style="color: var(--text-secondary); font-size: 14px;">
        <span class="loading-spinner" style="display: inline-block; width: 12px; height: 12px; margin-right: 5px;"></span>
        Loading location name...
      </p>
    </div>
  `;
  
  // Получить название места (асинхронно)
  const locationName = await getLocationNameFromCoords(position.latitude, position.longitude);
  
  // Рассчитать скорость в km/h
  const speedKmh = (position.speed || 0) * 3.6;
  
  // Определить качество сигнала
  let accuracyStatus = '✅ Excellent';
  let accuracyColor = 'var(--success-green)';
  
  if (position.accuracy > 50) {
    accuracyStatus = '⚠️ Fair';
    accuracyColor = 'var(--warning-orange)';
  }
  if (position.accuracy > 100) {
    accuracyStatus = '❌ Poor';
    accuracyColor = 'var(--danger-red)';
  }
  
  // Обновить с полной информацией
  coordsEl.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <span style="font-size: 64px; margin-bottom: 15px; display: block;">📍</span>
      
      <div style="margin-bottom: 15px;">
        <p style="font-size: 20px; font-weight: bold; margin: 5px 0; color: var(--primary-blue);">
          ${locationName}
        </p>
        <p style="font-size: 14px; color: var(--text-secondary); margin: 5px 0; font-family: monospace;">
          ${position.latitude.toFixed(6)}°, ${position.longitude.toFixed(6)}°
        </p>
      </div>
      
      <div style="
        display: grid; 
        grid-template-columns: 1fr 1fr; 
        gap: 10px; 
        margin: 15px 0;
        padding: 10px;
        background: var(--bg-light);
        border-radius: 8px;
      ">
        <div style="text-align: center;">
          <p style="font-size: 11px; color: var(--text-secondary); margin: 0;">ACCURACY</p>
          <p style="font-size: 16px; font-weight: bold; margin: 5px 0; color: ${accuracyColor};">
            ${position.accuracy?.toFixed(1) || 'N/A'}m
          </p>
          <p style="font-size: 10px; color: var(--text-secondary); margin: 0;">${accuracyStatus}</p>
        </div>
        <div style="text-align: center;">
          <p style="font-size: 11px; color: var(--text-secondary); margin: 0;">SPEED</p>
          <p style="font-size: 16px; font-weight: bold; margin: 5px 0; color: var(--primary-blue);">
            ${speedKmh.toFixed(1)} km/h
          </p>
          <p style="font-size: 10px; color: var(--text-secondary); margin: 0;">
            ${(position.speed || 0).toFixed(1)} m/s
          </p>
        </div>
      </div>
      
      ${position.altitude ? `
        <p style="font-size: 12px; color: var(--text-secondary); margin: 10px 0;">
          🏔️ Altitude: ${position.altitude.toFixed(1)}m
        </p>
      ` : ''}
      
      <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
        <a href="https://www.google.com/maps?q=${position.latitude},${position.longitude}" 
           target="_blank" 
           class="primary-btn"
           style="
             display: inline-flex;
             align-items: center;
             gap: 5px;
             padding: 10px 20px;
             background: var(--primary-blue);
             color: white;
             text-decoration: none;
             border-radius: 8px;
             font-size: 14px;
             font-weight: 600;
             transition: all 0.3s;
           "
           onmouseover="this.style.background='var(--primary-dark)'"
           onmouseout="this.style.background='var(--primary-blue)'">
          🗺️ Open in Maps
        </a>
        
        <button onclick="refreshCurrentLocation('${window.currentDeviceId || ''}')" 
                class="secondary-btn"
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 5px;
                  padding: 10px 20px;
                  background: var(--success-green);
                  color: white;
                  border: none;
                  border-radius: 8px;
                  font-size: 14px;
                  font-weight: 600;
                  cursor: pointer;
                  transition: all 0.3s;
                "
                onmouseover="this.style.background='#008f5d'"
                onmouseout="this.style.background='var(--success-green)'">
          🔄 Refresh
        </button>
      </div>
      
      <p style="font-size: 11px; color: var(--text-secondary); margin-top: 15px;">
        Last updated: ${new Date(position.timestamp).toLocaleTimeString()}
      </p>
    </div>
  `;
}

/**
 * Обновить текущую локацию устройства
 * @param {string} deviceId - ID устройства
 */
window.refreshCurrentLocation = function(deviceId) {
  if (!deviceId || !window.deviceManager) {
    console.warn('⚠️ Cannot refresh: deviceId or deviceManager not available');
    return;
  }
  
  console.log('🔄 Refreshing location for:', deviceId);
  
  // Показать индикатор загрузки
  const coordsEl = document.getElementById('device-coordinates');
  if (coordsEl) {
    const currentContent = coordsEl.innerHTML;
    coordsEl.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 10px;"></div>
        <p style="color: var(--text-secondary);">Updating location...</p>
      </div>
    `;
    
    // Восстановить если не получилось через 5 секунд
    setTimeout(() => {
      if (coordsEl.innerHTML.includes('Updating location')) {
        coordsEl.innerHTML = currentContent;
      }
    }, 5000);
  }
  
  // Получить новую позицию
  window.deviceManager.getCurrentPosition(deviceId, async (position) => {
    if (position) {
      console.log('📍 New position:', position);
      await renderPositionWithLocation(position, 'device-coordinates');
      
      // Показать уведомление
      if (window.ui && window.ui.showNotification) {
        window.ui.showNotification('Location updated!', 'success');
      }
    } else {
      console.log('❌ No position available');
      if (coordsEl) {
        coordsEl.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <span style="font-size: 48px;">❌</span>
            <p style="margin: 10px 0; color: var(--danger-red);">
              Failed to get location
            </p>
            <p style="font-size: 12px; color: var(--text-secondary);">
              Please check GPS signal and try again
            </p>
          </div>
        `;
      }
    }
  });
};

/**
 * Форматировать расстояние для отображения
 * @param {number} meters - Расстояние в метрах
 * @returns {string} Форматированное расстояние
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return `${meters.toFixed(0)}m`;
  } else {
    return `${(meters / 1000).toFixed(2)}km`;
  }
}

/**
 * Рассчитать расстояние между двумя точками (Haversine formula)
 * @param {number} lat1 - Широта точки 1
 * @param {number} lon1 - Долгота точки 1
 * @param {number} lat2 - Широта точки 2
 * @param {number} lon2 - Долгота точки 2
 * @returns {number} Расстояние в метрах
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Радиус Земли в метрах
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

// Экспорт функций в глобальное пространство
window.getLocationNameFromCoords = getLocationNameFromCoords;
window.renderPositionWithLocation = renderPositionWithLocation;
window.formatDistance = formatDistance;
window.calculateDistance = calculateDistance;

console.log('✅ ui-location.js loaded');
