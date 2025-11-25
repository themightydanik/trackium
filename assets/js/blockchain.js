// blockchain.js - Улучшенная Minima Blockchain интеграция для Trackium

class TrackiumBlockchain {
  constructor(database) {
    this.db = database;
    this.nodeAddress = null;
    this.nodePublicKey = null;
    this.nodeBalance = null;
    this.proofContractAddress = null;
  }

  // Инициализация
  async init() {
    try {
      console.log("🔗 Initializing blockchain connection...");
      
      // Получить адрес и публичный ключ ноды
      const addressData = await this.getNodeAddress();
      if (!addressData) {
        throw new Error("Failed to get node address");
      }
      
      this.nodeAddress = addressData.address;
      this.nodePublicKey = addressData.publickey;
      console.log("📫 Node address:", this.nodeAddress);
      
      // Получить баланс
      const balance = await this.getBalance();
      this.nodeBalance = balance.sendable;
      console.log("💰 Balance:", this.nodeBalance, "Minima");
      
      // Создать/загрузить контракт для Proof-of-Movement
      await this.initProofContract();
      
      return true;
    } catch (error) {
      console.error('❌ Blockchain init error:', error);
      return false;
    }
  }

  // Инициализировать контракт Proof-of-Movement
  async initProofContract() {
    try {
      const script = `
        LET deviceId = STATE(0)
        LET movementHash = STATE(1)
        LET timestamp = STATE(2)
        LET ownerKey = STATE(3)
        
        IF SIGNEDBY(ownerKey) THEN 
          RETURN TRUE 
        ENDIF
        
        IF @COINAGE GT 0 THEN
          ASSERT SAMESTATE(0 2)
          RETURN TRUE
        ENDIF
        
        RETURN FALSE
      `;
      
      const result = await new Promise((resolve, reject) => {
        MDS.cmd(`newscript trackall:true script:"${script}"`, (res) => {
          if (res.status) {
            resolve(res.response);
          } else {
            reject(new Error('Failed to create contract'));
          }
        });
      });
      
      this.proofContractAddress = result.miniaddress;
      console.log("📜 Proof contract address:", this.proofContractAddress);
      
      return this.proofContractAddress;
      
    } catch (error) {
      console.error('Failed to init proof contract:', error);
      return null;
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
          if (minimaToken) {
            resolve({
              confirmed: parseFloat(minimaToken.confirmed),
              unconfirmed: parseFloat(minimaToken.unconfirmed),
              sendable: parseFloat(minimaToken.sendable)
            });
          } else {
            resolve({ confirmed: 0, unconfirmed: 0, sendable: 0 });
          }
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
      MDS.cmd(`hash data:"${this._escape(data)}"`, (res) => {
        if (res.status) {
          resolve(res.response.hash);
        } else {
          console.error("Hash creation failed:", res.error);
          resolve(null);
        }
      });
    });
  }

  // Отправить proof-of-movement на блокчейн (УЛУЧШЕННАЯ ВЕРСИЯ)
  async submitProofOfMovement(deviceId, movementData) {
    try {
      console.log('📤 Submitting proof for device:', deviceId);

      // 1. Создать хэш данных
      const dataHash = await this.createMovementHash(movementData);
      if (!dataHash) {
        throw new Error('Failed to create data hash');
      }
      console.log('🔐 Data hash:', dataHash);

      // 2. Проверить баланс
      const balance = await this.getBalance();
      if (balance.sendable < 0.001) {
        throw new Error('Insufficient balance for proof submission');
      }

      // 3. Создать транзакцию
      const txnId = `proof_${deviceId}_${Date.now()}`;
      
      await this._execCmd(`txncreate id:${txnId}`);
      console.log('✅ Transaction created');

      // 4. Получить монету
      const coins = await new Promise((resolve) => {
        MDS.cmd("coins relevant:true", (res) => {
          resolve(res.response || []);
        });
      });

      const coin = coins.find(c => 
        parseFloat(c.amount) >= 0.001 && 
        c.tokenid === "0x00" &&
        !c.spent
      );
      
      if (!coin) {
        throw new Error('No suitable coin found');
      }
      console.log('💰 Using coin:', coin.coinid);

      // 5. Добавить вход
      await this._execCmd(`txninput id:${txnId} coinid:${coin.coinid} scriptmmr:true`);

      // 6. Создать state с данными
      const stateData = {
        "0": deviceId,
        "1": dataHash,
        "2": Date.now().toString(),
        "3": this.nodePublicKey
      };
      
      const stateStr = JSON.stringify(stateData).replace(/"/g, '\\"');

      // 7. Добавить выход (используем контракт если есть)
      const outputAddress = this.proofContractAddress || this.nodeAddress;
      const amount = parseFloat(coin.amount) - 0.0001; // Небольшой burn для приоритета
      
      await this._execCmd(
        `txnoutput id:${txnId} address:${outputAddress} amount:${amount} state:"${stateStr}"`
      );
      console.log('✅ Output added');

      // 8. Подписать
      await this._execCmd(`txnsign id:${txnId} publickey:auto`);
      console.log('✅ Transaction signed');

      // 9. Добавить MMR proofs
      await this._execCmd(`txnbasics id:${txnId}`);
      console.log('✅ Proofs added');

      // 10. Отправить транзакцию
      const postResult = await new Promise((resolve, reject) => {
        MDS.cmd(`txnpost id:${txnId}`, (res) => {
          if (res.status) {
            resolve(res.response);
          } else {
            reject(new Error(res.error || 'Failed to post transaction'));
          }
        });
      });

      const txid = postResult.txpowid || txnId;
      console.log('✅ Proof submitted! TXID:', txid);

      // 11. Сохранить в базу
      this.db.addBlockchainProof({
        deviceId: deviceId,
        type: 'movement',
        proofHash: dataHash,
        txid: txid,
        dataHash: dataHash
      });

      return {
        txid: txid,
        dataHash: dataHash,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('❌ Error submitting proof:', error);
      return null;
    }
  }

  // Верифицировать proof на блокчейне
  async verifyProof(proofHash, txid) {
    try {
      console.log('🔍 Verifying proof:', proofHash);

      const txData = await new Promise((resolve) => {
        MDS.cmd(`txpowsearch txpowid:${txid}`, (res) => {
          resolve(res.status ? res.response : null);
        });
      });

      if (!txData) {
        console.log('⏳ Transaction not found on chain yet');
        return false;
      }

      // Проверить state в outputs
      const outputs = txData.body?.txn?.outputs || [];
      for (const output of outputs) {
        if (output.state) {
          // STATE хранится как массив объектов с port и data
          const stateArray = Array.isArray(output.state) ? output.state : [];
          const hashState = stateArray.find(s => s.port === 1);
          
          if (hashState && hashState.data === proofHash) {
            console.log('✅ Proof verified successfully!');
            return true;
          }
        }
      }

      console.log('❌ Proof hash not found in transaction');
      return false;

    } catch (error) {
      console.error('❌ Error verifying proof:', error);
      return false;
    }
  }

  // ========== SMART LOCK CONTRACT ==========

  // Создать контракт smart lock
  async createSmartLockContract(deviceId) {
    try {
      const script = `
        LET deviceId = STATE(0)
        LET lockStatus = STATE(1)
        LET ownerKey = STATE(2)
        LET unlockHash = STATE(3)
        
        IF SIGNEDBY(ownerKey) THEN 
          RETURN TRUE 
        ENDIF
        
        IF lockStatus EQ TRUE AND SHA3(STATE(4)) EQ unlockHash THEN
          ASSERT STATE(1) EQ FALSE
          RETURN TRUE
        ENDIF
        
        IF @COINAGE GT 288 THEN
          RETURN TRUE
        ENDIF
        
        RETURN FALSE
      `;

      const result = await new Promise((resolve, reject) => {
        MDS.cmd(`newscript trackall:true script:"${script}"`, (res) => {
          if (res.status) {
            resolve({
              address: res.response.miniaddress,
              script: res.response.script
            });
          } else {
            reject(new Error('Failed to create lock contract'));
          }
        });
      });

      console.log('🔒 Smart lock contract created:', result.address);
      return result;

    } catch (error) {
      console.error('Error creating lock contract:', error);
      return null;
    }
  }

  // ========== SHIPMENT DELIVERY CONTRACT ==========

  // Создать контракт доставки
  async createDeliveryContract(shipmentData) {
    try {
      const script = `
        LET shipmentId = STATE(0)
        LET recipientKey = STATE(1)
        LET senderKey = STATE(2)
        LET destinationHash = STATE(3)
        
        IF SIGNEDBY(senderKey) AND @COINAGE LT 10 THEN
          RETURN TRUE
        ENDIF
        
        IF SIGNEDBY(recipientKey) AND SHA3(STATE(4)) EQ destinationHash THEN
          RETURN TRUE
        ENDIF
        
        IF @COINAGE GT 43200 AND SIGNEDBY(senderKey) THEN
          RETURN TRUE
        ENDIF
        
        RETURN FALSE
      `;

      const result = await new Promise((resolve, reject) => {
        MDS.cmd(`newscript trackall:true script:"${script}"`, (res) => {
          if (res.status) {
            resolve({
              address: res.response.miniaddress,
              script: res.response.script
            });
          } else {
            reject(new Error('Failed to create delivery contract'));
          }
        });
      });

      console.log('📦 Delivery contract created:', result.address);
      return result;

    } catch (error) {
      console.error('Error creating delivery contract:', error);
      return null;
    }
  }

  // ========== HELPER FUNCTIONS ==========

  // Выполнить команду с промисом
  _execCmd(command) {
    return new Promise((resolve, reject) => {
      MDS.cmd(command, (res) => {
        if (res.status) {
          resolve(res.response);
        } else {
          reject(new Error(res.error || `Command failed: ${command}`));
        }
      });
    });
  }

  // Escape строки для SQL/команд
  _escape(str) {
    return String(str).replace(/"/g, '\\"').replace(/'/g, "\\'");
  }

  // Получить информацию о блокчейне
  getBlockchainInfo() {
    return {
      nodeAddress: this.nodeAddress,
      nodePublicKey: this.nodePublicKey,
      balance: this.nodeBalance,
      proofContractAddress: this.proofContractAddress
    };
  }

  // Автоматическая отправка proofs
  startAutoProofSubmission(deviceId, intervalMinutes = 60) {
    console.log(`⏰ Starting auto-proof for ${deviceId} every ${intervalMinutes}min`);

    const interval = setInterval(async () => {
      this.db.getLastPosition(deviceId, async (movement) => {
        if (movement && !movement.proof_submitted) {
          console.log(`🔄 Auto-submitting proof for ${deviceId}`);
          const result = await this.submitProofOfMovement(deviceId, movement);
          
          if (result) {
            this.db.updateMovementProof(movement.id, result.txid);
          }
        }
      });
    }, intervalMinutes * 60 * 1000);

    return interval;
  }

  stopAutoProofSubmission(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
      console.log('⏹️ Auto-proof submission stopped');
    }
  }
}

globalThis.TrackiumBlockchain = TrackiumBlockchain;
