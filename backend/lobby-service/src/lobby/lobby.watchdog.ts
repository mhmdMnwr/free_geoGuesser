import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { LobbyService } from './lobby.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class LobbyWatchdog implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LobbyWatchdog.name);
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly lobbyService: LobbyService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    this.checkInterval = setInterval(async () => {
      const lobbies = this.lobbyService.getAllLobbies();
      for (const lobby of lobbies) {
        if (lobby.id === 'LAN-01') continue;
        if (lobby.playerCount === 0) {
          await this.lobbyService.deleteLobby(lobby.id, 'Squad has 0 members.');
          continue;
        }
        const alive = await this.redis.checkHostHeartbeat(lobby.id);
        if (!alive) {
          this.logger.warn(`Watchdog: Host heartbeat expired for ${lobby.id}. Disbanding lobby.`);
          await this.lobbyService.deleteLobby(
            lobby.id,
            `Squad Leader (${lobby.hostName}) disconnected. Room disbanded.`,
          );
        }
      }
    }, 2500);
  }

  onModuleDestroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
