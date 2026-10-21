import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { CryptoService } from './crypto.service';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly crypto: CryptoService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header = req.headers['x-internal-service-auth'];

    if (!header || typeof header !== 'string') {
      throw new UnauthorizedException('Missing internal cluster authorization header.');
    }

    const match = header.match(/^t=(\d+),sig=([a-f0-9]+)$/);
    if (!match) {
      throw new UnauthorizedException('Malformed internal service auth token.');
    }

    const [, timestampStr, signature] = match;
    const timestamp = parseInt(timestampStr, 10);
    const now = Math.floor(Date.now() / 1000);

    if (Math.abs(now - timestamp) > 60) {
      throw new UnauthorizedException('Internal service auth token expired.');
    }

    const secret =
      process.env.INTERNAL_CLUSTER_SECRET ||
      'lan_guessr_cluster_secret_e9f3b8a1';

    const path = req.path || req.originalUrl?.split('?')[0];
    const payload = `${timestamp}:${path}`;
    const isValid = this.crypto.verifyHmac(payload, signature, secret);

    if (!isValid) {
      throw new UnauthorizedException('Invalid internal HMAC signature.');
    }

    return true;
  }
}
