import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import * as Location from 'expo-location';

const { WifiDirectModule } = NativeModules;
const TAG = '[WifiDirect]';

class WifiDirectService {
  constructor() {
    this.devices            = new Map();
    this.connectedDevices   = new Map();
    this.listeners          = [];
    this.messageListeners   = [];
    this.isDiscovering      = false;
    this.isConnected        = false;
    this.isInitialized      = false;
    this.eventEmitter       = null;
    this.eventSubscriptions = [];
    this.pendingConnections  = new Set();
    this.onStateChanged      = null;
    this._initCount          = 0;
    this.localDeviceAddress  = null;
    this.isWifiDirectOn      = false;
    this._discoveryPending   = false;
    // Android 10+ masks local P2P MAC as 02:00:00:00:00:00 on all devices,
    // so address comparison is useless for the tie-breaker.
    // Use a stable random token instead — persists for the lifetime of this service.
    this._tiebreakToken      = Math.random();
    console.log(`${TAG} WifiDirectService constructed`);
    console.log(`${TAG}   WifiDirectModule available: ${!!WifiDirectModule}`);
    console.log(`${TAG}   Platform: ${Platform.OS} v${Platform.Version}`);
  }

  async initialize() {
    this._initCount++;
    console.log(`${TAG} ══════════════════════════════════`);
    console.log(`${TAG} ── initialize() call #${this._initCount} ──`);
    console.log(`${TAG}   isInitialized=${this.isInitialized} WifiDirectModule=${!!WifiDirectModule}`);

    if (!WifiDirectModule) {
      console.warn(`${TAG}   ⚠️ WifiDirectModule not available — module not linked?`);
      return false;
    }
    if (Platform.OS !== 'android') {
      console.warn(`${TAG}   ⚠️ WiFi Direct only supported on Android`);
      return false;
    }
    if (this.isInitialized) {
      console.warn(`${TAG}   ⚠️ already initialized — skipping`);
      return true;
    }

    try {
      console.log(`${TAG}   calling WifiDirectModule.initialize()...`);
      await WifiDirectModule.initialize();
      console.log(`${TAG}   ✅ WifiDirectModule.initialize() resolved`);

      this.isInitialized = true;
      this.eventEmitter  = new NativeEventEmitter(WifiDirectModule);
      console.log(`${TAG}   ✅ NativeEventEmitter created`);

      this.eventSubscriptions = [

        this.eventEmitter.addListener('WifiDirectPeersFound', (peers) => {
          console.log(`${TAG} ◀ EVENT WifiDirectPeersFound — ${peers?.length ?? 0} peers`);
          if (!peers || peers.length === 0) {
            console.log(`${TAG}   (empty peer list received)`);
          }
          this._handlePeersFound(peers || []);
        }),

        this.eventEmitter.addListener('WifiDirectConnected', (info) => {
          console.log(`${TAG} ◀ EVENT WifiDirectConnected`);
          console.log(`${TAG}   info: ${JSON.stringify(info)}`);
          this._handleConnected(info);
        }),

        this.eventEmitter.addListener('WifiDirectDisconnected', () => {
          console.log(`${TAG} ◀ EVENT WifiDirectDisconnected`);
          console.log(`${TAG}   wasConnected=${this.isConnected} connectedDevices=${this.connectedDevices.size}`);
          this._handleDisconnected();
        }),

        this.eventEmitter.addListener('WifiDirectThisDeviceChanged', (info) => {
          console.log(`${TAG} ◀ EVENT WifiDirectThisDeviceChanged`);
          console.log(`${TAG}   info: ${JSON.stringify(info)}`);
          if (info?.deviceAddress) {
            const prev = this.localDeviceAddress;
            this.localDeviceAddress = info.deviceAddress;
            console.log(`${TAG}   localDeviceAddress: ${prev} → ${this.localDeviceAddress}`);
          } else {
            console.warn(`${TAG}   ⚠️ no deviceAddress in event`);
          }
        }),

        this.eventEmitter.addListener('WifiDirectStateChanged', (enabled) => {
          console.log(`${TAG} ◀ EVENT WifiDirectStateChanged: ${enabled ? 'ENABLED' : 'DISABLED'}`);
          console.log(`${TAG}   previous isWifiDirectOn=${this.isWifiDirectOn}`);
          console.log(`${TAG}   isDiscovering=${this.isDiscovering} isConnected=${this.isConnected}`);
          console.log(`${TAG}   devices=${this.devices.size} pendingConnections=${this.pendingConnections.size}`);

          this.isWifiDirectOn = enabled;

          if (!enabled) {
            console.log(`${TAG}   WiFi Direct turned OFF — clearing all state`);
            this.devices.clear();
            this.connectedDevices.clear();
            this.pendingConnections.clear();
            this.isDiscovering = false;
            this.isConnected   = false;
            this.notifyListeners();
          } else {
            console.log(`${TAG}   WiFi Direct turned ON — ready for discovery`);
          }

          if (this.onStateChanged) {
            console.log(`${TAG}   calling onStateChanged(${enabled})`);
            this.onStateChanged(enabled);
          } else {
            console.warn(`${TAG}   ⚠️ onStateChanged is null — ConnectionManager not wired up yet?`);
          }
        }),

        this.eventEmitter.addListener('WifiDirectError', (error) => {
          console.error(`${TAG} ◀ EVENT WifiDirectError: ${JSON.stringify(error)}`);
        }),
      ];

      console.log(`${TAG}   ✅ ${this.eventSubscriptions.length} event listeners registered`);
      console.log(`${TAG} ── initialize() done ──`);
      console.log(`${TAG} ══════════════════════════════════`);
      return true;
    } catch (error) {
      console.error(`${TAG}   ❌ initialize() threw: ${error.message}`);
      console.error(`${TAG}   code=${error.code} full:`, error);
      return false;
    }
  }

  _handlePeersFound(peers) {
    console.log(`${TAG} ── _handlePeersFound: ${peers.length} peers ──`);
    console.log(`${TAG}   localDeviceAddress=${this.localDeviceAddress}`);
    peers.forEach((p, i) => {
      console.log(`${TAG}   [${i}] name=${p.deviceName} addr=${p.deviceAddress} status=${p.status} (0=connected,1=invited,2=failed,3=available,4=unavailable)`);
    });

    const currentAddresses = new Set(peers.map(p => p.deviceAddress));
    let removed = 0;
    for (const [address] of this.devices.entries()) {
      if (!currentAddresses.has(address) && !this.connectedDevices.has(address)) {
        console.log(`${TAG}   🗑️ removing stale device: ${address}`);
        this.devices.delete(address);
        removed++;
      }
    }
    if (removed > 0) console.log(`${TAG}   removed ${removed} stale devices`);

    peers.forEach(peer => {
      const isConnected = peer.status === 0;
      const isInvited   = peer.status === 1;
      const isFailed    = peer.status === 2;
      const isAvailable = peer.status === 3;
      const isUnavailable = peer.status === 4;

      console.log(`${TAG}   processing ${peer.deviceAddress} (${peer.deviceName}): isConnected=${isConnected} isInvited=${isInvited} isFailed=${isFailed} isAvailable=${isAvailable} isUnavailable=${isUnavailable}`);

      const deviceInfo = {
        id:         peer.deviceAddress,
        name:       peer.deviceName || `P2P_${peer.deviceAddress.slice(-5)}`,
        address:    peer.deviceAddress,
        peerStatus: peer.status,
        isConnected,
        transport:  'wifi-direct',
        rssi:       -65,
        distance:   20,
        lastSeen:   Date.now(),
      };

      this.devices.set(peer.deviceAddress, deviceInfo);

      if (isConnected) {
        console.log(`${TAG}   ✅ marking ${peer.deviceAddress} as connected`);
        this.connectedDevices.set(peer.deviceAddress, deviceInfo);
        this.pendingConnections.delete(peer.deviceAddress);
      }

      if (isFailed) {
        console.warn(`${TAG}   ⚠️ peer ${peer.deviceAddress} is in FAILED state`);
      }

      if (
        isAvailable &&
        !this.connectedDevices.has(peer.deviceAddress) &&
        !this.pendingConnections.has(peer.deviceAddress)
      ) {
        // Android 10+ always reports localDeviceAddress as 02:00:00:00:00:00 (privacy mask),
        // so address comparison fails — both phones get the same result and either both
        // connect or neither does.  Use _tiebreakToken (a random float set at construction)
        // instead: one phone will be < 0.5, the other (statistically) > 0.5.
        const isMaskedAddr = this.localDeviceAddress === '02:00:00:00:00:00' || !this.localDeviceAddress;
        const shouldInitiate = isMaskedAddr
          ? this._tiebreakToken < 0.5
          : this.localDeviceAddress < peer.deviceAddress;

        console.log(`${TAG}   tie-breaker: isMaskedAddr=${isMaskedAddr} token=${this._tiebreakToken.toFixed(4)} shouldInitiate=${shouldInitiate}`);

        if (shouldInitiate) {
          console.log(`${TAG}   → we initiate connection to ${peer.deviceAddress}`);
          this._connectToDevice(peer.deviceAddress);
        } else {
          console.log(`${TAG}   → waiting for peer ${peer.deviceAddress} to initiate (6s fallback)`);
          setTimeout(() => {
            const current = this.devices.get(peer.deviceAddress);
            const stillAvailable = current?.peerStatus === 3;
            const alreadyConnected = this.isConnected || this.connectedDevices.has(peer.deviceAddress);
            const pending = this.pendingConnections.has(peer.deviceAddress);
            console.log(`${TAG}   [6s fallback] addr=${peer.deviceAddress} stillAvailable=${stillAvailable} alreadyConnected=${alreadyConnected} pending=${pending}`);
            if (stillAvailable && !alreadyConnected && !pending) {
              console.log(`${TAG}   [6s fallback] → peer didn't initiate — we try now`);
              this._connectToDevice(peer.deviceAddress);
            } else {
              console.log(`${TAG}   [6s fallback] → no action needed`);
            }
          }, 6000);
        }
      }
    });

    console.log(`${TAG}   devices map size: ${this.devices.size} | connectedDevices: ${this.connectedDevices.size} | pending: ${this.pendingConnections.size}`);
    this.notifyListeners();
  }

  _handleConnected(info) {
    console.log(`${TAG} ── _handleConnected ──`);
    console.log(`${TAG}   groupFormed=${info?.groupFormed} isGroupOwner=${info?.isGroupOwner} groupOwnerAddress=${info?.groupOwnerAddress}`);
    this.isConnected = true;

    console.log(`${TAG}   calling WifiDirectModule.requestPeers() to confirm who connected...`);
    WifiDirectModule.requestPeers()
      .then(peers => {
        console.log(`${TAG}   requestPeers after connect: ${peers.length} peers`);
        peers.forEach((peer, i) => {
          console.log(`${TAG}     [${i}] name=${peer.deviceName} addr=${peer.deviceAddress} status=${peer.status}`);
          if (peer.status === 0) {
            const existing = this.devices.get(peer.deviceAddress);
            console.log(`${TAG}     → connected peer ${peer.deviceAddress} existing=${!!existing}`);
            if (existing) {
              const updated = { ...existing, isConnected: true, peerStatus: 0 };
              this.devices.set(peer.deviceAddress, updated);
              this.connectedDevices.set(peer.deviceAddress, updated);
              console.log(`${TAG}     ✅ updated ${peer.deviceAddress} as connected`);
            } else {
              console.warn(`${TAG}     ⚠️ connected peer ${peer.deviceAddress} not in devices map — adding fresh`);
              const fresh = {
                id: peer.deviceAddress, name: peer.deviceName || `P2P_${peer.deviceAddress.slice(-5)}`,
                address: peer.deviceAddress, peerStatus: 0, isConnected: true,
                transport: 'wifi-direct', rssi: -65, distance: 20, lastSeen: Date.now(),
              };
              this.devices.set(peer.deviceAddress, fresh);
              this.connectedDevices.set(peer.deviceAddress, fresh);
            }
          }
        });
        console.log(`${TAG}   connectedDevices after update: ${this.connectedDevices.size}`);
        this.notifyListeners();
      })
      .catch((err) => {
        console.error(`${TAG}   ❌ requestPeers after connect failed: ${err.message}`);
        console.log(`${TAG}   falling back to marking peerStatus=0 devices as connected`);
        let fallbackCount = 0;
        for (const [address, device] of this.devices.entries()) {
          if (device.peerStatus === 0) {
            const updated = { ...device, isConnected: true };
            this.devices.set(address, updated);
            this.connectedDevices.set(address, updated);
            fallbackCount++;
          }
        }
        console.log(`${TAG}   fallback marked ${fallbackCount} devices as connected`);
        this.notifyListeners();
      });
  }

  _handleDisconnected() {
    console.log(`${TAG} ── _handleDisconnected ──`);
    console.log(`${TAG}   connectedDevices=${this.connectedDevices.size} pendingConnections=${this.pendingConnections.size}`);
    this.isConnected = false;
    this.connectedDevices.clear();
    this.pendingConnections.clear();

    let updated = 0;
    for (const [address, device] of this.devices.entries()) {
      this.devices.set(address, { ...device, isConnected: false, peerStatus: 3 });
      updated++;
    }
    console.log(`${TAG}   reset ${updated} devices to available (peerStatus=3)`);
    this.notifyListeners();
  }

  async _connectToDevice(deviceAddress) {
    console.log(`${TAG} ── _connectToDevice: ${deviceAddress}`);
    console.log(`${TAG}   isInitialized=${this.isInitialized}`);
    console.log(`${TAG}   alreadyConnected=${this.connectedDevices.has(deviceAddress)}`);
    console.log(`${TAG}   pending=${this.pendingConnections.has(deviceAddress)}`);
    console.log(`${TAG}   isConnected(global)=${this.isConnected}`);
    console.log(`${TAG}   total pendingConnections: ${[...this.pendingConnections].join(', ') || 'none'}`);

    if (!this.isInitialized) {
      console.warn(`${TAG}   ⚠️ not initialized — aborting`);
      return;
    }
    if (this.connectedDevices.has(deviceAddress)) {
      console.warn(`${TAG}   ⚠️ already in connectedDevices — skipping`);
      return;
    }
    if (this.pendingConnections.has(deviceAddress)) {
      console.warn(`${TAG}   ⚠️ already pending — skipping`);
      return;
    }

    try {
      this.pendingConnections.add(deviceAddress);
      console.log(`${TAG}   calling WifiDirectModule.connectToDevice(${deviceAddress})...`);
      await WifiDirectModule.connectToDevice(deviceAddress);
      console.log(`${TAG}   ✅ connectToDevice call resolved (invite sent, waiting for WifiDirectConnected event)`);
    } catch (error) {
      console.error(`${TAG}   ❌ connectToDevice(${deviceAddress}) threw: ${error.message}`);
      console.error(`${TAG}   code=${error.code} full:`, error);
      this.pendingConnections.delete(deviceAddress);
      console.log(`${TAG}   removed ${deviceAddress} from pendingConnections`);
    }
  }

  async startDiscovery(retryCount = 0) {
    console.log(`${TAG} ── startDiscovery() retryCount=${retryCount}`);
    console.log(`${TAG}   isInitialized=${this.isInitialized} isDiscovering=${this.isDiscovering} _discoveryPending=${this._discoveryPending} isWifiDirectOn=${this.isWifiDirectOn}`);
    console.log(`${TAG}   WifiDirectModule=${!!WifiDirectModule}`);

    if (!this.isInitialized) {
      console.warn(`${TAG}   ⚠️ not initialized — aborting`);
      return;
    }
    if (this.isDiscovering || this._discoveryPending) {
      console.warn(`${TAG}   ⚠️ already discovering or pending — aborting`);
      return;
    }
    if (!this.isWifiDirectOn) {
      console.warn(`${TAG}   ⚠️ Wi-Fi Direct not yet ON — cannot start discovery`);
      console.warn(`${TAG}   Waiting for WifiDirectStateChanged(true) event to trigger discovery`);
      return;
    }

    // Claim the slot synchronously BEFORE any await to prevent two concurrent
    // callers both passing the guard above and racing into discoverPeers().
    this._discoveryPending = true;

    // On Android 10-12, discoverPeers() requires location services to be ON.
    // On Android 13+ with NEARBY_WIFI_DEVICES + neverForLocation this is not needed,
    // but we still log the state so we can see what's happening.
    try {
      const locationServicesOn = await Location.hasServicesEnabledAsync();
      console.log(`${TAG}   location services enabled: ${locationServicesOn} (Android SDK ${Platform.Version})`);
      if (!locationServicesOn && Platform.Version < 33) {
        console.error(`${TAG}   ❌ Location services are OFF — discoverPeers() will fail on Android <13`);
        console.error(`${TAG}   Ask user to enable location services and retry`);
        this._discoveryPending = false;
        // Retry every 5s while location is off
        setTimeout(() => {
          if (!this.isDiscovering && !this._discoveryPending) {
            console.log(`${TAG}   [location retry] rechecking...`);
            this.startDiscovery(retryCount);
          }
        }, 5000);
        return;
      }
    } catch (e) {
      console.warn(`${TAG}   could not check location services: ${e.message}`);
    }
    console.log(`${TAG}   calling WifiDirectModule.discoverPeers()...`);

    try {
      await WifiDirectModule.discoverPeers();
      this.isDiscovering     = true;
      this._discoveryPending = false;
      console.log(`${TAG}   ✅ discovery started`);
    } catch (error) {
      console.error(`${TAG}   ❌ discoverPeers() threw (attempt ${retryCount + 1}): ${error.message}`);
      console.error(`${TAG}   code=${error.code}`);
      this.isDiscovering     = false;
      this._discoveryPending = false;

      const isError0 = error.message?.includes('ERROR(0)') || error.code === 'DISCOVERY_FAILED';

      if (isError0) {
        // ERROR(0) = WifiP2pManager.ERROR
        // On Samsung Android 13+ this fires even with location ON when the P2P channel
        // has become stale. Fix: stop any pending discovery, reinitialize the native
        // channel, then wait 3s for the framework to settle before retrying.
        console.error(`${TAG}   ⚠️ ERROR(0) detected — WifiP2p channel is stale`);
        console.error(`${TAG}   → Resetting WifiP2p state + reinitializing channel...`);
        // stopDiscovery + disconnect (removeGroup) clears the Android WifiP2p system
        // service state — just recreating the channel object is not enough.
        try { await WifiDirectModule.stopDiscovery(); } catch (_) {}
        try { await WifiDirectModule.disconnect();    } catch (_) {}
        try {
          await WifiDirectModule.initialize();
          console.log(`${TAG}   ✅ channel reinitialized`);
        } catch (reinitErr) {
          console.error(`${TAG}   ❌ reinitialize also failed: ${reinitErr.message}`);
        }
        // Give the Android WifiP2p framework time to settle after full reset
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      if (retryCount < 3) {
        const delay = isError0 ? 1000 : (retryCount + 1) * 2000;
        console.log(`${TAG}   retrying in ${delay}ms... (attempt ${retryCount + 2} of 4)`);
        setTimeout(() => this.startDiscovery(retryCount + 1), delay);
      } else {
        console.error(`${TAG}   💀 all 4 discovery attempts exhausted`);
        console.log(`${TAG}   scheduling background retry every 15s...`);
        const retryTimer = setInterval(() => {
          if (!this.isWifiDirectOn) {
            console.log(`${TAG}   [bg retry] WiFi Direct off — clearing timer`);
            clearInterval(retryTimer);
            return;
          }
          if (!this.isDiscovering && !this._discoveryPending) {
            console.log(`${TAG}   [bg retry] attempting discovery again (full reset first)`);
            clearInterval(retryTimer);
            Promise.resolve()
              .then(() => WifiDirectModule.stopDiscovery().catch(() => {}))
              .then(() => WifiDirectModule.disconnect().catch(() => {}))
              .then(() => WifiDirectModule.initialize())
              .then(() => new Promise(r => setTimeout(r, 3000)))
              .then(() => this.startDiscovery(0))
              .catch(e => {
                console.error(`${TAG}   [bg retry] reset failed: ${e.message}`);
                this.startDiscovery(0);
              });
          }
        }, 15000);
      }
    }
  }

  async stopDiscovery() {
    console.log(`${TAG} ── stopDiscovery() — isInitialized=${this.isInitialized} isDiscovering=${this.isDiscovering}`);
    if (!this.isInitialized) {
      console.log(`${TAG}   not initialized — nothing to stop`);
      return;
    }
    try {
      await WifiDirectModule.stopDiscovery();
      console.log(`${TAG}   ✅ stopDiscovery success`);
    } catch (e) {
      console.error(`${TAG}   ❌ stopDiscovery threw: ${e.message} (code=${e.code})`);
    }
    this.isDiscovering     = false;
    this._discoveryPending = false;
  }

  async disconnect() {
    console.log(`${TAG} ── disconnect() — isInitialized=${this.isInitialized} isConnected=${this.isConnected}`);
    if (!this.isInitialized) {
      console.log(`${TAG}   not initialized — nothing to disconnect`);
      return;
    }
    try {
      await WifiDirectModule.disconnect();
      console.log(`${TAG}   ✅ disconnect success`);
    } catch (e) {
      console.error(`${TAG}   ❌ disconnect threw: ${e.message}`);
    }
    this.isConnected = false;
    this.connectedDevices.clear();
    this.pendingConnections.clear();
  }

  broadcastData(encodedPayload) {
    const count = this.connectedDevices.size;
    console.log(`${TAG} ── broadcastData() — connectedDevices=${count}`);
    if (count === 0) {
      console.warn(`${TAG}   ⚠️ no WD connected devices — nothing to broadcast`);
      return;
    }
    console.warn(`${TAG}   ⚠️ WifiDirectService.broadcastData() is NOT YET IMPLEMENTED — message dropped`);
    // TODO: implement socket/TCP broadcast over Wi-Fi Direct group
  }

  getDevices() {
    return Array.from(this.devices.values());
  }

  getStats() {
    return {
      totalDevices:     this.devices.size,
      connectedDevices: this.connectedDevices.size,
      isDiscovering:    this.isDiscovering,
      isConnected:      this.isConnected,
      isInitialized:    this.isInitialized,
      localAddress:     this.localDeviceAddress,
      isWifiDirectOn:   this.isWifiDirectOn,
    };
  }

  addListener(callback) {
    this.listeners.push(callback);
    console.log(`${TAG}   addListener — total: ${this.listeners.length}`);
  }
  removeListener(callback) { this.listeners = this.listeners.filter(cb => cb !== callback); }

  addMessageListener(callback) {
    this.messageListeners.push(callback);
    console.log(`${TAG}   addMessageListener — total: ${this.messageListeners.length}`);
  }
  removeMessageListener(callback) { this.messageListeners = this.messageListeners.filter(cb => cb !== callback); }

  notifyListeners() {
    const devices = this.getDevices();
    console.log(`${TAG} notifyListeners — ${devices.length} devices, ${this.listeners.length} listeners`);
    devices.forEach(d => {
      console.log(`${TAG}   device: name=${d.name} addr=${d.address} connected=${d.isConnected} peerStatus=${d.peerStatus}`);
    });
    this.listeners.forEach(cb => cb(devices));
  }

  cleanup() {
    console.log(`${TAG} ── cleanup() ──`);
    this.stopDiscovery();
    this.disconnect();
    this.eventSubscriptions.forEach(s => s.remove());
    this.eventSubscriptions = [];
    this.devices.clear();
    this.connectedDevices.clear();
    this.pendingConnections.clear();
    this.listeners         = [];
    this.messageListeners  = [];
    this.isInitialized     = false;
    this.onStateChanged    = null;
    console.log(`${TAG}   cleanup done`);
  }
}

export default new WifiDirectService();
