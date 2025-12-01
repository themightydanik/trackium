// analytics.js - Analytics Charts for Trackium

function loadAnalytics() {
  if (!window.db) {
    console.error('Database not available');
    return;
  }
  
  // Получить все устройства
  window.db.getDevices((devices) => {
    if (devices.length === 0) {
      showNoDevicesMessage();
      return;
    }
    
    // Показать селектор устройств
    renderDeviceSelector(devices);
    
    // Загрузить данные для первого устройства
    const firstDevice = devices[0];
    loadDeviceAnalytics(firstDevice.device_id || firstDevice.DEVICE_ID || firstDevice.deviceId);
  });
}

function renderDeviceSelector(devices) {
  const container = document.querySelector('.analytics-container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="section">
      <h3>Select Device</h3>
      <select id="analytics-device-select" class="form-input" onchange="loadDeviceAnalytics(this.value)">
        ${devices.map(d => {
          const id = d.device_id || d.DEVICE_ID || d.deviceId;
          const name = d.device_name || d.DEVICE_NAME || d.deviceName || id;
          return `<option value="${id}">${name}</option>`;
        }).join('')}
      </select>
    </div>
    
    <div class="section">
      <h3>Distance Traveled Over Time</h3>
      <canvas id="distance-chart" style="max-height: 400px;"></canvas>
    </div>
    
    <div class="section">
      <h3>Device Activity</h3>
      <canvas id="activity-chart" style="max-height: 300px;"></canvas>
    </div>
  `;
}

function loadDeviceAnalytics(deviceId) {
  console.log('📊 Loading analytics for:', deviceId);
  
  // Получить историю движений
  window.db.getMovementHistory(deviceId, 1000, (movements) => {
    if (movements.length === 0) {
      showNoDataMessage();
      return;
    }
    
    renderDistanceChart(movements);
    renderActivityChart(deviceId, movements);
  });
}

function renderDistanceChart(movements) {
  const canvas = document.getElementById('distance-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Рассчитать кумулятивное расстояние
  let totalDistance = 0;
  const dataPoints = [];
  
  for (let i = 1; i < movements.length; i++) {
    const prev = movements[i - 1];
    const curr = movements[i];
    
    const dist = calculateDistance(
      prev.latitude || prev.LATITUDE,
      prev.longitude || prev.LONGITUDE,
      curr.latitude || curr.LATITUDE,
      curr.longitude || curr.LONGITUDE
    );
    
    totalDistance += dist;
    
    dataPoints.push({
      x: new Date(curr.recorded_at || curr.RECORDED_AT),
      y: (totalDistance / 1000).toFixed(2) // км
    });
  }
  
  // Простой график с Canvas API
  drawChart(ctx, dataPoints);
}

function drawChart(ctx, dataPoints) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  
  // Очистить canvas
  ctx.clearRect(0, 0, width, height);
  
  if (dataPoints.length === 0) return;
  
  // Найти мин/макс
  const maxY = Math.max(...dataPoints.map(p => parseFloat(p.y)));
  const minY = 0;
  
  // Настройки
  const padding = 40;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;
  
  // Фон
  ctx.fillStyle = '#1a1f35';
  ctx.fillRect(0, 0, width, height);
  
  // Сетка
  ctx.strokeStyle = '#4A4D55';
  ctx.lineWidth = 1;
  
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }
  
  // График
  ctx.strokeStyle = '#0066CC';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  dataPoints.forEach((point, i) => {
    const x = padding + (chartWidth / (dataPoints.length - 1)) * i;
    const y = height - padding - ((point.y - minY) / (maxY - minY)) * chartHeight;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // Точки
  ctx.fillStyle = '#00A86B';
  dataPoints.forEach((point, i) => {
    const x = padding + (chartWidth / (dataPoints.length - 1)) * i;
    const y = height - padding - ((point.y - minY) / (maxY - minY)) * chartHeight;
    
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Подписи
  ctx.fillStyle = '#B0B3B8';
  ctx.font = '12px Arial';
  ctx.fillText('0 km', 5, height - padding + 20);
  ctx.fillText(maxY.toFixed(1) + ' km', 5, padding - 10);
}

function renderActivityChart(deviceId, movements) {
  // Группировать по дням
  const byDay = {};
  
  movements.forEach(m => {
    const date = new Date(m.recorded_at || m.RECORDED_AT).toLocaleDateString();
    byDay[date] = (byDay[date] || 0) + 1;
  });
  
  const canvas = document.getElementById('activity-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const days = Object.keys(byDay).slice(-7); // Последние 7 дней
  const counts = days.map(d => byDay[d]);
  
  // Простой bar chart
  drawBarChart(ctx, days, counts);
}

function drawBarChart(ctx, labels, data) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  
  ctx.clearRect(0, 0, width, height);
  
  const padding = 40;
  const barWidth = (width - 2 * padding) / data.length - 10;
  const maxValue = Math.max(...data);
  
  // Фон
  ctx.fillStyle = '#1a1f35';
  ctx.fillRect(0, 0, width, height);
  
  // Бары
  data.forEach((value, i) => {
    const barHeight = ((height - 2 * padding) / maxValue) * value;
    const x = padding + i * (barWidth + 10);
    const y = height - padding - barHeight;
    
    ctx.fillStyle = '#0066CC';
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Подпись
    ctx.fillStyle = '#B0B3B8';
    ctx.font = '10px Arial';
    ctx.save();
    ctx.translate(x + barWidth / 2, height - padding + 15);
    ctx.rotate(-Math.PI / 4);
    ctx.fillText(labels[i], 0, 0);
    ctx.restore();
  });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
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

function showNoDevicesMessage() {
  const container = document.querySelector('.analytics-container');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 100px 20px;">
        <h3>No Devices Available</h3>
        <p style="color: var(--text-secondary);">Add devices to see analytics</p>
      </div>
    `;
  }
}

function showNoDataMessage() {
  const container = document.querySelector('.analytics-container');
  if (container) {
    container.innerHTML += `
      <div style="text-align: center; padding: 50px;">
        <p style="color: var(--text-secondary);">No movement data available for this device</p>
      </div>
    `;
  }
}

window.loadAnalytics = loadAnalytics;
console.log('✅ analytics.js loaded');
