/**
 * MeshMessagePayload.js
 * Compact packet structure for mesh SOS messages.
 *
 * Packet (JSON):
 * {
 *   id:        string   — uuid v4, used for dedup
 *   msg:       string   — plaintext message OR '[Encrypted]' placeholder when enc=true
 *   lat:       number   — sender GPS latitude  (null if unavailable)
 *   lon:       number   — sender GPS longitude (null if unavailable)
 *   ts:        number   — unix timestamp ms
 *   sid:       string   — sender device id (trimmed)
 *   target:    'local' | 'authority'
 *   ttl:       number   — hops remaining (decrements each relay, drop at 0)
 *   sRole:     'User' | 'Authority'   — sender's role
 *   sAdmin:    string                 — sender's authority type (e.g. "Medics"), empty for non-authority
 *
 *   -- Present only when enc = true (authority-targeted encrypted messages) --
 *   enc:       true              — signals payload is RSA+AES hybrid encrypted
 *   ct:        base64 string     — AES-256-GCM ciphertext (message + 16-byte auth tag)
 *   iv:        base64 string     — 12-byte AES-GCM nonce
 *   ek:        base64 string     — RSA-OAEP wrapped AES key (256 bytes → ~344 base64 chars)
 * }
 *
 * Relay nodes carry encrypted packets unchanged — they see msg='[Encrypted]' and cannot
 * read the content. Only the authority device with the matching RSA private key can decrypt.
 */
import { v4 as uuidv4 } from 'uuid';
export const MAX_TTL = 5; // how many relay hops allowed

/**
 * Build a new outgoing message packet.
 * Pass `encrypted: { ct, iv, ek }` to embed ciphertext for authority messages.
 */
export function createPacket({ message, latitude, longitude, senderId, target, senderRole, senderAdminType, encrypted }) {
  const packet = {
    id:     uuidv4(),
    msg:    (message || '').slice(0, 200),
    lat:    latitude  ?? null,
    lon:    longitude ?? null,
    ts:     Date.now(),
    sid:    (senderId || 'unknown').slice(0, 32),
    target: target === 'authority' ? 'authority' : 'local',
    ttl:    MAX_TTL,
    sRole:  senderRole === 'Authority' ? 'Authority' : 'User',
    sAdmin: senderRole === 'Authority' ? (senderAdminType || '').slice(0, 60) : '',
    enc:    false,
  };

  if (encrypted) {
    packet.enc = true;
    packet.ct  = encrypted.ct;
    packet.iv  = encrypted.iv;
    packet.ek  = encrypted.ek;
  }

  return packet;
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
 * Encrypted payloads are carried as-is — relays never modify ct/iv/ek.
 */
export function relayPacket(packet) {
  if (!packet || packet.ttl <= 1) return null;
  return { ...packet, ttl: packet.ttl - 1 };
}
