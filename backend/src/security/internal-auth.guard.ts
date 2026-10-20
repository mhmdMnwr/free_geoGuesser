import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CryptoService } from './crypto.service';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly cryptoService: CryptoService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const clusterSecret = process.env.INTERNAL_CLUSTER_SECRET || 'lan_cluster_default_secret_2026';
    const authHeader = req.headers['x-internal-service-auth'] as string | undefined;

    const isValid = this.cryptoService.verifyInternalRequest(
      authHeader,
      req.originalUrl || req.url,
      clusterSecret,
    );

    if (!isValid) {
      throw new UnauthorizedException(
        'Access Denied: Missing or invalid internal cluster HMAC signature.',
      );
    }

    return true;
  }
}
