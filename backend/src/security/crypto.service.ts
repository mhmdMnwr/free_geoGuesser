import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface EcdhKeyPair {
  publicKey: string; // 65-byte uncompressed point in hex (starts with '04')
  privateKey: string; // 32-byte private key in hex
}

export interface EncryptedPayload {
  iv: string; // 12-byte IV in hex
  ciphertext: string; // ciphertext in hex or base64
  tag: string; // 16-byte auth tag in hex
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);

  /**
   * Generates a new NIST P-256 (prime256v1 / secp256r1) ECDH keypair.
   */
  generateEcdhKeyPair(): EcdhKeyPair {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    return {
      publicKey: ecdh.getPublicKey('hex'),
      privateKey: ecdh.getPrivateKey('hex'),
    };
  }

  /**
   * Derives a 256-bit symmetric AES key from peer public key and my private key using ECDH + SHA-256.
   * Neither key is ever transmitted over the network.
   */
  deriveSharedKey(peerPublicKeyHex: string, privateKeyHex: string): Buffer {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(privateKeyHex, 'hex'));
    const peerBuffer = Buffer.from(peerPublicKeyHex, 'hex');
    const sharedSecret = ecdh.computeSecret(peerBuffer);
    // Hash shared secret with SHA-256 to obtain uniform 256-bit AES key
    return crypto.createHash('sha256').update(sharedSecret).digest();
  }

  /**
   * Encrypts plaintext JSON data with AES-256-GCM.
   */
  encryptAesGcm(data: any, key: Buffer): EncryptedPayload {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const jsonStr = JSON.stringify(data);
    let ciphertext = cipher.update(jsonStr, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return {
      iv: iv.toString('hex'),
      ciphertext,
      tag,
    };
  }

  /**
   * Decrypts AES-256-GCM payload and verifies integrity auth tag.
   */
  decryptAesGcm(payload: EncryptedPayload, key: Buffer): any {
    const iv = Buffer.from(payload.iv, 'hex');
    const tag = Buffer.from(payload.tag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  /**
   * Signs an internal inter-service request with HMAC-SHA256.
   */
  signInternalRequest(
    path: string,
    secret: string,
    timestamp: number = Date.now(),
  ): string {
    const normalizedPath = path.split('?')[0];
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}:${normalizedPath}`)
      .digest('hex');
    return `t=${timestamp},sig=${signature}`;
  }

  /**
   * Verifies an internal inter-service request signature and checks for replay expiration.
   */
  verifyInternalRequest(
    authHeader: string | undefined,
    path: string,
    secret: string,
    maxAgeMs: number = 30000,
  ): boolean {
    if (!authHeader) return false;

    const parts = authHeader.split(',');
    let timestamp: number | null = null;
    let signature: string | null = null;

    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === 't') timestamp = parseInt(v, 10);
      if (k === 'sig') signature = v;
    }

    if (!timestamp || !signature || isNaN(timestamp)) {
      return false;
    }

    // Check timestamp drift to prevent replay attacks
    const now = Date.now();
    if (Math.abs(now - timestamp) > maxAgeMs) {
      this.logger.warn(`Rejected internal request: signature expired (drift: ${now - timestamp}ms)`);
      return false;
    }

    const normalizedPath = path.split('?')[0];
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}:${normalizedPath}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSig, 'hex'),
    );
  }
}
