import { Module } from '@nestjs/common';
import { GameModule } from './game/game.module';
import { GeoDatabaseModule } from './geo-database/geo-database.module';
import { InfoModule } from './info/info.module';
import { StreetViewModule } from './streetview/streetview.module';

@Module({
  imports: [GeoDatabaseModule, GameModule, InfoModule, StreetViewModule],
})
export class AppModule {}
