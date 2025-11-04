// device-manager.js - Управление Trackium устройствами

class DeviceManager {
  constructor(database) {
    this.db = database;
    this.activeDevices = new Map(); // deviceId -> { tracker, interval }
  }

  // Генерировать уникальный Device ID
  generateDeviceId() {
    const prefix = 'TRACK';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  // Зарегистрировать новое устройство
  async registerDevice(deviceData) {
    try {
      const device = {
        deviceId: deviceData.deviceId || this.generateDeviceId(),
        name: deviceData.name,
        type: deviceData.type,
        location: deviceData.location || '',
        blockchainProof: deviceData.blockchainProof || false
      };

      // Сохранить в базу
      await new Promise((resolve) => {
        this.db.addDevice(device, (success) => {
          if (success) {
            console.log('Device registered:', device.deviceId);
            
            // Добавить событие
            this.db.addEvent(
              device.deviceId,
              'device_registered',
              { name: device.name, type: device.type }
            );
          }
          resolve(success);
        });
      });

      return device;
    } catch (error) {
      console.error('Error registering device:', error);
      return null;
    }
  }

  // Активировать устройство (начать трекинг)
  async activateDevice(deviceId, deviceType) {
    if (this.activeDevices.has(deviceId)) {
      console.log('Device already active:', deviceId);
      return { success: true, message: 'Already active' };
    }

    console.log('Activating device:', deviceId, 'Type:', deviceType);

    // Только для tracker/smartphone типов пытаемся включить GPS
    if (deviceType === 'tracker' || deviceType === 'smartphone') {
      return await this.activateGPSTracking(deviceId);
    } else {
      // Для других типов (например, для мониторинга устройств) просто активируем
      this.db.updateDeviceStatus(deviceId, 'online');
      this.db.addEvent(deviceId, 'device_activated', { type: deviceType });
      return { success: true, message: 'Device activated (no GPS required)' };
    }
  }

  // Активировать GPS трекинг
  async activateGPSTracking(deviceId) {
    try {
      // Создать новый GPS трекер для этого устройства
      const deviceGPS = new GPSTracker();
      
      // Проверить поддержку геолокации
      if (!deviceGPS.isGeolocationSupported()) {
        console.log('Geolocation not supported, using simulation');
        return this.activateSimulatedTracking(deviceId);
      }

      // Попытаться получить разрешение и запустить GPS
      const gpsStarted = await this.tryStartRealGPS(deviceId, deviceGPS);
      
      if (gpsStarted.success) {
        return gpsStarted;
      } else {
        // Fallback к симуляции
        console.log('Real GPS failed, using simulation');
        return this.activateSimulatedTracking(deviceId);
      }

    } catch (error) {
      console.error('Error activating GPS:', error);
      return this.activateSimulatedTracking(deviceId);
    }
  }

  // Попытаться запустить реальный GPS
  async tryStartRealGPS(deviceId, deviceGPS) {
    return new Promise((resolve) => {
      console.log('Attempting to start real GPS...');

      let gpsStarted = false;
      let timeoutId;

      const onGPSUpdate = (position) => {
        if (!gpsStarted) {
          gpsStarted = true;
          clearTimeout(timeoutId);
          
          console.log('✅ Real GPS working!');
          this.handleGPSSuccess(deviceId, deviceGPS, onGPSUpdate);
          
          resolve({
            success: true,
            message: 'Real GPS activated',
            type: 'real'
          });
        }

        // Сохранить движение
        this.saveMovement(deviceId, position);
      };

      const onGPSError = (error) => {
        if (!gpsStarted) {
          console.error('GPS Error:', error);
          // Не резолвим сразу, ждем timeout
        }
      };

      // Попытаться запустить GPS
      deviceGPS.startRealTracking(onGPSUpdate, onGPSError);

      // Timeout через 10 секунд если GPS не отвечает
      timeoutId = setTimeout(() => {
        if (!gpsStarted) {
          deviceGPS.stopTracking();
          resolve({
            success: false,
            message: 'GPS timeout - no response',
            type: 'timeout'
          });
        }
      }, 10000);
    });
  }

  // Обработать успешный запуск GPS
  handleGPSSuccess(deviceId, deviceGPS, onGPSUpdate) {
    // Обновить статус устройства
    this.db.updateDeviceStatus(deviceId, 'online');
    this.db.updateDeviceGPS(deviceId, true);

    // Сохранить активное устройство
    this.activeDevices.set(deviceId, {
      gpsTracker: deviceGPS,
      startTime: new Date(),
      type: 'real'
    });

    // Симулировать батарею
    const batteryInterval = setInterval(() => {
      this.db.getDevice(deviceId, (device) => {
        if (device) {
          const newBattery = Math.max(0, device.battery - 1);
          this.db.updateDeviceBattery(deviceId, newBattery);
          
          if (newBattery === 0) {
            this.deactivateDevice(deviceId);
            clearInterval(batteryInterval);
          }
        }
      });
    }, 10 * 60 * 1000);

    this.activeDevices.get(deviceId).batteryInterval = batteryInterval;
    this.db.addEvent(deviceId, 'gps_activated', { type: 'real' });
  }

  // Активировать симулированное отслеживание
  activateSimulatedTracking(deviceId) {
    console.log('Starting GPS simulation for device:', deviceId);

    const deviceGPS = new GPSTracker();
    
    const onGPSUpdate = (position) => {
      this.saveMovement(deviceId, position);
      this.db.updateDeviceGPS(deviceId, true);
    };

    // Использовать WiFi/Cell для примерной локации если доступно
    this.tryGetApproximateLocation((approxLocation) => {
      const lat = approxLocation?.latitude || 50.4501; // Default: Kyiv
      const lng = approxLocation?.longitude || 30.5234;
      
      deviceGPS.startSimulation(lat, lng, onGPSUpdate);
      
      this.db.updateDeviceStatus(deviceId, 'online');
      
      this.activeDevices.set(deviceId, {
        gpsTracker: deviceGPS,
        startTime: new Date(),
        type: 'simulated'
      });

      this.db.addEvent(deviceId, 'gps_activated', { type: 'simulated' });
    });

    return {
      success: true,
      message: 'Simulation activated',
      type: 'simulated'
    };
  }

  // Попытаться получить примерную локацию (WiFi/Cell)
  tryGetApproximateLocation(callback) {
    if (!navigator.geolocation) {
      callback(null);
      return;
    }

    // Использовать низкую точность (WiFi/Cell)
    const options = {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 60000 // Можно использовать кэш до 1 минуты
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Got approximate location from WiFi/Cell');
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        console.log('Could not get approximate location:', error);
        callback(null);
      },
      options
    );
  }

  // Сохранить движение
  saveMovement(deviceId, position) {
    this.db.addMovement({
      deviceId: deviceId,
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude || 0,
      speed: position.speed || 0,
      accuracy: position.accuracy || 0
    }, (movementId) => {
      if (movementId) {
        console.log('Movement saved:', movementId);
      }
    });
  }

  // Деактивировать устройство
  deactivateDevice(deviceId) {
    const activeDevice = this.activeDevices.get(deviceId);
    
    if (activeDevice) {
      // Остановить GPS трекинг
      activeDevice.gpsTracker.stopTracking();
      
      // Остановить обновление батареи
      if (activeDevice.batteryInterval) {
        clearInterval(activeDevice.batteryInterval);
      }
      
      // Удалить из активных
      this.activeDevices.delete(deviceId);
      
      // Обновить статус
      this.db.updateDeviceStatus(deviceId, 'offline');
      
      // Добавить событие
      this.db.addEvent(deviceId, 'device_deactivated', {});
      
      console.log('Device deactivated:', deviceId);
    }
  }

  // Переключить замок
  toggleLock(deviceId, callback) {
    this.db.getDevice(deviceId, (device) => {
      if (!device) {
        if (callback) callback(false);
        return;
      }

      const newLockState = !device.locked;
      
      this.db.updateLockStatus(deviceId, newLockState, (success) => {
        if (success) {
          this.db.addEvent(deviceId, newLockState ? 'device_locked' : 'device_unlocked', {});
          console.log(`Device ${deviceId} ${newLockState ? 'locked' : 'unlocked'}`);
        }
        if (callback) callback(success);
      });
    });
  }

  // Удалить устройство
  removeDevice(deviceId, callback) {
    // Деактивировать если активно
    this.deactivateDevice(deviceId);
    
    // Удалить из базы
    this.db.deleteDevice(deviceId, (success) => {
      if (success) {
        console.log('Device removed:', deviceId);
      }
      if (callback) callback(success);
    });
  }

  // Получить текущую позицию устройства
  getCurrentPosition(deviceId, callback) {
    const activeDevice = this.activeDevices.get(deviceId);
    
    if (activeDevice && activeDevice.gpsTracker.currentPosition) {
      callback(activeDevice.gpsTracker.currentPosition);
    } else {
      // Получить последнюю сохраненную позицию из базы
      this.db.getLastPosition(deviceId, callback);
    }
  }

  // Активировать режим смартфона
  activateSmartphoneMode(deviceName = 'My Smartphone') {
    console.log('Activating smartphone mode...');
    this.smartphoneMode = true;

    // Создать виртуальное устройство для смартфона
    const smartphoneDevice = {
      deviceId: 'SMARTPHONE-' + Date.now(),
      name: deviceName,
      type: 'smartphone',
      location: 'Mobile',
      blockchainProof: true
    };

    this.registerDevice(smartphoneDevice).then((device) => {
      if (device) {
        // Активировать с РЕАЛЬНЫМ GPS
        this.activateDevice(device.deviceId, true);
        
        console.log('Smartphone mode activated with device:', device.deviceId);
        return device;
      }
    });
  }

  // Симулировать маршрут для тестирования
  simulateRoute(deviceId, startLat, startLng, endLat, endLng, durationMinutes) {
    const activeDevice = this.activeDevices.get(deviceId);
    
    if (!activeDevice) {
      console.error('Device not active:', deviceId);
      return;
    }

    const onUpdate = (position) => {
      this.db.addMovement({
        deviceId: deviceId,
        latitude: position.latitude,
        longitude: position.longitude,
        altitude: position.altitude,
        speed: position.speed,
        accuracy: position.accuracy
      });
    };

    activeDevice.gpsTracker.simulateRoute(
      startLat, startLng,
      endLat, endLng,
      durationMinutes,
      onUpdate
    );

    this.db.addEvent(deviceId, 'route_simulation_started', {
      from: `${startLat},${startLng}`,
      to: `${endLat},${endLng}`,
      duration: durationMinutes
    });
  }

  // Получить статус всех устройств
  getDevicesStatus(callback) {
    this.db.getDevices((devices) => {
      const devicesWithStatus = devices.map(device => {
        const isActive = this.activeDevices.has(device.device_id);
        let currentPosition = null;

        if (isActive) {
          const activeDevice = this.activeDevices.get(device.device_id);
          currentPosition = activeDevice.gpsTracker.currentPosition;
        }

        return {
          ...device,
          isActive: isActive,
          currentPosition: currentPosition
        };
      });

      callback(devicesWithStatus);
    });
  }

  // Получить активные устройства
  getActiveDevices() {
    return Array.from(this.activeDevices.keys());
  }

  // Проверить поддержку геолокации
  checkGeolocationSupport() {
    const supported = 'geolocation' in navigator;
    console.log('Geolocation supported:', supported);
    return supported;
  }

  // Запросить разрешение на геолокацию
  async requestGeolocationPermission() {
    if (!this.checkGeolocationSupport()) {
      return false;
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      console.log('Geolocation permission:', result.state);
      
      if (result.state === 'prompt') {
        // Запросить разрешение
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false)
          );
        });
      }

      return result.state === 'granted';
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }
}

// Экспорт
window.DeviceManager = DeviceManager;
