import { Module } from '@nestjs/common';
import { RoadProxyService } from './road-proxy.service';
import { RoadProxyController } from './road-proxy.controller';

@Module({
  controllers: [RoadProxyController],
  providers: [RoadProxyService],
  exports: [RoadProxyService],
})
export class RoadProxyModule {}
