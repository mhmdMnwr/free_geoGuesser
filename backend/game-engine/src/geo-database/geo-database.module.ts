import { Module } from '@nestjs/common';
import { GeoDatabaseService } from './geo-database.service';

@Module({
  providers: [GeoDatabaseService],
  exports: [GeoDatabaseService],
})
export class GeoDatabaseModule {}
