import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  signHmac(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  generateInternalAuthHeader(path: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const secret =
      process.env.INTERNAL_CLUSTER_SECRET ||
      'lan_guessr_cluster_secret_e9f3b8a1';
    const payload = `${timestamp}:${path}`;
    const sig = this.signHmac(payload, secret);
    return `t=${timestamp},sig=${sig}`;
  }
}
