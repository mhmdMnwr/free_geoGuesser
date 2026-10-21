import { Module } from '@nestjs/common';
import { InfoController } from './info.controller';
import { NetworkInterfacesService } from './network-interfaces.service';

@Module({
  controllers: [InfoController],
  providers: [NetworkInterfacesService],
  exports: [NetworkInterfacesService],
})
export class InfoModule {}
