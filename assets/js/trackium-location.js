#!/usr/bin/env node

/**
 * Trackium Location Service
 * Периодически определяет геолокацию и отправляет в MiniDapp
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ========== CONFIGURATION ==========

const CONFIG = {
  deviceId: process.env.TRACKIUM_DEVICE_ID || null,
  minimaNodeUrl: process.env.MINIMA_NODE_URL || 'http://127.0.0.1:9003',
  updateInterval: parseInt(process.env.UPDATE_INTERVAL) || 180000, // 3 minutes
  dataFile: path.join(__dirname, 'location-data.json'),
  
  // API Keys (бесплатные, без регистрации)
  apis: {
    bigDataCloud: 'https://api.bigdatacloud.net/data/client-info',
    ipApi: 'http://ip-api.com/json/',
    mozilla: 'https://location.services.mozilla.com/v1/geolocate?key=test'
  }
};

// ========== STATE ==========

let currentLocation = null;
let isRunning = false;

// ========== MAIN ==========

console.log('🚀 Trackium Location Service Starting...');
console.log('📍 Version: 1.0.0');
console.log('🔗 Minima Node:', CONFIG.minimaNodeUrl);

// Check device ID
if (!CONFIG.deviceId) {
  console.log('\n⚠️  No Device ID provided!');
  console.log('Please set TRACKIUM_DEVICE_ID environment variable or enter it now:\n');
  
  // Prompt for device ID
  promptForDeviceId().then(deviceId => {
    CONFIG.deviceId = deviceId;
    startService();
  });
} else {
  console.log('📱 Device ID:', CONFIG.deviceId);
  startService();
}

// ========== LOCATION DETECTION ==========

/**
 * Получить геолокацию через различные API
 */
async function detectLocation() {
  console.log('\n🔍 Detecting location...');
  
  // Try BigDataCloud first (best accuracy, no key required)
  try {
    const location = await getBigDataCloudLocation();
    if (location) {
      console.log('✅ Location detected via BigDataCloud');
      return location;
    }
  } catch (err) {
    console.log('❌ BigDataCloud failed:', err.message);
  }
  
  // Fallback to IP-API
  try {
    const location = await getIpApiLocation();
    if (location) {
      console.log('✅ Location detected via IP-API');
      return location;
    }
  } catch (err) {
    console.log('❌ IP-API failed:', err.message);
  }
  
  // Last resort: Mozilla Location Service
  try {
    const location = await getMozillaLocation();
    if (location) {
      console.log('✅ Location detected via Mozilla MLS');
      return location;
    }
  } catch (err) {
    console.log('❌ Mozilla MLS failed:', err.message);
  }
  
  console.log('❌ All location APIs failed');
  return null;
}

/**
 * BigDataCloud Client Info API
 * Лучшая точность для WiFi/Cell
 */
function getBigDataCloudLocation() {
  return new Promise((resolve, reject) => {
    https.get(CONFIG.apis.bigDataCloud, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (json.location && json.location.latitude && json.location.longitude) {
            resolve({
              latitude: json.location.latitude,
              longitude: json.location.longitude,
              accuracy: json.location.accuracyRadius || 1000,
              source: 'bigdatacloud',
              city: json.location.city,
              country: json.location.countryName
            });
          } else {
            reject(new Error('No location in response'));
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

/**
 * IP-API.com
 * Fallback на основе IP
 */
function getIpApiLocation() {
  return new Promise((resolve, reject) => {
    http.get(CONFIG.apis.ipApi, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (json.status === 'success' && json.lat && json.lon) {
            resolve({
              latitude: json.lat,
              longitude: json.lon,
              accuracy: 5000, // IP-based менее точный
              source: 'ip-api',
              city: json.city,
              country: json.country
            });
          } else {
            reject(new Error('Failed to get location'));
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Mozilla Location Service (WiFi-based)
 */
function getMozillaLocation() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      considerIp: true
    });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    
    const req = https.request(CONFIG.apis.mozilla, options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (json.location && json.location.lat && json.location.lng) {
            resolve({
              latitude: json.location.lat,
              longitude: json.location.lng,
              accuracy: json.accuracy || 2000,
              source: 'mozilla-mls'
            });
          } else {
            reject(new Error('No location in response'));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ========== DATA MANAGEMENT ==========

/**
 * Сохранить локацию локально
 */
function saveLocationLocally(location) {
  const data = {
    deviceId: CONFIG.deviceId,
    location: location,
    timestamp: new Date().toISOString(),
    uploaded: false
  };
  
  try {
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify(data, null, 2));
    console.log('💾 Location saved locally');
  } catch (err) {
    console.error('❌ Failed to save location:', err.message);
  }
}

/**
 * Отправить локацию в MiniDapp
 */
async function uploadLocationToMiniDapp(location) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      deviceId: CONFIG.deviceId,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      altitude: 0,
      speed: 0,
      timestamp: new Date().toISOString(),
      source: location.source
    });
    
    const url = new URL(`${CONFIG.minimaNodeUrl}/api/location/update`);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    
    const protocol = url.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('📤 Location uploaded to MiniDapp');
          resolve(true);
        } else {
          console.error('❌ Upload failed:', res.statusCode, data);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ Connection to MiniDapp failed:', err.message);
      reject(err);
    });
    
    req.write(postData);
    req.end();
  });
}

// ========== SERVICE LOOP ==========

/**
 * Основной цикл сервиса
 */
async function serviceLoop() {
  if (!isRunning) return;
  
  try {
    // Detect location
    const location = await detectLocation();
    
    if (location) {
      currentLocation = location;
      
      console.log(`📍 Location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
      console.log(`   Accuracy: ${location.accuracy}m | Source: ${location.source}`);
      
      if (location.city) {
        console.log(`   City: ${location.city}, ${location.country}`);
      }
      
      // Save locally
      saveLocationLocally(location);
      
      // Upload to MiniDapp
      try {
        await uploadLocationToMiniDapp(location);
      } catch (err) {
        console.log('⚠️  Upload failed, will retry next cycle');
      }
    }
    
  } catch (err) {
    console.error('❌ Service loop error:', err.message);
  }
  
  // Schedule next update
  console.log(`\n⏰ Next update in ${CONFIG.updateInterval / 1000} seconds`);
  setTimeout(serviceLoop, CONFIG.updateInterval);
}

/**
 * Запустить сервис
 */
function startService() {
  if (isRunning) return;
  
  console.log('\n✅ Service started successfully!');
  console.log(`🔄 Update interval: ${CONFIG.updateInterval / 1000} seconds`);
  console.log('📱 Device ID:', CONFIG.deviceId);
  console.log('\n💡 Press Ctrl+C to stop\n');
  
  isRunning = true;
  
  // Start immediately
  serviceLoop();
}

/**
 * Остановить сервис
 */
function stopService() {
  console.log('\n\n🛑 Stopping Trackium Location Service...');
  isRunning = false;
  process.exit(0);
}

// ========== UTILITIES ==========

/**
 * Запросить Device ID у пользователя
 */
function promptForDeviceId() {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('Enter Device ID (e.g., TRACK-XXX-YYY): ', (answer) => {
      readline.close();
      resolve(answer.trim());
    });
  });
}

// Handle Ctrl+C
process.on('SIGINT', stopService);
process.on('SIGTERM', stopService);

// Catch errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
  stopService();
});
