import { BleManager } from 'react-native-ble-plx';
import BLEAdvertiser from 'react-native-ble-advertiser';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';

const SERVICE_UUID        = '0000FFF0-0000-1000-8000-00805F9B34FB';
const CHARACTERISTIC_UUID = '0000FFF1-0000-1000-8000-00805F9B34FB';
const COMPANY_ID          = 0x00E0;
const STALE_THRESHOLD     = 20000;
const STALE_CHECK_INTERVAL = 5000;
const READVERTISE_INTERVAL = 10000;

const { BluetoothModule } = NativeModules;

class BluetoothMeshService {
  constructor() {
    this.manager            = new BleManager();
    this.devices            = new Map();
    this.connectedDevices   = new Map();
    this.listeners          = [];
    this.messageListeners   = [];
    this.isScanning         = false;
    this.isAdvertising      = false;
    this.isBluetoothOn      = false;
    this.gattServerRunning  = false;
    this.deviceName         = `SOS_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    this.stateSubscription  = null;
    this.staleCheckInterval = null;
    this.readvertiseInterval = null;
    this.nativeEventEmitter = null;
    this.gattSubscriptions  = [];
  }

  // ── initialize — permissions already granted by PermissionManager ─────────
  async initialize() {
    if (BluetoothModule) {
      this.nativeEventEmitter = new NativeEventEmitter(BluetoothModule);

      const connSub = this.nativeEventEmitter.addListener(
        'GattDeviceConnected',
        (address) => {
          for (const [id, device] of this.devices.entries()) {
            if (id === address || device.id === address) {
              const updated = { ...device, isConnected: true };
              this.devices.set(id, updated);
              this.connectedDevices.set(id, updated);
              this.notifyListeners();
              break;
            }
          }
        }
      );

      const disconnSub = this.nativeEventEmitter.addListener(
        'GattDeviceDisconnected',
        (address) => {
          for (const [id, device] of this.devices.entries()) {
            if (id === address || device.id === address) {
              const updated = { ...device, isConnected: false };
              this.devices.set(id, updated);
              this.connectedDevices.delete(id);
              this.notifyListeners();
              break;
            }
          }
        }
      );

      // ── Wire incoming BLE data into MessageService ──────────────────────
      const msgSub = this.nativeEventEmitter.addListener(
        'GattMessageReceived',
        (data) => {
          try {
            const raw = atob(data.value);
            this.notifyMessageListeners(raw);
          } catch (e) {
            console.error('BLE message decode error:', e);
          }
        }
      );

      this.gattSubscriptions = [connSub, disconnSub, msgSub];
    }

    this.stateSubscription = this.manager.onStateChange((state) => {
      console.log('📱 BT state:', state);
      if (state === 'PoweredOn') {
        this.isBluetoothOn = true;
        this._onBluetoothOn();
      } else {
        this._onBluetoothOff();
      }
    }, true);

    const state = await this.manager.state();
    if (state === 'PoweredOn') {
      this.isBluetoothOn = true;
      await this._onBluetoothOn();
      return true;
    }

    console.log('⚠️ Bluetooth off — waiting for user to enable');
    return false;
  }

  async _onBluetoothOn() {
    await this._startGattServer();
    await this.startAdvertising();
    this.startScanning();
    this._startStaleCheck();
  }

  _onBluetoothOff() {
    this.isBluetoothOn      = false;
    this.isScanning         = false;
    this.isAdvertising      = false;
    this.gattServerRunning  = false;
    this._stopStaleCheck();
    this._stopReadvertise();
    this.devices.clear();
    this.connectedDevices.clear();
    this.notifyListeners();
  }

  async _startGattServer() {
    if (!BluetoothModule || this.gattServerRunning) return;
    try {
      await BluetoothModule.startGattServer();
      this.gattServerRunning = true;
      console.log('✅ GATT server running');
    } catch (e) {
      console.error('❌ GATT server start failed:', e);
    }
  }

  async _stopGattServer() {
    if (!BluetoothModule || !this.gattServerRunning) return;
    try {
      await BluetoothModule.stopGattServer();
      this.gattServerRunning = false;
    } catch (e) {
      console.error('❌ GATT server stop failed:', e);
    }
  }

  async startAdvertising() {
    if (!this.isBluetoothOn || this.isAdvertising) return;
    try {
      console.log('📡 Advertising as:', this.deviceName);
      BLEAdvertiser.setCompanyId(COMPANY_ID);
      await BLEAdvertiser.broadcast(SERVICE_UUID, [], {
        advertiseMode:        2,
        txPowerLevel:         3,
        connectable:          true,
        includeDeviceName:    true,
        includeTxPowerLevel:  false,
      });
      this.isAdvertising = true;
      console.log('✅ Advertising started');
      this._startReadvertise();
    } catch (error) {
      console.error('❌ Advertising error:', error);
      this.isAdvertising = false;
    }
  }

  async stopAdvertising() {
    this._stopReadvertise();
    if (!this.isAdvertising) return;
    if (!this.isBluetoothOn) { this.isAdvertising = false; return; }
    try { await BLEAdvertiser.stopBroadcast(); } catch (e) {}
    this.isAdvertising = false;
  }

  _startReadvertise() {
    this._stopReadvertise();
    this.readvertiseInterval = setInterval(async () => {
      if (!this.isBluetoothOn) return;
      try {
        await BLEAdvertiser.stopBroadcast();
        this.isAdvertising = false;
        await new Promise(r => setTimeout(r, 500));
        await this.startAdvertising();
      } catch (e) {}
    }, READVERTISE_INTERVAL);
  }

  _stopReadvertise() {
    if (this.readvertiseInterval) {
      clearInterval(this.readvertiseInterval);
      this.readvertiseInterval = null;
    }
  }

  startScanning() {
    if (!this.isBluetoothOn || this.isScanning) return;
    console.log('🔍 Scanning for SOS devices...');
    this.isScanning = true;
    this.manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (error) {
        console.error('❌ Scan error:', error);
        this.isScanning = false;
        setTimeout(() => {
          if (this.isBluetoothOn) { this.isScanning = false; this.startScanning(); }
        }, 3000);
        return;
      }
      if (device && device.name && device.name.startsWith('SOS_')) {
        this._handleDeviceFound(device);
      }
    });
  }

  stopScanning() {
    if (!this.isScanning) return;
    this.manager.stopDeviceScan();
    this.isScanning = false;
  }

  async _handleDeviceFound(device) {
    const rssi          = device.rssi || -100;
    const distance      = this._calculateDistance(rssi);
    const alreadyKnown  = this.devices.has(device.id);
    const alreadyConnected = this.connectedDevices.has(device.id);

    const deviceInfo = {
      id:          device.id,
      name:        device.name,
      rssi,
      distance:    Math.round(distance),
      lastSeen:    Date.now(),
      isConnected: alreadyConnected,
      transport:   'bluetooth',
    };

    const existing = this.devices.get(device.id);
    const changed  = !existing || existing.rssi !== rssi;

    this.devices.set(device.id, deviceInfo);

    if (!alreadyKnown) {
      console.log(`📱 Found: ${device.name} (~${deviceInfo.distance}m)`);
      this._connectToDevice(device.id);
    }

    if (changed) this.notifyListeners();
  }

  async _connectToDevice(deviceId) {
    if (!this.isBluetoothOn) return;
    if (this.connectedDevices.has(deviceId)) return;
    try {
      console.log(`🔗 Connecting to ${deviceId}...`);
      const device = await this.manager.connectToDevice(deviceId, { autoConnect: false, requestMTU: 256 });
      await device.discoverAllServicesAndCharacteristics();

      const services = await device.services();
      const hasSosService = services.some(s => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase());
      if (!hasSosService) {
        console.log(`⚠️ ${deviceId} has no SOS service — disconnecting`);
        await this.manager.cancelDeviceConnection(deviceId);
        return;
      }

      this.connectedDevices.set(deviceId, device);
      const deviceInfo = this.devices.get(deviceId);
      if (deviceInfo) {
        this.devices.set(deviceId, { ...deviceInfo, isConnected: true });
        this.notifyListeners();
      }
      console.log(`✅ Connected to ${device.name || deviceId}`);

      this.manager.onDeviceDisconnected(deviceId, () => {
        console.log(`📴 Disconnected: ${deviceId}`);
        this.connectedDevices.delete(deviceId);
        const info = this.devices.get(deviceId);
        if (info) {
          this.devices.set(deviceId, { ...info, isConnected: false });
          this.notifyListeners();
        }
        setTimeout(() => {
          if (this.isBluetoothOn && this.devices.has(deviceId)) {
            this._connectToDevice(deviceId);
          }
        }, 4000);
      });

    } catch (error) {
      console.error(`❌ Connect failed to ${deviceId}:`, error.message);
      setTimeout(() => {
        if (this.isBluetoothOn && this.devices.has(deviceId) && !this.connectedDevices.has(deviceId)) {
          this._connectToDevice(deviceId);
        }
      }, 6000);
    }
  }

  // ── Broadcast data to all connected GATT peers ───────────────────────────
  broadcastData(encodedPayload) {
    this.connectedDevices.forEach(async (device, id) => {
      try {
        await this.manager.writeCharacteristicWithoutResponseForDevice(
          id,
          SERVICE_UUID,
          CHARACTERISTIC_UUID,
          btoa(encodedPayload),
        );
      } catch (e) {
        console.error(`❌ BLE write to ${id} failed:`, e.message);
      }
    });
  }

  _startStaleCheck() {
    this._stopStaleCheck();
    this.staleCheckInterval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, device] of this.devices.entries()) {
        if (now - device.lastSeen > STALE_THRESHOLD && !this.connectedDevices.has(id)) {
          this.devices.delete(id);
          console.log(`🗑️ Stale: ${device.name}`);
          changed = true;
        }
      }
      if (changed) this.notifyListeners();
    }, STALE_CHECK_INTERVAL);
  }

  _stopStaleCheck() {
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
      this.staleCheckInterval = null;
    }
  }

  _calculateDistance(rssi) {
    return Math.pow(10, (-59 - rssi) / 20);
  }

  getDevices() { return Array.from(this.devices.values()); }

  getStats() {
    return {
      totalDevices:     this.devices.size,
      connectedDevices: this.connectedDevices.size,
      isScanning:       this.isScanning,
      isAdvertising:    this.isAdvertising,
      deviceName:       this.deviceName,
    };
  }

  addListener(cb)           { this.listeners.push(cb); }
  removeListener(cb)        { this.listeners = this.listeners.filter(l => l !== cb); }
  addMessageListener(cb)    { this.messageListeners.push(cb); }
  removeMessageListener(cb) { this.messageListeners = this.messageListeners.filter(l => l !== cb); }

  notifyListeners() {
    const devices = this.getDevices();
    this.listeners.forEach(cb => cb(devices));
  }

  notifyMessageListeners(raw) {
    this.messageListeners.forEach(cb => cb(raw));
  }

  cleanup() {
    this.stopScanning();
    this.stopAdvertising();
    this._stopGattServer();
    this._stopStaleCheck();
    this.gattSubscriptions.forEach(s => s.remove());
    this.gattSubscriptions = [];
    if (this.stateSubscription) { this.stateSubscription.remove(); this.stateSubscription = null; }
    this.devices.clear();
    this.connectedDevices.clear();
    this.listeners        = [];
    this.messageListeners = [];
  }
}

export default new BluetoothMeshService();