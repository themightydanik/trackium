// location-tracker.js - NB-IoT + WiFi/Cell Location Tracking

class LocationTracker {
  constructor() {
    this.currentPosition = null;
    this.tracking = false;
    this.watchId = null;
    this.trackingMode = 'wifi'; // 'nbiot' | 'wifi' | 'cell'
    this.lastUpdateTime = null;
  }

  /**
   * Начать отслеживание локации
   * @param {string} deviceType - 'tracker' (NB-IoT) | 'smartphone' (WiFi/Cell)
   * @param {function} onUpdate - Колбэк при обновлении позиции
   * @param {function} onError - Колбэк при ошибке
   */
  startTracking(deviceType, onUpdate, onError) {
    console.log('📡 Starting location tracking, device type:', deviceType);
    
    if (!this.isLocationSupported()) {
      console.error('❌ Location API not supported');
      if (onError) onError(new Error('Location not supported'));
      return false;
    }

    this.tracking = true;

    // Определить режим по типу устройства
    if (deviceType === 'smartphone') {
      this.trackingMode = 'wifi';
      return this.startWiFiCellTracking(onUpdate, onError);
    } else {
      // Для tracker, smartlock - пытаемся эмулировать NB-IoT
      this.trackingMode = 'nbiot';
      return this.startNBIoTTracking(onUpdate, onError);
    }
  }

  /**
   * WiFi/Cell триангуляция (для смартфонов)
   * Низкое энергопотребление, точность 100-1000м
   */
  startWiFiCellTracking(onUpdate, onError) {
    console.log('📶 Starting WiFi/Cell tracking...');

    const options = {
      enableHighAccuracy: false,  // НЕ использовать GPS
      timeout: 10000,
      maximumAge: 30000  // Кэш до 30 секунд
    };

    // Получить начальную позицию
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('📍 WiFi/Cell position acquired');
        this.handlePositionUpdate(position, 'wifi', onUpdate);
      },
      (error) => {
        console.error('❌ WiFi/Cell error:', this.getErrorMessage(error));
        if (onError) onError(error);
      },
      options
    );

    // Начать постоянное отслеживание
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.handlePositionUpdate(position, 'wifi', onUpdate);
      },
      (error) => {
        console.error('❌ WiFi/Cell watch error:', error);
        // Не прерываем трекинг при ошибках
      },
      options
    );

    return true;
  }

  /**
   * NB-IoT эмуляция (для реальных Trackium устройств)
   * В реальной версии это будет общение с NB-IoT модемом
   */
  startNBIoTTracking(onUpdate, onError) {
    console.log('📡 Starting NB-IoT tracking (emulated)...');

    // В production: здесь будет команда к NB-IoT модулю
    // Например: AT команды через Serial/USB
    
    // Пока используем WiFi/Cell с особыми настройками
    const options = {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000  // NB-IoT обновляется реже для экономии
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('📍 NB-IoT position acquired');
        this.handlePositionUpdate(position, 'nbiot', onUpdate);
      },
      (error) => {
        console.error('❌ NB-IoT error, fallback to WiFi/Cell');
        // Fallback к WiFi/Cell
        this.trackingMode = 'wifi';
        return this.startWiFiCellTracking(onUpdate, onError);
      },
      options
    );

    // NB-IoT обновляется реже (экономия батареи)
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.handlePositionUpdate(position, 'nbiot', onUpdate);
      },
      (error) => {
        console.error('❌ NB-IoT watch error:', error);
      },
      options
    );

    return true;
  }

  /**
   * Обработать обновление позиции
   */
  handlePositionUpdate(position, source, callback) {
    const now = Date.now();
    
    // Защита от слишком частых обновлений
    const minInterval = source === 'nbiot' ? 30000 : 10000; // NB-IoT реже
    if (this.lastUpdateTime && (now - this.lastUpdateTime) < minInterval) {
      return;
    }
    
    this.lastUpdateTime = now;

    const locationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude || 0,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed || 0,
      heading: position.coords.heading || 0,
      timestamp: new Date(position.timestamp),
      source: source  // 'nbiot' | 'wifi' | 'cell'
    };

    this.currentPosition = locationData;
    
    console.log(`📍 Location Update (${source}):`, {
      lat: locationData.latitude.toFixed(6),
      lng: locationData.longitude.toFixed(6),
      accuracy: locationData.accuracy.toFixed(0) + 'm'
    });

    if (callback) callback(locationData);
  }

  /**
   * Остановить отслеживание
   */
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      console.log('⏹️ Location tracking stopped');
    }
    this.tracking = false;
  }

  /**
   * Получить текущую позицию (одноразово)
   */
  getCurrentPosition(callback, onError) {
    if (!this.isLocationSupported()) {
      if (onError) onError(new Error('Location not supported'));
      return;
    }

    const options = {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.handlePositionUpdate(position, this.trackingMode, callback);
      },
      (error) => {
        console.error('Get Position Error:', error);
        if (onError) onError(error);
      },
      options
    );
  }

  /**
   * Проверить поддержку геолокации
   */
  isLocationSupported() {
    return 'geolocation' in navigator;
  }

  /**
   * Получить понятное сообщение об ошибке
   */
  getErrorMessage(error) {
    switch(error.code) {
      case error.PERMISSION_DENIED:
        return "User denied location permission";
      case error.POSITION_UNAVAILABLE:
        return "Location unavailable";
      case error.TIMEOUT:
        return "Location request timed out";
      default:
        return "Unknown location error";
    }
  }

  /**
   * Форматировать координаты
   */
  formatCoordinates(lat, lng) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
  }

  /**
   * Рассчитать расстояние между точками (Haversine)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // м
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

  /**
   * Получить ссылку на карту
   */
  getMapLink(lat, lng) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  /**
   * Получить статус
   */
  getStatus() {
    return {
      tracking: this.tracking,
      mode: this.trackingMode,
      hasPosition: this.currentPosition !== null,
      currentPosition: this.currentPosition,
      accuracy: this.currentPosition?.accuracy || null,
      lastUpdate: this.lastUpdateTime ? new Date(this.lastUpdateTime) : null
    };
  }
}

window.LocationTracker = LocationTracker;
console.log('✅ location-tracker.js loaded');
