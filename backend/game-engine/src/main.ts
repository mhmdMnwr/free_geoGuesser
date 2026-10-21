import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useWebSocketAdapter(new IoAdapter(app));

  const port = parseInt(process.env.PORT || '5002', 10);
  await app.listen(port, '0.0.0.0');

  console.log(`[GameEngineService] WebSocket & Engine running on port ${port}`);
}

bootstrap();
