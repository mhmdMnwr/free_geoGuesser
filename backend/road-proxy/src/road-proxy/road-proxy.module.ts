import { Module } from '@nestjs/common';
import { RoadProxyController } from './road-proxy.controller';
import { RoadProxyService } from './road-proxy.service';
import { RedisModule } from '../redis/redis.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [RedisModule, SecurityModule],
  controllers: [RoadProxyController],
  providers: [RoadProxyService],
  exports: [RoadProxyService],
})
export class RoadProxyModule {}
