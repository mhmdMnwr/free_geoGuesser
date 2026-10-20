import { Module } from '@nestjs/common';
import { StreetViewController } from './streetview.controller';
import { GameModule } from '../game/game.module';

@Module({
  imports: [GameModule],
  controllers: [StreetViewController],
})
export class StreetViewModule {}
