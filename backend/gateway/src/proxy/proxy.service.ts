import { Injectable, Logger } from '@nestjs/common';
import { CryptoService } from '../security/crypto.service';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly crypto: CryptoService) {}

  getLobbyServiceUrl(): string {
    return process.env.LOBBY_SERVICE_URL || 'http://127.0.0.1:5001';
  }

  getGameEngineUrl(): string {
    return process.env.GAME_ENGINE_URL || 'http://127.0.0.1:5002';
  }

  getRoadProxyUrl(): string {
    return process.env.ROAD_PROXY_URL || 'http://127.0.0.1:5003';
  }

  getInternalAuthHeader(path: string): string {
    return this.crypto.generateInternalAuthHeader(path);
  }
}
