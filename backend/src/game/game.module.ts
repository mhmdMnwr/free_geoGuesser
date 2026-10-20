import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { GeoDatabaseModule } from '../geo-database/geo-database.module';
import { RoadProxyModule } from '../road-proxy/road-proxy.module';

@Module({
  imports: [GeoDatabaseModule, RoadProxyModule],
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}
