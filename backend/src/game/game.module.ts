import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { GeoDatabaseModule } from '../geo-database/geo-database.module';

@Module({
  imports: [GeoDatabaseModule],
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}
