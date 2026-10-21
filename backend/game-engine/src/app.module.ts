import { Module } from '@nestjs/common';
import { SecurityModule } from './security/security.module';
import { RedisModule } from './redis/redis.module';
import { GeoDatabaseModule } from './geo-database/geo-database.module';
import { GameModule } from './game/game.module';

@Module({
  imports: [SecurityModule, RedisModule, GeoDatabaseModule, GameModule],
})
export class AppModule {}
