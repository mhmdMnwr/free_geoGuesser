/**
 * Pure LAN Zero-Trust WebCrypto Client for WAYFINDER
 * Implements in-memory Elliptic-Curve Diffie-Hellman (ECDH P-256)
 * and AES-256-GCM authenticated encryption.
 * The session key is NEVER sent over the LAN.
 */

export interface EncryptedPayload {
  iv: string; // 12-byte IV in hex
  ciphertext: string; // Ciphertext in hex
  tag: string; // 16-byte authentication tag in hex
}

export interface ClientCryptoState {
  keyPair: CryptoKeyPair | null;
  publicKeyHex: string | null;
  aesKey: CryptoKey | null;
}

export async function generateClientEcdhKeyPair(): Promise<{
  keyPair: CryptoKeyPair;
  publicKeyHex: string;
}> {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );

  const rawPub = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
  const hexPub = Array.from(new Uint8Array(rawPub))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { keyPair, publicKeyHex: hexPub };
}

export async function deriveAesGcmKey(
  serverPublicKeyHex: string,
  clientPrivateKey: CryptoKey,
): Promise<CryptoKey> {
  const bytes = new Uint8Array(
    serverPublicKeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );

  const serverPubKey = await window.crypto.subtle.importKey(
    'raw',
    bytes.buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  return window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: serverPubKey },
    clientPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptPayload(
  data: any,
  aesKey: CryptoKey,
): Promise<EncryptedPayload> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    encoded,
  );

  // In WebCrypto AES-GCM, the auth tag (16 bytes) is appended to ciphertext
  const encryptedBytes = new Uint8Array(encryptedBuffer);
  const ciphertextBytes = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const tagBytes = encryptedBytes.slice(encryptedBytes.length - 16);

  const toHex = (buf: Uint8Array) =>
    Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  return {
    iv: toHex(iv),
    ciphertext: toHex(ciphertextBytes),
    tag: toHex(tagBytes),
  };
}

export async function decryptPayload(
  encrypted: EncryptedPayload,
  aesKey: CryptoKey,
): Promise<any> {
  const fromHex = (hex: string) =>
    new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));

  const iv = fromHex(encrypted.iv);
  const ciphertext = fromHex(encrypted.ciphertext);
  const tag = fromHex(encrypted.tag);

  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    combined.buffer,
  );

  const decoded = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(decoded);
}
