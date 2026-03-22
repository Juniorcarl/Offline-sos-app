import { Platform, PermissionsAndroid } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import bluetoothMeshService from './BluetoothMeshService';
import wifiDirectService from './WifiDirectService';
import messageService from './MessageService';

/**
 * Pick the best display name from two device records.
 * Priority:
 *   1. A name that starts with "SOS_"  (our BLE advertised name)
 *   2. Any non-empty name that isn't a raw MAC / P2P fallback
 *   3. Whatever is non-null
 */
function bestName(a, b) {
  const prefer = (n) =>
    n && n.trim().length > 0 && !n.match(/^P2P_|^Device /i);

  if (a?.startsWith('SOS_')) return a;
  if (b?.startsWith('SOS_')) return b;
  if (prefer(a)) return a;
  if (prefer(b)) return b;
  return a || b || null;
}

class ConnectionManager {
  constructor() {
    this.devices              = new Map();
    this.listeners            = [];
    this.bluetoothEnabled     = false;
    this.wifiEnabled          = false;
    this.wifiDirectEnabled    = false;
    this.isScanning           = false;
    this._wdRestartInterval   = null;
    this._netInfoUnsubscribe  = null;
  }

  // ── Permissions ────────────────────────────────────────────────────────────

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

  // ── Initialise ─────────────────────────────────────────────────────────────

  async initialize() {
    console.log('🔧 Initializing ConnectionManager...');

    const btReady = await bluetoothMeshService.initialize();
    this.bluetoothEnabled = btReady;
    console.log('🔵 Bluetooth ready:', btReady);

    const wdReady = await wifiDirectService.initialize();
    this.wifiDirectEnabled = wdReady;
    console.log('📶 WiFi Direct ready:', wdReady);

    // ── Init MessageService with this manager + our device id ────────────────
    messageService.init(this, bluetoothMeshService.deviceName);
    console.log('💬 MessageService initialized with id:', bluetoothMeshService.deviceName);

    // Keep wifiDirectEnabled in sync when the user toggles Wi-Fi on/off
    wifiDirectService.onStateChanged = (enabled) => {
      console.log('📶 ConnectionManager: WiFi Direct state →', enabled);
      this.wifiDirectEnabled = enabled;

      if (enabled && !wifiDirectService.isDiscovering) {
        wifiDirectService.startDiscovery();
      }

      this.notifyListeners();
    };

    await this.checkWifiState();

    this._netInfoUnsubscribe = NetInfo.addEventListener(state => {
      this.wifiEnabled = state.type === 'wifi' && state.isConnected;
    });

    bluetoothMeshService.addListener(this._handleBluetoothDevices.bind(this));
    wifiDirectService.addListener(this._handleWifiDirectDevices.bind(this));

    // ── Wire incoming mesh data into MessageService ───────────────────────────
    bluetoothMeshService.addMessageListener(this._handleIncomingData.bind(this));
    wifiDirectService.addMessageListener?.(this._handleIncomingData.bind(this));

    console.log('✅ ConnectionManager initialized');
  }

  // ── Incoming mesh data ─────────────────────────────────────────────────────

  /**
   * Called by BluetoothMeshService / WifiDirectService whenever raw data
   * arrives from a peer. Hands it straight to MessageService for dedup + relay.
   */
  _handleIncomingData(rawData) {
    messageService.handleIncoming(rawData);
  }

  // ── Device merge helpers ───────────────────────────────────────────────────

  /**
   * Called whenever BluetoothMeshService reports its current device list.
   */
  _handleBluetoothDevices(devices) {
    const bleIds = new Set(devices.map(d => d.id));

    // Remove stale BLE-only entries
    for (const [id, device] of this.devices.entries()) {
      if (device.transport === 'bluetooth' && !bleIds.has(id)) {
        this.devices.delete(id);
      }
    }

    devices.forEach(device => {
      const existing = this.devices.get(device.id);

      if (existing && existing.transport === 'wifi-direct') {
        this.devices.set(device.id, {
          ...existing,
          ...device,
          name: bestName(device.name, existing.name),
          transport: 'both',
          wifiDirectConnected: existing.isConnected,
        });
      } else if (existing && existing.transport === 'both') {
        this.devices.set(device.id, {
          ...existing,
          rssi:        device.rssi,
          distance:    device.distance,
          lastSeen:    device.lastSeen,
          name:        bestName(device.name, existing.name),
          isConnected: device.isConnected || existing.wifiDirectConnected,
        });
      } else {
        this.devices.set(device.id, { ...device, transport: 'bluetooth' });
      }
    });

    this.notifyListeners();
  }

  /**
   * Called whenever WifiDirectService reports its current peer list.
   */
  _handleWifiDirectDevices(devices) {
    const wdIds = new Set(devices.map(d => d.id));

    // Remove stale WiFi-Direct-only entries
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
          name: bestName(existing.name, device.name),
          wifiDirectConnected: device.isConnected,
          isConnected: existing.isConnected || device.isConnected,
          address: device.address,
          peerStatus: device.peerStatus,
        });
      } else if (existing && existing.transport === 'both') {
        this.devices.set(device.id, {
          ...existing,
          wifiDirectConnected: device.isConnected,
          isConnected: existing.isConnected || device.isConnected,
          address: device.address,
          peerStatus: device.peerStatus,
          name: bestName(existing.name, device.name),
        });
      } else {
        this.devices.set(device.id, { ...device, transport: 'wifi-direct' });
      }
    });

    this.notifyListeners();
  }

  // ── WiFi state ─────────────────────────────────────────────────────────────

  async checkWifiState() {
    const state = await NetInfo.fetch();
    this.wifiEnabled = state.type === 'wifi' && state.isConnected;
  }

  // ── Scanning ───────────────────────────────────────────────────────────────

  startScanning() {
    console.log('🔍 Starting scanning...');
    this.isScanning = true;

    if (this.bluetoothEnabled) {
      bluetoothMeshService.startScanning();
    }

    if (this.wifiDirectEnabled) {
      wifiDirectService.startDiscovery();

      // Android stops peer discovery after ~2 min — keep restarting
      this._wdRestartInterval = setInterval(() => {
        if (this.wifiDirectEnabled) {
          console.log('🔄 Restarting WiFi Direct discovery...');
          wifiDirectService.stopDiscovery().then(() => {
            setTimeout(() => wifiDirectService.startDiscovery(), 1000);
          });
        }
      }, 110_000);
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

  // ── Public API ─────────────────────────────────────────────────────────────

  getDevices() {
    return Array.from(this.devices.values());
  }

  getStats() {
    const btStats = bluetoothMeshService.getStats();
    const wdStats = wifiDirectService.getStats();

    return {
      totalDevices:      this.devices.size,
      bluetoothEnabled:  this.bluetoothEnabled,
      wifiEnabled:       this.wifiEnabled,
      wifiDirectEnabled: this.wifiDirectEnabled,
      isScanning:        btStats.isScanning || wdStats.isDiscovering,
      isAdvertising:     btStats.isAdvertising,
      deviceName:        btStats.deviceName,
    };
  }

  setBluetoothEnabled(enabled) {
    this.bluetoothEnabled = enabled;
    if (!enabled) {
      for (const [id, device] of this.devices.entries()) {
        if (device.transport === 'bluetooth') {
          this.devices.delete(id);
        } else if (device.transport === 'both') {
          this.devices.set(id, {
            ...device,
            transport:   'wifi-direct',
            isConnected: device.wifiDirectConnected || false,
          });
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
      if (!wifiDirectService.isDiscovering) {
        wifiDirectService.startDiscovery();
      }
    }
  }

  /**
   * Broadcast an encoded message payload to all connected peers.
   * Called by MessageService when sending or relaying a packet.
   */
  sendMessage(encodedPayload) {
    if (this.bluetoothEnabled) {
      bluetoothMeshService.broadcastData(encodedPayload);
    }
    if (this.wifiDirectEnabled) {
      wifiDirectService.broadcastData?.(encodedPayload);
    }
  }

  addListener(callback)    { this.listeners.push(callback); }
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