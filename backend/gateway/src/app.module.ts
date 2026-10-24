import { Module } from '@nestjs/common';
import { SecurityModule } from './security/security.module';
import { InfoModule } from './info/info.module';
import { ProxyModule } from './proxy/proxy.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [SecurityModule, InfoModule, ProxyModule, FeedbackModule],
})
export class AppModule {}
