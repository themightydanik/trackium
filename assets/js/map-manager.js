// map-manager.js - Interactive Map with Leaflet

class MapManager {
  constructor() {
    this.map = null;
    this.markers = [];
    this.routeLine = null;
    this.deviceMarker = null;
  }

  /**
   * Инициализировать карту
   * @param {string} containerId - ID контейнера для карты
   * @param {number} lat - Начальная широта
   * @param {number} lng - Начальная долгота
   */
  initMap(containerId, lat = 50.4501, lng = 30.5234) {
    console.log('🗺️ Initializing map...', containerId);

    // Удалить старую карту если есть
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Map container not found:', containerId);
      return;
    }

    // Очистить контейнер
    container.innerHTML = '';

    try {
      // Создать карту
      this.map = L.map(containerId, {
        zoomControl: true,
        attributionControl: true
      }).setView([lat, lng], 13);

      // Добавить тайлы OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      console.log('✅ Map initialized');
      
      // Исправить размер карты (иногда глючит)
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 100);

    } catch (error) {
      console.error('❌ Map initialization failed:', error);
      
      // Fallback к placeholder
      container.innerHTML = `
        <div class="map-placeholder" style="display: flex;">
          <span class="location-icon">📍</span>
          <p>Map failed to load</p>
        </div>
      `;
    }
  }

  /**
   * Добавить маркер на карту
   * @param {number} lat 
   * @param {number} lng 
   * @param {string} title 
   * @param {string} description 
   */
  addMarker(lat, lng, title = '', description = '') {
    if (!this.map) return;

    const marker = L.marker([lat, lng])
      .addTo(this.map)
      .bindPopup(`
        <strong>${title}</strong><br>
        ${description}<br>
        <small>${lat.toFixed(6)}, ${lng.toFixed(6)}</small>
      `);

    this.markers.push(marker);
    return marker;
  }

  /**
   * Обновить текущую позицию устройства
   * @param {number} lat 
   * @param {number} lng 
   * @param {Object} data - Дополнительные данные
   */
  updateDevicePosition(lat, lng, data = {}) {
    if (!this.map) {
      console.warn('Map not initialized');
      return;
    }

    console.log('📍 Updating device position:', lat, lng);

    // Создать или обновить маркер устройства
    if (this.deviceMarker) {
      // Анимированное перемещение
      this.deviceMarker.setLatLng([lat, lng]);
    } else {
      // Создать новый маркер с кастомной иконкой
      const deviceIcon = L.divIcon({
        className: 'device-marker',
        html: `
          <div style="
            background: var(--primary-blue);
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
          ">
            📍
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      this.deviceMarker = L.marker([lat, lng], { icon: deviceIcon })
        .addTo(this.map);
    }

    // Обновить popup
    const accuracy = data.accuracy ? `±${data.accuracy.toFixed(1)}m` : '';
    const speed = data.speed ? `${(data.speed * 3.6).toFixed(1)} km/h` : '';
    const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '';

    this.deviceMarker.bindPopup(`
      <div style="font-family: sans-serif;">
        <strong style="color: var(--primary-blue); font-size: 14px;">📍 Current Position</strong><br>
        <div style="margin: 8px 0; font-size: 12px;">
          ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
          ${accuracy ? `Accuracy: ${accuracy}<br>` : ''}
          ${speed ? `Speed: ${speed}<br>` : ''}
          ${timestamp ? `<small style="color: #888;">Updated: ${timestamp}</small>` : ''}
        </div>
      </div>
    `);

    // Центрировать карту на новой позиции
    this.map.setView([lat, lng], this.map.getZoom(), {
      animate: true,
      duration: 0.5
    });
  }

  /**
   * Отобразить маршрут устройства
   * @param {Array} movements - Массив точек [{lat, lng}, ...]
   */
  showRoute(movements) {
    if (!this.map || !movements || movements.length === 0) return;

    console.log('🛣️ Drawing route with', movements.length, 'points');

    // Удалить старый маршрут
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
    }

    // Подготовить координаты
    const coordinates = movements.map(m => [
      m.latitude || m.LATITUDE,
      m.longitude || m.LONGITUDE
    ]);

    // Нарисовать линию маршрута
    this.routeLine = L.polyline(coordinates, {
      color: '#0066CC',
      weight: 3,
      opacity: 0.7,
      smoothFactor: 1
    }).addTo(this.map);

    // Добавить маркеры старта и финиша
    if (movements.length >= 2) {
      const start = movements[0];
      const end = movements[movements.length - 1];

      // Старт (зеленый)
      L.circleMarker([start.latitude || start.LATITUDE, start.longitude || start.LONGITUDE], {
        radius: 8,
        fillColor: '#00A86B',
        color: 'white',
        weight: 2,
        fillOpacity: 1
      })
      .addTo(this.map)
      .bindPopup(`
        <strong style="color: #00A86B;">🚀 Start</strong><br>
        <small>${new Date(start.recorded_at || start.RECORDED_AT).toLocaleString()}</small>
      `);

      // Финиш (красный)
      L.circleMarker([end.latitude || end.LATITUDE, end.longitude || end.LONGITUDE], {
        radius: 8,
        fillColor: '#DC143C',
        color: 'white',
        weight: 2,
        fillOpacity: 1
      })
      .addTo(this.map)
      .bindPopup(`
        <strong style="color: #DC143C;">🏁 Latest</strong><br>
        <small>${new Date(end.recorded_at || end.RECORDED_AT).toLocaleString()}</small>
      `);
    }

    // Центрировать карту на маршрут
    this.map.fitBounds(this.routeLine.getBounds(), {
      padding: [50, 50]
    });
  }

  /**
   * Очистить все маркеры и линии
   */
  clearMap() {
    if (!this.map) return;

    // Удалить маркеры
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];

    // Удалить маршрут
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }

    // Удалить маркер устройства
    if (this.deviceMarker) {
      this.map.removeLayer(this.deviceMarker);
      this.deviceMarker = null;
    }
  }

  /**
   * Уничтожить карту
   */
  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.markers = [];
    this.routeLine = null;
    this.deviceMarker = null;
  }
}

// Export
window.MapManager = MapManager;
console.log('✅ map-manager.js loaded');
