import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const port = parseInt(process.env.PORT || '5003', 10);
  await app.listen(port, '0.0.0.0');

  console.log(`[RoadProxyService] Listening on port ${port}`);
}

bootstrap();
