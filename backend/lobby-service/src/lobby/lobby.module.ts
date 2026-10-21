import { Module } from '@nestjs/common';
import { LobbyController } from './lobby.controller';
import { LobbyService } from './lobby.service';
import { LobbyWatchdog } from './lobby.watchdog';
import { CryptoModule } from '../crypto/crypto.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [CryptoModule, RedisModule],
  controllers: [LobbyController],
  providers: [LobbyService, LobbyWatchdog],
  exports: [LobbyService],
})
export class LobbyModule {}
