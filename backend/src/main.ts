import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for all origins (LAN multiplayer requirement)
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Socket.IO adapter with CORS
  app.useWebSocketAdapter(new IoAdapter(app));

  // Optional static assets fallback if compiled frontend dist directory is mounted/present
  const candidateFrontendDirs = [
    path.join(process.cwd(), 'frontend', 'dist'),
    path.join(process.cwd(), '..', 'frontend', 'dist'),
    path.join(__dirname, '..', '..', 'frontend', 'dist'),
    path.join(process.cwd(), 'dist', 'frontend'),
  ];
  for (const dir of candidateFrontendDirs) {
    if (fs.existsSync(dir)) {
      app.use(express.static(dir));
      break;
    }
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  await app.listen(port, '0.0.0.0');

  // Print LAN addresses
  const interfaces = os.networkInterfaces();
  console.log('\n=============================================================');
  console.log('       LAN-GUESS-R BACKEND (NestJS)');
  console.log('=============================================================');
  console.log(`  Local host:    http://localhost:${port}`);
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  LAN (${name}): http://${iface.address}:${port}`);
      }
    }
  }
  console.log('=============================================================\n');
}

bootstrap();
