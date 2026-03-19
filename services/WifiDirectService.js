import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { WifiDirectModule } = NativeModules;

class WifiDirectService {
  constructor() {
    this.devices = new Map();
    this.connectedDevices = new Map();
    this.listeners = [];
    this.isDiscovering = false;
    this.isConnected = false;
    this.isInitialized = false;
    this.eventEmitter = null;
    this.eventSubscriptions = [];
    this.pendingConnections = new Set(); // addresses currently being connected
  }

  async initialize() {
    if (!WifiDirectModule) {
      console.warn('⚠️ WifiDirectModule not available');
      return false;
    }
    if (Platform.OS !== 'android') {
      console.warn('⚠️ WiFi Direct only supported on Android');
      return false;
    }

    try {
      await WifiDirectModule.initialize();
      this.isInitialized = true;
      this.eventEmitter = new NativeEventEmitter(WifiDirectModule);

      this.eventSubscriptions = [
        this.eventEmitter.addListener('WifiDirectPeersFound', (peers) => {
          this._handlePeersFound(peers);
        }),
        this.eventEmitter.addListener('WifiDirectConnected', (info) => {
          this._handleConnected(info);
        }),
        this.eventEmitter.addListener('WifiDirectDisconnected', () => {
          this._handleDisconnected();
        }),
        this.eventEmitter.addListener('WifiDirectStateChanged', (enabled) => {
          console.log('📶 WiFi Direct:', enabled ? 'ON' : 'OFF');
          if (!enabled) {
            this.devices.clear();
            this.connectedDevices.clear();
            this.pendingConnections.clear();
            this.isDiscovering = false;
            this.isConnected = false;
            this.notifyListeners();
          }
        }),
      ];

      console.log('✅ WifiDirectService initialized');
      return true;
    } catch (error) {
      console.error('❌ WifiDirectService init error:', error);
      return false;
    }
  }

  _handlePeersFound(peers) {
    console.log(`📶 WiFi Direct peers: ${peers.length}`);

    const currentAddresses = new Set(peers.map(p => p.deviceAddress));

    // Remove devices no longer in the peer list (unless connected)
    for (const [address] of this.devices.entries()) {
      if (!currentAddresses.has(address) && !this.connectedDevices.has(address)) {
        this.devices.delete(address);
      }
    }

    peers.forEach(peer => {
      const isConnected = peer.status === 0;   // WifiP2pDevice.CONNECTED
      const isAvailable = peer.status === 3;   // WifiP2pDevice.AVAILABLE
      const isInvited = peer.status === 1;     // WifiP2pDevice.INVITED (connecting)

      const deviceInfo = {
        id: peer.deviceAddress,
        name: peer.deviceName || `P2P_${peer.deviceAddress.slice(-5)}`,
        address: peer.deviceAddress,
        peerStatus: peer.status,
        isConnected: isConnected,
        transport: 'wifi-direct',
        rssi: -65,
        distance: 20,
        lastSeen: Date.now(),
      };

      this.devices.set(peer.deviceAddress, deviceInfo);

      if (isConnected) {
        this.connectedDevices.set(peer.deviceAddress, deviceInfo);
        this.pendingConnections.delete(peer.deviceAddress);
      }

      // Auto-connect to available peers that we're not already connecting to
      if (
        isAvailable &&
        !this.connectedDevices.has(peer.deviceAddress) &&
        !this.pendingConnections.has(peer.deviceAddress)
      ) {
        this._connectToDevice(peer.deviceAddress);
      }
    });

    this.notifyListeners();
  }

  _handleConnected(info) {
    console.log('✅ WiFi Direct group formed:', info);
    this.isConnected = true;

    // Request fresh peer list to get updated statuses
    WifiDirectModule.requestPeers()
      .then(peers => {
        peers.forEach(peer => {
          if (peer.status === 0) {
            const existing = this.devices.get(peer.deviceAddress);
            if (existing) {
              const updated = { ...existing, isConnected: true, peerStatus: 0 };
              this.devices.set(peer.deviceAddress, updated);
              this.connectedDevices.set(peer.deviceAddress, updated);
            }
          }
        });
        this.notifyListeners();
      })
      .catch(() => {
        // Fallback — mark all known peers with peerStatus 0 as connected
        for (const [address, device] of this.devices.entries()) {
          if (device.peerStatus === 0) {
            const updated = { ...device, isConnected: true };
            this.devices.set(address, updated);
            this.connectedDevices.set(address, updated);
          }
        }
        this.notifyListeners();
      });
  }

  _handleDisconnected() {
    console.log('📴 WiFi Direct disconnected');
    this.isConnected = false;
    this.connectedDevices.clear();
    this.pendingConnections.clear();

    for (const [address, device] of this.devices.entries()) {
      this.devices.set(address, { ...device, isConnected: false, peerStatus: 3 });
    }
    this.notifyListeners();
  }

  async _connectToDevice(deviceAddress) {
    if (!this.isInitialized) return;
    if (this.connectedDevices.has(deviceAddress)) return;
    if (this.pendingConnections.has(deviceAddress)) return;

    try {
      this.pendingConnections.add(deviceAddress);
      console.log(`🔗 WiFi Direct connecting to: ${deviceAddress}`);
      await WifiDirectModule.connectToDevice(deviceAddress);
      console.log(`✅ WiFi Direct connection initiated: ${deviceAddress}`);
    } catch (error) {
      console.error(`❌ WiFi Direct connect failed:`, error);
      this.pendingConnections.delete(deviceAddress);
    }
  }

  async startDiscovery() {
    if (!this.isInitialized || this.isDiscovering) return;
    try {
      await WifiDirectModule.discoverPeers();
      this.isDiscovering = true;
      console.log('🔍 WiFi Direct discovery started');
    } catch (error) {
      console.error('❌ WiFi Direct discovery error:', error);
      this.isDiscovering = false;
    }
  }

  async stopDiscovery() {
    if (!this.isInitialized) return;
    try {
      await WifiDirectModule.stopDiscovery();
    } catch (e) { /* ignore */ }
    this.isDiscovering = false;
  }

  async disconnect() {
    if (!this.isInitialized) return;
    try {
      await WifiDirectModule.disconnect();
    } catch (e) { /* ignore */ }
    this.isConnected = false;
    this.connectedDevices.clear();
    this.pendingConnections.clear();
  }

  getDevices() { return Array.from(this.devices.values()); }

  getStats() {
    return {
      totalDevices: this.devices.size,
      connectedDevices: this.connectedDevices.size,
      isDiscovering: this.isDiscovering,
      isConnected: this.isConnected,
      isInitialized: this.isInitialized,
    };
  }

  addListener(callback) { this.listeners.push(callback); }
  removeListener(callback) { this.listeners = this.listeners.filter(cb => cb !== callback); }
  notifyListeners() { this.listeners.forEach(cb => cb(this.getDevices())); }

  cleanup() {
    this.stopDiscovery();
    this.disconnect();
    this.eventSubscriptions.forEach(s => s.remove());
    this.eventSubscriptions = [];
    this.devices.clear();
    this.connectedDevices.clear();
    this.pendingConnections.clear();
    this.listeners = [];
    this.isInitialized = false;
  }
}

export default new WifiDirectService();