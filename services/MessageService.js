/**
 * MessageService.js
 *
 * Sits on top of ConnectionManager.
 * Responsibilities:
 *   • Build outgoing SOS packets
 *   • Relay packets received from the mesh (TTL-based flood)
 *   • Deduplicate incoming packets by message id
 *   • Notify UI listeners when a new message arrives
 *   • Trigger background / foreground notification
 */

import { createPacket, encodePacket, decodePacket, relayPacket } from './MeshMessagePayload';
import notificationService from './NotificationService';
import * as Location from 'expo-location';

// How long (ms) to keep seen message ids before pruning
const SEEN_TTL = 5 * 60 * 1000; // 5 minutes

class MessageService {
  constructor() {
    /** id -> timestamp of when we first saw this message */
    this._seen     = new Map();
    /** Listeners notified when a NEW message arrives: (packet) => void */
    this._listeners = [];
    /** Listeners notified when an ACK arrives for a message WE sent: (messageId) => void */
    this._ackListeners = [];
    /** IDs of messages this device has sent — used to match incoming ACKs */
    this._sentIds  = new Set();
    /** ACK message IDs we've already processed — prevents relay loops */
    this._seenAcks = new Set();
    /** Our own device id — set by ConnectionManager on init */
    this.deviceId  = null;
    /** Reference injected by ConnectionManager so we can broadcast */
    this._connectionManager = null;
    /** Local device role — 'User' or 'Admin' */
    this._localRole      = 'User';
    /** Local admin type description (e.g. 'Medics'), empty for non-admin */
    this._localAdminType = '';

    // Prune stale seen ids every minute
    setInterval(() => this._pruneSeen(), 60_000);
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  init(connectionManager, deviceId) {
    this._connectionManager = connectionManager;
    this.deviceId = deviceId;
  }

  /**
   * Update the local device's role. Call this after the user saves their profile.
   * @param {'User'|'Admin'} role
   * @param {string} adminType
   */
  setLocalRole(role, adminType = '') {
    this._localRole      = role === 'Admin' ? 'Admin' : 'User';
    this._localAdminType = this._localRole === 'Admin' ? (adminType || '') : '';
    console.log(`[MessageService] localRole set to: ${this._localRole} (${this._localAdminType})`);
  }

  // ── Outgoing ──────────────────────────────────────────────────────────────

  /**
   * Build and broadcast a new SOS message from this device.
   * @param {string} message
   * @param {'local'|'authority'} target
   */
  async sendSOS(message, target = 'local') {
    console.log('════════════════════════════════');
    console.log('📤 [MessageService] sendSOS() CALLED');
    console.log('📤   message:', message);
    console.log('📤   target:', target);
    console.log('📤   deviceId:', this.deviceId);
    console.log('📤   connectionManager set?', this._connectionManager != null);

    let latitude  = null;
    let longitude = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('📤   location permission status:', status);
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 4000,
        });
        latitude  = loc.coords.latitude;
        longitude = loc.coords.longitude;
        console.log('📤   location obtained:', latitude, longitude);
      } else {
        console.warn('📤   location permission not granted — sending without location');
      }
    } catch (e) {
      console.warn('📤   location error:', e.message, '— sending without location');
    }

    const packet = createPacket({
      message,
      latitude,
      longitude,
      senderId:        this.deviceId,
      target,
      senderRole:      this._localRole,
      senderAdminType: this._localAdminType,
    });

    console.log('📤   packet created:', JSON.stringify(packet));
    console.log('📤   packet.id:', packet.id);

    this._markSeen(packet.id);
    this._sentIds.add(packet.id);
    console.log('📤   marked as seen (won\'t relay our own message back)');

    const encoded = encodePacket(packet);
    console.log('📤   encoded packet length:', encoded.length, 'chars');
    console.log('📤   encoded packet:', encoded);

    console.log('📤   calling connectionManager.sendMessage()...');
    this._connectionManager?.sendMessage(encoded);
    console.log('📤   connectionManager.sendMessage() returned');
    console.log('════════════════════════════════');

    // Show in message history immediately (with _isMine flag so UI can style it)
    this._notifyListeners({ ...packet, _isMine: true });

    return packet;
  }

  // ── Incoming (called by ConnectionManager when data arrives) ──────────────

  /**
   * Call this whenever raw bytes / string arrive from the mesh.
   * Handles dedup, relay, and notifying UI.
   */
  handleIncoming(raw) {
    // ── ACK short-circuit ────────────────────────────────────────────────────
    if (typeof raw === 'string' && raw.startsWith('ACK:')) {
      this._handleAck(raw);
      return;
    }

    // ── Normal SOS packet ────────────────────────────────────────────────────
    const packet = decodePacket(raw);
    if (!packet) {
      console.warn('⚠️ MessageService: malformed packet, ignoring');
      return;
    }

    // Ignore our own messages that bounced back
    if (packet.sid === this.deviceId) return;

    // Deduplicate
    if (this._hasSeen(packet.id)) {
      console.log('🔁 Duplicate suppressed:', packet.id);
      return;
    }
    this._markSeen(packet.id);

    console.log(`📩 New SOS from ${packet.sid} | target:${packet.target} | sRole:${packet.sRole} | ttl:${packet.ttl}`);

    // Route by target vs local role — always relay, only alert the intended role:
    //   'local'     → alert User devices only
    //   'admin'     → alert Admin devices only
    //   'authority' → alert everyone
    const localIsAdmin = this._localRole === 'Admin';
    const shouldNotify =
      packet.target === 'authority' ||
      (packet.target === 'admin' &&  localIsAdmin) ||
      (packet.target === 'local' && !localIsAdmin);

    if (shouldNotify) {
      this._notifyListeners(packet);
      notificationService.showAlert(packet);
    } else {
      console.log(`📩 Message target="${packet.target}" skipped on ${this._localRole} device — relaying only`);
    }

    // Send ACK back through the mesh so the original sender knows we got it
    const ack = `ACK:${packet.id}`;
    this._connectionManager?.sendMessage(ack);
    console.log(`📨 Sent ACK for ${packet.id}`);

    // Relay to rest of mesh (flood with TTL decrement)
    const relay = relayPacket(packet);
    if (relay) {
      const encoded = encodePacket(relay);
      this._connectionManager?.sendMessage(encoded);
      console.log(`🔄 Relayed packet ${packet.id} | remaining ttl: ${relay.ttl}`);
    }
  }

  // ── ACK handling ──────────────────────────────────────────────────────────

  _handleAck(raw) {
    const messageId = raw.slice(4); // strip "ACK:"
    if (!messageId) return;

    // Dedup — prevents relay loops
    if (this._seenAcks.has(messageId)) return;
    this._seenAcks.add(messageId);

    // If WE sent this message, notify UI listeners (delivery confirmation)
    if (this._sentIds.has(messageId)) {
      console.log(`✅ ACK received — our message ${messageId} was delivered`);
      this._notifyAckListeners(messageId);
      return; // don't relay — we are the intended destination
    }

    // Otherwise relay the ACK onwards so it can reach the original sender
    this._connectionManager?.sendMessage(raw);
    console.log(`🔄 Relayed ACK for ${messageId}`);
  }

  // ── SOS listeners ─────────────────────────────────────────────────────────

  addListener(cb)    { this._listeners.push(cb); }
  removeListener(cb) { this._listeners = this._listeners.filter(l => l !== cb); }

  _notifyListeners(packet) {
    this._listeners.forEach(cb => {
      try { cb(packet); } catch (e) { console.error('MessageService listener error:', e); }
    });
  }

  // ── ACK listeners ──────────────────────────────────────────────────────────

  addAckListener(cb)    { this._ackListeners.push(cb); }
  removeAckListener(cb) { this._ackListeners = this._ackListeners.filter(l => l !== cb); }

  _notifyAckListeners(messageId) {
    this._ackListeners.forEach(cb => {
      try { cb(messageId); } catch (e) { console.error('MessageService ACK listener error:', e); }
    });
  }

  // ── Seen-id management ────────────────────────────────────────────────────

  _hasSeen(id)  { return this._seen.has(id); }
  _markSeen(id) { this._seen.set(id, Date.now()); }

  _pruneSeen() {
    const cutoff = Date.now() - SEEN_TTL;
    for (const [id, ts] of this._seen.entries()) {
      if (ts < cutoff) this._seen.delete(id);
    }
  }
}

export default new MessageService();