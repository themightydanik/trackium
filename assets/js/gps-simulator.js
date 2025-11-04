// gps-simulator.js - GPS трекинг для реального устройства и симуляция

class GPSTracker {
  constructor() {
    this.currentPosition = null;
    this.watching = false;
    this.watchId = null;
    this.isRealDevice = false;
    this.simulationInterval = null;
  }

  // Проверить поддержку геолокации
  isGeolocationSupported() {
    return 'geolocation' in navigator;
  }

  // Начать отслеживание РЕАЛЬНОЙ геолокации (для Android смартфона)
  startRealTracking(onUpdate, onError) {
    if (!this.isGeolocationSupported()) {
      console.error("Geolocation is not supported");
      if (onError) onError(new Error("Geolocation not supported"));
      return false;
    }

    const options = {
      enableHighAccuracy: true,  // Высокая точность (использует GPS)
      timeout: 10000,            // Таймаут 10 секунд
      maximumAge: 0              // Не использовать кэшированные данные
    };

    console.log("Starting REAL GPS tracking...");
    this.isRealDevice = true;
    this.watching = true;

    // Получить начальную позицию
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.handlePositionUpdate(position, onUpdate);
      },
      (error) => {
        console.error("GPS Error:", error);
        if (onError) onError(error);
      },
      options
    );

    // Начать постоянное отслеживание
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.handlePositionUpdate(position, onUpdate);
      },
      (error) => {
        console.error("GPS Watch Error:", error);
        if (onError) onError(error);
      },
      options
    );

    return true;
  }

  // Обработать обновление позиции
  handlePositionUpdate(position, callback) {
    const gpsData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude || 0,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed || 0,
      heading: position.coords.heading || 0,
      timestamp: new Date(position.timestamp)
    };

    this.currentPosition = gpsData;
    
    console.log("GPS Update:", {
      lat: gpsData.latitude.toFixed(6),
      lng: gpsData.longitude.toFixed(6),
      accuracy: gpsData.accuracy.toFixed(2) + "m"
    });

    if (callback) callback(gpsData);
  }

  // Остановить отслеживание
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    this.watching = false;
    console.log("GPS tracking stopped");
  }

  // Получить текущую позицию (одноразово)
  getCurrentPosition(callback, onError) {
    if (!this.isGeolocationSupported()) {
      if (onError) onError(new Error("Geolocation not supported"));
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.handlePositionUpdate(position, callback);
      },
      (error) => {
        console.error("Get Position Error:", error);
        if (onError) onError(error);
      },
      options
    );
  }

  // ========== СИМУЛЯЦИЯ (для тестирования без GPS) ==========

  // Начать симуляцию движения
  startSimulation(startLat, startLng, onUpdate) {
    console.log("Starting GPS SIMULATION...");
    this.isRealDevice = false;
    this.watching = true;

    // Начальная позиция (по умолчанию - Киев)
    let latitude = startLat || 50.4501;
    let longitude = startLng || 30.5234;

    this.currentPosition = {
      latitude: latitude,
      longitude: longitude,
      altitude: 180,
      accuracy: 10,
      speed: 0,
      heading: 0,
      timestamp: new Date()
    };

    if (onUpdate) onUpdate(this.currentPosition);

    // Обновлять позицию каждые 5 секунд
    this.simulationInterval = setInterval(() => {
      // Симулировать небольшое движение (случайное)
      const deltaLat = (Math.random() - 0.5) * 0.001; // ~100m
      const deltaLng = (Math.random() - 0.5) * 0.001;
      
      latitude += deltaLat;
      longitude += deltaLng;

      this.currentPosition = {
        latitude: latitude,
        longitude: longitude,
        altitude: 180 + Math.random() * 10,
        accuracy: 5 + Math.random() * 10,
        speed: Math.random() * 20, // 0-20 km/h
        heading: Math.random() * 360,
        timestamp: new Date()
      };

      console.log("Simulated GPS:", {
        lat: latitude.toFixed(6),
        lng: longitude.toFixed(6)
      });

      if (onUpdate) onUpdate(this.currentPosition);
    }, 5000);
  }

  // Симулировать маршрут между двумя точками
  simulateRoute(startLat, startLng, endLat, endLng, durationMinutes, onUpdate) {
    console.log("Simulating route...");
    this.isRealDevice = false;
    this.watching = true;

    const steps = durationMinutes * 6; // 10-секундные интервалы
    const latStep = (endLat - startLat) / steps;
    const lngStep = (endLng - startLng) / steps;
    
    let currentStep = 0;
    let latitude = startLat;
    let longitude = startLng;

    this.currentPosition = {
      latitude: latitude,
      longitude: longitude,
      altitude: 180,
      accuracy: 10,
      speed: 60, // km/h
      heading: this.calculateBearing(startLat, startLng, endLat, endLng),
      timestamp: new Date()
    };

    if (onUpdate) onUpdate(this.currentPosition);

    this.simulationInterval = setInterval(() => {
      currentStep++;
      
      if (currentStep >= steps) {
        // Маршрут завершен
        latitude = endLat;
        longitude = endLng;
        this.stopTracking();
      } else {
        latitude += latStep;
        longitude += lngStep;
      }

      this.currentPosition = {
        latitude: latitude,
        longitude: longitude,
        altitude: 180 + Math.random() * 10,
        accuracy: 5 + Math.random() * 5,
        speed: 50 + Math.random() * 20,
        heading: this.calculateBearing(latitude, longitude, endLat, endLng),
        timestamp: new Date()
      };

      console.log(`Route progress: ${currentStep}/${steps}`);
      if (onUpdate) onUpdate(this.currentPosition);
    }, 10000);
  }

  // Рассчитать направление между двумя точками
  calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - 
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    
    const θ = Math.atan2(y, x);
    const bearing = ((θ * 180 / Math.PI) + 360) % 360;
    
    return bearing;
  }

  // Рассчитать расстояние между двумя точками (в метрах)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Радиус Земли в метрах
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // в метрах
  }

  // Форматировать координаты для отображения
  formatCoordinates(lat, lng) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    
    return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
  }

  // Получить ссылку на карту (Google Maps)
  getMapLink(lat, lng) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  // Проверить достаточную точность GPS
  hasGoodAccuracy(accuracy) {
    return accuracy <= 50; // Точность <= 50 метров считается хорошей
  }

  // Получить статус GPS
  getStatus() {
    return {
      isTracking: this.watching,
      isRealDevice: this.isRealDevice,
      hasPosition: this.currentPosition !== null,
      currentPosition: this.currentPosition
    };
  }
}

// Экспорт
window.GPSTracker = GPSTracker;
