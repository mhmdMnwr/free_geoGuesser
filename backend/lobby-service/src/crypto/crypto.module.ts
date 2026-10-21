import { Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { InternalAuthGuard } from './internal-auth.guard';

@Module({
  providers: [CryptoService, InternalAuthGuard],
  exports: [CryptoService, InternalAuthGuard],
})
export class CryptoModule {}
