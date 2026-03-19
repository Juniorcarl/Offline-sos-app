import { Platform, PermissionsAndroid } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import bluetoothMeshService from './BluetoothMeshService';
import wifiDirectService from './WifiDirectService';

class ConnectionManager {
  constructor() {
    this.devices = new Map();
    this.listeners = [];
    this.bluetoothEnabled = false;
    this.wifiEnabled = false;
    this.wifiDirectEnabled = false;
    this.isScanning = false;
    this._wdRestartInterval = null;
    this._netInfoUnsubscribe = null;
  }

  async requestPermissions() {
    if (Platform.OS === 'android') {
      try {
        const possiblePermissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
          PermissionsAndroid.PERMISSIONS.CHANGE_WIFI_STATE,
          PermissionsAndroid.PERMISSIONS.ACCESS_WIFI_STATE,
        ].filter(p => p != null && p !== '');

        const granted = await PermissionsAndroid.requestMultiple(possiblePermissions);

        const required = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ].filter(p => p != null && p !== '');

        return required.every(p => granted[p] === PermissionsAndroid.RESULTS.GRANTED);
      } catch (err) {
        console.error('Permission error:', err);
        return false;
      }
    }
    return true;
  }

  async initialize() {
    console.log('🔧 Initializing ConnectionManager...');

    const btReady = await bluetoothMeshService.initialize();
    this.bluetoothEnabled = btReady;
    console.log('🔵 Bluetooth ready:', btReady);

    const wdReady = await wifiDirectService.initialize();
    this.wifiDirectEnabled = wdReady;
    console.log('📶 WiFi Direct ready:', wdReady);

    await this.checkWifiState();

    this._netInfoUnsubscribe = NetInfo.addEventListener(state => {
      this.wifiEnabled = state.type === 'wifi' && state.isConnected;
    });

    bluetoothMeshService.addListener(this._handleBluetoothDevices.bind(this));
    wifiDirectService.addListener(this._handleWifiDirectDevices.bind(this));

    console.log('✅ ConnectionManager initialized');
  }

  _handleBluetoothDevices(devices) {
    const bleIds = new Set(devices.map(d => d.id));

    // Remove gone BLE devices (unless they're also on WiFi Direct)
    for (const [id, device] of this.devices.entries()) {
      if (device.transport === 'bluetooth' && !bleIds.has(id)) {
        this.devices.delete(id);
      }
    }

    devices.forEach(device => {
      const existing = this.devices.get(device.id);
      if (existing && existing.transport === 'wifi-direct') {
        this.devices.set(device.id, { ...device, transport: 'both' });
      } else {
        this.devices.set(device.id, { ...device, transport: 'bluetooth' });
      }
    });

    this.notifyListeners();
  }

  _handleWifiDirectDevices(devices) {
    const wdIds = new Set(devices.map(d => d.id));

    for (const [id, device] of this.devices.entries()) {
      if (device.transport === 'wifi-direct' && !wdIds.has(id)) {
        this.devices.delete(id);
      }
    }

    devices.forEach(device => {
      const existing = this.devices.get(device.id);
      if (existing && existing.transport === 'bluetooth') {
        this.devices.set(device.id, {
          ...existing,
          transport: 'both',
          wifiDirectConnected: device.isConnected,
        });
      } else {
        this.devices.set(device.id, { ...device, transport: 'wifi-direct' });
      }
    });

    this.notifyListeners();
  }

  async checkWifiState() {
    const state = await NetInfo.fetch();
    this.wifiEnabled = state.type === 'wifi' && state.isConnected;
  }

  startScanning() {
    console.log('🔍 Starting scanning...');
    this.isScanning = true;

    // BLE — BluetoothMeshService handles this via its own BT state listener
    // Only call manually if BT is already on
    if (this.bluetoothEnabled) {
      bluetoothMeshService.startScanning();
    }

    // WiFi Direct
    if (this.wifiDirectEnabled) {
      wifiDirectService.startDiscovery();

      // Android stops discovery after ~2 min — keep restarting
      this._wdRestartInterval = setInterval(() => {
        if (this.wifiDirectEnabled) {
          console.log('🔄 Restarting WiFi Direct discovery...');
          wifiDirectService.stopDiscovery().then(() => {
            setTimeout(() => wifiDirectService.startDiscovery(), 1000);
          });
        }
      }, 110000);
    }
  }

  stopScanning() {
    this.isScanning = false;
    if (this._wdRestartInterval) {
      clearInterval(this._wdRestartInterval);
      this._wdRestartInterval = null;
    }
    bluetoothMeshService.stopScanning();
    wifiDirectService.stopDiscovery();
  }

  getDevices() {
    return Array.from(this.devices.values());
  }

  getStats() {
    const btStats = bluetoothMeshService.getStats();
    const wdStats = wifiDirectService.getStats();

    return {
      totalDevices: this.devices.size,
      bluetoothEnabled: this.bluetoothEnabled,
      wifiEnabled: this.wifiEnabled,
      wifiDirectEnabled: this.wifiDirectEnabled,
      isScanning: btStats.isScanning || wdStats.isDiscovering,
      isAdvertising: btStats.isAdvertising,
      deviceName: btStats.deviceName,
    };
  }

  setBluetoothEnabled(enabled) {
    this.bluetoothEnabled = enabled;
    if (!enabled) {
      for (const [id, device] of this.devices.entries()) {
        if (device.transport === 'bluetooth') {
          this.devices.delete(id);
        } else if (device.transport === 'both') {
          this.devices.set(id, { ...device, transport: 'wifi-direct', isConnected: device.wifiDirectConnected || false });
        }
      }
      this.notifyListeners();
    }
  }

  setWifiDirectEnabled(enabled) {
    this.wifiDirectEnabled = enabled;
    if (!enabled) {
      wifiDirectService.stopDiscovery();
      for (const [id, device] of this.devices.entries()) {
        if (device.transport === 'wifi-direct') {
          this.devices.delete(id);
        } else if (device.transport === 'both') {
          this.devices.set(id, { ...device, transport: 'bluetooth' });
        }
      }
      this.notifyListeners();
    } else {
      if (!wifiDirectService.isDiscovering) wifiDirectService.startDiscovery();
    }
  }

  addListener(callback) { this.listeners.push(callback); }
  removeListener(callback) { this.listeners = this.listeners.filter(cb => cb !== callback); }

  notifyListeners(devices) {
    const all = devices || this.getDevices();
    this.listeners.forEach(cb => cb(all));
  }

  cleanup() {
    this.stopScanning();
    bluetoothMeshService.cleanup();
    wifiDirectService.cleanup();
    if (this._netInfoUnsubscribe) {
      this._netInfoUnsubscribe();
      this._netInfoUnsubscribe = null;
    }
    this.devices.clear();
    this.listeners = [];
  }
}

export default new ConnectionManager();