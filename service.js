// service.js - Фоновый сервис для Trackium

// Загрузить необходимые библиотеки
MDS.load('./assets/js/database.js');

let db = null;
let autoProofIntervals = new Map();

// Инициализация MDS
MDS.init(function(msg) {
  
  if (msg.event === "inited") {
    MDS.log("Trackium Service initialized");
    
    // Инициализировать базу данных
    db = new TrackiumDatabase();
    db.init(() => {
      MDS.log("Database initialized in background service");
      
      // Загрузить настройки и начать авто-proof если включен
      loadAutoProofSettings();
    });
  }
  
  // Новый блок - проверить pending proofs
  if (msg.event === "NEWBLOCK") {
    MDS.log("New block detected: " + msg.data.txpow.header.block);
    checkPendingProofs();
  }
  
  // Обновление баланса
  if (msg.event === "NEWBALANCE") {
    MDS.log("Balance updated");
  }
  
  // Таймер каждый час - очистка и обслуживание
  if (msg.event === "MDS_TIMER_1HOUR") {
    MDS.log("Hourly maintenance task");
    performMaintenance();
  }
  
  // Таймер каждые 10 секунд - проверка устройств
  if (msg.event === "MDS_TIMER_10SECONDS") {
    checkDeviceStatus();
  }
  
  // Shutdown
  if (msg.event === "MDS_SHUTDOWN") {
    MDS.log("Trackium Service shutting down");
    stopAllAutoProofs();
  }
  
});

// Загрузить настройки автоматической отправки proofs
function loadAutoProofSettings() {
  if (!db) return;
  
  db.getSetting('auto_proof', (autoProof) => {
    if (autoProof) {
      db.getSetting('proof_frequency', (frequency) => {
        const intervalMinutes = frequency || 60;
        
        // Запустить auto-proof для всех активных устройств
        db.getDevices((devices) => {
          devices.forEach(device => {
            if (device.status === 'online' && device.blockchain_proof) {
              startAutoProof(device.device_id, intervalMinutes);
            }
          });
        });
      });
    }
  });
}

// Начать автоматическую отправку proofs для устройства
function startAutoProof(deviceId, intervalMinutes) {
  // Остановить существующий интервал если есть
  stopAutoProof(deviceId);
  
  MDS.log(`Starting auto-proof for device ${deviceId} every ${intervalMinutes} minutes`);
  
  const interval = setInterval(() => {
    submitAutoProof(deviceId);
  }, intervalMinutes * 60 * 1000);
  
  autoProofIntervals.set(deviceId, interval);
}

// Остановить auto-proof для устройства
function stopAutoProof(deviceId) {
  if (autoProofIntervals.has(deviceId)) {
    clearInterval(autoProofIntervals.get(deviceId));
    autoProofIntervals.delete(deviceId);
    MDS.log(`Auto-proof stopped for device ${deviceId}`);
  }
}

// Остановить все auto-proofs
function stopAllAutoProofs() {
  autoProofIntervals.forEach((interval, deviceId) => {
    clearInterval(interval);
    MDS.log(`Auto-proof stopped for device ${deviceId}`);
  });
  autoProofIntervals.clear();
}

// Отправить автоматический proof
function submitAutoProof(deviceId) {
  if (!db) return;
  
  MDS.log(`Submitting auto-proof for device ${deviceId}`);
  
  // Получить последнюю позицию
  db.getLastPosition(deviceId, (movement) => {
    if (!movement) {
      MDS.log(`No movement data for device ${deviceId}`);
      return;
    }
    
    // Проверить что proof еще не отправлен
    if (movement.proof_submitted) {
      MDS.log(`Proof already submitted for this movement`);
      return;
    }
    
    // Создать хэш данных
    const data = JSON.stringify({
      deviceId: deviceId,
      latitude: movement.latitude,
      longitude: movement.longitude,
      altitude: movement.altitude,
      timestamp: movement.timestamp
    });
    
    MDS.cmd(`hash data:"${data}"`, (hashRes) => {
      if (!hashRes.status) {
        MDS.log(`Failed to create hash for device ${deviceId}`);
        return;
      }
      
      const dataHash = hashRes.response.hash;
      
      // Создать транзакцию
      const txnId = `proof_${deviceId}_${Date.now()}`;
      
      MDS.cmd(`txncreate id:${txnId}`, (res1) => {
        if (!res1.status) {
          MDS.log(`Failed to create transaction`);
          return;
        }
        
        // Получить монету
        MDS.cmd("coins relevant:true", (res2) => {
          if (!res2.status || !res2.response || res2.response.length === 0) {
            MDS.log(`No coins available`);
            return;
          }
          
          const coin = res2.response.find(c => parseFloat(c.amount) >= 0.001 && c.tokenid === "0x00");
          if (!coin) {
            MDS.log(`No suitable coin for proof`);
            return;
          }
          
          // Добавить вход
          MDS.cmd(`txninput id:${txnId} coinid:${coin.coinid}`, (res3) => {
            if (!res3.status) {
              MDS.log(`Failed to add input`);
              return;
            }
            
            // Получить адрес
            MDS.cmd("getaddress", (res4) => {
              if (!res4.status) return;
              
              const address = res4.response.miniaddress;
              
              // Создать state с данными
              const stateStr = `{"0":"${deviceId}","1":"${dataHash}","2":"${movement.latitude}","3":"${movement.longitude}","4":"${Date.now()}"}`;
              
              // Добавить выход
              MDS.cmd(`txnoutput id:${txnId} address:${address} amount:${coin.amount} state:${stateStr}`, (res5) => {
                if (!res5.status) {
                  MDS.log(`Failed to add output`);
                  return;
                }
                
                // Подписать
                MDS.cmd(`txnsign id:${txnId} publickey:auto`, (res6) => {
                  if (!res6.status) return;
                  
                  // Добавить базовые данные
                  MDS.cmd(`txnbasics id:${txnId}`, (res7) => {
                    if (!res7.status) return;
                    
                    // Отправить
                    MDS.cmd(`txnpost id:${txnId}`, (res8) => {
                      if (res8.status) {
                        const txid = res8.response?.txpowid || txnId;
                        
                        MDS.log(`Proof submitted successfully: ${txid}`);
                        
                        // Сохранить proof в базу
                        db.addBlockchainProof({
                          deviceId: deviceId,
                          type: 'movement',
                          proofHash: dataHash,
                          txid: txid,
                          dataHash: dataHash
                        });
                        
                        // Обновить movement
                        db.updateMovementProof(movement.id, txid);
                        
                        // Отправить уведомление
                        MDS.notify(`Proof-of-Movement submitted for device ${deviceId}`);
                      } else {
                        MDS.log(`Failed to post transaction`);
                      }
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

// Проверить pending proofs
function checkPendingProofs() {
  if (!db) return;
  
  // Получить все unverified proofs
  MDS.cmd("status", (statusRes) => {
    if (!statusRes.status) return;
    
    const currentBlock = statusRes.response.chain.block;
    
    // Проверить proofs которые старше 10 блоков
    const sql = `SELECT * FROM blockchain_proofs 
                 WHERE verified = FALSE 
                 ORDER BY timestamp DESC 
                 LIMIT 10`;
    
    MDS.sql(sql, (res) => {
      if (!res.rows || res.rows.length === 0) return;
      
      res.rows.forEach(proof => {
        // Попробовать верифицировать
        if (proof.transaction_id) {
          MDS.cmd(`txpowsearch txpowid:${proof.transaction_id}`, (txRes) => {
            if (txRes.status && txRes.response) {
              // Proof найден на блокчейне - верифицировать
              const blockNum = txRes.response.header.block;
              db.verifyProof(proof.id, blockNum, () => {
                MDS.log(`Proof ${proof.id} verified at block ${blockNum}`);
              });
            }
          });
        }
      });
    });
  });
}

// Проверить статус устройств
function checkDeviceStatus() {
  if (!db) return;
  
  // Получить все онлайн устройства
  const sql = `SELECT * FROM devices WHERE status = 'online'`;
  
  MDS.sql(sql, (res) => {
    if (!res.rows || res.rows.length === 0) return;
    
    const now = new Date();
    
    res.rows.forEach(device => {
      const lastSync = new Date(device.last_sync);
      const minutesSinceSync = (now - lastSync) / (1000 * 60);
      
      // Если устройство не синхронизировалось более 30 минут - пометить как offline
      if (minutesSinceSync > 30) {
        db.updateDeviceStatus(device.device_id, 'offline', () => {
          MDS.log(`Device ${device.device_id} marked as offline (no sync for ${minutesSinceSync.toFixed(0)} minutes)`);
          
          // Добавить событие
          db.addEvent(device.device_id, 'device_timeout', {
            lastSync: device.last_sync,
            minutesInactive: minutesSinceSync.toFixed(0)
          });
        });
      }
    });
  });
}

// Выполнить обслуживание
function performMaintenance() {
  if (!db) return;
  
  MDS.log("Performing maintenance...");
  
  // Удалить старые события (старше 30 дней)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const sql = `DELETE FROM events WHERE timestamp < '${thirtyDaysAgo}'`;
  
  MDS.sql(sql, (res) => {
    if (res.status) {
      MDS.log(`Cleaned up old events: ${res.count || 0} deleted`);
    }
  });
  
  // Проверить устройства с низкой батареей
  const lowBatterySql = `SELECT * FROM devices WHERE battery < 20 AND status = 'online'`;
  
  MDS.sql(lowBatterySql, (res) => {
    if (!res.rows || res.rows.length === 0) return;
    
    res.rows.forEach(device => {
      MDS.notify(`⚠️ Low battery alert: Device ${device.device_name} at ${device.battery}%`);
    });
  });
}

// Обработка команд от основного приложения через comms
MDS.comms.solo(function(msg) {
  MDS.log("Received message: " + JSON.stringify(msg));
  
  if (msg.command === 'start_auto_proof') {
    startAutoProof(msg.deviceId, msg.intervalMinutes || 60);
  } else if (msg.command === 'stop_auto_proof') {
    stopAutoProof(msg.deviceId);
  } else if (msg.command === 'submit_proof') {
    submitAutoProof(msg.deviceId);
  }
});

MDS.log("=== Trackium Background Service Started ===");
MDS.log("Version: 1.0.0");
MDS.log("Ready for GPS tracking and blockchain proofs");
