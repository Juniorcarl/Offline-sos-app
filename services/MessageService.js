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
    /** Our own device id — set by ConnectionManager on init */
    this.deviceId  = null;
    /** Reference injected by ConnectionManager so we can broadcast */
    this._connectionManager = null;

    // Prune stale seen ids every minute
    setInterval(() => this._pruneSeen(), 60_000);
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  init(connectionManager, deviceId) {
    this._connectionManager = connectionManager;
    this.deviceId = deviceId;
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
      senderId: this.deviceId,
      target,
    });

    console.log('📤   packet created:', JSON.stringify(packet));
    console.log('📤   packet.id:', packet.id);

    this._markSeen(packet.id);
    console.log('📤   marked as seen (won\'t relay our own message back)');

    const encoded = encodePacket(packet);
    console.log('📤   encoded packet length:', encoded.length, 'chars');
    console.log('📤   encoded packet:', encoded);

    console.log('📤   calling connectionManager.sendMessage()...');
    this._connectionManager?.sendMessage(encoded);
    console.log('📤   connectionManager.sendMessage() returned');
    console.log('════════════════════════════════');

    return packet;
  }

  // ── Incoming (called by ConnectionManager when data arrives) ──────────────

  /**
   * Call this whenever raw bytes / string arrive from the mesh.
   * Handles dedup, relay, and notifying UI.
   */
  handleIncoming(raw) {
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

    console.log(`📩 New SOS from ${packet.sid} | target:${packet.target} | ttl:${packet.ttl}`);

    // Notify UI & trigger alert
    this._notifyListeners(packet);
    notificationService.showAlert(packet);

    // Relay to rest of mesh (flood with TTL decrement)
    const relay = relayPacket(packet);
    if (relay) {
      const encoded = encodePacket(relay);
      this._connectionManager?.sendMessage(encoded);
      console.log(`🔄 Relayed packet ${packet.id} | remaining ttl: ${relay.ttl}`);
    }
  }

  // ── Listeners ─────────────────────────────────────────────────────────────

  addListener(cb)    { this._listeners.push(cb); }
  removeListener(cb) { this._listeners = this._listeners.filter(l => l !== cb); }

  _notifyListeners(packet) {
    this._listeners.forEach(cb => {
      try { cb(packet); } catch (e) { console.error('MessageService listener error:', e); }
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