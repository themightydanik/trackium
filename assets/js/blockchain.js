// blockchain.js - Minima Blockchain интеграция для Trackium

class TrackiumBlockchain {
  constructor(database) {
    this.db = database;
    this.nodeAddress = null;
    this.nodeBalance = null;
  }

  // Инициализация
  async init() {
    try {
      // Получить адрес ноды
      const addressData = await this.getNodeAddress();
      this.nodeAddress = addressData.address;
      
      // Получить баланс
      const balance = await this.getBalance();
      this.nodeBalance = balance.sendable;
      
      console.log('Blockchain initialized:', this.nodeAddress);
      return true;
    } catch (error) {
      console.error('Blockchain init error:', error);
      return false;
    }
  }

  // Получить адрес ноды
  getNodeAddress() {
    return new Promise((resolve) => {
      MDS.cmd("getaddress", (res) => {
        if (res.status) {
          resolve({
            address: res.response.miniaddress,
            publickey: res.response.publickey
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  // Получить баланс
  getBalance() {
    return new Promise((resolve) => {
      MDS.cmd("balance", (res) => {
        if (res.status) {
          const minimaToken = res.response.find(t => t.token === "Minima");
          resolve({
            confirmed: parseFloat(minimaToken.confirmed),
            unconfirmed: parseFloat(minimaToken.unconfirmed),
            sendable: parseFloat(minimaToken.sendable)
          });
        } else {
          resolve({ confirmed: 0, unconfirmed: 0, sendable: 0 });
        }
      });
    });
  }

  // Получить текущий блок
  getCurrentBlock() {
    return new Promise((resolve) => {
      MDS.cmd("status", (res) => {
        if (res.status) {
          resolve({
            block: res.response.chain.block,
            time: res.response.chain.time
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  // ========== PROOF-OF-MOVEMENT ==========

  // Создать хэш данных движения
  createMovementHash(movementData) {
    const data = JSON.stringify({
      deviceId: movementData.deviceId,
      latitude: movementData.latitude,
      longitude: movementData.longitude,
      altitude: movementData.altitude,
      timestamp: movementData.timestamp || new Date().toISOString()
    });

    return new Promise((resolve) => {
      MDS.cmd(`hash data:"${data}"`, (res) => {
        if (res.status) {
          resolve(res.response.hash);
        } else {
          resolve(null);
        }
      });
    });
  }

  // Отправить proof-of-movement на блокчейн
  async submitProofOfMovement(deviceId, movementData) {
    try {
      console.log('Submitting proof-of-movement for device:', deviceId);

      // Создать хэш данных
      const dataHash = await this.createMovementHash(movementData);
      if (!dataHash) {
        throw new Error('Failed to create data hash');
      }

      // Создать транзакцию с данными в state
      const txnId = `proof_${deviceId}_${Date.now()}`;
      
      // Создаем транзакцию
      await new Promise((resolve, reject) => {
        MDS.cmd(`txncreate id:${txnId}`, (res) => {
          if (res.status) resolve();
          else reject(new Error('Failed to create transaction'));
        });
      });

      // Получаем монету для использования
      const coins = await new Promise((resolve) => {
        MDS.cmd("coins relevant:true", (res) => {
          resolve(res.response || []);
        });
      });

      const coin = coins.find(c => parseFloat(c.amount) >= 0.001 && c.tokenid === "0x00");
      if (!coin) {
        throw new Error('No suitable coin for proof submission');
      }

      // Добавляем вход
      await new Promise((resolve, reject) => {
        MDS.cmd(`txninput id:${txnId} coinid:${coin.coinid}`, (res) => {
          if (res.status) resolve();
          else reject(new Error('Failed to add input'));
        });
      });

      // Добавляем выход с данными в state
      const stateData = {
        0: deviceId,                           // Device ID
        1: dataHash,                           // Data hash
        2: movementData.latitude.toString(),  // Latitude
        3: movementData.longitude.toString(), // Longitude
        4: Date.now().toString()              // Timestamp
      };

      const stateStr = JSON.stringify(stateData).replace(/"/g, '\\"');

      await new Promise((resolve, reject) => {
        MDS.cmd(`txnoutput id:${txnId} address:${this.nodeAddress} amount:${coin.amount} state:${stateStr}`, (res) => {
          if (res.status) resolve();
          else reject(new Error('Failed to add output'));
        });
      });

      // Подписываем
      await new Promise((resolve, reject) => {
        MDS.cmd(`txnsign id:${txnId} publickey:auto`, (res) => {
          if (res.status) resolve();
          else reject(new Error('Failed to sign transaction'));
        });
      });

      // Добавляем базовые данные
      await new Promise((resolve, reject) => {
        MDS.cmd(`txnbasics id:${txnId}`, (res) => {
          if (res.status) resolve();
          else reject(new Error('Failed to add basics'));
        });
      });

      // Отправляем
      const result = await new Promise((resolve, reject) => {
        MDS.cmd(`txnpost id:${txnId}`, (res) => {
          if (res.status) {
            resolve({
              txid: res.response.txpowid || txnId,
              dataHash: dataHash
            });
          } else {
            reject(new Error('Failed to post transaction'));
          }
        });
      });

      // Сохранить proof в базу
      this.db.addBlockchainProof({
        deviceId: deviceId,
        type: 'movement',
        proofHash: dataHash,
        txid: result.txid,
        dataHash: dataHash
      });

      console.log('Proof submitted successfully:', result.txid);
      return result;

    } catch (error) {
      console.error('Error submitting proof:', error);
      return null;
    }
  }

  // Верифицировать proof на блокчейне
  async verifyProof(proofHash, txid) {
    try {
      console.log('Verifying proof:', proofHash);

      // Получить транзакцию
      const txData = await new Promise((resolve) => {
        MDS.cmd(`txpowsearch txpowid:${txid}`, (res) => {
          resolve(res.status ? res.response : null);
        });
      });

      if (!txData) {
        console.log('Transaction not found on chain yet');
        return false;
      }

      // Проверить что proof hash в state
      const outputs = txData.body.txn.outputs;
      for (const output of outputs) {
        if (output.state) {
          const stateData = output.state;
          if (stateData[1] === proofHash) {
            console.log('Proof verified successfully!');
            return true;
          }
        }
      }

      return false;

    } catch (error) {
      console.error('Error verifying proof:', error);
      return false;
    }
  }

  // Автоматическая отправка proofs каждые N минут
  startAutoProofSubmission(deviceId, intervalMinutes = 60) {
    console.log(`Starting auto-proof for device ${deviceId} every ${intervalMinutes} minutes`);

    const interval = setInterval(async () => {
      // Получить последнюю позицию
      this.db.getLastPosition(deviceId, async (movement) => {
        if (movement && !movement.proof_submitted) {
          const result = await this.submitProofOfMovement(deviceId, movement);
          
          if (result) {
            // Обновить запись движения
            this.db.updateMovementProof(movement.id, result.txid);
          }
        }
      });
    }, intervalMinutes * 60 * 1000);

    return interval;
  }

  // Остановить автоматическую отправку
  stopAutoProofSubmission(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
      console.log('Auto-proof submission stopped');
    }
  }

  // ========== SMART CONTRACT FUNCTIONS ==========

  // Создать смарт-контракт для secure delivery
  async createDeliveryContract(shipmentData) {
    const script = `
      LET deviceId = STATE(0)
      LET destinationHash = STATE(1)
      LET recipient = STATE(2)
      
      IF SIGNEDBY(recipient) AND SHA3(STATE(3)) EQ destinationHash THEN
        RETURN TRUE
      ENDIF
      
      IF @COINAGE GT 288 AND SIGNEDBY(${this.nodeAddress}) THEN
        RETURN TRUE
      ENDIF
      
      RETURN FALSE
    `;

    try {
      const result = await new Promise((resolve, reject) => {
        MDS.cmd(`newscript trackall:true script:"${script}"`, (res) => {
          if (res.status) {
            resolve({
              address: res.response.miniaddress,
              script: res.response.script
            });
          } else {
            reject(new Error('Failed to create contract'));
          }
        });
      });

      console.log('Delivery contract created:', result.address);
      return result;

    } catch (error) {
      console.error('Error creating contract:', error);
      return null;
    }
  }

  // Получить информацию о блокчейне
  getBlockchainInfo() {
    return {
      nodeAddress: this.nodeAddress,
      balance: this.nodeBalance
    };
  }
}

// Экспорт
window.TrackiumBlockchain = TrackiumBlockchain;
