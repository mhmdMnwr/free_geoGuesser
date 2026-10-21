import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class StreetviewCipherService {
  obfuscateUrl(url: string): { payload: string; key: string } {
    const key = crypto.randomBytes(16).toString('hex');
    const buf = Buffer.from(url, 'utf8');
    const xored: number[] = [];
    for (let i = 0; i < buf.length; i++) {
      xored.push(buf[i] ^ key.charCodeAt(i % key.length));
    }
    const payload = Buffer.from(xored).toString('base64');
    return { payload, key };
  }
}
