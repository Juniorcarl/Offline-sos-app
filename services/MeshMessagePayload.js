/**
 * MeshMessagePayload.js
 * Compact packet structure for mesh SOS messages.
 *
 * Packet (JSON, kept small):
 * {
 *   id:        string   — uuid v4, used for dedup
 *   msg:       string   — the message text (max 200 chars)
 *   lat:       number   — sender GPS latitude  (null if unavailable)
 *   lon:       number   — sender GPS longitude (null if unavailable)
 *   ts:        number   — unix timestamp ms
 *   sid:       string   — sender device id (trimmed)
 *   target:    'local' | 'authority'
 *   ttl:       number   — hops remaining (decrements each relay, drop at 0)
 * }
 *
 * Max serialised size is well under 512 bytes for BLE MTU comfort.
 */
import { v4 as uuidv4 } from 'uuid';
export const MAX_TTL = 5; // how many relay hops allowed

/**
 * Build a new outgoing message packet.
 */
export function createPacket({ message, latitude, longitude, senderId, target }) {
  return {
    id:     uuidv4(),
    msg:    (message || '').slice(0, 200),
    lat:    latitude  ?? null,
    lon:    longitude ?? null,
    ts:     Date.now(),
    sid:    (senderId || 'unknown').slice(0, 32),
    target: target === 'authority' ? 'authority' : 'local',
    ttl:    MAX_TTL,
  };
}

/**
 * Serialise to a compact JSON string for BLE / WiFi Direct transport.
 */
export function encodePacket(packet) {
  return JSON.stringify(packet);
}

/**
 * Deserialise from transport string. Returns null if malformed.
 */
export function decodePacket(raw) {
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!p || !p.id || !p.msg || !p.sid || !p.ts) return null;
    return p;
  } catch {
    return null;
  }
}

/**
 * Create a relay copy with TTL decremented.
 * Returns null when TTL is exhausted (do not forward).
 */
export function relayPacket(packet) {
  if (!packet || packet.ttl <= 1) return null;
  return { ...packet, ttl: packet.ttl - 1 };
}