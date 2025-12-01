// simulator.js — GPS Location Simulator

class LocationSimulator {
  constructor(database, deviceManager) {
    this.db = database;
    this.deviceManager = deviceManager;
    this.enabled = false;
    this.intervalId = null;
    
    // Киев центр
    this.centerLat = 50.4501;
    this.centerLng = 30.5234;
    
    // Радиус движения (в градусах, ~10km)
    this.radius = 0.09;
    
    // Текущие позиции устройств
    this.devicePositions = new Map();
  }

  /**
   * Включить симулятор
   */
  start() {
    if (this.enabled) return;
    
    console.log('🎮 Starting GPS Simulator...');
    this.enabled = true;
    
    // Инициализировать позиции для всех устройств
    this.initializeDevicePositions();
    
    // Первое обновление сразу
    this.generateUpdates();
    
    // Затем каждые 5 минут
    this.intervalId = setInterval(() => {
      this.generateUpdates();
    }, 5 * 60 * 1000);
    
    console.log('✅ Simulator started (updates every 5 minutes)');
  }

  /**
   * Остановить симулятор
   */
  stop() {
    if (!this.enabled) return;
    
    console.log('🛑 Stopping GPS Simulator...');
    this.enabled = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('✅ Simulator stopped');
  }

  /**
   * Инициализировать случайные стартовые позиции
   */
  async initializeDevicePositions() {
    if (!this.db) return;
    
    this.db.getDevices((devices) => {
      devices.forEach(device => {
        const deviceId = device.device_id || device.DEVICE_ID || device.deviceId;
        
        if (!this.devicePositions.has(deviceId)) {
          // Случайная позиция в радиусе центра
          const angle = Math.random() * 2 * Math.PI;
          const distance = Math.random() * this.radius;
          
          this.devicePositions.set(deviceId, {
            lat: this.centerLat + distance * Math.cos(angle),
            lng: this.centerLng + distance * Math.sin(angle),
            direction: Math.random() * 2 * Math.PI, // Направление движения
            speed: 20 + Math.random() * 40 // 20-60 km/h
          });
        }
      });
    });
  }

  /**
   * Генерировать обновления для всех устройств
   */
  async generateUpdates() {
    if (!this.enabled || !this.db) return;
    
    console.log('🎮 Generating simulated GPS updates...');
    
    this.db.getDevices((devices) => {
      devices.forEach(device => {
        const deviceId = device.device_id || device.DEVICE_ID || device.deviceId;
        
        if (deviceId && deviceId !== 'undefined') {
          this.updateDevicePosition(deviceId);
        }
      });
    });
  }

/**
 * Обновить позицию конкретного устройства (симуляция)
 */
updateDevicePosition(deviceId) {
    let pos = this.devicePositions.get(deviceId);

    if (!pos) {
        // Создать стартовую позицию
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * this.radius;

        pos = {
            lat: this.centerLat + distance * Math.cos(angle),
            lng: this.centerLng + distance * Math.sin(angle),
            direction: Math.random() * 2 * Math.PI,
            speed: 20 + Math.random() * 40
        };
    }

    // =============================
    // Симулировать движение
    // =============================
    const deltaTime = 5 * 60; // 5 минут
    const speedMs = pos.speed / 3.6;
    const distanceM = speedMs * deltaTime;
    const distanceDeg = distanceM / 111000;

    pos.lat += distanceDeg * Math.cos(pos.direction);
    pos.lng += distanceDeg * Math.sin(pos.direction);

    pos.direction += (Math.random() - 0.5) * Math.PI / 3;
    pos.speed += (Math.random() - 0.5) * 20;
    pos.speed = Math.max(10, Math.min(80, pos.speed));

    const distFromCenter = this.calculateDistance(
        this.centerLat, this.centerLng,
        pos.lat, pos.lng
    );

    if (distFromCenter > this.radius * 111000) {
        pos.direction = Math.atan2(
            this.centerLat - pos.lat,
            this.centerLng - pos.lng
        );
    }

    // Сохранить обратно
    this.devicePositions.set(deviceId, pos);

    // =============================
    // Создать movement объект
    // =============================
    const movement = {
        deviceId: deviceId,
        latitude: pos.lat,
        longitude: pos.lng,
        altitude: 180 + Math.random() * 20,
        speed: speedMs,
        accuracy: 5 + Math.random() * 10,
        timestamp: new Date().toISOString()
    };

    // =============================
    // Сохранить в БД
    // =============================
    this.db.addMovement(movement, (movementId) => {
        if (movementId) {
            console.log(`📍 Simulated movement for ${deviceId}:`,
                `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`);

            // Обновить статус
            this.db.updateDeviceStatus(deviceId, "online");
            this.db.updateDeviceBattery(deviceId, Math.max(0, 100 - Math.random() * 50));

            // Добавить событие
            this.db.addEvent(deviceId, "movement_detected", {
                simulated: true,
                lat: pos.lat,
                lng: pos.lng
            });

            // Обновить UI если это текущее устройство
            if (window.currentDeviceId === deviceId) {
                this.refreshDeviceUI(deviceId);
            }

            // =============================
            // ⛓️ Создать blockchain-транзакцию (НОВОЕ)
            // =============================
            if (window.blockchain) {
                setTimeout(() => {
                    console.log("⛓️ Creating blockchain TX for simulated movement...");

                    window.blockchain
                        .submitProofOfMovement(deviceId, movement)
                        .then(result => {
                            if (result) {
                                console.log("✅ Blockchain TX created:", result.txid);

                                // Увеличить счетчик proof'ов
                                const proofCounter = document.getElementById("verified-proofs");
                                if (proofCounter) {
                                    const current = parseInt(proofCounter.textContent) || 0;
                                    proofCounter.textContent = current + 1;
                                }

                                // Добавить событие
                                this.db.addEvent(deviceId, "proof_submitted", {
                                    txid: result.txid,
                                    simulated: true
                                });

                                // Показать уведомление в UI
                                if (window.ui) {
                                    window.ui.showNotification(
                                        "Blockchain proof created!",
                                        "success"
                                    );
                                }
                            }
                        });
                }, 2000); // задержка 2 сек
            }
        }
    });
}


  /**
   * Принудительное обновление (кнопка "Force Update")
   */
  forceUpdate() {
    if (!this.enabled) {
      console.warn('Simulator not enabled');
      return;
    }
    
    console.log('🔄 Forcing simulator update...');
    this.generateUpdates();
    
    if (window.ui) {
      window.ui.showNotification('Simulator updated!', 'success');
    }
  }

  /**
   * Обновить UI устройства
   */
  refreshDeviceUI(deviceId) {
    if (typeof refreshDeviceDetail === 'function') {
      refreshDeviceDetail();
    }
    
    if (typeof loadDashboard === 'function') {
      loadDashboard();
    }
  }

  /**
   * Рассчитать расстояние (Haversine)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
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
   * Получить статус
   */
  getStatus() {
    return {
      enabled: this.enabled,
      deviceCount: this.devicePositions.size,
      centerPoint: {
        lat: this.centerLat,
        lng: this.centerLng
      }
    };
  }
}

// Export
window.LocationSimulator = LocationSimulator;
console.log('✅ simulator.js loaded');
