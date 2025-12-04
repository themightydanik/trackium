// ======================================================
// device-manager.js (Android Pull Mode — FINAL VERSION)
// ======================================================

class DeviceManager {
    constructor(database) {
        this.db = database;
        console.log("📡 DeviceManager (Android Pull Mode) loaded");
    }

    // -------------------------------------------
    //  DEVICE REGISTRATION
    // -------------------------------------------
    generateDeviceId() {
        const prefix = "TRACK";
        const timestamp = Date.now().toString(36).toUpperCase();
        const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${timestamp}-${rnd}`;
    }

    _escape(str) {
        return String(str || "").replace(/'/g, "''");
    }

    async registerDevice(deviceData) {
        try {
            const device = {
                deviceId: deviceData.deviceId || this.generateDeviceId(),
                name: deviceData.name,
                type: deviceData.type,
                transportType: deviceData.transportType || "ground",
                category: deviceData.category || "",
                location: deviceData.location || "",
                blockchainProof: deviceData.blockchainProof ? 1 : 0
            };

            console.log("📝 Registering device:", device);

            await this.db.sqlPromise(`
                INSERT INTO devices 
                (device_id, device_name, device_type, transport_type, category, location, blockchain_proof, status)
                VALUES (
                    '${device.deviceId}', 
                    '${this._escape(device.name)}',
                    '${this._escape(device.type)}',
                    '${device.transportType}',
                    '${this._escape(device.category)}',
                    '${this._escape(device.location)}',
                    ${device.blockchainProof},
                    'offline'
                )
            `);

            // Add event
            await this.db.sqlPromise(`
                INSERT INTO events (device_id, event_type, event_data)
                VALUES ('${device.deviceId}', 'device_registered', '{}')
            `);

            return device;
        } catch (err) {
            console.error("❌ registerDevice failed:", err);
            return null;
        }
    }

    // -------------------------------------------
    //  GET CURRENT POSITION — from Android App
    // -------------------------------------------
    async getCurrentPosition(deviceId, callback) {
        try {
            const res = await MDS.http.get("http://127.0.0.1:8123/location");

            if (!res.status) {
                console.warn("⚠️ Android not responding, fallback to DB");
                this.db.getLastPosition(deviceId, callback);
                return;
            }

            const data = JSON.parse(res.response);
            callback(data);
        } catch (e) {
            console.error("❌ getCurrentPosition error:", e);
            this.db.getLastPosition(deviceId, callback);
        }
    }

    // -------------------------------------------
    //  REFRESH LOCATION
    // -------------------------------------------
    async refreshDeviceLocation(deviceId, callback) {
        return this.getCurrentPosition(deviceId, async (position) => {
            if (position) {
                await this.saveMovement(deviceId, position);
                callback(position);
            } else {
                callback(null);
            }
        });
    }

    // -------------------------------------------
    // SAVE MOVEMENT
    // -------------------------------------------
    async saveMovement(deviceId, position) {
        await this.db.addMovementPromise({
            deviceId,
            latitude: position.latitude,
            longitude: position.longitude,
            altitude: position.altitude || 0,
            speed: position.speed || 0,
            accuracy: position.accuracy || 0
        });

        if (position.battery !== undefined) {
            await this.db.updateDeviceBatteryPromise(deviceId, position.battery);
        }

        await this.db.updateDeviceStatusPromise(deviceId, "online");

        await this.db.addEventPromise(deviceId, "movement_detected", {});
    }

    // -------------------------------------------
    // ACTIVATE DEVICE — no longer needed
    // -------------------------------------------
    async activateDevice(deviceId, type) {
        return {
            success: true,
            type: "external",
            message: "Tracking handled by Android companion app"
        };
    }

    // -------------------------------------------
    // REMOVE DEVICE
    // -------------------------------------------
    removeDevice(deviceId, callback) {
        this.db.deleteDevice(deviceId, callback);
    }

    // -------------------------------------------
    // LOCK/UNLOCK DEVICE
    // -------------------------------------------
    toggleLock(deviceId, callback) {
        this.db.getDevice(deviceId, (device) => {
            if (!device) return callback(false);

            const newState = !device.locked;

            this.db.updateLockStatus(deviceId, newState, (success) => {
                if (success) {
                    this.db.addEvent(deviceId, newState ? "device_locked" : "device_unlocked", {});
                }
                callback(success);
            });
        });
    }

    // -------------------------------------------
    // DEVICE STATUS
    // -------------------------------------------
    getDevicesStatus(callback) {
        this.db.getDevices((devices) => callback(devices));
    }
}

globalThis.DeviceManager = DeviceManager;
console.log("✅ device-manager.js ready (Android Pull Mode)");
