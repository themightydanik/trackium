// gps-simulator.js - GPS трекинг (ИСПРАВЛЕННЫЙ - только реальный GPS)

class GPSTracker {
  constructor() {
    this.currentPosition = null;
    this.watching = false;
    this.watchId = null;
    this.isRealDevice = false;
    this.simulationInterval = null;
    this.lastUpdateTime = null;
  }

  // Проверить поддержку геолокации
  isGeolocationSupported() {
    return 'geolocation' in navigator;
  }

  // Начать отслеживание РЕАЛЬНОЙ геолокации
  startRealTracking(onUpdate, onError) {
    if (!this.isGeolocationSupported()) {
      console.error("❌ Geolocation is not supported");
      if (onError) onError(new Error("Geolocation not supported"));
      return false;
    }

    const options = {
      enableHighAccuracy: true,  // Использовать GPS (не WiFi)
      timeout: 30000,            // Ждать до 30 секунд
      maximumAge: 0              // Не использовать кэш
    };

    console.log("🛰️ Starting REAL GPS tracking with high accuracy...");
    this.isRealDevice = true;
    this.watching = true;

    // Получить начальную позицию
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("📍 Initial GPS position acquired");
        this.handlePositionUpdate(position, onUpdate);
      },
      (error) => {
        console.error("❌ Initial GPS Error:", this.getErrorMessage(error));
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
        console.error("❌ GPS Watch Error:", this.getErrorMessage(error));
        if (onError) onError(error);
      },
      options
    );

    return true;
  }

  // Получить понятное сообщение об ошибке
  getErrorMessage(error) {
    switch(error.code) {
      case error.PERMISSION_DENIED:
        return "User denied GPS permission";
      case error.POSITION_UNAVAILABLE:
        return "GPS position unavailable";
      case error.TIMEOUT:
        return "GPS request timed out";
      default:
        return "Unknown GPS error";
    }
  }

  // Обработать обновление позиции
  handlePositionUpdate(position, callback) {
    const now = Date.now();
    
    // Защита от слишком частых обновлений (минимум 3 секунды)
    if (this.lastUpdateTime && (now - this.lastUpdateTime) < 3000) {
      return;
    }
    
    this.lastUpdateTime = now;

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
    
    console.log("📍 GPS Update:", {
      lat: gpsData.latitude.toFixed(6),
      lng: gpsData.longitude.toFixed(6),
      accuracy: gpsData.accuracy.toFixed(1) + "m",
      speed: gpsData.speed.toFixed(1) + " m/s"
    });

    if (callback) callback(gpsData);
  }

  // Остановить отслеживание
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      console.log("⏹️ GPS tracking stopped");
    }

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    this.watching = false;
  }

  // Получить текущую позицию (одноразово)
  getCurrentPosition(callback, onError) {
    if (!this.isGeolocationSupported()) {
      if (onError) onError(new Error("Geolocation not supported"));
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.handlePositionUpdate(position, callback);
      },
      (error) => {
        console.error("❌ Get Position Error:", this.getErrorMessage(error));
        if (onError) onError(error);
      },
      options
    );
  }

  // ========== СИМУЛЯЦИЯ (только для тестирования) ==========

  // Начать симуляцию движения
  startSimulation(startLat, startLng, onUpdate) {
    console.log("🎮 Starting GPS SIMULATION (test mode)...");
    this.isRealDevice = false;
    this.watching = true;

    // По умолчанию Киев
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

    console.log("📍 Simulated starting position:", {
      lat: latitude.toFixed(6),
      lng: longitude.toFixed(6),
      location: "Kyiv, Ukraine"
    });

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
        speed: Math.random() * 5, // 0-5 m/s
        heading: Math.random() * 360,
        timestamp: new Date()
      };

      console.log("🎮 Simulated GPS:", {
        lat: latitude.toFixed(6),
        lng: longitude.toFixed(6)
      });

      if (onUpdate) onUpdate(this.currentPosition);
    }, 5000);
  }

  // Симулировать маршрут между двумя точками
  simulateRoute(startLat, startLng, endLat, endLng, durationMinutes, onUpdate) {
    console.log("🎮 Simulating route...");
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

      console.log(`🎮 Route progress: ${currentStep}/${steps}`);
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

  // Получить название локации через Geocoding (примерно)
  async getLocationName(lat, lng) {
    try {
      // Используем бесплатный Nominatim API от OpenStreetMap
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data.display_name) {
        return data.display_name;
      }
      
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      console.error("Failed to get location name:", error);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  // Получить ссылку на карту
  getMapLink(lat, lng) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  // Проверить достаточную точность GPS
  hasGoodAccuracy(accuracy) {
    return accuracy <= 50; // Точность <= 50 метров
  }

  // Получить статус GPS
  getStatus() {
    return {
      isTracking: this.watching,
      isRealDevice: this.isRealDevice,
      hasPosition: this.currentPosition !== null,
      currentPosition: this.currentPosition,
      accuracy: this.currentPosition?.accuracy || null,
      lastUpdate: this.lastUpdateTime ? new Date(this.lastUpdateTime) : null
    };
  }
}

window.GPSTracker = GPSTracker;
