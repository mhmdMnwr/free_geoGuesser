import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface EncryptedPayload {
  iv: string;
  ciphertext: string;
  tag: string;
}

@Injectable()
export class CryptoService {
  generateEcdhKeyPair() {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    return {
      publicKeyHex: ecdh.getPublicKey('hex'),
      privateKey: ecdh,
    };
  }

  deriveAesKey(serverEcdh: crypto.ECDH, clientPublicKeyHex: string): Buffer {
    const clientPub = Buffer.from(clientPublicKeyHex, 'hex');
    return serverEcdh.computeSecret(clientPub);
  }

  decryptPayload(payload: EncryptedPayload, aesKey: Buffer): any {
    const iv = Buffer.from(payload.iv, 'hex');
    const tag = Buffer.from(payload.tag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  encryptPayload(data: any, aesKey: Buffer): EncryptedPayload {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    const plaintext = JSON.stringify(data);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return {
      iv: iv.toString('hex'),
      ciphertext,
      tag,
    };
  }

  verifyHmac(payload: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expected = hmac.digest('hex');
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  }
}
