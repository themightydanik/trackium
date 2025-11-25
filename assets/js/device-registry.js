// device-registry.js - Регистрация устройств для мульти-нода отслеживания

class DeviceRegistry {
  constructor(database) {
    this.db = database;
  }

  /**
   * РЕГИСТРАЦИЯ УСТРОЙСТВА (владелец устройства)
   * Создает on-chain запись о владении устройством
   */
  async registerDeviceOnChain(deviceId, deviceName, accessPassword) {
    try {
      console.log('📝 Registering device on-chain:', deviceId);
      
      // Хэш пароля для безопасности
      const passwordHash = await this.hashPassword(accessPassword);
      
      // Получить публичный ключ владельца
      const addressData = await this.getNodeAddress();
      const ownerKey = addressData.publickey;
      
      // Создать транзакцию с данными регистрации в STATE
      const txnId = `reg_${deviceId}_${Date.now()}`;
      
      await this.execCmd(`txncreate id:${txnId}`);
      
      // Получить монету
      const coins = await this.getCoins();
      const coin = coins.find(c => parseFloat(c.amount) >= 0.001 && c.tokenid === "0x00");
      
      if (!coin) {
        throw new Error('No suitable coin for registration');
      }
      
      await this.execCmd(`txninput id:${txnId} coinid:${coin.coinid} scriptmmr:true`);
      
      // STATE данные регистрации
      const registryData = {
        "0": "TRACKIUM_REGISTRY",    // Тип записи
        "1": deviceId,                // Device ID
        "2": ownerKey,                // Публичный ключ владельца
        "3": passwordHash,            // Хэш пароля доступа
        "4": Date.now().toString()    // Timestamp регистрации
      };
      
      const stateStr = JSON.stringify(registryData).replace(/"/g, '\\"');
      
      // Получить адрес
      const address = addressData.address;
      const amount = parseFloat(coin.amount) - 0.0001;
      
      await this.execCmd(
        `txnoutput id:${txnId} address:${address} amount:${amount} state:"${stateStr}"`
      );
      
      await this.execCmd(`txnsign id:${txnId} publickey:auto`);
      await this.execCmd(`txnbasics id:${txnId}`);
      
      const result = await this.execCmd(`txnpost id:${txnId}`);
      const txid = result.txpowid || txnId;
      
      console.log('✅ Device registered on-chain:', txid);
      
      // Сохранить локально
      this.db.saveSetting(`device_registry_${deviceId}`, {
        deviceId: deviceId,
        deviceName: deviceName,
        ownerKey: ownerKey,
        passwordHash: passwordHash,
        txid: txid,
        registeredAt: Date.now()
      });
      
      return {
        success: true,
        txid: txid,
        deviceId: deviceId,
        accessCode: `${deviceId}:${accessPassword}` // Дать пользователю
      };
      
    } catch (error) {
      console.error('❌ Device registration failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ДОБАВИТЬ УСТРОЙСТВО С ДРУГОЙ НОДЫ (менеджер компании)
   * Проверяет on-chain и добавляет устройство для отслеживания
   */
  async addRemoteDevice(deviceId, accessPassword) {
    try {
      console.log('🔍 Looking up device on-chain:', deviceId);
      
      // Хэш введенного пароля
      const inputPasswordHash = await this.hashPassword(accessPassword);
      
      // Найти регистрацию устройства on-chain
      const registrationData = await this.findDeviceRegistration(deviceId);
      
      if (!registrationData) {
        throw new Error('Device not found in blockchain registry');
      }
      
      // Проверить пароль
      if (registrationData.passwordHash !== inputPasswordHash) {
        throw new Error('Invalid access password');
      }
      
      console.log('✅ Device verified on-chain');
      
      // Добавить устройство локально как "remote"
      const remoteDevice = {
        deviceId: deviceId,
        name: registrationData.deviceName || deviceId,
        type: 'tracker', // По умолчанию
        location: 'Remote',
        blockchainProof: true,
        isRemote: true,
        ownerNode: registrationData.ownerKey
      };
      
      // Сохранить в БД
      await new Promise((resolve) => {
        this.db.addDevice(remoteDevice, resolve);
      });
      
      // Подписаться на обновления через Maxima (если доступно)
      await this.subscribeToDeviceUpdates(deviceId, registrationData.ownerKey);
      
      return {
        success: true,
        device: remoteDevice
      };
      
    } catch (error) {
      console.error('❌ Failed to add remote device:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Найти регистрацию устройства on-chain
   */
  async findDeviceRegistration(deviceId) {
    try {
      // Поиск по всем транзакциям с TRACKIUM_REGISTRY в STATE
      // (это упрощенная версия, в продакшене нужен индекс)
      
      // Проверить локальный кэш сначала
      const cached = await new Promise((resolve) => {
        this.db.getSetting(`device_registry_${deviceId}`, resolve);
      });
      
      if (cached) {
        return cached;
      }
      
      // TODO: Реальный on-chain поиск через txpowlist
      // Пока возвращаем null
      return null;
      
    } catch (error) {
      console.error('Failed to find device registration:', error);
      return null;
    }
  }

  /**
   * Подписаться на обновления устройства через Maxima
   */
  async subscribeToDeviceUpdates(deviceId, ownerPublicKey) {
    try {
      // Получить Maxima адрес владельца устройства
      // и подписаться на его сообщения о движении
      
      console.log('📡 Subscribing to device updates via Maxima...');
      
      // TODO: Implement Maxima subscription
      // MDS.cmd(`maxima action:subscribe publickey:${ownerPublicKey}`, ...)
      
      return true;
    } catch (error) {
      console.error('Failed to subscribe to updates:', error);
      return false;
    }
  }

  /**
   * ПУБЛИКАЦИЯ ОБНОВЛЕНИЙ (владелец устройства)
   * Отправляет обновления движения подписчикам через Maxima
   */
  async publishMovementUpdate(deviceId, movement) {
    try {
      // Получить список подписчиков этого устройства
      const subscribers = await this.getDeviceSubscribers(deviceId);
      
      if (subscribers.length === 0) {
        console.log('No subscribers for device:', deviceId);
        return;
      }
      
      // Подготовить данные
      const updateData = {
        type: 'TRACKIUM_MOVEMENT_UPDATE',
        deviceId: deviceId,
        latitude: movement.latitude,
        longitude: movement.longitude,
        altitude: movement.altitude,
        speed: movement.speed,
        accuracy: movement.accuracy,
        timestamp: movement.timestamp || Date.now(),
        proofTxid: movement.proof_txid || null
      };
      
      // Отправить через Maxima всем подписчикам
      for (const subscriber of subscribers) {
        await this.sendMaximaMessage(subscriber, JSON.stringify(updateData));
      }
      
      console.log(`📤 Published update to ${subscribers.length} subscribers`);
      
    } catch (error) {
      console.error('Failed to publish update:', error);
    }
  }

  /**
   * Получить подписчиков устройства
   */
  async getDeviceSubscribers(deviceId) {
    // TODO: Implement subscriber storage
    return [];
  }

  /**
   * Отправить Maxima сообщение
   */
  async sendMaximaMessage(recipientKey, message) {
    try {
      await this.execCmd(
        `maxima action:send publickey:${recipientKey} application:trackium data:"${message}"`
      );
    } catch (error) {
      console.error('Failed to send Maxima message:', error);
    }
  }

  // Helper functions
  
  async hashPassword(password) {
    return new Promise((resolve) => {
      MDS.cmd(`hash data:"${password}"`, (res) => {
        resolve(res.status ? res.response.hash : null);
      });
    });
  }

  async getNodeAddress() {
    return new Promise((resolve) => {
      MDS.cmd("getaddress", (res) => {
        resolve(res.status ? {
          address: res.response.miniaddress,
          publickey: res.response.publickey
        } : null);
      });
    });
  }

  async getCoins() {
    return new Promise((resolve) => {
      MDS.cmd("coins relevant:true", (res) => {
        resolve(res.response || []);
      });
    });
  }

  async execCmd(command) {
    return new Promise((resolve, reject) => {
      MDS.cmd(command, (res) => {
        if (res.status) {
          resolve(res.response);
        } else {
          reject(new Error(res.error || 'Command failed'));
        }
      });
    });
  }
}

this.DeviceRegistry = DeviceRegistry;
