import { Injectable } from '@nestjs/common';
import * as os from 'os';

export interface LanAddress {
  interface: string;
  address: string;
}

@Injectable()
export class NetworkInterfacesService {
  getLanAddresses(): LanAddress[] {
    const interfaces = os.networkInterfaces();
    const addresses: LanAddress[] = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push({ interface: name, address: iface.address });
        }
      }
    }
    return addresses;
  }

  getPrimaryIp(requestedHost?: string): string {
    if (process.env.HOST_PRIMARY_IP) return process.env.HOST_PRIMARY_IP;
    if (process.env.HOST_IP) return process.env.HOST_IP;

    if (requestedHost) {
      const clean = requestedHost.split(':')[0].trim();
      const isInternal = clean === 'localhost' || clean === '127.0.0.1' || clean === 'backend' || clean === 'gateway' || clean.startsWith('172.28.');
      if (clean && !isInternal) return clean;
    }

    const addrs = this.getLanAddresses().filter((a) => !a.address.startsWith('172.28.') && !a.address.startsWith('172.17.'));
    return addrs.length > 0 ? addrs[0].address : (process.env.HOST_PRIMARY_IP || '127.0.0.1');
  }
}
