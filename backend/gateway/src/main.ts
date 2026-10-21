import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const gameEngineUrl = process.env.GAME_ENGINE_URL || 'http://172.28.0.12:5002';
  const wsProxy = createProxyMiddleware({
    pathFilter: '/socket.io',
    target: gameEngineUrl,
    changeOrigin: true,
    ws: true,
  });

  app.use(wsProxy);

  const candidateDirs = [
    path.join(process.cwd(), 'frontend', 'dist'),
    path.join(process.cwd(), '..', '..', 'frontend', 'dist'),
    path.join(__dirname, '..', '..', 'frontend', 'dist'),
  ];
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      app.use(express.static(dir));
      break;
    }
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  const server = app.getHttpServer();
  server.on('upgrade', (req: any, socket: any, head: any) => {
    if (req.url && req.url.startsWith('/socket.io')) {
      (wsProxy as any).upgrade(req, socket, head);
    }
  });

  await app.listen(port, '0.0.0.0');
  console.log(`[GatewayService] Running on port ${port}, routing WS to ${gameEngineUrl}`);
}

bootstrap();
