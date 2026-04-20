/**
 * AuthorityKeyService.js
 *
 * Hybrid RSA-OAEP + AES-256-GCM encryption for authority-targeted messages.
 *
 * How it works:
 *   Authority device (Admin role):
 *     1. On first setup, generates an RSA-2048 key pair (public + private).
 *     2. Broadcasts its public key across the mesh as a KEY: prefix packet.
 *     3. Receiving devices cache the public key in AsyncStorage.
 *     4. When an encrypted authority message arrives, the authority device
 *        uses its private key to decrypt it.
 *
 *   Sender device (any role):
 *     1. Has cached the authority's public key from a KEY: broadcast.
 *     2. To send to authority:
 *        a. Generates a fresh random AES-256-GCM key.
 *        b. Encrypts the message text with that AES key.
 *        c. Encrypts the AES key itself with RSA-OAEP using the authority public key.
 *        d. Sends { ct, iv, ek } in the packet.
 *     3. Relay devices carry the encrypted payload without being able to read it.
 *     4. Only the authority device, with the matching RSA private key, can:
 *        - Unwrap the AES key (step c reversed)
 *        - Decrypt the message (step b reversed)
 *
 * Why hybrid (RSA + AES)?
 *   RSA-OAEP 2048 can only directly encrypt ~190 bytes — not enough for a message.
 *   AES-GCM has no such limit. So: AES encrypts the message, RSA encrypts the AES key.
 *   This is the standard approach (used in TLS, PGP, etc.).
 *
 * Packet additions for encrypted messages:
 *   enc:  true                — signals this payload is encrypted
 *   ct:   base64 string       — AES-GCM ciphertext (+ 16-byte auth tag)
 *   iv:   base64 string       — 12-byte AES-GCM nonce (unique per message)
 *   ek:   base64 string       — RSA-OAEP encrypted AES key (256 bytes output)
 *   msg:  '[Encrypted]'       — placeholder so relay nodes pass decodePacket validation
 *
 * Key broadcast format (sent as raw mesh message, not a JSON packet):
 *   KEY:<base64(JSON(RSA-public-JWK))>
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_OWN_PUB    = 'authkey_own_pub';
const STORE_OWN_PRIV   = 'authkey_own_priv';
const STORE_REMOTE_PUB = 'authkey_remote_pub';

class AuthorityKeyService {
  constructor() {
    this._ownPublicKey    = null; // CryptoKey — authority device only
    this._ownPrivateKey   = null; // CryptoKey — authority device only, never leaves device
    this._remotePublicKey = null; // CryptoKey — cached from mesh KEY: broadcast
    this._publicKeyB64    = null; // string    — base64(JWK) ready to broadcast

    // Web Crypto is available in Expo SDK 49+ via Hermes
    this._available = !!(globalThis?.crypto?.subtle);
    if (!this._available) {
      console.warn('[AuthorityKey] Web Crypto (crypto.subtle) not available — encryption disabled');
    }
  }

  /** True if encryption is supported on this device. */
  get available() { return this._available; }

  /** True if this device has an authority RSA key pair (i.e. is an authority device). */
  get hasKeyPair() { return !!(this._ownPublicKey && this._ownPrivateKey); }

  /** True if we have a cached remote authority public key (can encrypt to authority). */
  get hasRemoteKey() { return !!(this._remotePublicKey); }

  /** Base64-encoded JWK public key string, ready to broadcast via KEY: prefix. */
  get publicKeyB64() { return this._publicKeyB64; }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Load persisted keys from AsyncStorage. Call once on app start.
   * Non-authority devices will only have STORE_REMOTE_PUB (if they received a broadcast).
   */
  async load() {
    if (!this._available) return;
    try {
      const [[, ownPubStr], [, ownPrivStr], [, remotePubStr]] =
        await AsyncStorage.multiGet([STORE_OWN_PUB, STORE_OWN_PRIV, STORE_REMOTE_PUB]);

      if (ownPubStr && ownPrivStr) {
        this._ownPublicKey  = await this._importPub(JSON.parse(ownPubStr));
        this._ownPrivateKey = await this._importPriv(JSON.parse(ownPrivStr));
        this._publicKeyB64  = btoa(ownPubStr);
        console.log('[AuthorityKey] loaded own RSA-2048 key pair');
      }

      if (remotePubStr) {
        this._remotePublicKey = await this._importPub(JSON.parse(remotePubStr));
        console.log('[AuthorityKey] loaded remote authority public key from storage');
      }
    } catch (e) {
      console.warn('[AuthorityKey] load error:', e.message);
    }
  }

  /**
   * Generate a fresh RSA-2048 key pair and persist it.
   * Called when a device first selects the Admin role.
   * Returns true on success.
   */
  async generateKeyPair() {
    if (!this._available) return false;
    try {
      const pair = await globalThis.crypto.subtle.generateKey(
        {
          name:           'RSA-OAEP',
          modulusLength:  2048,
          publicExponent: new Uint8Array([1, 0, 1]), // 65537
          hash:           'SHA-256',
        },
        true,                    // extractable — needed to persist to AsyncStorage
        ['encrypt', 'decrypt'],
      );

      const pubJwk  = await globalThis.crypto.subtle.exportKey('jwk', pair.publicKey);
      const privJwk = await globalThis.crypto.subtle.exportKey('jwk', pair.privateKey);
      const pubStr  = JSON.stringify(pubJwk);

      await AsyncStorage.multiSet([
        [STORE_OWN_PUB,  pubStr],
        [STORE_OWN_PRIV, JSON.stringify(privJwk)],
      ]);

      this._ownPublicKey  = pair.publicKey;
      this._ownPrivateKey = pair.privateKey;
      this._publicKeyB64  = btoa(pubStr);
      console.log('[AuthorityKey] generated and persisted new RSA-2048 key pair');
      return true;
    } catch (e) {
      console.error('[AuthorityKey] generateKeyPair error:', e.message);
      return false;
    }
  }

  // ── Key distribution ───────────────────────────────────────────────────────

  /**
   * Store a remote authority public key received from a KEY: mesh broadcast.
   * Any device that receives this can now encrypt messages to the authority.
   * @param {string} b64 — base64(JSON(JWK)) from the KEY: packet
   */
  async storeRemoteKey(b64) {
    if (!this._available) return;
    try {
      const jwkStr = atob(b64);
      const jwk    = JSON.parse(jwkStr);
      this._remotePublicKey = await this._importPub(jwk);
      await AsyncStorage.setItem(STORE_REMOTE_PUB, jwkStr);
      console.log('[AuthorityKey] stored and cached remote authority public key');
    } catch (e) {
      console.warn('[AuthorityKey] storeRemoteKey error:', e.message);
    }
  }

  // ── Encryption / Decryption ────────────────────────────────────────────────

  /**
   * Hybrid-encrypt a plaintext message for the authority.
   *
   * Steps:
   *   1. Generate a one-time AES-256-GCM key.
   *   2. Encrypt `plaintext` with that AES key + a random 12-byte IV → ciphertext.
   *   3. Export the raw AES key bytes and encrypt them with RSA-OAEP → encrypted key.
   *   4. Return { ct, iv, ek } — all base64-encoded.
   *
   * Returns null if no public key is available or crypto fails.
   */
  async encrypt(plaintext) {
    // Use remote (authority's) public key if available; fall back to own (self-test / authority sending to itself)
    const pubKey = this._remotePublicKey ?? this._ownPublicKey;
    if (!pubKey || !this._available) {
      console.warn('[AuthorityKey] encrypt: no public key available');
      return null;
    }

    try {
      // Step 1 — generate ephemeral AES-256-GCM key
      const aesKey = await globalThis.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,           // extractable — needed to RSA-encrypt the raw key bytes
        ['encrypt'],
      );

      // Step 2 — encrypt message with AES-GCM
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)); // 96-bit nonce
      const ct = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        new TextEncoder().encode(plaintext),
      );

      // Step 3 — export raw AES key bytes and wrap with RSA-OAEP
      const rawAes = await globalThis.crypto.subtle.exportKey('raw', aesKey);
      const ek     = await globalThis.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        pubKey,
        rawAes,
      );

      return {
        ct: _ab2b64(ct),   // AES ciphertext (message + 16-byte GCM auth tag)
        iv: _ab2b64(iv),   // AES-GCM nonce
        ek: _ab2b64(ek),   // RSA-wrapped AES key
      };
    } catch (e) {
      console.error('[AuthorityKey] encrypt error:', e.message);
      return null;
    }
  }

  /**
   * Hybrid-decrypt a message encrypted for this authority device.
   *
   * Steps:
   *   1. Unwrap the AES key using the RSA private key.
   *   2. Decrypt the ciphertext using the recovered AES key + IV.
   *   3. Return the plaintext string.
   *
   * Returns null if this device has no private key or decryption fails.
   */
  async decrypt({ ct, iv, ek }) {
    if (!this._ownPrivateKey || !this._available) {
      console.warn('[AuthorityKey] decrypt: no private key on this device');
      return null;
    }

    try {
      // Step 1 — RSA-OAEP unwrap the AES key
      const rawAes = await globalThis.crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        this._ownPrivateKey,
        _b642ab(ek),
      );

      // Step 2 — import the raw AES key bytes for decryption
      const aesKey = await globalThis.crypto.subtle.importKey(
        'raw', rawAes,
        { name: 'AES-GCM' },
        false,
        ['decrypt'],
      );

      // Step 3 — AES-GCM decrypt
      const plainBuf = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: _b642ab(iv) },
        aesKey,
        _b642ab(ct),
      );

      return new TextDecoder().decode(plainBuf);
    } catch (e) {
      console.error('[AuthorityKey] decrypt error:', e.message);
      return null;
    }
  }

  // ── Key import helpers ─────────────────────────────────────────────────────

  _importPub(jwk) {
    return globalThis.crypto.subtle.importKey(
      'jwk', jwk,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );
  }

  _importPriv(jwk) {
    return globalThis.crypto.subtle.importKey(
      'jwk', jwk,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt'],
    );
  }
}

// ── ArrayBuffer ↔ base64 ───────────────────────────────────────────────────

function _ab2b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function _b642ab(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export default new AuthorityKeyService();
