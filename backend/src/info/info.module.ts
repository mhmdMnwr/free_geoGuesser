import { Module } from '@nestjs/common';
import { InfoController } from './info.controller';
import { GameModule } from '../game/game.module';
import { GeoDatabaseModule } from '../geo-database/geo-database.module';

@Module({
  imports: [GameModule, GeoDatabaseModule],
  controllers: [InfoController],
})
export class InfoModule {}
