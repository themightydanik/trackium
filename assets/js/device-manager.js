// device-manager.js - ИСПРАВЛЕННЫЙ менеджер устройств

class DeviceManager {
  constructor(database) {
    this.db = database;
    this.activeDevices = new Map();
  }

  generateDeviceId() {
    const prefix = 'TRACK';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  async registerDevice(deviceData) {
    try {
      const device = {
        deviceId: deviceData.deviceId || this.generateDeviceId(),
        name: deviceData.name,
        type: deviceData.type,
        location: deviceData.location || '',
        blockchainProof: deviceData.blockchainProof || false
      };

      await new Promise((resolve) => {
        this.db.addDevice(device, (success) => {
          if (success) {
            console.log('Device registered:', device.deviceId);
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

  async activateDevice(deviceId, deviceType) {
    if (this.activeDevices.has(deviceId)) {
      console.log('Device already active:', deviceId);
      return { success: true, message: 'Already active' };
    }

    console.log('Activating device:', deviceId, 'Type:', deviceType);

    if (deviceType === 'tracker' || deviceType === 'smartphone') {
      return await this.activateGPSTracking(deviceId);
    } else {
      this.db.updateDeviceStatus(deviceId, 'online');
      this.db.addEvent(deviceId, 'device_activated', { type: deviceType });
      return { success: true, message: 'Device activated (no GPS required)' };
    }
  }

  async activateGPSTracking(deviceId) {
    try {
      const deviceGPS = new GPSTracker();
      
      if (!deviceGPS.isGeolocationSupported()) {
        console.log('❌ Geolocation not supported, using simulation');
        return this.activateSimulatedTracking(deviceId);
      }

      console.log('🛰️ Requesting GPS permission...');
      
      // Попробовать реальный GPS с увеличенным timeout
      const gpsStarted = await this.tryStartRealGPS(deviceId, deviceGPS);
      
      if (gpsStarted.success) {
        return gpsStarted;
      } else {
        console.log('⚠️ Real GPS failed, using simulation');
        return this.activateSimulatedTracking(deviceId);
      }

    } catch (error) {
      console.error('Error activating GPS:', error);
      return this.activateSimulatedTracking(deviceId);
    }
  }

  async tryStartRealGPS(deviceId, deviceGPS) {
    return new Promise((resolve) => {
      console.log('🛰️ Attempting to start real GPS...');

      let gpsStarted = false;
      let timeoutId;
      let errorCount = 0;

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

        this.saveMovement(deviceId, position);
      };

      const onGPSError = (error) => {
        errorCount++;
        console.error(`GPS Error #${errorCount}:`, error);
        
        // Если ошибка PERMISSION_DENIED - сразу fallback
        if (error.code === 1) { // PERMISSION_DENIED
          if (!gpsStarted) {
            clearTimeout(timeoutId);
            deviceGPS.stopTracking();
            resolve({
              success: false,
              message: 'GPS permission denied',
              type: 'permission_denied'
            });
          }
        }
      };

      deviceGPS.startRealTracking(onGPSUpdate, onGPSError);

      // Timeout 20 секунд (увеличено с 10)
      timeoutId = setTimeout(() => {
        if (!gpsStarted) {
          deviceGPS.stopTracking();
          console.log('⏱️ GPS timeout - no response in 20 seconds');
          resolve({
            success: false,
            message: 'GPS timeout',
            type: 'timeout'
          });
        }
      }, 20000);
    });
  }

  handleGPSSuccess(deviceId, deviceGPS, onGPSUpdate) {
    this.db.updateDeviceStatus(deviceId, 'online');
    this.db.updateDeviceGPS(deviceId, true);

    this.activeDevices.set(deviceId, {
      gpsTracker: deviceGPS,
      startTime: new Date(),
      type: 'real',
      batteryLevel: 100
    });

    // Симулировать разряд батареи
    const batteryInterval = setInterval(() => {
      const deviceData = this.activeDevices.get(deviceId);
      if (deviceData) {
        // Разряжаем на 1% каждые 10 минут
        const newBattery = Math.max(0, deviceData.batteryLevel - 1);
        deviceData.batteryLevel = newBattery;
        
        this.db.updateDeviceBattery(deviceId, newBattery);
        
        if (newBattery <= 20 && newBattery % 5 === 0) {
          console.log(`⚠️ Low battery: ${newBattery}%`);
        }
        
        if (newBattery === 0) {
          console.log('🔋 Battery depleted, deactivating device');
          this.deactivateDevice(deviceId);
          clearInterval(batteryInterval);
        }
      } else {
        clearInterval(batteryInterval);
      }
    }, 10 * 60 * 1000); // Каждые 10 минут

    this.activeDevices.get(deviceId).batteryInterval = batteryInterval;
    this.db.addEvent(deviceId, 'gps_activated', { type: 'real' });
  }

  activateSimulatedTracking(deviceId) {
    console.log('🎮 Starting GPS simulation for device:', deviceId);

    const deviceGPS = new GPSTracker();
    
    const onGPSUpdate = (position) => {
      this.saveMovement(deviceId, position);
      this.db.updateDeviceGPS(deviceId, true);
    };

    // Попробовать получить примерную локацию
    this.tryGetApproximateLocation((approxLocation) => {
      const lat = approxLocation?.latitude || 50.4501; // Default: Kyiv
      const lng = approxLocation?.longitude || 30.5234;
      
      console.log('📍 Starting simulation at:', lat, lng);
      deviceGPS.startSimulation(lat, lng, onGPSUpdate);
      
      this.db.updateDeviceStatus(deviceId, 'online');
      
      this.activeDevices.set(deviceId, {
        gpsTracker: deviceGPS,
        startTime: new Date(),
        type: 'simulated',
        batteryLevel: 100
      });

      // Симулировать разряд батареи
      const batteryInterval = setInterval(() => {
        const deviceData = this.activeDevices.get(deviceId);
        if (deviceData) {
          const newBattery = Math.max(0, deviceData.batteryLevel - 1);
          deviceData.batteryLevel = newBattery;
          this.db.updateDeviceBattery(deviceId, newBattery);
          
          if (newBattery === 0) {
            this.deactivateDevice(deviceId);
            clearInterval(batteryInterval);
          }
        } else {
          clearInterval(batteryInterval);
        }
      }, 10 * 60 * 1000);

      this.activeDevices.get(deviceId).batteryInterval = batteryInterval;
      this.db.addEvent(deviceId, 'gps_activated', { type: 'simulated' });
    });

    return {
      success: true,
      message: 'Simulation activated',
      type: 'simulated'
    };
  }

  tryGetApproximateLocation(callback) {
    if (!navigator.geolocation) {
      callback(null);
      return;
    }

    const options = {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 60000
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('📍 Got approximate location from WiFi/Cell');
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

  deactivateDevice(deviceId) {
    const activeDevice = this.activeDevices.get(deviceId);
    
    if (activeDevice) {
      // Остановить GPS
      if (activeDevice.gpsTracker) {
        activeDevice.gpsTracker.stopTracking();
      }
      
      // Остановить battery timer
      if (activeDevice.batteryInterval) {
        clearInterval(activeDevice.batteryInterval);
      }
      
      this.activeDevices.delete(deviceId);
      this.db.updateDeviceStatus(deviceId, 'offline');
      this.db.addEvent(deviceId, 'device_deactivated', {});
      
      console.log('Device deactivated:', deviceId);
    }
  }

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

  removeDevice(deviceId, callback) {
    console.log('🗑️ Removing device:', deviceId);
    
    // Деактивировать если активно
    this.deactivateDevice(deviceId);
    
    // Удалить из базы
    this.db.deleteDevice(deviceId, (success) => {
      if (success) {
        console.log('✅ Device removed from database:', deviceId);
      } else {
        console.error('❌ Failed to remove device from database');
      }
      if (callback) callback(success);
    });
  }

  getCurrentPosition(deviceId, callback) {
    const activeDevice = this.activeDevices.get(deviceId);
    
    if (activeDevice && activeDevice.gpsTracker && activeDevice.gpsTracker.currentPosition) {
      callback(activeDevice.gpsTracker.currentPosition);
    } else {
      this.db.getLastPosition(deviceId, callback);
    }
  }

  getDevicesStatus(callback) {
    this.db.getDevices((devices) => {
      const devicesWithStatus = devices.map(device => {
        const deviceId = device.device_id || device.deviceId;
        const isActive = this.activeDevices.has(deviceId);
        let currentPosition = null;

        if (isActive) {
          const activeDevice = this.activeDevices.get(deviceId);
          currentPosition = activeDevice.gpsTracker?.currentPosition || null;
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

  getActiveDevices() {
    return Array.from(this.activeDevices.keys());
  }

  checkGeolocationSupport() {
    const supported = 'geolocation' in navigator;
    console.log('Geolocation supported:', supported);
    return supported;
  }

  async requestGeolocationPermission() {
    if (!this.checkGeolocationSupport()) {
      return false;
    }

    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => reject(false),
          { timeout: 5000 }
        );
      });
      return true;
    } catch (error) {
      console.error('Permission denied or error:', error);
      return false;
    }
  }
}

window.DeviceManager = DeviceManager;
