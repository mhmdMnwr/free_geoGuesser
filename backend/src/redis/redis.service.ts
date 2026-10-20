import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private subClient: Redis | null = null;
  private isConnected = false;
  private memoryStore = new Map<string, { value: any; expiresAt?: number }>();
  private binaryStore = new Map<string, { buffer: Buffer; expiresAt?: number }>();
  private watchdogInterval: NodeJS.Timeout | null = null;

  async onModuleInit() {
    const host = process.env.REDIS_HOST || '172.28.0.15';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    try {
      this.client = new Redis({
        host,
        port,
        connectTimeout: 2500,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      this.subClient = new Redis({
        host,
        port,
        connectTimeout: 2500,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      await this.client.connect();
      await this.subClient.connect();
      this.isConnected = true;
      this.logger.log(`✅ Connected to Redis 7 Backbone at ${host}:${port}`);
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(
        `Redis connection at ${host}:${port} unavailable (${err.message}). Using high-performance in-memory fallback.`,
      );
    }
  }

  onModuleDestroy() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
    if (this.client) this.client.disconnect();
    if (this.subClient) this.subClient.disconnect();
  }

  // --- Ephemeral Lobby State ---

  async setLobbyMeta(lobbyId: string, meta: any, ttlSeconds = 14400): Promise<void> {
    const dataStr = JSON.stringify(meta);
    if (this.isConnected && this.client) {
      await this.client.set(`lobby:${lobbyId}:meta`, dataStr, 'EX', ttlSeconds);
    } else {
      this.memoryStore.set(`lobby:${lobbyId}:meta`, {
        value: dataStr,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  async getLobbyMeta(lobbyId: string): Promise<any | null> {
    if (this.isConnected && this.client) {
      const raw = await this.client.get(`lobby:${lobbyId}:meta`);
      return raw ? JSON.parse(raw) : null;
    } else {
      const entry = this.memoryStore.get(`lobby:${lobbyId}:meta`);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.memoryStore.delete(`lobby:${lobbyId}:meta`);
        return null;
      }
      return JSON.parse(entry.value);
    }
  }

  async deleteLobby(lobbyId: string): Promise<void> {
    if (this.isConnected && this.client) {
      await this.client.del(
        `lobby:${lobbyId}:meta`,
        `lobby:${lobbyId}:host_heartbeat`,
        `lobby:${lobbyId}:players`,
        `lobby:${lobbyId}:match`,
      );
    } else {
      this.memoryStore.delete(`lobby:${lobbyId}:meta`);
      this.memoryStore.delete(`lobby:${lobbyId}:host_heartbeat`);
      this.memoryStore.delete(`lobby:${lobbyId}:players`);
      this.memoryStore.delete(`lobby:${lobbyId}:match`);
    }
  }

  async getAllLobbies(): Promise<any[]> {
    if (this.isConnected && this.client) {
      const keys = await this.client.keys('lobby:*:meta');
      if (keys.length === 0) return [];
      const values = await this.client.mget(...keys);
      return values.filter(Boolean).map((v) => JSON.parse(v!));
    } else {
      const lobbies: any[] = [];
      const now = Date.now();
      for (const [key, entry] of this.memoryStore.entries()) {
        if (key.startsWith('lobby:') && key.endsWith(':meta')) {
          if (!entry.expiresAt || now <= entry.expiresAt) {
            lobbies.push(JSON.parse(entry.value));
          }
        }
      }
      return lobbies;
    }
  }

  // --- Host Heartbeat Watchdog ---

  async setHostHeartbeat(lobbyId: string, hostId: string, ttlSeconds = 8): Promise<void> {
    if (this.isConnected && this.client) {
      await this.client.set(`lobby:${lobbyId}:host_heartbeat`, hostId, 'EX', ttlSeconds);
    } else {
      this.memoryStore.set(`lobby:${lobbyId}:host_heartbeat`, {
        value: hostId,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  async isHostAlive(lobbyId: string): Promise<boolean> {
    if (this.isConnected && this.client) {
      const exists = await this.client.exists(`lobby:${lobbyId}:host_heartbeat`);
      return exists === 1;
    } else {
      const entry = this.memoryStore.get(`lobby:${lobbyId}:host_heartbeat`);
      if (!entry) return false;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.memoryStore.delete(`lobby:${lobbyId}:host_heartbeat`);
        return false;
      }
      return true;
    }
  }

  startHostWatchdog(
    getActiveLobbyIds: () => string[],
    onHostTerminated: (lobbyId: string) => void,
  ) {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);

    this.watchdogInterval = setInterval(async () => {
      const lobbyIds = getActiveLobbyIds();
      for (const id of lobbyIds) {
        if (id === 'LAN-01') continue; // Do not auto-purge the persistent LAN default
        const alive = await this.isHostAlive(id);
        if (!alive) {
          this.logger.warn(
            `[HOST WATCHDOG] Host heartbeat expired for room [${id}]. Deleting lobby instantly.`,
          );
          await this.deleteLobby(id);
          onHostTerminated(id);
        }
      }
    }, 2000);
  }

  // --- Road Imagery Binary Cache ---

  async cacheRoadImage(token: string, buffer: Buffer, ttlSeconds = 7200): Promise<void> {
    if (this.isConnected && this.client) {
      await this.client.set(
        `road:img:${token}`,
        buffer.toString('base64'),
        'EX',
        ttlSeconds,
      );
    } else {
      this.binaryStore.set(token, {
        buffer,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  async getRoadImage(token: string): Promise<Buffer | null> {
    if (this.isConnected && this.client) {
      const rawBase64 = await this.client.get(`road:img:${token}`);
      return rawBase64 ? Buffer.from(rawBase64, 'base64') : null;
    } else {
      const entry = this.binaryStore.get(token);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.binaryStore.delete(token);
        return null;
      }
      return entry.buffer;
    }
  }

  // --- Pub/Sub Event Backbone ---

  async publishLobbyEvent(lobbyId: string, event: string, payload: any): Promise<void> {
    const msg = JSON.stringify({ event, payload, timestamp: Date.now() });
    if (this.isConnected && this.client) {
      await this.client.publish(`pubsub:lobby:${lobbyId}`, msg);
    }
  }

  async subscribeToLobby(
    lobbyId: string,
    callback: (event: string, payload: any) => void,
  ): Promise<() => void> {
    if (this.isConnected && this.subClient) {
      const channel = `pubsub:lobby:${lobbyId}`;
      await this.subClient.subscribe(channel);
      const listener = (chan: string, message: string) => {
        if (chan === channel) {
          try {
            const data = JSON.parse(message);
            callback(data.event, data.payload);
          } catch (e) {}
        }
      };
      this.subClient.on('message', listener);
      return () => {
        this.subClient?.unsubscribe(channel);
        this.subClient?.off('message', listener);
      };
    }
    return () => {};
  }
}
