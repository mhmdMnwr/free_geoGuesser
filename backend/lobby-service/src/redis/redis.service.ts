import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private pubClient: Redis;
  private subClient: Redis;

  onModuleInit() {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    const opts = {
      host,
      port,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    };

    this.client = new Redis(opts);
    this.pubClient = new Redis(opts);
    this.subClient = new Redis(opts);

    Promise.all([
      this.client.connect().catch((e) => this.logger.warn(`Redis client connect: ${e.message}`)),
      this.pubClient.connect().catch((e) => this.logger.warn(`Redis pub connect: ${e.message}`)),
      this.subClient.connect().catch((e) => this.logger.warn(`Redis sub connect: ${e.message}`)),
    ]);
  }

  onModuleDestroy() {
    this.client?.disconnect();
    this.pubClient?.disconnect();
    this.subClient?.disconnect();
  }

  getClient(): Redis {
    return this.client;
  }

  async publish(channel: string, message: any): Promise<void> {
    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      await this.pubClient.publish(channel, data);
    } catch (err: any) {
      this.logger.error(`Publish error on ${channel}: ${err.message}`);
    }
  }

  async setHostHeartbeat(lobbyId: string, ttlSeconds = 8): Promise<void> {
    const key = `lobby:${lobbyId}:host_heartbeat`;
    await this.client.set(key, String(Date.now()), 'EX', ttlSeconds);
  }

  async checkHostHeartbeat(lobbyId: string): Promise<boolean> {
    const key = `lobby:${lobbyId}:host_heartbeat`;
    const exists = await this.client.exists(key);
    return exists === 1;
  }
}
