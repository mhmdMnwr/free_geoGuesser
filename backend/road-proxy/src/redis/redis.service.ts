import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  onModuleInit() {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    this.client = new Redis({
      host,
      port,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    this.client.connect().catch((e) => this.logger.warn(`Redis connect: ${e.message}`));
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  async setRoadImage(roadToken: string, buffer: Buffer, ttlSeconds = 7200): Promise<void> {
    const key = `road:img:${roadToken}`;
    await this.client.set(key, buffer, 'EX', ttlSeconds);
  }

  async getRoadImage(roadToken: string): Promise<Buffer | null> {
    const key = `road:img:${roadToken}`;
    return this.client.getBuffer(key);
  }

  async getTargetCoords(roomIdOrToken: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const direct = await this.client.get(`round:target:${roomIdOrToken}`);
      if (direct) return JSON.parse(direct);

      const byToken = await this.client.get(`round:token:${roomIdOrToken}`);
      if (byToken) return JSON.parse(byToken);
    } catch (err: any) {
      this.logger.warn(`Error getting target coords for ${roomIdOrToken}: ${err.message}`);
    }
    return null;
  }
}
