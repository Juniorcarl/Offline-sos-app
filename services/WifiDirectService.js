import { NativeModules, NativeEventEmitter, Platform, Alert } from 'react-native';
import * as Location from 'expo-location';

const { WifiDirectModule, WifiDirectSocketModule } = NativeModules;

const TAG = '[WifiDirectService]';
const STAG = '[WifiDirectSocketJS]';

const APP_ID = 'OfflineSOS';
const APP_VERSION = 1;
const HANDSHAKE_TIMEOUT_MS = 5000;
const REJECT_COOLDOWN_MS = 60000; // 1 min

class WifiDirectService {
  constructor() {
    this.devices = new Map();
    this.connectedDevices = new Map();

    this.listeners = [];
    this.messageListeners = [];

    this.isInitialized = false;
    this.isDiscovering = false;
    this.isConnected = false;
    this.isWifiDirectOn = false;

    this.localDeviceAddress = null;
    this.localDeviceName = null;

    this._eventEmitter = null;
    this._eventSubs = [];

    this._socketEmitter = null;
    this._socketSubs = [];

    this._isGroupOwner = false;
    this._groupOwnerAddress = null;
    this._socketConnected = false;

    this._pendingConnections = new Set();
    this._discoveryTimer = null;
    this._lastDiscoveryAt = 0;
    this._tiebreakToken = Math.random();

    this._sosDeviceName = null;
    this.onStateChanged = null;

    this._trustedPeer = false;
    this._handshakeSent = false;
    this._handshakeAcked = false;
    this._handshakeTimer = null;

    this._currentConnectedAddress = null;

    // NEW
    this.rejectedPeers = new Map(); // address -> timestamp
    this.trustedPeerAddresses = new Set();

    console.log(`${TAG} constructed`);
    console.log(`${TAG} Native module available: ${!!WifiDirectModule}`);
    console.log(`${TAG} Socket module available: ${!!WifiDirectSocketModule}`);
  }

  async initialize(force = false) {
    console.log(`${TAG} ══════════════════════════════════════`);
    console.log(`${TAG} initialize(force=${force})`);
    console.log(`${TAG} ══════════════════════════════════════`);

    if (Platform.OS !== 'android') {
      console.warn(`${TAG} Wi-Fi Direct only supported on Android`);
      return false;
    }

    if (!WifiDirectModule) {
      console.error(`${TAG} WifiDirectModule is missing`);
      return false;
    }

    if (this.isInitialized && !force) {
      console.log(`${TAG} already initialized`);
      return true;
    }

    try {
      if (force) {
        this._removeAllEventSubs();
      }

      await WifiDirectModule.initialize();
      console.log(`${TAG} native initialize() resolved`);

      this.isInitialized = true;

      this._sosDeviceName = `SOS_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      console.log(`${TAG} generated local SOS name ${this._sosDeviceName}`);

      try {
        await WifiDirectModule.setDeviceName(this._sosDeviceName);
        console.log(`${TAG} setDeviceName resolved`);
      } catch (e) {
        console.warn(`${TAG} setDeviceName warning: ${e?.message}`);
      }

      this._attachP2PEvents();
      this._attachSocketEvents();

      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`${TAG} init complete stats=`, this.getStats());
      return true;
    } catch (e) {
      console.error(`${TAG} initialize failed: ${e?.message}`, e);
      return false;
    }
  }

  _attachP2PEvents() {
    if (!this._eventEmitter) {
      this._eventEmitter = new NativeEventEmitter(WifiDirectModule);
    }

    this._eventSubs.push(
      this._eventEmitter.addListener('WifiDirectStateChanged', enabled => {
        console.log(`${TAG} EVENT WifiDirectStateChanged enabled=${enabled}`);
        this.isWifiDirectOn = !!enabled;

        if (this.onStateChanged) {
          try {
            this.onStateChanged(this.isWifiDirectOn);
          } catch (e) {
            console.error(`${TAG} onStateChanged callback error`, e);
          }
        }
      })
    );

    this._eventSubs.push(
      this._eventEmitter.addListener('WifiDirectThisDeviceChanged', info => {
        console.log(`${TAG} EVENT WifiDirectThisDeviceChanged`, info);
        this.localDeviceAddress = info?.deviceAddress || null;
        this.localDeviceName = info?.deviceName || null;
      })
    );

    this._eventSubs.push(
      this._eventEmitter.addListener('WifiDirectPeersFound', peers => {
        console.log(`${TAG} EVENT WifiDirectPeersFound count=${peers?.length ?? 0}`);
        this._handlePeersFound(peers || []);
      })
    );

    this._eventSubs.push(
      this._eventEmitter.addListener('WifiDirectConnected', info => {
        console.log(`${TAG} EVENT WifiDirectConnected`, info);
        this._handleConnected(info || {});
      })
    );

    this._eventSubs.push(
      this._eventEmitter.addListener('WifiDirectDisconnected', () => {
        console.log(`${TAG} EVENT WifiDirectDisconnected`);
        this._handleDisconnected();
      })
    );

    this._eventSubs.push(
      this._eventEmitter.addListener('WifiDirectError', err => {
        console.error(`${TAG} EVENT WifiDirectError`, err);
      })
    );

    console.log(`${TAG} attached ${this._eventSubs.length} P2P event listeners`);
  }

  _attachSocketEvents() {
    if (!WifiDirectSocketModule) {
      console.warn(`${TAG} WifiDirectSocketModule missing`);
      return;
    }

    if (!this._socketEmitter) {
      this._socketEmitter = new NativeEventEmitter(WifiDirectSocketModule);
    }

    this._socketSubs.push(
      this._socketEmitter.addListener('WifiDirectSocketConnected', info => {
        console.log(`${STAG} EVENT WifiDirectSocketConnected`, info);
        this._socketConnected = true;
        this._currentConnectedAddress = info?.remoteAddress || this._currentConnectedAddress;
        this._startHandshake();
      })
    );

    this._socketSubs.push(
      this._socketEmitter.addListener('WifiDirectSocketDisconnected', info => {
        console.warn(`${STAG} EVENT WifiDirectSocketDisconnected`, info);
        this._socketConnected = false;
        this._trustedPeer = false;
        this._handshakeSent = false;
        this._handshakeAcked = false;
        this._clearHandshakeTimer();
      })
    );

    this._socketSubs.push(
      this._socketEmitter.addListener('WifiDirectDataReceived', info => {
        const raw = info?.data;
        const remoteAddress = info?.remoteAddress || null;

        if (remoteAddress) {
          this._currentConnectedAddress = remoteAddress;
        }

        console.log(
          `${STAG} EVENT WifiDirectDataReceived from=${remoteAddress} len=${raw?.length}`
        );
        console.log(`${STAG} payload preview=${String(raw || '').slice(0, 120)}`);

        const handledByHandshake = this._maybeHandleHandshakeMessage(raw, remoteAddress);

        if (handledByHandshake) {
          return;
        }

        if (!this._trustedPeer) {
          console.warn(`${STAG} Ignoring app payload because peer is not trusted yet`);
          return;
        }

        this.messageListeners.forEach(cb => {
          try {
            cb(raw);
          } catch (e) {
            console.error(`${STAG} message listener error`, e);
          }
        });
      })
    );

    this._socketSubs.push(
      this._socketEmitter.addListener('WifiDirectSocketError', err => {
        console.error(`${STAG} EVENT WifiDirectSocketError`, err);
      })
    );

    console.log(`${TAG} attached ${this._socketSubs.length} socket listeners`);
  }

  _removeAllEventSubs() {
    this._eventSubs.forEach(s => s.remove());
    this._eventSubs = [];

    this._socketSubs.forEach(s => s.remove());
    this._socketSubs = [];
  }

  _cleanupRejectedPeers() {
    const now = Date.now();
    let removed = 0;

    for (const [addr, ts] of this.rejectedPeers.entries()) {
      if (now - ts > REJECT_COOLDOWN_MS) {
        this.rejectedPeers.delete(addr);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`${TAG} cleaned up ${removed} expired rejected peers`);
    }
  }

  _isRejected(address) {
    if (!address) return false;
    this._cleanupRejectedPeers();
    return this.rejectedPeers.has(address);
  }

  _rejectPeer(address, reason = 'unknown') {
    if (!address) return;

    console.warn(`${TAG} rejecting peer ${address} reason=${reason}`);
    this.rejectedPeers.set(address, Date.now());
    this.trustedPeerAddresses.delete(address);

    const existing = this.devices.get(address);
    if (existing) {
      this.devices.set(address, {
        ...existing,
        trusted: false,
        rejected: true,
        rejectedReason: reason,
      });
    }

    this.connectedDevices.delete(address);
    this.notifyListeners();
  }

  async startDiscovery() {
    console.log(`${TAG} ══════════════════════════════════════`);
    console.log(`${TAG} startDiscovery()`);
    console.log(`${TAG} isInitialized=${this.isInitialized}`);
    console.log(`${TAG} isWifiDirectOn=${this.isWifiDirectOn}`);
    console.log(`${TAG} isDiscovering=${this.isDiscovering}`);
    console.log(`${TAG} ══════════════════════════════════════`);

    if (!this.isInitialized) {
      console.warn(`${TAG} not initialized`);
      return false;
    }

    const locationEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
    console.log(`${TAG} location services enabled=${locationEnabled}`);

    if (Platform.Version >= 29 && !locationEnabled) {
      Alert.alert(
        'Location Required',
        'Turn on device location. Wi-Fi Direct discovery often fails on Android 10+ if location is off.'
      );
      console.warn(`${TAG} location is OFF, discovery likely to fail`);
      return false;
    }

    try {
      const nativeWifiEnabled = await WifiDirectModule.isWifiEnabled();
      console.log(`${TAG} native isWifiEnabled=${nativeWifiEnabled}`);
    } catch (e) {
      console.warn(`${TAG} failed to read native wifi state: ${e?.message}`);
    }

    try {
      await WifiDirectModule.discoverPeers();
      this.isDiscovering = true;
      this._lastDiscoveryAt = Date.now();
      console.log(`${TAG} discoverPeers() success`);

      if (this._discoveryTimer) clearInterval(this._discoveryTimer);
      this._discoveryTimer = setInterval(() => {
        if (!this.isDiscovering) return;
        this._cleanupRejectedPeers();
        const elapsed = Math.round((Date.now() - this._lastDiscoveryAt) / 1000);
        console.log(
          `${TAG} still discovering... ${elapsed}s devices=${this.getDevices().length} connected=${this.connectedDevices.size} rejected=${this.rejectedPeers.size}`
        );
      }, 5000);

      return true;
    } catch (e) {
      this.isDiscovering = false;
      console.error(`${TAG} startDiscovery failed: ${e?.message}`, e);
      return false;
    }
  }

  async stopDiscovery() {
    console.log(`${TAG} stopDiscovery()`);
    this.isDiscovering = false;

    if (this._discoveryTimer) {
      clearInterval(this._discoveryTimer);
      this._discoveryTimer = null;
    }

    try {
      await WifiDirectModule.stopDiscovery();
      console.log(`${TAG} stopDiscovery native resolved`);
    } catch (e) {
      console.warn(`${TAG} stopDiscovery warning: ${e?.message}`);
    }
  }

  _handlePeersFound(peers) {
    this._cleanupRejectedPeers();

    console.log(`${TAG} ══════════════════════════════════════`);
    console.log(`${TAG} _handlePeersFound count=${peers.length}`);
    console.log(`${TAG} localAddress=${this.localDeviceAddress}`);
    console.log(`${TAG} localName=${this.localDeviceName}`);
    console.log(`${TAG} rejectedPeers=${this.rejectedPeers.size}`);
    console.log(`${TAG} ══════════════════════════════════════`);

    peers.forEach((peer, index) => {
      console.log(
        `${TAG} peer[${index}] name=${peer?.deviceName} address=${peer?.deviceAddress} status=${peer?.status}`
      );
    });

    const incomingAddresses = new Set();

    peers.forEach(peer => {
      const address = peer?.deviceAddress;
      const name = peer?.deviceName || 'UNKNOWN';
      const status = peer?.status;

      if (!address) {
        console.warn(`${TAG} peer missing address`, peer);
        return;
      }

      incomingAddresses.add(address);

      const trusted = this.trustedPeerAddresses.has(address);
      const rejected = this._isRejected(address);

      const device = {
        id: address,
        name,
        address,
        peerStatus: status,
        isConnected: status === 0,
        transport: 'wifi-direct',
        trusted,
        rejected,
        lastSeen: Date.now(),
      };

      console.log(
        `${TAG} peer name=${name} address=${address} status=${status} connected=${device.isConnected} trusted=${trusted} rejected=${rejected}`
      );

      this.devices.set(address, device);

      if (device.isConnected) {
        this.connectedDevices.set(address, device);
        this._pendingConnections.delete(address);
      }
    });

    for (const [addr, dev] of this.devices.entries()) {
      if (!incomingAddresses.has(addr) && !dev.isConnected) {
        console.log(`${TAG} removing stale peer ${addr}`);
        this.devices.delete(addr);
      }
    }

    this.notifyListeners();

    const availablePeers = peers.filter(p => {
      const address = p?.deviceAddress;
      return p?.status === 3 && address && !this._isRejected(address);
    });

    if (availablePeers.length > 0) {
      this._maybeAutoConnect(availablePeers);
    } else {
      console.log(`${TAG} no AVAILABLE non-rejected peers to auto-connect right now`);
    }
  }

  async _maybeAutoConnect(availablePeers) {
    if (this.isConnected) {
      console.log(`${TAG} already connected, skipping auto-connect`);
      return;
    }

    const peer = availablePeers[0];
    const peerAddress = peer.deviceAddress;

    if (this._isRejected(peerAddress)) {
      console.log(`${TAG} peer ${peerAddress} is currently rejected, skipping`);
      return;
    }

    if (this._pendingConnections.has(peerAddress)) {
      console.log(`${TAG} connection already pending for ${peerAddress}`);
      return;
    }

    const localAddr = this.localDeviceAddress;
    const canCompare = localAddr && localAddr !== '02:00:00:00:00:00';
    const shouldInitiate = canCompare ? localAddr < peerAddress : this._tiebreakToken < 0.5;

    console.log(`${TAG} auto-connect decision`);
    console.log(`${TAG} localAddr=${localAddr}`);
    console.log(`${TAG} peerAddr=${peerAddress}`);
    console.log(`${TAG} canCompare=${canCompare}`);
    console.log(`${TAG} tiebreakToken=${this._tiebreakToken}`);
    console.log(`${TAG} shouldInitiate=${shouldInitiate}`);

    if (!shouldInitiate) {
      console.log(`${TAG} waiting for peer to initiate first`);
      return;
    }

    try {
      this._pendingConnections.add(peerAddress);
      console.log(`${TAG} calling connectToDevice(${peerAddress})`);
      await WifiDirectModule.connectToDevice(peerAddress);
      console.log(`${TAG} connectToDevice invitation sent`);
    } catch (e) {
      this._pendingConnections.delete(peerAddress);
      console.error(`${TAG} connectToDevice failed: ${e?.message}`, e);
    }
  }

  async _handleConnected(info) {
    console.log(`${TAG} ══════════════════════════════════════`);
    console.log(`${TAG} _handleConnected`);
    console.log(`${TAG} groupFormed=${info?.groupFormed}`);
    console.log(`${TAG} isGroupOwner=${info?.isGroupOwner}`);
    console.log(`${TAG} groupOwnerAddress=${info?.groupOwnerAddress}`);
    console.log(`${TAG} ══════════════════════════════════════`);

    this.isConnected = true;
    this.isDiscovering = false;
    this._isGroupOwner = !!info?.isGroupOwner;
    this._groupOwnerAddress = info?.groupOwnerAddress || null;
    this._trustedPeer = false;
    this._handshakeSent = false;
    this._handshakeAcked = false;
    this._clearHandshakeTimer();

    if (this._discoveryTimer) {
      clearInterval(this._discoveryTimer);
      this._discoveryTimer = null;
    }

    try {
      const peers = await WifiDirectModule.requestPeers();
      console.log(`${TAG} requestPeers after connect returned ${peers?.length ?? 0} peers`);

      (peers || []).forEach(peer => {
        if (peer.status === 0) {
          const updated = {
            id: peer.deviceAddress,
            name: peer.deviceName,
            address: peer.deviceAddress,
            peerStatus: peer.status,
            isConnected: true,
            transport: 'wifi-direct',
            trusted: this.trustedPeerAddresses.has(peer.deviceAddress),
            rejected: this._isRejected(peer.deviceAddress),
            lastSeen: Date.now(),
          };
          this.devices.set(peer.deviceAddress, updated);
          this.connectedDevices.set(peer.deviceAddress, updated);
          this._currentConnectedAddress = peer.deviceAddress;
        }
      });
    } catch (e) {
      console.warn(`${TAG} requestPeers after connect failed: ${e?.message}`);
    }

    this.notifyListeners();
    await this._setupSocket();
  }

  async _setupSocket() {
    console.log(`${STAG} ══════════════════════════════════════`);
    console.log(`${STAG} _setupSocket()`);
    console.log(`${STAG} isGroupOwner=${this._isGroupOwner}`);
    console.log(`${STAG} groupOwnerAddress=${this._groupOwnerAddress}`);
    console.log(`${STAG} socketModuleAvailable=${!!WifiDirectSocketModule}`);
    console.log(`${STAG} ══════════════════════════════════════`);

    if (!WifiDirectSocketModule) {
      console.warn(`${STAG} socket module unavailable`);
      return;
    }

    try {
      if (this._isGroupOwner) {
        console.log(`${STAG} starting TCP server as Group Owner`);
        await WifiDirectSocketModule.startServer();
        console.log(`${STAG} startServer() resolved`);
      } else if (this._groupOwnerAddress) {
        console.log(`${STAG} connecting TCP socket to GO ${this._groupOwnerAddress}:8989`);
        this._currentConnectedAddress = this._groupOwnerAddress;
        await WifiDirectSocketModule.connectSocket(this._groupOwnerAddress);
        console.log(`${STAG} connectSocket() resolved`);
      } else {
        console.warn(`${STAG} no group owner address available`);
      }
    } catch (e) {
      console.error(`${STAG} _setupSocket failed: ${e?.message}`, e);
    }
  }

  _startHandshake() {
    console.log(`${STAG} _startHandshake() socketConnected=${this._socketConnected}`);

    if (!this._socketConnected) {
      console.warn(`${STAG} cannot start handshake: socket not connected`);
      return;
    }

    this._clearHandshakeTimer();

    this._handshakeSent = true;
    this._handshakeAcked = false;
    this._trustedPeer = false;

    const hello = {
      type: 'HELLO',
      app: APP_ID,
      version: APP_VERSION,
      deviceName: this.localDeviceName || this._sosDeviceName || 'UNKNOWN',
      ts: Date.now(),
    };

    console.log(`${STAG} sending HELLO`, hello);

    this.sendRaw(JSON.stringify(hello));

    this._handshakeTimer = setTimeout(async () => {
      if (!this._handshakeAcked) {
        console.warn(`${STAG} HELLO timeout after ${HANDSHAKE_TIMEOUT_MS}ms — disconnecting`);
        if (this._currentConnectedAddress) {
          this._rejectPeer(this._currentConnectedAddress, 'handshake-timeout');
        }
        await this.disconnect();
      }
    }, HANDSHAKE_TIMEOUT_MS);
  }

  _clearHandshakeTimer() {
    if (this._handshakeTimer) {
      clearTimeout(this._handshakeTimer);
      this._handshakeTimer = null;
    }
  }

  _maybeHandleHandshakeMessage(raw, remoteAddress = null) {
    let msg;

    try {
      msg = JSON.parse(raw);
    } catch {
      return false;
    }

    if (!msg || !msg.type) {
      return false;
    }

    if (msg.type === 'HELLO') {
      console.log(`${STAG} received HELLO`, msg);

      if (msg.app !== APP_ID) {
        console.warn(`${STAG} peer is not our app, disconnecting`);
        if (remoteAddress) {
          this._rejectPeer(remoteAddress, 'wrong-app-on-hello');
        }
        this.disconnect();
        return true;
      }

      this._trustedPeer = true;

      if (remoteAddress) {
        this.trustedPeerAddresses.add(remoteAddress);
      }

      const ack = {
        type: 'HELLO_ACK',
        app: APP_ID,
        version: APP_VERSION,
        deviceName: this.localDeviceName || this._sosDeviceName || 'UNKNOWN',
        ts: Date.now(),
      };

      console.log(`${STAG} sending HELLO_ACK`, ack);
      this.sendRaw(JSON.stringify(ack));
      this._markConnectedPeersTrusted(remoteAddress);
      return true;
    }

    if (msg.type === 'HELLO_ACK') {
      console.log(`${STAG} received HELLO_ACK`, msg);

      if (msg.app !== APP_ID) {
        console.warn(`${STAG} invalid HELLO_ACK app id, disconnecting`);
        if (remoteAddress) {
          this._rejectPeer(remoteAddress, 'wrong-app-on-ack');
        }
        this.disconnect();
        return true;
      }

      this._handshakeAcked = true;
      this._trustedPeer = true;
      this._clearHandshakeTimer();

      if (remoteAddress) {
        this.trustedPeerAddresses.add(remoteAddress);
      }

      this._markConnectedPeersTrusted(remoteAddress);
      console.log(`${STAG} peer trusted ✅`);
      return true;
    }

    return false;
  }

  _markConnectedPeersTrusted(remoteAddress = null) {
    if (remoteAddress) {
      this.trustedPeerAddresses.add(remoteAddress);
    }

    for (const [addr, dev] of this.connectedDevices.entries()) {
      const updated = { ...dev, trusted: true, rejected: false };
      this.connectedDevices.set(addr, updated);
      this.devices.set(addr, updated);
      this.trustedPeerAddresses.add(addr);
      this.rejectedPeers.delete(addr);
    }

    this.notifyListeners();
  }

  _handleDisconnected() {
    console.log(`${TAG} ══════════════════════════════════════`);
    console.log(`${TAG} _handleDisconnected()`);
    console.log(`${TAG} clearing connected state`);
    console.log(`${TAG} ══════════════════════════════════════`);

    this.isConnected = false;
    this._socketConnected = false;
    this._isGroupOwner = false;
    this._groupOwnerAddress = null;
    this._trustedPeer = false;
    this._handshakeSent = false;
    this._handshakeAcked = false;
    this._clearHandshakeTimer();

    this.connectedDevices.clear();
    this._pendingConnections.clear();
    this._currentConnectedAddress = null;

    for (const [addr, dev] of this.devices.entries()) {
      const stillTrusted = this.trustedPeerAddresses.has(addr);
      const rejected = this._isRejected(addr);

      this.devices.set(addr, {
        ...dev,
        isConnected: false,
        trusted: stillTrusted,
        rejected,
      });
    }

    this.notifyListeners();
  }

  async disconnect() {
    console.log(`${TAG} disconnect()`);

    try {
      if (WifiDirectSocketModule) {
        await WifiDirectSocketModule.closeAll();
      }
    } catch (e) {
      console.warn(`${STAG} closeAll warning: ${e?.message}`);
    }

    try {
      await WifiDirectModule.disconnect();
      console.log(`${TAG} native disconnect resolved`);
    } catch (e) {
      console.warn(`${TAG} disconnect warning: ${e?.message}`);
    }

    this._handleDisconnected();
  }

  async sendRaw(data) {
    console.log(`${STAG} sendRaw len=${data?.length}`);
    console.log(`${STAG} socketConnected=${this._socketConnected}`);
    console.log(`${STAG} payloadPreview=${String(data || '').slice(0, 120)}`);

    if (!WifiDirectSocketModule) {
      console.warn(`${STAG} socket module unavailable`);
      return false;
    }

    try {
      await WifiDirectSocketModule.sendData(data);
      console.log(`${STAG} sendRaw resolved`);
      return true;
    } catch (e) {
      console.error(`${STAG} sendRaw failed: ${e?.message}`, e);
      return false;
    }
  }

  async sendData(data) {
    if (!this._trustedPeer) {
      console.warn(`${STAG} sendData blocked because peer is not trusted yet`);
      return false;
    }

    let payload = data;

    if (typeof data !== 'string') {
      payload = JSON.stringify(data);
    }

    return this.sendRaw(payload);
  }

  // NORMAL APP LIST
  getDevices() {
    this._cleanupRejectedPeers();

    return Array.from(this.devices.values()).filter(device => {
      // hide rejected peers from normal app list
      if (device.rejected || this._isRejected(device.address)) {
        return false;
      }

      // show trusted connected peers
      if (device.trusted) {
        return true;
      }

      // show non-rejected peers that are still candidates
      return true;
    });
  }

  // OPTIONAL DEBUG LIST
  getAllDevicesDebug() {
    this._cleanupRejectedPeers();
    return Array.from(this.devices.values()).map(device => ({
      ...device,
      rejected: device.rejected || this._isRejected(device.address),
      trusted: device.trusted || this.trustedPeerAddresses.has(device.address),
    }));
  }

  getStats() {
    return {
      isInitialized: this.isInitialized,
      isDiscovering: this.isDiscovering,
      isConnected: this.isConnected,
      isWifiDirectOn: this.isWifiDirectOn,
      localDeviceAddress: this.localDeviceAddress,
      localDeviceName: this.localDeviceName,
      isGroupOwner: this._isGroupOwner,
      groupOwnerAddress: this._groupOwnerAddress,
      socketConnected: this._socketConnected,
      trustedPeer: this._trustedPeer,
      handshakeSent: this._handshakeSent,
      handshakeAcked: this._handshakeAcked,
      totalDevicesVisible: this.getDevices().length,
      totalDevicesInternal: this.devices.size,
      connectedDevices: this.connectedDevices.size,
      rejectedPeers: this.rejectedPeers.size,
      trustedPeerAddresses: this.trustedPeerAddresses.size,
      sosDeviceName: this._sosDeviceName,
    };
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  addMessageListener(callback) {
    this.messageListeners.push(callback);
  }

  removeMessageListener(callback) {
    this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
  }

  notifyListeners() {
    const devices = this.getDevices();
    this.listeners.forEach(cb => {
      try {
        cb(devices);
      } catch (e) {
        console.error(`${TAG} notify listener error`, e);
      }
    });
  }

  async cleanup() {
    console.log(`${TAG} cleanup()`);

    try {
      await this.stopDiscovery();
    } catch (_) {}

    try {
      await this.disconnect();
    } catch (_) {}

    this._removeAllEventSubs();

    this.devices.clear();
    this.connectedDevices.clear();
    this._pendingConnections.clear();
    this.rejectedPeers.clear();
    this.trustedPeerAddresses.clear();

    this.listeners = [];
    this.messageListeners = [];

    this.isInitialized = false;
    this.isDiscovering = false;
    this.isConnected = false;
    this._socketConnected = false;
    this._trustedPeer = false;
    this._handshakeSent = false;
    this._handshakeAcked = false;
    this._currentConnectedAddress = null;
    this._clearHandshakeTimer();
  }
}

export default new WifiDirectService();