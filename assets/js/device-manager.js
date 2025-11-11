// device-manager.js - NB-IoT + WiFi/Cell версия

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
        transportType: deviceData.transportType || 'ground',
        category: deviceData.category || '',
        location: deviceData.location || '',
        blockchainProof: deviceData.blockchainProof || false
      };

      console.log('📝 Registering device:', device);

      await new Promise((resolve) => {
        this.db.addDevice(device, (success) => {
          if (success) {
            console.log('✅ Device registered:', device.deviceId);
            this.db.addEvent(
              device.deviceId,
              'device_registered',
              { 
                name: device.name, 
                type: device.type,
                transportType: device.transportType,
                category: device.category
              }
            );
          }
          resolve(success);
        });
      });

      return device;
    } catch (error) {
      console.error('❌ Error registering device:', error);
      return null;
    }
  }

  async activateDevice(deviceId, deviceType) {
    if (this.activeDevices.has(deviceId)) {
      console.log('Device already active:', deviceId);
      return { success: true, message: 'Already active' };
    }

    console.log('🔌 Activating device:', deviceId, 'Type:', deviceType);

    // Все типы используют location tracking
    return await this.activateLocationTracking(deviceId, deviceType);
  }

  async activateLocationTracking(deviceId, deviceType) {
    try {
      const locationTracker = new LocationTracker();
      
      console.log('📡 Starting location tracking...');
      
      const trackingStarted = await new Promise((resolve) => {
        let hasUpdate = false;
        const timeout = setTimeout(() => {
          if (!hasUpdate) {
            resolve(false);
          }
        }, 15000);

        const onUpdate = (position) => {
          if (!hasUpdate) {
            hasUpdate = true;
            clearTimeout(timeout);
            
            console.log('✅ Location tracking active');
            this.handleLocationSuccess(deviceId, locationTracker, onUpdate, deviceType);
            
            resolve(true);
          }
          
          this.saveMovement(deviceId, position);
        };

        const onError = (error) => {
          console.error('Location error:', error);
          if (!hasUpdate) {
            clearTimeout(timeout);
            resolve(false);
          }
        };

        locationTracker.startTracking(deviceType, onUpdate, onError);
      });

      if (trackingStarted) {
        return {
          success: true,
          message: deviceType === 'smartphone' ? 'WiFi/Cell tracking active' : 'NB-IoT tracking active',
          type: deviceType === 'smartphone' ? 'wifi' : 'nbiot'
        };
      } else {
        throw new Error('Location tracking timeout');
      }

    } catch (error) {
      console.error('❌ Failed to activate location tracking:', error);
      return {
        success: false,
        message: error.message,
        type: 'failed'
      };
    }
  }

  handleLocationSuccess(deviceId, locationTracker, onUpdate, deviceType) {
    this.db.updateDeviceStatus(deviceId, 'online');
    
    // Определить силу сигнала
    const signalStrength = deviceType === 'smartphone' ? 'WiFi/Cell' : 'NB-IoT';
    this.db.updateDeviceSignal(deviceId, signalStrength);

    this.activeDevices.set(deviceId, {
      locationTracker: locationTracker,
      startTime: new Date(),
      type: deviceType,
      batteryLevel: 100
    });

    // Симулировать разряд батареи
    // NB-IoT: 1% каждые 30 минут (экономичнее)
    // WiFi/Cell: 1% каждые 15 минут
    const batteryInterval = deviceType === 'smartphone' ? 15 : 30;
    
    const batteryTimer = setInterval(() => {
      const deviceData = this.activeDevices.get(deviceId);
      if (deviceData) {
        const newBattery = Math.max(0, deviceData.batteryLevel - 1);
        deviceData.batteryLevel = newBattery;
        
        this.db.updateDeviceBattery(deviceId, newBattery);
        
        if (newBattery <= 20 && newBattery % 5 === 0) {
          console.log(`⚠️ Low battery: ${newBattery}%`);
          this.db.addEvent(deviceId, 'low_battery', { battery: newBattery });
        }
        
        if (newBattery === 0) {
          console.log('🔋 Battery depleted');
          this.deactivateDevice(deviceId);
          clearInterval(batteryTimer);
        }
      } else {
        clearInterval(batteryTimer);
      }
    }, batteryInterval * 60 * 1000);

    this.activeDevices.get(deviceId).batteryTimer = batteryTimer;
    
    this.db.addEvent(deviceId, 'location_activated', { 
      type: deviceType,
      signalStrength: signalStrength
    });
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
        console.log('📍 Movement saved:', movementId);
      }
    });
  }

  deactivateDevice(deviceId) {
    const activeDevice = this.activeDevices.get(deviceId);
    
    if (activeDevice) {
      if (activeDevice.locationTracker) {
        activeDevice.locationTracker.stopTracking();
      }
      
      if (activeDevice.batteryTimer) {
        clearInterval(activeDevice.batteryTimer);
      }
      
      this.activeDevices.delete(deviceId);
      this.db.updateDeviceStatus(deviceId, 'offline');
      this.db.addEvent(deviceId, 'device_deactivated', {});
      
      console.log('⏹️ Device deactivated:', deviceId);
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
          console.log(`🔒 Device ${deviceId} ${newLockState ? 'locked' : 'unlocked'}`);
        }
        if (callback) callback(success);
      });
    });
  }

  removeDevice(deviceId, callback) {
    console.log('🗑️ Removing device:', deviceId);
    
    this.deactivateDevice(deviceId);
    
    this.db.deleteDevice(deviceId, (success) => {
      if (success) {
        console.log('✅ Device removed:', deviceId);
      }
      if (callback) callback(success);
    });
  }

  getCurrentPosition(deviceId, callback) {
    const activeDevice = this.activeDevices.get(deviceId);
    
    if (activeDevice && activeDevice.locationTracker && activeDevice.locationTracker.currentPosition) {
      callback(activeDevice.locationTracker.currentPosition);
    } else {
      this.db.getLastPosition(deviceId, callback);
    }
  }

  // Обновить позицию устройства (по запросу)
  refreshDeviceLocation(deviceId, callback) {
    const activeDevice = this.activeDevices.get(deviceId);
    
    if (activeDevice && activeDevice.locationTracker) {
      console.log('🔄 Refreshing location for:', deviceId);
      
      activeDevice.locationTracker.getCurrentPosition(
        (position) => {
          this.saveMovement(deviceId, position);
          if (callback) callback(position);
        },
        (error) => {
          console.error('Failed to refresh location:', error);
          if (callback) callback(null);
        }
      );
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
          currentPosition = activeDevice.locationTracker?.currentPosition || null;
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

  // Получить устройства по категории
  getDevicesByCategory(category, callback) {
    this.db.getDevicesByCategory(category, callback);
  }

  // Получить все категории
  getAllCategories(callback) {
    this.db.getAllCategories(callback);
  }
}

window.DeviceManager = DeviceManager;
console.log('✅ device-manager.js (NB-IoT) loaded');
