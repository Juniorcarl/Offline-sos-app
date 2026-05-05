/**
 * MessageService.js
 *
 * Mesh relay layer above Bluetooth + Wi-Fi Direct.
 */

import { createPacket, encodePacket, decodePacket, relayPacket } from './MeshMessagePayload';
import notificationService from './NotificationService';
import authorityKeyService from './AuthorityKeyService';
import * as Location from 'expo-location';

const SEEN_TTL = 5 * 60 * 1000;
const ACK_SEEN_TTL = 5 * 60 * 1000;

const TAG = '[MessageService]';

class MessageService {
  constructor() {
    this._seen = new Map();
    this._seenAcks = new Map();
    this._listeners = [];
    this._ackListeners = [];
    this._sentIds = new Set();

    this.deviceId = null;
    this._connectionManager = null;

    this._localRole = 'User';
    this._localAdminType = '';

    setInterval(() => {
      this._pruneSeen();
      this._pruneSeenAcks();
    }, 60_000);
  }

  init(connectionManager, deviceId) {
    this._connectionManager = connectionManager;
    this.deviceId = deviceId;
    console.log(`${TAG} init() deviceId=${deviceId}`);
    console.log(`${TAG} init() connectionManager exists=${!!connectionManager}`);
    console.log(`${TAG} init() sendMessage type=${typeof connectionManager?.sendMessage}`);
  }

  async setLocalRole(role, adminType = '') {
    this._localRole = role === 'Authority' ? 'Authority' : 'User';
    this._localAdminType = this._localRole === 'Authority' ? (adminType || '') : '';
    console.log(`${TAG} localRole -> ${this._localRole} (${this._localAdminType})`);

    if (this._localRole === 'Authority' && authorityKeyService.available) {
      if (!authorityKeyService.hasKeyPair) {
        console.log(`${TAG} generating RSA key pair for authority role...`);
        await authorityKeyService.generateKeyPair();
      }

      const broadcast = () => this.broadcastPublicKey();
      broadcast();
      [5000, 15000, 30000, 60000, 120000].forEach(delay => setTimeout(broadcast, delay));
    }
  }

  broadcastPublicKey() {
    const b64 = authorityKeyService.publicKeyB64;
    if (!b64 || !this._connectionManager) {
      console.log(`${TAG} broadcastPublicKey skipped: no key or connection manager`);
      return;
    }

    console.log(`${TAG} broadcasting authority public key`);
    this._connectionManager.sendMessage(`KEY:${b64}`);
  }

  async sendSOS(message, target = 'local', options = {}) {
    console.log('════════════════════════════════════════════');
    console.log(`📤 ${TAG} sendSOS()`);
    console.log(`📤   target=${target}`);
    console.log(`📤   deviceId=${this.deviceId}`);
    console.log(`📤   localRole=${this._localRole}`);
    console.log(`📤   localAdminType=${this._localAdminType}`);
    console.log(`📤   message="${message}"`);
    console.log(`📤   options=${JSON.stringify(options)}`);
    console.log('════════════════════════════════════════════');

    let latitude = null;
    let longitude = null;

    if (options?.skipLocation) {
      console.log(`📤 ${TAG} skipping location because source=${options?.source}`);
    } else {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log(`📤 ${TAG} location permission=${status}`);

        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 4000,
          });

          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;

          console.log(`📤 ${TAG} location=(${latitude}, ${longitude})`);
        } else {
          console.warn(`📤 ${TAG} location permission not granted`);
        }
      } catch (e) {
        console.warn(`📤 ${TAG} location error: ${e.message}`);
      }
    }

    let encrypted = null;
    let msgPayload = message;

    if (target === 'authority' && authorityKeyService.available) {
      if (authorityKeyService.hasRemoteKey || authorityKeyService.hasKeyPair) {
        console.log(`📤 ${TAG} encrypting authority-targeted message`);
        encrypted = await authorityKeyService.encrypt(message);

        if (encrypted) {
          msgPayload = '[Encrypted — Authority Only]';
          console.log(`📤 ${TAG} encryption succeeded`);
        } else {
          console.warn(`📤 ${TAG} encryption failed — sending plaintext`);
        }
      } else {
        console.warn(`📤 ${TAG} no authority public key yet — sending plaintext`);
      }
    }

    const packet = createPacket({
      message: msgPayload,
      latitude,
      longitude,
      senderId: this.deviceId,
      target,
      senderRole: this._localRole,
      senderAdminType: this._localAdminType,
      encrypted,
    });

    console.log(`📤 ${TAG} packet created id=${packet.id} ttl=${packet.ttl} enc=${packet.enc}`);

    this._markSeen(packet.id);
    this._sentIds.add(packet.id);

    const encoded = encodePacket(packet);
    console.log(`📤 ${TAG} encoded length=${encoded.length}`);

    console.log('════════════════════════════════════════════');
    console.log(`${TAG} 🚨 FINAL SEND STEP`);
    console.log(`${TAG} connectionManager exists=${!!this._connectionManager}`);
    console.log(`${TAG} sendMessage type=${typeof this._connectionManager?.sendMessage}`);
    console.log('════════════════════════════════════════════');

    try {
      if (this._connectionManager && typeof this._connectionManager.sendMessage === 'function') {
        console.log(`${TAG} 📡 Trying connectionManager.sendMessage()`);
        this._connectionManager.sendMessage(encoded);
        console.log(`${TAG} ✅ connectionManager.sendMessage CALLED`);
      } else {
        console.log(`${TAG} ❌ connectionManager invalid`);
      }
    } catch (e) {
      console.log(`${TAG} ❌ connectionManager.sendMessage failed`, e);
    }

    try {
      const bluetoothMeshService = require('./BluetoothMeshService').default;
      const connectedDevices = bluetoothMeshService.connectedDevices;

      console.log(`${TAG} 🔵 BLE connectedDevices=${connectedDevices?.size}`);

      if (connectedDevices && connectedDevices.size > 0) {
        console.log(`${TAG} 🔵 FORCING BLE BROADCAST`);
        bluetoothMeshService.broadcastData(encoded);
        console.log(`${TAG} 🔵 BLE SEND SUCCESS`);
      } else {
        console.log(`${TAG} 🔵 NO BLE CONNECTION — cannot force send`);
      }
    } catch (e) {
      console.log(`${TAG} ❌ FORCE BLE SEND FAILED`, e);
    }

    console.log(`📤 ${TAG} sent to ConnectionManager`);

    this._notifyListeners({
      ...packet,
      msg: message,
      _isMine: true,
      _transport: 'local',
    });

    return packet;
  }

  async handleIncoming(raw) {
    const preview = typeof raw === 'string' ? raw.slice(0, 120) : '[non-string]';

    console.log('════════════════════════════════════════════');
    console.log(`📥 ${TAG} handleIncoming()`);
    console.log(`📥   preview=${preview}`);
    console.log('════════════════════════════════════════════');

    if (typeof raw === 'string' && raw.startsWith('KEY:')) {
      console.log(`🔑 ${TAG} received authority public key broadcast`);
      await authorityKeyService.storeRemoteKey(raw.slice(4));
      return;
    }

    if (typeof raw === 'string' && raw.startsWith('ACK:')) {
      this._handleAck(raw);
      return;
    }

    const packet = decodePacket(raw);

    if (!packet) {
      console.warn(`⚠️ ${TAG} malformed packet ignored`);
      return;
    }

    console.log(
      `📩 ${TAG} packet id=${packet.id} sid=${packet.sid} target=${packet.target} ttl=${packet.ttl} enc=${packet.enc}`
    );

    if (packet.sid === this.deviceId) {
      console.log(`📩 ${TAG} ignoring own bounced packet ${packet.id}`);
      return;
    }

    if (this._hasSeen(packet.id)) {
      console.log(`🔁 ${TAG} duplicate suppressed id=${packet.id}`);
      return;
    }

    this._markSeen(packet.id);

    const localIsAuthority = this._localRole === 'Authority';

    const shouldNotify =
      (packet.target === 'authority' && localIsAuthority) ||
      (packet.target === 'local' && !localIsAuthority);

    let displayPacket = packet;

    if (shouldNotify) {
      if (packet.enc && packet.target === 'authority' && localIsAuthority) {
        console.log(`🔓 ${TAG} decrypting authority message id=${packet.id}`);

        const plaintext = await authorityKeyService.decrypt({
          ct: packet.ct,
          iv: packet.iv,
          ek: packet.ek,
        });

        if (plaintext) {
          displayPacket = { ...packet, msg: plaintext };
          console.log(`🔓 ${TAG} decryption successful id=${packet.id}`);
        } else {
          console.warn(`🔓 ${TAG} decryption failed id=${packet.id}`);
        }
      }

      console.log(`📣 ${TAG} notifying UI for packet id=${packet.id}`);
      this._notifyListeners(displayPacket);
      notificationService.showAlert(displayPacket);
    } else {
      console.log(
        `📩 ${TAG} packet ${packet.id} not for this role (${this._localRole}) — relay only`
      );
    }

    const ack = `ACK:${packet.id}`;

    try {
      this._connectionManager?.sendMessage(ack);
      console.log(`📨 ${TAG} ACK sent for ${packet.id}`);
    } catch (e) {
      console.log(`📨 ${TAG} ACK send failed`, e);
    }

    const relay = relayPacket(packet);

    if (!relay) {
      console.log(`⛔ ${TAG} relay dropped for ${packet.id} because TTL exhausted`);
      return;
    }

    const relayEncoded = encodePacket(relay);

    try {
      this._connectionManager?.sendMessage(relayEncoded);
      console.log(
        `🔄 ${TAG} relayed packet id=${packet.id} originalTTL=${packet.ttl} newTTL=${relay.ttl}`
      );
    } catch (e) {
      console.log(`🔄 ${TAG} relay send failed`, e);
    }
  }

  _handleAck(raw) {
    const messageId = raw.slice(4);

    if (!messageId) return;

    if (this._hasSeenAck(messageId)) {
      console.log(`🔁 ${TAG} duplicate ACK suppressed for ${messageId}`);
      return;
    }

    this._markSeenAck(messageId);

    if (this._sentIds.has(messageId)) {
      console.log(`✅ ${TAG} ACK received for our message ${messageId}`);
      this._notifyAckListeners(messageId);
      return;
    }

    this._connectionManager?.sendMessage(raw);
    console.log(`🔄 ${TAG} relayed ACK for ${messageId}`);
  }

  addListener(cb) {
    this._listeners.push(cb);
  }

  removeListener(cb) {
    this._listeners = this._listeners.filter(l => l !== cb);
  }

  _notifyListeners(packet) {
    this._listeners.forEach(cb => {
      try {
        cb(packet);
      } catch (e) {
        console.error(`${TAG} listener error:`, e);
      }
    });
  }

  addAckListener(cb) {
    this._ackListeners.push(cb);
  }

  removeAckListener(cb) {
    this._ackListeners = this._ackListeners.filter(l => l !== cb);
  }

  _notifyAckListeners(messageId) {
    this._ackListeners.forEach(cb => {
      try {
        cb(messageId);
      } catch (e) {
        console.error(`${TAG} ACK listener error:`, e);
      }
    });
  }

  _hasSeen(id) {
    return this._seen.has(id);
  }

  _markSeen(id) {
    this._seen.set(id, Date.now());
  }

  _hasSeenAck(id) {
    return this._seenAcks.has(id);
  }

  _markSeenAck(id) {
    this._seenAcks.set(id, Date.now());
  }

  _pruneSeen() {
    const cutoff = Date.now() - SEEN_TTL;
    let removed = 0;

    for (const [id, ts] of this._seen.entries()) {
      if (ts < cutoff) {
        this._seen.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`${TAG} pruned ${removed} seen packet ids`);
    }
  }

  _pruneSeenAcks() {
    const cutoff = Date.now() - ACK_SEEN_TTL;
    let removed = 0;

    for (const [id, ts] of this._seenAcks.entries()) {
      if (ts < cutoff) {
        this._seenAcks.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`${TAG} pruned ${removed} seen ACK ids`);
    }
  }
}

export default new MessageService();