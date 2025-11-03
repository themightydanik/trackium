// device-manager.js - Управление Trackium устройствами

class DeviceManager {
  constructor(database, gpsTracker) {
    this.db = database;
    this.gps = gpsTracker;
    this.activeDevices = new Map(); // deviceId -> { tracker, interval }
    this.smartphoneMode = false;
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
  activateDevice(deviceId, useRealGPS = true) {
    if (this.activeDevices.has(deviceId)) {
      console.log('Device already active:', deviceId);
      return;
    }

    console.log('Activating device:', deviceId);

    // Создать GPS трекер для устройства
    const deviceGPS = new GPSTracker();
    
    // Callback для обновлений GPS
    const onGPSUpdate = (position) => {
      console.log('GPS update for device:', deviceId, position);
      
      // Сохранить движение в базу
      this.db.addMovement({
        deviceId: deviceId,
        latitude: position.latitude,
        longitude: position.longitude,
        altitude: position.altitude,
        speed: position.speed,
        accuracy: position.accuracy
      }, (movementId) => {
        if (movementId) {
          console.log('Movement saved:', movementId);
        }
      });

      // Обновить статус GPS в устройстве
      this.db.updateDeviceGPS(deviceId, deviceGPS.hasGoodAccuracy(position.accuracy));
    };

    // Начать трекинг
    if (useRealGPS && deviceGPS.isGeolocationSupported()) {
      deviceGPS.startRealTracking(onGPSUpdate, (error) => {
        console.error('GPS Error:', error);
        // Fallback к симуляции
        deviceGPS.startSimulation(50.4501, 30.5234, onGPSUpdate);
      });
    } else {
      // Симуляция GPS
      deviceGPS.startSimulation(50.4501, 30.5234, onGPSUpdate);
    }

    // Обновить статус устройства
    this.db.updateDeviceStatus(deviceId, 'online');

    // Сохранить активное устройство
    this.activeDevices.set(deviceId, {
      gpsTracker: deviceGPS,
      startTime: new Date()
    });

    // Симулировать батарею (уменьшается каждые 10 минут)
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
    }, 10 * 60 * 1000); // 10 минут

    this.activeDevices.get(deviceId).batteryInterval = batteryInterval;

    // Добавить событие
    this.db.addEvent(deviceId, 'device_activated', {});
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
