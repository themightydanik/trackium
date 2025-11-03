// qr-generator.js - QR Code генерация для unlock

class QRGenerator {
  constructor() {
    this.activeQRCodes = new Map(); // code -> { deviceId, expiresAt }
  }

  // Генерировать unlock token
  generateUnlockToken(deviceId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const data = `${deviceId}:${timestamp}:${random}`;
    
    return this.hashString(data);
  }

  // Простой хэш функция
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).toUpperCase();
  }

  // Создать QR данные для unlock
  createUnlockQR(deviceId, validityMinutes = 5) {
    const token = this.generateUnlockToken(deviceId);
    const expiresAt = Date.now() + (validityMinutes * 60 * 1000);
    
    const qrData = {
      type: 'trackium_unlock',
      deviceId: deviceId,
      token: token,
      expiresAt: expiresAt,
      timestamp: Date.now()
    };

    // Сохранить активный QR код
    this.activeQRCodes.set(token, {
      deviceId: deviceId,
      expiresAt: expiresAt
    });

    // Автоматически удалить после истечения
    setTimeout(() => {
      this.activeQRCodes.delete(token);
    }, validityMinutes * 60 * 1000);

    return JSON.stringify(qrData);
  }

  // Валидировать QR код
  validateQR(qrDataString) {
    try {
      const qrData = JSON.parse(qrDataString);
      
      // Проверка типа
      if (qrData.type !== 'trackium_unlock') {
        return { valid: false, reason: 'Invalid QR type' };
      }

      // Проверка наличия токена
      if (!this.activeQRCodes.has(qrData.token)) {
        return { valid: false, reason: 'QR code not found or expired' };
      }

      // Проверка срока действия
      const qrInfo = this.activeQRCodes.get(qrData.token);
      if (Date.now() > qrInfo.expiresAt) {
        this.activeQRCodes.delete(qrData.token);
        return { valid: false, reason: 'QR code expired' };
      }

      // QR валиден
      return {
        valid: true,
        deviceId: qrInfo.deviceId
      };

    } catch (error) {
      return { valid: false, reason: 'Invalid QR format' };
    }
  }

  // Отобразить QR код (используя библиотеку или ASCII)
  async renderQR(qrData, container) {
    // Пытаемся использовать QRCode.js если доступна
    if (typeof QRCode !== 'undefined') {
      // Очистить контейнер
      container.innerHTML = '';
      
      // Создать QR код
      new QRCode(container, {
        text: qrData,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    } else {
      // Fallback к текстовому QR
      this.renderTextQR(qrData, container);
    }
  }

  // Альтернативный текстовый QR (fallback)
  renderTextQR(qrData, container) {
    container.innerHTML = `
      <div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">📱</div>
        <p style="color: black; font-size: 12px; word-break: break-all; font-family: monospace;">
          ${qrData}
        </p>
        <p style="color: #666; font-size: 10px; margin-top: 10px;">
          Scan with QR reader or copy code manually
        </p>
      </div>
    `;
  }

  // Создать QR для shipment tracking
  createTrackingQR(shipmentId) {
    const qrData = {
      type: 'trackium_tracking',
      shipmentId: shipmentId,
      timestamp: Date.now()
    };

    return JSON.stringify(qrData);
  }

  // Создать QR для device registration
  createRegistrationQR(deviceId, deviceKey) {
    const qrData = {
      type: 'trackium_registration',
      deviceId: deviceId,
      key: deviceKey,
      timestamp: Date.now()
    };

    return JSON.stringify(qrData);
  }

  // Получить активные QR коды
  getActiveQRCodes() {
    const now = Date.now();
    const active = [];

    this.activeQRCodes.forEach((value, token) => {
      if (value.expiresAt > now) {
        active.push({
          token: token,
          deviceId: value.deviceId,
          expiresIn: Math.floor((value.expiresAt - now) / 1000)
        });
      }
    });

    return active;
  }

  // Очистить истекшие QR коды
  cleanupExpiredQRs() {
    const now = Date.now();
    
    this.activeQRCodes.forEach((value, token) => {
      if (value.expiresAt <= now) {
        this.activeQRCodes.delete(token);
      }
    });
  }
}

// Экспорт
window.QRGenerator = QRGenerator;
