import { Platform, PermissionsAndroid } from 'react-native';
import bluetoothMeshService from './BluetoothMeshService';
import wifiDirectService from './WifiDirectService';
import messageService from './MessageService';

const TAG = '[ConnMgr]';

class ConnectionManager {
  constructor() {
    this.devices = new Map();
    this.listeners = [];
    this.bluetoothEnabled = false;
    this.wifiDirectEnabled = false;
    this.isScanning = false;
    this._healthInterval = null;
    this._bleNoConnSince = null;
    console.log(`${TAG} ConnectionManager constructed`);
  }

  async requestPermissions() {
    console.log(`${TAG} ── requestPermissions() — Platform=${Platform.OS}`);

    if (Platform.OS !== 'android') {
      console.log(`${TAG} non-Android — skipping permissions`);
      return true;
    }

    try {
      const possiblePermissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ...(Platform.Version >= 33 ? ['android.permission.NEARBY_WIFI_DEVICES'] : []),
      ].filter(Boolean);

      const granted = await PermissionsAndroid.requestMultiple(possiblePermissions);

      Object.entries(granted).forEach(([perm, result]) => {
        console.log(`${TAG} permission ${perm} => ${result}`);
      });

      const required = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ...(Platform.Version >= 33 ? ['android.permission.NEARBY_WIFI_DEVICES'] : []),
      ].filter(Boolean);

      const allGranted = required.every(
        p => granted[p] === PermissionsAndroid.RESULTS.GRANTED
      );

      console.log(`${TAG} required permissions all granted=${allGranted}`);
      return allGranted;
    } catch (err) {
      console.error(`${TAG} requestPermissions error: ${err.message}`, err);
      return false;
    }
  }

  async initialize() {
    console.log(`${TAG} ══════════════════════════════════`);
    console.log(`${TAG} ── initialize() START ──`);
    console.log(`${TAG} ══════════════════════════════════`);

    console.log(`${TAG} [1/4] Initializing BluetoothMeshService...`);
    const btReady = await bluetoothMeshService.initialize();
    this.bluetoothEnabled = btReady;
    console.log(`${TAG} [1/4] Bluetooth ready: ${btReady}`);

    console.log(`${TAG} [2/4] Initializing WifiDirectService...`);
    const wdReady = await wifiDirectService.initialize();
    this.wifiDirectEnabled = wdReady;
    console.log(`${TAG} [2/4] WifiDirect ready: ${wdReady}`);

    wifiDirectService.onStateChanged = enabled => {
      console.log(`${TAG} wifiDirectService.onStateChanged(${enabled})`);
      this.wifiDirectEnabled = enabled;

      if (enabled && this.isScanning) {
        const wdStats = wifiDirectService.getStats();
        if (!wdStats.isDiscovering) {
          console.log(`${TAG} Wi-Fi Direct ON while scanning — start discovery`);
          wifiDirectService.startDiscovery();
        }
      }
    };

    console.log(`${TAG} [3/4] Initializing MessageService...`);
    messageService.init(this, bluetoothMeshService.deviceName);
    console.log(`${TAG} [3/4] MessageService initialized — deviceId=${bluetoothMeshService.deviceName}`);

    console.log(`${TAG} [4/4] Attaching listeners...`);
    bluetoothMeshService.addListener(this._handleBluetoothDevices.bind(this));
    bluetoothMeshService.addMessageListener(this._handleIncomingData.bind(this));

    wifiDirectService.addListener(this._handleWifiDirectDevices.bind(this));
    wifiDirectService.addMessageListener(this._handleIncomingData.bind(this));

    console.log(`${TAG} [4/4] listeners attached`);

    console.log(`${TAG} ══════════════════════════════════`);
    console.log(`${TAG} ── initialize() DONE — bt=${this.bluetoothEnabled} wd=${this.wifiDirectEnabled}`);
    console.log(`${TAG} ══════════════════════════════════`);
  }

  _handleIncomingData(rawData) {
    console.log(
      `${TAG} ◀ _handleIncomingData len=${rawData?.length} preview=${String(rawData || '').slice(0, 100)}`
    );
    messageService.handleIncoming(rawData);
  }

  _handleBluetoothDevices(devices) {
    console.log(`${TAG} ◀ _handleBluetoothDevices count=${devices.length}`);

    if (devices.some(d => d.isConnected)) {
      this._bleNoConnSince = null;
    }

    const bleNames = new Set(devices.map(d => d.name));
    for (const [name, device] of this.devices.entries()) {
      if (device.transport === 'bluetooth' && !bleNames.has(name)) {
        this.devices.delete(name);
      }
    }

    devices.forEach(device => {
      this.devices.set(device.name, { ...device, transport: 'bluetooth' });
    });

    this.notifyListeners();
  }

  _handleWifiDirectDevices(devices) {
    console.log(`${TAG} ◀ _handleWifiDirectDevices count=${devices.length}`);

    const wdAddresses = new Set(devices.map(d => d.address));
    for (const [key, device] of this.devices.entries()) {
      if (device.transport === 'wifi-direct' && !wdAddresses.has(device.address)) {
        this.devices.delete(key);
      }
    }

    devices.forEach(device => {
      const key = `WD_${device.address}`;
      this.devices.set(key, { ...device, transport: 'wifi-direct' });
    });

    this.notifyListeners();
  }

  startScanning() {
    console.log(`${TAG} ── startScanning() — bt=${this.bluetoothEnabled} wd=${this.wifiDirectEnabled}`);
    this.isScanning = true;

    if (this.bluetoothEnabled) {
      console.log(`${TAG} → starting BLE scan`);
      bluetoothMeshService.startScanning();
    } else {
      console.warn(`${TAG} BLE disabled — skipping`);
    }

    if (this.wifiDirectEnabled) {
      console.log(`${TAG} → starting Wi-Fi Direct discovery`);
      wifiDirectService.startDiscovery();
    } else {
      console.warn(`${TAG} Wi-Fi Direct not ready`);
    }

    this._startTransportHealthMonitor();
  }

  stopScanning() {
    console.log(`${TAG} ── stopScanning()`);
    this.isScanning = false;
    this._stopTransportHealthMonitor();
    bluetoothMeshService.stopScanning();
    wifiDirectService.stopDiscovery();
  }

  _startTransportHealthMonitor() {
    this._stopTransportHealthMonitor();
    this._bleNoConnSince = null;

    this._healthInterval = setInterval(() => {
      console.log(`${TAG} ── [Health Check] ──`);

      const btStats = bluetoothMeshService.getStats?.() || {};
      const wdStats = wifiDirectService.getStats?.() || {};

      console.log(
        `${TAG} BLE stats scanning=${btStats.isScanning} advertising=${btStats.isAdvertising} connected=${bluetoothMeshService.connectedDevices?.size ?? 0}`
      );
      console.log(
        `${TAG} WD stats discovering=${wdStats.isDiscovering} connected=${wdStats.isConnected} socket=${wdStats.socketConnected} trusted=${wdStats.trustedPeer}`
      );

      if (this.isScanning && this.wifiDirectEnabled && !wdStats.isDiscovering && !wdStats.isConnected) {
        console.log(`${TAG} WD idle while scanning — nudging discovery`);
        wifiDirectService.startDiscovery();
      }
    }, 20000);
  }

  _stopTransportHealthMonitor() {
    if (this._healthInterval) {
      clearInterval(this._healthInterval);
      this._healthInterval = null;
    }
  }

  getDevices() {
    return Array.from(this.devices.values());
  }

  getStats() {
    const btStats = bluetoothMeshService.getStats?.() || {};
    const wdStats = wifiDirectService.getStats?.() || {};

    return {
      totalDevices: this.devices.size,
      bluetoothEnabled: this.bluetoothEnabled,
      wifiDirectEnabled: this.wifiDirectEnabled,
      bleScanning: btStats.isScanning,
      bleAdvertising: btStats.isAdvertising,
      wdIsDiscovering: wdStats.isDiscovering,
      wdIsConnected: wdStats.isConnected,
      wdSocketConnected: wdStats.socketConnected,
      wdTrustedPeer: wdStats.trustedPeer,
    };
  }

  getDebugInfo() {
    return {
      ble: bluetoothMeshService.getDebugInfo?.() || {},
      wd: wifiDirectService.getStats?.() || {},
    };
  }

  setBluetoothEnabled(enabled) {
    console.log(`${TAG} ── setBluetoothEnabled(${enabled})`);
    this.bluetoothEnabled = enabled;

    if (!enabled) {
      for (const [key, device] of this.devices.entries()) {
        if (device.transport === 'bluetooth') {
          this.devices.delete(key);
        }
      }
      this.notifyListeners();
    }
  }

  sendMessage(encodedPayload) {
    const preview = String(encodedPayload || '').slice(0, 80);
    console.log(`${TAG} ── sendMessage() preview=${preview}`);

    // BLE path
    const bleConnected = bluetoothMeshService.connectedDevices?.size ?? 0;
    console.log(`${TAG}   BLE connected peers=${bleConnected}`);
    if (bleConnected > 0 || this.bluetoothEnabled) {
      try {
        bluetoothMeshService.broadcastData(encodedPayload);
        console.log(`${TAG}   BLE broadcast queued`);
      } catch (e) {
        console.error(`${TAG}   BLE broadcast error: ${e.message}`, e);
      }
    }

    // Wi-Fi Direct path
    const wdStats = wifiDirectService.getStats?.() || {};
    console.log(
      `${TAG}   WD connected=${wdStats.isConnected} socket=${wdStats.socketConnected} trusted=${wdStats.trustedPeer}`
    );

    if (wdStats.isConnected && wdStats.socketConnected && wdStats.trustedPeer) {
      try {
        wifiDirectService.sendData(encodedPayload);
        console.log(`${TAG}   WD broadcast queued`);
      } catch (e) {
        console.error(`${TAG}   WD broadcast error: ${e.message}`, e);
      }
    } else {
      console.log(`${TAG}   WD send skipped — no trusted active Wi-Fi Direct socket`);
    }
  }

  addListener(callback) {
    this.listeners.push(callback);
    console.log(`${TAG} addListener total=${this.listeners.length}`);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  notifyListeners(devices) {
    const all = devices || this.getDevices();
    console.log(`${TAG} notifyListeners devices=${all.length} listeners=${this.listeners.length}`);
    this.listeners.forEach(cb => cb(all));
  }

  cleanup() {
    console.log(`${TAG} ── cleanup()`);
    this.stopScanning();
    bluetoothMeshService.cleanup();
    wifiDirectService.cleanup();
    this.devices.clear();
    this.listeners = [];
  }
}

export default new ConnectionManager();
