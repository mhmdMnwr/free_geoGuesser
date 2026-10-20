import { Module, Global } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { InternalAuthGuard } from './internal-auth.guard';

@Global()
@Module({
  providers: [CryptoService, InternalAuthGuard],
  exports: [CryptoService, InternalAuthGuard],
})
export class SecurityModule {}
