import { Module } from '@nestjs/common';
import { CryptoModule } from './crypto/crypto.module';
import { RedisModule } from './redis/redis.module';
import { LobbyModule } from './lobby/lobby.module';

@Module({
  imports: [CryptoModule, RedisModule, LobbyModule],
})
export class AppModule {}
