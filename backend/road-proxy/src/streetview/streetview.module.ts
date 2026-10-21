import { Module } from '@nestjs/common';
import { StreetViewController } from './streetview.controller';
import { StreetviewCipherService } from './streetview-cipher.service';
import { StreetviewTemplateService } from './streetview-template.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [StreetViewController],
  providers: [StreetviewCipherService, StreetviewTemplateService],
  exports: [StreetviewCipherService, StreetviewTemplateService],
})
export class StreetviewModule {}
