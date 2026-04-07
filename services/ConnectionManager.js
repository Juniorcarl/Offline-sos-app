import { Platform, PermissionsAndroid } from 'react-native';
import bluetoothMeshService from './BluetoothMeshService';
import messageService from './MessageService';

const TAG = '[ConnMgr]';

class ConnectionManager {
  constructor() {
    this.devices          = new Map();
    this.listeners        = [];
    this.bluetoothEnabled = false;
    this.isScanning       = false;
    this._healthInterval  = null;
    this._bleNoConnSince  = null;
    console.log(`${TAG} ConnectionManager constructed`);
  }

  // ── Permissions ────────────────────────────────────────────────────────────

  async requestPermissions() {
    console.log(`${TAG} ── requestPermissions() — Platform=${Platform.OS}`);
    if (Platform.OS === 'android') {
      try {
        const possiblePermissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ].filter(p => p != null && p !== '');

        console.log(`${TAG}   requesting ${possiblePermissions.length} permissions:`);
        possiblePermissions.forEach(p => console.log(`${TAG}     - ${p}`));

        const granted = await PermissionsAndroid.requestMultiple(possiblePermissions);

        console.log(`${TAG}   permission results:`);
        Object.entries(granted).forEach(([perm, result]) => {
          const icon = result === PermissionsAndroid.RESULTS.GRANTED ? '✅' : result === PermissionsAndroid.RESULTS.DENIED ? '❌' : '🚫';
          console.log(`${TAG}     ${icon} ${perm}: ${result}`);
        });

        const required = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ].filter(p => p != null && p !== '');

        const allGranted = required.every(p => granted[p] === PermissionsAndroid.RESULTS.GRANTED);
        console.log(`${TAG}   required permissions all granted: ${allGranted}`);

        if (!allGranted) {
          const missing = required.filter(p => granted[p] !== PermissionsAndroid.RESULTS.GRANTED);
          console.warn(`${TAG}   ⚠️ MISSING required permissions: ${missing.join(', ')}`);
        }

        return allGranted;
      } catch (err) {
        console.error(`${TAG}   ❌ Permission request threw: ${err.message}`, err);
        return false;
      }
    }
    console.log(`${TAG}   non-Android — skipping permissions`);
    return true;
  }

  // ── Initialise ─────────────────────────────────────────────────────────────

  async initialize() {
    console.log(`${TAG} ══════════════════════════════════`);
    console.log(`${TAG} ── initialize() START ──`);
    console.log(`${TAG} ══════════════════════════════════`);

    console.log(`${TAG}   [1/3] Initializing BluetoothMeshService...`);
    const btReady = await bluetoothMeshService.initialize();
    this.bluetoothEnabled = btReady;
    console.log(`${TAG}   [1/3] ✅ Bluetooth ready: ${btReady}`);

    console.log(`${TAG}   [2/3] Initializing MessageService...`);
    messageService.init(this, bluetoothMeshService.deviceName);
    console.log(`${TAG}   [2/3] ✅ MessageService initialized — deviceId=${bluetoothMeshService.deviceName}`);

    console.log(`${TAG}   [3/3] Attaching device + message listeners...`);
    bluetoothMeshService.addListener(this._handleBluetoothDevices.bind(this));
    bluetoothMeshService.addMessageListener(this._handleIncomingData.bind(this));
    console.log(`${TAG}   [3/3] ✅ listeners attached`);

    console.log(`${TAG} ══════════════════════════════════`);
    console.log(`${TAG} ── initialize() DONE — bluetoothEnabled=${this.bluetoothEnabled}`);
    console.log(`${TAG} ══════════════════════════════════`);
  }

  // ── Incoming mesh data ─────────────────────────────────────────────────────

  _handleIncomingData(rawData) {
    console.log(`${TAG} ◀ _handleIncomingData — length=${rawData?.length} preview=${rawData?.substring(0, 80)}`);
    messageService.handleIncoming(rawData);
  }

  // ── Device list update from BLE ────────────────────────────────────────────

  _handleBluetoothDevices(devices) {
    console.log(`${TAG} ◀ _handleBluetoothDevices — ${devices.length} BLE devices reported`);
    devices.forEach(d => {
      console.log(`${TAG}   BLE: name=${d.name} id=${d.id} connected=${d.isConnected} rssi=${d.rssi}`);
    });

    if (devices.some(d => d.isConnected)) {
      this._bleNoConnSince = null;
    }

    // Remove stale entries no longer in BLE list
    const bleNames = new Set(devices.map(d => d.name));
    for (const [name] of this.devices.entries()) {
      if (!bleNames.has(name)) {
        this.devices.delete(name);
      }
    }

    devices.forEach(device => {
      this.devices.set(device.name, { ...device, transport: 'bluetooth' });
    });

    console.log(`${TAG}   devices map: ${this.devices.size} total`);
    this.notifyListeners();
  }

  // ── Scanning ───────────────────────────────────────────────────────────────

  startScanning() {
    console.log(`${TAG} ── startScanning() — bluetoothEnabled=${this.bluetoothEnabled}`);
    this.isScanning = true;

    if (this.bluetoothEnabled) {
      console.log(`${TAG}   → starting BLE scanning`);
      bluetoothMeshService.startScanning();
    } else {
      console.warn(`${TAG}   ⚠️ BLE disabled — skipping BLE scan`);
    }

    this._startTransportHealthMonitor();
  }

  stopScanning() {
    console.log(`${TAG} ── stopScanning()`);
    this.isScanning = false;
    this._stopTransportHealthMonitor();
    bluetoothMeshService.stopScanning();
  }

  // ── Transport health monitor ────────────────────────────────────────────────

  _startTransportHealthMonitor() {
    this._stopTransportHealthMonitor();
    this._bleNoConnSince = null;
    console.log(`${TAG}   health monitor started (checks every 20s)`);

    this._healthInterval = setInterval(() => {
      const now = Date.now();
      console.log(`${TAG} ── [Health Check] ──`);
      console.log(`${TAG}   BLE: enabled=${this.bluetoothEnabled} btOn=${bluetoothMeshService.isBluetoothOn} scanning=${bluetoothMeshService.isScanning} advertising=${bluetoothMeshService.isAdvertising} connected=${bluetoothMeshService.connectedDevices.size} known=${bluetoothMeshService.devices.size}`);

      if (this.bluetoothEnabled && bluetoothMeshService.isBluetoothOn) {
        if (!bluetoothMeshService.isScanning) {
          console.warn(`${TAG}   ⚠️ BLE scan stopped unexpectedly — restarting`);
          bluetoothMeshService.startScanning();
          this._bleNoConnSince = null;
          return;
        }
        if (!bluetoothMeshService.isAdvertising) {
          console.warn(`${TAG}   ⚠️ BLE advertising stopped unexpectedly — restarting`);
          bluetoothMeshService.startAdvertising();
        }

        const bleConnected = bluetoothMeshService.connectedDevices.size;
        if (bleConnected === 0) {
          if (!this._bleNoConnSince) {
            this._bleNoConnSince = now;
            console.log(`${TAG}   BLE: no connections — starting 30s timer`);
          } else {
            const elapsed = now - this._bleNoConnSince;
            console.log(`${TAG}   BLE: still no connections — ${elapsed}ms elapsed`);
            if (elapsed > 30_000) {
              console.log(`${TAG}   🔄 [Health] BLE no connections for 30s — restarting scan`);
              this._bleNoConnSince = null;
              bluetoothMeshService.stopScanning();
              setTimeout(() => bluetoothMeshService.startScanning(), 1000);
            }
          }
        } else {
          this._bleNoConnSince = null;
        }
      } else {
        this._bleNoConnSince = null;
      }
    }, 20_000);
  }

  _stopTransportHealthMonitor() {
    if (this._healthInterval) {
      clearInterval(this._healthInterval);
      this._healthInterval = null;
      console.log(`${TAG}   health monitor stopped`);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getDevices() {
    return Array.from(this.devices.values());
  }

  getStats() {
    const btStats = bluetoothMeshService.getStats();
    return {
      totalDevices:     this.devices.size,
      bluetoothEnabled: this.bluetoothEnabled,
      isScanning:       btStats.isScanning,
      isAdvertising:    btStats.isAdvertising,
      deviceName:       btStats.deviceName,
    };
  }

  getDebugInfo() {
    return bluetoothMeshService.getDebugInfo();
  }

  setBluetoothEnabled(enabled) {
    console.log(`${TAG} ── setBluetoothEnabled(${enabled})`);
    this.bluetoothEnabled = enabled;
    if (!enabled) {
      this.devices.clear();
      this.notifyListeners();
    }
  }

  /**
   * Broadcast an encoded message payload to all connected BLE peers.
   */
  sendMessage(encodedPayload) {
    const preview = encodedPayload?.substring(0, 60) || 'null';
    console.log(`${TAG} ── sendMessage() — payload preview: ${preview}...`);
    const bleConnected = bluetoothMeshService.connectedDevices.size;
    console.log(`${TAG}   → BLE: sending to ${bleConnected} connected peers`);
    bluetoothMeshService.broadcastData(encodedPayload);
  }

  addListener(callback)    {
    this.listeners.push(callback);
    console.log(`${TAG}   addListener — total listeners: ${this.listeners.length}`);
  }
  removeListener(callback) { this.listeners = this.listeners.filter(cb => cb !== callback); }

  notifyListeners(devices) {
    const all = devices || this.getDevices();
    console.log(`${TAG} notifyListeners — ${all.length} devices, ${this.listeners.length} listeners`);
    this.listeners.forEach(cb => cb(all));
  }

  cleanup() {
    console.log(`${TAG} ── cleanup() ──`);
    this.stopScanning();
    this._stopTransportHealthMonitor();
    bluetoothMeshService.cleanup();
    this.devices.clear();
    this.listeners = [];
    console.log(`${TAG}   cleanup done`);
  }
}

export default new ConnectionManager();
