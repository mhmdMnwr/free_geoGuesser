import { Module } from '@nestjs/common';
import { GameModule } from './game/game.module';
import { GeoDatabaseModule } from './geo-database/geo-database.module';
import { InfoModule } from './info/info.module';
import { StreetViewModule } from './streetview/streetview.module';
import { SecurityModule } from './security/security.module';
import { RedisModule } from './redis/redis.module';
import { RoadProxyModule } from './road-proxy/road-proxy.module';

@Module({
  imports: [
    SecurityModule,
    RedisModule,
    GeoDatabaseModule,
    RoadProxyModule,
    GameModule,
    InfoModule,
    StreetViewModule,
  ],
})
export class AppModule {}
