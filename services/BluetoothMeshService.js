import { BleManager } from 'react-native-ble-plx';
import BLEAdvertiser from 'react-native-ble-advertiser';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';

const SERVICE_UUID        = '0000FFF0-0000-1000-8000-00805F9B34FB';
const CHARACTERISTIC_UUID = '0000FFF1-0000-1000-8000-00805F9B34FB';
const COMPANY_ID          = 0x00E0;
const STALE_THRESHOLD     = 45000;
const STALE_CHECK_INTERVAL = 5000;
const READVERTISE_INTERVAL = 10000;

const TAG = '[BLE]';
const { BluetoothModule } = NativeModules;

class BluetoothMeshService {
  constructor() {
    this.manager            = new BleManager();
    // Map key: SOS_ name (stable across MAC rotations)
    // Map value: { id: mac, name: SOS_XXXXXX, rssi, distance, lastSeen, isConnected, transport }
    this.devices            = new Map();
    // Map key: SOS_ name  /  Map value: PLX device object (has .id = MAC)
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
    // Set of SOS_ names currently being connected
    this.connectingDevices  = new Set();
    console.log(`${TAG} BluetoothMeshService constructed — deviceName=${this.deviceName}`);
    console.log(`${TAG} BluetoothModule available: ${!!BluetoothModule}`);
    console.log(`${TAG} Platform: ${Platform.OS} SDK: ${Platform.Version}`);
  }

  // ── initialize — permissions already granted by PermissionManager ─────────
  async initialize() {
    console.log(`${TAG} ── initialize() called ──`);
    console.log(`${TAG}   BluetoothModule: ${!!BluetoothModule}`);

    if (BluetoothModule) {
      console.log(`${TAG}   Setting up NativeEventEmitter for BluetoothModule`);
      this.nativeEventEmitter = new NativeEventEmitter(BluetoothModule);

      const connSub = this.nativeEventEmitter.addListener(
        'GattDeviceConnected',
        (address) => {
          console.log(`${TAG} ◀ EVENT GattDeviceConnected (server-side): address=${address}`);
          // This fires when a REMOTE device connects TO OUR GATT server.
          // Find the device by MAC address in our name-keyed map.
          let found = false;
          for (const [name, device] of this.devices.entries()) {
            if (device.id === address) {
              console.log(`${TAG}   matched device name=${name} mac=${address}`);
              this.devices.set(name, { ...device, isConnected: true });
              found = true;
              this.notifyListeners();
              // If we don't already have a PLX outgoing connection, connect back.
              setTimeout(() => {
                if (this.isBluetoothOn && !this.connectedDevices.has(name)) {
                  console.log(`${TAG}   [post-server-connect] connecting back to ${name}`);
                  this._connectToDevice(name);
                }
              }, 1500);
              break;
            }
          }
          if (!found) {
            // Device connected to our GATT server but we haven't scanned it yet
            // (or its name doesn't start with SOS_). We can't create a name-keyed
            // entry without knowing the name — the next scan will pick it up.
            console.log(`${TAG}   GattDeviceConnected: unknown address ${address} — waiting for scan to discover it`);
          }
        }
      );

      const disconnSub = this.nativeEventEmitter.addListener(
        'GattDeviceDisconnected',
        (address) => {
          console.log(`${TAG} ◀ EVENT GattDeviceDisconnected (server-side): address=${address}`);
          let found = false;
          for (const [name, device] of this.devices.entries()) {
            if (device.id === address) {
              console.log(`${TAG}   matched device name=${name} mac=${address}`);
              if (!this.connectedDevices.has(name)) {
                this.devices.set(name, { ...device, isConnected: false });
                this.notifyListeners();
              }
              found = true;
              break;
            }
          }
          if (!found) {
            console.log(`${TAG}   GattDeviceDisconnected: unknown address ${address}`);
          }
        }
      );

      const msgSub = this.nativeEventEmitter.addListener(
        'GattMessageReceived',
        (data) => {
          console.log(`${TAG} ════════════════════════════════`);
          console.log(`${TAG} ◀◀◀ GattMessageReceived FIRED ◀◀◀`);
          console.log(`${TAG}   data is null? ${data == null}`);
          console.log(`${TAG}   data keys: ${Object.keys(data || {}).join(', ')}`);
          console.log(`${TAG}   data.value exists? ${data?.value != null}`);
          console.log(`${TAG}   data.value type: ${typeof data?.value}`);
          console.log(`${TAG}   data.value length: ${data?.value?.length}`);
          console.log(`${TAG}   data.value (first 100 chars): ${JSON.stringify(data?.value || '').substring(0, 100)}`);
          try {
            if (!data?.value) {
              console.error(`${TAG}   ❌ data.value is empty or null — cannot decode`);
              return;
            }
            const raw = atob(data.value);
            console.log(`${TAG}   ✅ atob decode succeeded`);
            console.log(`${TAG}   decoded length: ${raw.length} chars`);
            console.log(`${TAG}   decoded message (first 200 chars): ${raw.substring(0, 200)}`);
            console.log(`${TAG}   calling notifyMessageListeners (${this.messageListeners.length} listeners)...`);
            this.notifyMessageListeners(raw);
            console.log(`${TAG}   ✅ notifyMessageListeners done`);
          } catch (e) {
            console.error(`${TAG}   ❌ BLE message decode error: ${e.message}`);
            console.error(`${TAG}   ❌ raw value was: ${JSON.stringify(data?.value)}`);
          }
          console.log(`${TAG} ════════════════════════════════`);
        }
      );

      this.gattSubscriptions = [connSub, disconnSub, msgSub];
      console.log(`${TAG}   ✅ ${this.gattSubscriptions.length} GATT event listeners registered`);
    } else {
      console.warn(`${TAG}   ⚠️ BluetoothModule is null — GATT events will NOT fire`);
    }

    console.log(`${TAG}   Subscribing to BleManager state changes...`);
    this.stateSubscription = this.manager.onStateChange((state) => {
      console.log(`${TAG} ◀ BT STATE CHANGE: ${state}`);
      if (state === 'PoweredOn') {
        this.isBluetoothOn = true;
        console.log(`${TAG}   → Bluetooth ON — triggering _onBluetoothOn()`);
        this._onBluetoothOn();
      } else {
        console.log(`${TAG}   → Bluetooth NOT ON (${state}) — triggering _onBluetoothOff()`);
        this._onBluetoothOff();
      }
    });

    const state = await this.manager.state();
    console.log(`${TAG}   Initial BT state from manager.state(): ${state}`);
    if (state === 'PoweredOn') {
      this.isBluetoothOn = true;
      console.log(`${TAG}   Bluetooth already ON — calling _onBluetoothOn() immediately`);
      await this._onBluetoothOn();
      return true;
    }

    console.log(`${TAG}   ⚠️ Bluetooth is ${state} — waiting for user to enable`);
    return false;
  }

  async _onBluetoothOn() {
    console.log(`${TAG} ── _onBluetoothOn() ──`);
    console.log(`${TAG}   gattServerRunning=${this.gattServerRunning} isAdvertising=${this.isAdvertising} isScanning=${this.isScanning}`);
    await this._startGattServer();
    await this.startAdvertising();
    this.startScanning();
    this._startStaleCheck();
    console.log(`${TAG}   _onBluetoothOn() done`);
  }

  _onBluetoothOff() {
    console.log(`${TAG} ── _onBluetoothOff() ──`);
    console.log(`${TAG}   clearing ${this.devices.size} devices, ${this.connectedDevices.size} connected`);
    this.isBluetoothOn      = false;
    this.isScanning         = false;
    this.isAdvertising      = false;
    this.gattServerRunning  = false;
    this._stopStaleCheck();
    this._stopReadvertise();
    this.connectingDevices.clear();
    this.devices.clear();
    this.connectedDevices.clear();
    this.notifyListeners();
  }

  async _startGattServer() {
    console.log(`${TAG} ── _startGattServer() — BluetoothModule=${!!BluetoothModule} gattServerRunning=${this.gattServerRunning}`);
    if (!BluetoothModule) {
      console.warn(`${TAG}   ⚠️ BluetoothModule not available — cannot start GATT server`);
      return;
    }
    if (this.gattServerRunning) {
      console.log(`${TAG}   already running — skipping`);
      return;
    }
    this.gattServerRunning = true;
    try {
      // Set the Android Bluetooth device name so peers can discover us by "SOS_" prefix.
      try {
        await BluetoothModule.setDeviceName(this.deviceName);
        console.log(`${TAG}   ✅ Bluetooth device name set to ${this.deviceName}`);
      } catch (e) {
        console.warn(`${TAG}   ⚠️ setDeviceName failed: ${e.message}`);
      }
      console.log(`${TAG}   calling BluetoothModule.startGattServer()...`);
      await BluetoothModule.startGattServer();
      console.log(`${TAG}   ✅ GATT server running`);
    } catch (e) {
      console.error(`${TAG}   ❌ GATT server start failed: ${e.message}`);
      console.error(`${TAG}   error code: ${e.code} | full:`, e);
      this.gattServerRunning = false;
    }
  }

  async _stopGattServer() {
    console.log(`${TAG} ── _stopGattServer() — BluetoothModule=${!!BluetoothModule} gattServerRunning=${this.gattServerRunning}`);
    if (!BluetoothModule || !this.gattServerRunning) return;
    try {
      await BluetoothModule.stopGattServer();
      this.gattServerRunning = false;
      console.log(`${TAG}   ✅ GATT server stopped`);
    } catch (e) {
      console.error(`${TAG}   ❌ GATT server stop failed: ${e.message}`);
    }
  }

  async startAdvertising() {
    console.log(`${TAG} ── startAdvertising() — isBluetoothOn=${this.isBluetoothOn} isAdvertising=${this.isAdvertising}`);
    if (!this.isBluetoothOn) {
      console.warn(`${TAG}   ⚠️ BT not on — skipping`);
      return;
    }
    if (this.isAdvertising) {
      console.log(`${TAG}   already advertising — skipping`);
      return;
    }
    try {
      console.log(`${TAG}   deviceName=${this.deviceName} SERVICE_UUID=${SERVICE_UUID} COMPANY_ID=0x${COMPANY_ID.toString(16)}`);
      BLEAdvertiser.setCompanyId(COMPANY_ID);
      console.log(`${TAG}   calling BLEAdvertiser.broadcast()...`);
      await BLEAdvertiser.broadcast(SERVICE_UUID, [], {
        advertiseMode:        2,
        txPowerLevel:         3,
        connectable:          true,
        includeDeviceName:    true,
        includeTxPowerLevel:  false,
      });
      this.isAdvertising = true;
      console.log(`${TAG}   ✅ Advertising started as ${this.deviceName}`);
      this._startReadvertise();
    } catch (error) {
      console.error(`${TAG}   ❌ Advertising error: ${error.message}`);
      console.error(`${TAG}   error code: ${error.code} | full:`, error);
      this.isAdvertising = false;
    }
  }

  async stopAdvertising() {
    console.log(`${TAG} ── stopAdvertising() — isAdvertising=${this.isAdvertising}`);
    this._stopReadvertise();
    if (!this.isAdvertising) {
      console.log(`${TAG}   not advertising — nothing to stop`);
      return;
    }
    if (!this.isBluetoothOn) {
      this.isAdvertising = false;
      console.log(`${TAG}   BT off — just clearing flag`);
      return;
    }
    try {
      await BLEAdvertiser.stopBroadcast();
      console.log(`${TAG}   ✅ Advertising stopped`);
    } catch (e) {
      console.error(`${TAG}   ❌ stopBroadcast error: ${e.message}`);
    }
    this.isAdvertising = false;
  }

  _startReadvertise() {
    this._stopReadvertise();
    console.log(`${TAG}   readvertise interval set (every ${READVERTISE_INTERVAL}ms)`);
    this.readvertiseInterval = setInterval(async () => {
      if (!this.isBluetoothOn) {
        console.log(`${TAG}   [readvertise] BT off — skipping`);
        return;
      }
      console.log(`${TAG}   [readvertise] cycling advertising...`);
      try {
        await BLEAdvertiser.stopBroadcast();
        this.isAdvertising = false;
        console.log(`${TAG}   [readvertise] stopped old broadcast, waiting 500ms...`);
        await new Promise(r => setTimeout(r, 500));
        await this.startAdvertising();
      } catch (e) {
        console.error(`${TAG}   [readvertise] error: ${e.message}`);
      }
    }, READVERTISE_INTERVAL);
  }

  _stopReadvertise() {
    if (this.readvertiseInterval) {
      clearInterval(this.readvertiseInterval);
      this.readvertiseInterval = null;
      console.log(`${TAG}   readvertise interval cleared`);
    }
  }

  startScanning() {
    console.log(`${TAG} ── startScanning() — isBluetoothOn=${this.isBluetoothOn} isScanning=${this.isScanning}`);
    if (!this.isBluetoothOn) {
      console.warn(`${TAG}   ⚠️ BT not on — skipping`);
      return;
    }
    if (this.isScanning) {
      console.log(`${TAG}   already scanning — skipping`);
      return;
    }
    // Scan ALL devices (no hardware UUID filter) so we can see what's actually being
    // advertised. We then check device.serviceUUIDs in the callback.
    // NOTE: a hardware UUID filter ([SERVICE_UUID]) was tried but failed to find peers —
    // likely because react-native-ble-advertiser broadcasts the UUID in a format that
    // Android's hardware scan filter doesn't match (16-bit vs 128-bit mismatch).
    console.log(`${TAG}   Starting device scan (no UUID filter — will inspect serviceUUIDs in callback)`);
    console.log(`${TAG}   Looking for SERVICE_UUID: ${SERVICE_UUID}`);
    this.isScanning = true;
    let totalScanned = 0;
    let namedDevicesScanned = 0;
    this.manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (error) {
        console.error(`${TAG}   ❌ Scan error: code=${error.errorCode} msg=${error.message}`);
        console.error(`${TAG}   Stopping scan. Will retry in 3s...`);
        this.isScanning = false;
        setTimeout(() => {
          if (this.isBluetoothOn) {
            console.log(`${TAG}   [scan retry] restarting scan after error`);
            this.isScanning = false;
            this.startScanning();
          }
        }, 3000);
        return;
      }
      if (!device) return;

      totalScanned++;
      if (totalScanned % 100 === 0) {
        console.log(`${TAG}   [scan] ${totalScanned} total seen, ${namedDevicesScanned} named, ${this.devices.size} SOS tracked`);
      }

      // Check service UUIDs advertised by this device
      const serviceUUIDs = device.serviceUUIDs || [];
      const hasSosUUID = serviceUUIDs.some(
        u => u.toLowerCase() === SERVICE_UUID.toLowerCase() ||
             u.toLowerCase() === 'fff0' ||
             u.toLowerCase() === '0000fff0-0000-1000-8000-00805f9b34fb'
      );
      const hasSosName = device.name && device.name.startsWith('SOS_');

      if (device.name) {
        namedDevicesScanned++;
        console.log(`${TAG}   [scan] named device: name=${device.name} id=${device.id} rssi=${device.rssi} hasSosUUID=${hasSosUUID} serviceUUIDs=${JSON.stringify(serviceUUIDs)}`);
      }

      if (hasSosUUID || hasSosName) {
        console.log(`${TAG}   [scan] ✅ SOS PEER FOUND: id=${device.id} name=${device.name || '(no name)'} rssi=${device.rssi} hasSosUUID=${hasSosUUID} hasSosName=${hasSosName}`);
        this._handleDeviceFound(device);
      }
    });
    console.log(`${TAG}   Scan started ✅`);
  }

  stopScanning() {
    console.log(`${TAG} ── stopScanning() — isScanning=${this.isScanning}`);
    if (!this.isScanning) {
      console.log(`${TAG}   not scanning — nothing to stop`);
      return;
    }
    this.manager.stopDeviceScan();
    this.isScanning = false;
    console.log(`${TAG}   ✅ Scan stopped`);
  }

  async _handleDeviceFound(device) {
    // Guard: ignore anything without a valid SOS_ name.
    // Identity is name-based; a device without an SOS_ name cannot be tracked.
    if (!device.name || !device.name.startsWith('SOS_')) {
      return;
    }

    const name     = device.name;   // stable identity key
    const mac      = device.id;     // current MAC (used only for BLE API calls)
    const rssi     = device.rssi || -100;
    const distance = this._calculateDistance(rssi);

    const alreadyKnown     = this.devices.has(name);
    const alreadyConnected = this.connectedDevices.has(name);

    console.log(`${TAG} ── _handleDeviceFound: name=${name} mac=${mac} rssi=${rssi} alreadyKnown=${alreadyKnown} alreadyConnected=${alreadyConnected}`);
    console.log(`${TAG}   isConnectable=${device.isConnectable} mtu=${device.mtu} distance≈${Math.round(distance)}m`);

    const existing = this.devices.get(name);

    // If the MAC rotated (same name, new MAC) cancel any in-flight connection to the old MAC.
    if (existing && existing.id !== mac) {
      console.log(`${TAG}   MAC rotated for "${name}": ${existing.id} → ${mac}`);
      if (!alreadyConnected) {
        try { this.manager.cancelDeviceConnection(existing.id); } catch (_) {}
      }
    }

    const deviceInfo = {
      id:          mac,
      name,
      rssi,
      distance:    Math.round(distance),
      lastSeen:    Date.now(),
      isConnected: alreadyConnected,
      transport:   'bluetooth',
    };

    const changed = !existing || existing.rssi !== rssi;
    this.devices.set(name, deviceInfo);

    if (!alreadyKnown) {
      // Random 0-1.5s jitter so both phones don't try connecting simultaneously
      const jitter = Math.random() * 1500;
      console.log(`${TAG}   NEW device — connecting in ${Math.round(jitter)}ms`);
      setTimeout(() => {
        if (this.isBluetoothOn && !this.connectedDevices.has(name) && !this.connectingDevices.has(name)) {
          this._connectToDevice(name);
        }
      }, jitter);
    } else {
      if (changed) {
        console.log(`${TAG}   known device, RSSI changed from ${existing?.rssi} to ${rssi}`);
      }
    }

    if (changed) this.notifyListeners();
  }

  async _connectToDevice(deviceName) {
    console.log(`${TAG} ── _connectToDevice: ${deviceName}`);
    console.log(`${TAG}   isBluetoothOn=${this.isBluetoothOn} alreadyConnected=${this.connectedDevices.has(deviceName)} alreadyConnecting=${this.connectingDevices.has(deviceName)}`);

    if (!this.isBluetoothOn) {
      console.warn(`${TAG}   ⚠️ BT not on — aborting connect`);
      return;
    }
    if (this.connectedDevices.has(deviceName)) {
      console.log(`${TAG}   already connected — skipping`);
      return;
    }
    if (this.connectingDevices.has(deviceName)) {
      console.log(`${TAG}   connection already in progress — skipping`);
      return;
    }

    // Look up the current MAC for this device name
    const deviceInfo = this.devices.get(deviceName);
    if (!deviceInfo) {
      console.warn(`${TAG}   device ${deviceName} not in map — aborting`);
      return;
    }
    const mac = deviceInfo.id;

    this.connectingDevices.add(deviceName);
    try {
      console.log(`${TAG}   calling connectToDevice(mac=${mac}, autoConnect=false, requestMTU=256)...`);
      const device = await this.manager.connectToDevice(mac, { autoConnect: false, requestMTU: 256 });
      console.log(`${TAG}   ✅ connectToDevice resolved — name=${device.name} mtu=${device.mtu}`);

      console.log(`${TAG}   discovering services and characteristics...`);
      await device.discoverAllServicesAndCharacteristics();
      console.log(`${TAG}   ✅ discoverAllServicesAndCharacteristics done`);

      const services = await device.services();
      console.log(`${TAG}   services found: ${services.length}`);
      services.forEach((s, i) => {
        console.log(`${TAG}     [${i}] uuid=${s.uuid}`);
      });

      const hasSosService = services.some(s => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase());
      console.log(`${TAG}   hasSosService=${hasSosService} (looking for ${SERVICE_UUID.toLowerCase()})`);

      if (!hasSosService) {
        console.warn(`${TAG}   ⚠️ ${deviceName} has no SOS service — disconnecting`);
        await this.manager.cancelDeviceConnection(mac);
        return;
      }

      // Check characteristics
      try {
        const chars = await device.characteristicsForService(SERVICE_UUID);
        console.log(`${TAG}   characteristics for SOS service: ${chars.length}`);
        chars.forEach((c, i) => {
          console.log(`${TAG}     [${i}] uuid=${c.uuid} isReadable=${c.isReadable} isWritableWithResponse=${c.isWritableWithResponse} isWritableWithoutResponse=${c.isWritableWithoutResponse} isNotifiable=${c.isNotifiable}`);
        });
      } catch (e) {
        console.warn(`${TAG}   ⚠️ could not read characteristics: ${e.message}`);
      }

      // Store PLX device object keyed by name; the object itself carries .id = mac
      this.connectedDevices.set(deviceName, device);
      const info = this.devices.get(deviceName);
      if (info) {
        this.devices.set(deviceName, { ...info, isConnected: true });
      }
      this.notifyListeners();
      console.log(`${TAG}   ✅ Connected to ${deviceName} (mac=${mac}). Total connected: ${this.connectedDevices.size}`);

      // Disconnect handler — registered with MAC (PLX requirement), but all map ops use name
      this.manager.onDeviceDisconnected(mac, (error) => {
        console.log(`${TAG} ◀ onDeviceDisconnected: ${deviceName} (mac=${mac})`);
        if (error) console.warn(`${TAG}   disconnect error: ${error.message}`);
        this.connectedDevices.delete(deviceName);
        console.log(`${TAG}   connectedDevices remaining: ${this.connectedDevices.size}`);
        const latestInfo = this.devices.get(deviceName);
        if (latestInfo) {
          this.devices.set(deviceName, { ...latestInfo, isConnected: false });
          this.notifyListeners();
        }
        console.log(`${TAG}   scheduling reconnect in 4s...`);
        setTimeout(() => {
          const stillKnown = this.devices.has(deviceName);
          console.log(`${TAG}   [reconnect] isBluetoothOn=${this.isBluetoothOn} stillKnown=${stillKnown} alreadyConnected=${this.connectedDevices.has(deviceName)}`);
          if (this.isBluetoothOn && stillKnown) {
            this._connectToDevice(deviceName);
          }
        }, 4000);
      });

    } catch (error) {
      console.error(`${TAG}   ❌ Connect failed to ${deviceName} (mac=${mac}): ${error.message}`);
      console.error(`${TAG}   error code: ${error.errorCode} | reason: ${error.reason}`);
      console.log(`${TAG}   scheduling retry in 6s...`);
      setTimeout(() => {
        const stillKnown  = this.devices.has(deviceName);
        const alreadyConn = this.connectedDevices.has(deviceName);
        console.log(`${TAG}   [retry] isBluetoothOn=${this.isBluetoothOn} stillKnown=${stillKnown} alreadyConn=${alreadyConn}`);
        if (this.isBluetoothOn && stillKnown && !alreadyConn) {
          this._connectToDevice(deviceName);
        }
      }, 6000);
    } finally {
      this.connectingDevices.delete(deviceName);
    }
  }

  // ── Broadcast data to all connected GATT peers ───────────────────────────
  broadcastData(encodedPayload) {
    const count = this.connectedDevices.size;
    console.log(`${TAG} ════════════════════════════════`);
    console.log(`${TAG} ── broadcastData() CALLED`);
    console.log(`${TAG}   connectedDevices count: ${count}`);
    console.log(`${TAG}   connectingDevices count: ${this.connectingDevices.size}`);
    console.log(`${TAG}   known devices count: ${this.devices.size}`);
    console.log(`${TAG}   isBluetoothOn: ${this.isBluetoothOn}`);

    if (count === 0) {
      console.warn(`${TAG}   ⚠️ NO CONNECTED DEVICES — message will NOT be sent`);
      console.warn(`${TAG}   All known devices:`);
      this.devices.forEach((d, name) => {
        console.warn(`${TAG}     - ${name} | mac=${d.id} | isConnected=${d.isConnected}`);
      });
      console.warn(`${TAG}   Connecting devices: ${JSON.stringify([...this.connectingDevices])}`);
      console.log(`${TAG} ════════════════════════════════`);
      return;
    }

    if (!encodedPayload) {
      console.error(`${TAG}   ❌ encodedPayload is null/empty — aborting`);
      return;
    }

    const payloadLength = encodedPayload.length;
    const preview = encodedPayload.substring(0, 120);
    console.log(`${TAG}   payload length: ${payloadLength} chars`);
    console.log(`${TAG}   payload preview: ${preview}`);

    let encoded;
    try {
      encoded = btoa(encodedPayload);
      console.log(`${TAG}   base64 encoded length: ${encoded.length} chars`);
    } catch (e) {
      console.error(`${TAG}   ❌ btoa() failed: ${e.message}`);
      console.error(`${TAG}   payload was: ${encodedPayload}`);
      return;
    }

    console.log(`${TAG}   Sending to ${count} device(s):`);
    this.connectedDevices.forEach((device, name) => {
      console.log(`${TAG}     → target name=${name} mac=${device.id}`);
    });

    this.connectedDevices.forEach(async (device, name) => {
      // device is the PLX device object — its .id is the real MAC needed for the write
      const mac = device.id;
      console.log(`${TAG}   [WRITE] starting write to name=${name} mac=${mac}`);
      console.log(`${TAG}   [WRITE] SERVICE_UUID=${SERVICE_UUID}`);
      console.log(`${TAG}   [WRITE] CHARACTERISTIC_UUID=${CHARACTERISTIC_UUID}`);
      console.log(`${TAG}   [WRITE] encoded payload length=${encoded.length}`);
      try {
        const result = await this.manager.writeCharacteristicWithResponseForDevice(
          mac,
          SERVICE_UUID,
          CHARACTERISTIC_UUID,
          encoded,
        );
        console.log(`${TAG}   ✅ [WRITE SUCCESS] write to ${name} (mac=${mac}) completed`);
        console.log(`${TAG}   ✅ [WRITE SUCCESS] result: ${JSON.stringify(result)}`);
      } catch (e) {
        console.error(`${TAG}   ❌ [WRITE FAILED] BLE write to ${name} (mac=${mac}) failed`);
        console.error(`${TAG}   ❌ [WRITE FAILED] error message: ${e.message}`);
        console.error(`${TAG}   ❌ [WRITE FAILED] error code: ${e.errorCode}`);
        console.error(`${TAG}   ❌ [WRITE FAILED] error reason: ${e.reason}`);
        console.error(`${TAG}   ❌ [WRITE FAILED] full error: ${JSON.stringify(e)}`);
      }
    });
    console.log(`${TAG} ════════════════════════════════`);
  }

  _startStaleCheck() {
    this._stopStaleCheck();
    console.log(`${TAG}   stale check interval set (every ${STALE_CHECK_INTERVAL}ms, threshold=${STALE_THRESHOLD}ms)`);
    this.staleCheckInterval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const before = this.devices.size;
      for (const [name, device] of this.devices.entries()) {
        const age = now - device.lastSeen;
        if (age > STALE_THRESHOLD && !this.connectedDevices.has(name)) {
          console.log(`${TAG}   [stale] removing ${name} — age=${age}ms`);
          this.devices.delete(name);
          changed = true;
        }
      }
      if (changed) {
        console.log(`${TAG}   [stale] removed ${before - this.devices.size} devices. Remaining: ${this.devices.size}`);
        this.notifyListeners();
      } else {
        console.log(`${TAG}   [stale] no stale devices. Total: ${this.devices.size} tracked, ${this.connectedDevices.size} connected`);
      }
    }, STALE_CHECK_INTERVAL);
  }

  _stopStaleCheck() {
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
      this.staleCheckInterval = null;
      console.log(`${TAG}   stale check interval cleared`);
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

  addListener(cb)           { this.listeners.push(cb); console.log(`${TAG}   addListener — total listeners: ${this.listeners.length}`); }
  removeListener(cb)        { this.listeners = this.listeners.filter(l => l !== cb); }
  addMessageListener(cb)    { this.messageListeners.push(cb); console.log(`${TAG}   addMessageListener — total: ${this.messageListeners.length}`); }
  removeMessageListener(cb) { this.messageListeners = this.messageListeners.filter(l => l !== cb); }

  notifyListeners() {
    const devices = this.getDevices();
    console.log(`${TAG} notifyListeners — ${devices.length} devices total, ${this.connectedDevices.size} connected, ${this.listeners.length} listeners`);
    devices.forEach(d => {
      console.log(`${TAG}   device: name=${d.name} mac=${d.id} transport=${d.transport} connected=${d.isConnected} rssi=${d.rssi}`);
    });
    this.listeners.forEach(cb => cb(devices));
  }

  notifyMessageListeners(raw) {
    console.log(`${TAG} notifyMessageListeners — ${this.messageListeners.length} listeners, message length=${raw?.length}`);
    this.messageListeners.forEach(cb => cb(raw));
  }

  cleanup() {
    console.log(`${TAG} ── cleanup() ──`);
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
    console.log(`${TAG}   cleanup done`);
  }
}

export default new BluetoothMeshService();
