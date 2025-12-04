// ======================================
// location-sync.js — HTTP PULL from Android Companion
// MiniDapp сам опрашивает локальный API Android-приложения
// и сохраняет локацию в локальную БД Trackium.
// ======================================

(function() {

    // 🛰 Локальный HTTP-сервер в Android-компаньоне
    // См. LocalHttpServer.kt — там должен быть endpoint /latest
    var ANDROID_API_URL = "http://127.0.0.1:8132/latest";

    // ⏱ интервал опроса (3 минуты)
    var POLL_INTERVAL_MS = 3 * 60 * 1000;

    var pollTimer = null;

    function log(msg) {
        try {
            console.log(msg);
        } catch (e) {}

        try {
            if (typeof MDS !== "undefined" && MDS.log) {
                MDS.log(msg);
            }
        } catch (e2) {}
    }

    // ==============================
    // Вспомогательные: HTTP GET
    // ==============================
    function fetchLatestLocation(callback) {
        // Используем стандартный fetch из WebView
        log("🔄 Fetching latest location from Android: " + ANDROID_API_URL);

        fetch(ANDROID_API_URL, {
            method: "GET"
        })
            .then(function(res) {
                if (!res.ok) {
                    log("❌ Android API HTTP " + res.status);
                    callback(null);
                    return null;
                }
                return res.json();
            })
            .then(function(data) {
                if (!data) {
                    callback(null);
                    return;
                }

                log("📨 Android API payload: " + JSON.stringify(data));
                callback(data);
            })
            .catch(function(err) {
                log("❌ Fetch failed: " + err);
                callback(null);
            });
    }

    // ==============================
    // Сохранение данных в БД MiniDapp
    // ==============================
    function saveLocationToDatabase(loc) {
        var deviceId = (loc.deviceId || "UNKNOWN").toString().replace(/'/g, "''");
        var lat = Number(loc.latitude) || 0;
        var lon = Number(loc.longitude) || 0;
        var acc = Number(loc.accuracy || 0);
        var batt = Number(loc.battery || 0);
        var ts = loc.timestamp || Date.now();

        log("📍 Saving location for " + deviceId + " → DB");

        // 1) movements
        var sqlMov =
            "INSERT INTO movements " +
            "(device_id, latitude, longitude, altitude, speed, accuracy, timestamp) " +
            "VALUES (" +
            "'" + deviceId + "', " +
            lat + ", " +
            lon + ", " +
            "0, " +                 // altitude
            "0, " +                 // speed
            acc + ", " +
            ts +
            ");";

        MDS.sql(sqlMov, function(res) {
            if (!res.status) {
                log("❌ movements insert failed: " + res.error);
            } else {
                log("✅ Movement row inserted for " + deviceId);
            }
        });

        // 2) device_registry — базовая карточка устройства
        var sqlReg =
            "INSERT OR IGNORE INTO device_registry (id, name, description, type) " +
            "VALUES (" +
            "'" + deviceId + "', " +
            "'" + deviceId + "', " +
            "'Tracked device', " +
            "'tracker'" +
            ");";

        MDS.sql(sqlReg, function(res) {
            if (!res.status) {
                log("⚠️ device_registry insert failed (maybe OK): " + res.error);
            }
        });

        // 3) device_states — используется UI в списке устройств
        var sqlState =
            "INSERT OR REPLACE INTO device_states (id, status, battery, last_sync) " +
            "VALUES (" +
            "'" + deviceId + "', " +
            "'online', " +
            batt + ", " +
            "CURRENT_TIMESTAMP" +
            ");";

        MDS.sql(sqlState, function(res) {
            if (!res.status) {
                log("⚠️ device_states upsert failed: " + res.error);
            } else {
                log("✅ device_states updated for " + deviceId);
            }
        });

        // 4) device_metadata — расширенная инфа для UI
        var metaObj = {
            accuracy: acc,
            source: loc.source || "android",
            last_lat: lat,
            last_lon: lon,
            last_update: ts
        };

        var metaJson = JSON.stringify(metaObj).replace(/'/g, "''");

        var sqlMeta =
            "INSERT OR REPLACE INTO device_metadata (id, meta) " +
            "VALUES (" +
            "'" + deviceId + "', " +
            "'" + metaJson + "'" +
            ");";

        MDS.sql(sqlMeta, function(res) {
            if (!res.status) {
                log("⚠️ device_metadata upsert failed: " + res.error);
            } else {
                log("✅ device_metadata updated for " + deviceId);
            }
        });
    }

    // ==============================
    // (опционально) Proof в блокчейн
    // ==============================
    var ENABLE_CHAIN_TX = false; // можно включить позже

    function createBlockchainTx(loc) {
        if (!ENABLE_CHAIN_TX) return;

        try {
            var payload = JSON.stringify({
                deviceId: loc.deviceId,
                lat: loc.latitude,
                lon: loc.longitude,
                accuracy: loc.accuracy || 0,
                battery: loc.battery || 0,
                ts: loc.timestamp || Date.now()
            }).replace(/"/g, '\\"');

            log("⛓️ Creating blockchain TX for " + loc.deviceId);

            MDS.cmd("txncreate id:trackium_loc", function(res1) {
                if (!res1.status) {
                    log("❌ txncreate failed: " + res1.error);
                    return;
                }

                MDS.cmd('txnadddata id:trackium_loc data:"' + payload + '"', function(res2) {
                    if (!res2.status) {
                        log("❌ txnadddata failed: " + res2.error);
                        return;
                    }

                    MDS.cmd("txnsign id:trackium_loc", function(res3) {
                        if (!res3.status) {
                            log("❌ txnsign failed: " + res3.error);
                            return;
                        }

                        MDS.cmd("txnpost id:trackium_loc", function(res4) {
                            if (!res4.status) {
                                log("❌ txnpost failed: " + res4.error);
                            } else {
                                log("✅ Blockchain TX posted for " + loc.deviceId);
                            }
                        });
                    });
                });
            });
        } catch (e) {
            log("❌ createBlockchainTx error: " + e);
        }
    }

    // ==============================
    // Один цикл: забрать → сохранить
    // ==============================
    function pollOnce() {
        fetchLatestLocation(function(loc) {
            if (!loc) {
                log("⚠️ No location data from Android (yet)");
                return;
            }

            if (!loc.deviceId) {
                log("⚠️ Missing deviceId in payload: " + JSON.stringify(loc));
                return;
            }

            saveLocationToDatabase(loc);
            createBlockchainTx(loc);

            // Если открыт UI по этому девайсу — можно мягко обновить
            try {
                if (typeof window !== "undefined") {
                    // Например, если есть глобальный helper
                    if (window.refreshDevicePosition && window.currentDeviceId === loc.deviceId) {
                        window.refreshDevicePosition(loc.deviceId);
                    }
                }
            } catch (e) {
                // не критично
            }
        });
    }

    // ==============================
    // Инициализация
    // ==============================
    MDS.init(function() {
        log("📡 Trackium Location Sync initialized (HTTP pull mode)");

        // Немедленный первый опрос
        pollOnce();

        // Периодический опрос
        pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);

        // Экспорт в window для ручного дебага
        try {
            if (typeof window !== "undefined") {
                window.TrackiumLocationSync = {
                    pollOnce: pollOnce
                };
            }
        } catch (e) {}
    });

})();
