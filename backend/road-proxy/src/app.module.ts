import { Module } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { SecurityModule } from './security/security.module';
import { RoadProxyModule } from './road-proxy/road-proxy.module';
import { StreetviewModule } from './streetview/streetview.module';

@Module({
  imports: [RedisModule, SecurityModule, RoadProxyModule, StreetviewModule],
})
export class AppModule {}
