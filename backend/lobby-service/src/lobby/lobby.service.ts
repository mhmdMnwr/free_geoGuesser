import { Injectable, Logger } from '@nestjs/common';
import { CryptoService } from '../crypto/crypto.service';
import { RedisService } from '../redis/redis.service';
import { LobbyMeta, LobbyPlayer } from './lobby.types';
import { CreateLobbyDto, JoinLobbyDto } from './dto/lobby.dto';

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  private lobbies = new Map<string, LobbyMeta>();
  private players = new Map<string, Map<string, LobbyPlayer>>();

  constructor(
    private readonly crypto: CryptoService,
    private readonly redis: RedisService,
  ) {}

  getAllLobbies(): any[] {
    const list: any[] = [];
    for (const meta of Array.from(this.lobbies.values())) {
      const roomPlayers = this.players.get(meta.id);
      const count = roomPlayers ? roomPlayers.size : 0;
      if (count === 0 && meta.id !== 'LAN-01') {
        this.deleteLobby(meta.id, 'Squad has 0 members.');
        continue;
      }
      list.push({
        id: meta.id,
        name: meta.name,
        hostName: meta.hostName,
        hostIp: meta.hostIp,
        playerCount: count,
        maxPlayers: meta.maxPlayers,
        selectedRegion: meta.selectedRegion,
        difficulty: meta.difficulty,
        totalRounds: meta.totalRounds,
        status: meta.status,
      });
    }
    return list;
  }

  getLobby(id: string): LobbyMeta | null {
    return this.lobbies.get(id) || null;
  }

  async createLobby(dto: CreateLobbyDto, clientIp: string) {
    const id = `LAN-${Math.floor(1000 + Math.random() * 9000)}`;
    const hostId = `host_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const serverEcdh = this.crypto.generateEcdhKeyPair();
    const aesKey = this.crypto.deriveAesKey(serverEcdh.privateKey, dto.clientPublicKey);

    const meta: LobbyMeta = {
      id,
      name: dto.name || `Squad ${id}`,
      hostId,
      hostIp: clientIp,
      hostName: dto.hostName || 'SquadLeader',
      maxPlayers: dto.maxPlayers || 8,
      selectedRegion: dto.selectedRegion || 'all',
      difficulty: dto.difficulty || 'all',
      totalRounds: dto.totalRounds || 5,
      status: 'LOBBY',
      createdAt: Date.now(),
    };

    const hostPlayer: LobbyPlayer = {
      id: hostId,
      username: meta.hostName,
      ip: clientIp,
      isHost: true,
      connected: true,
      clientPublicKeyHex: dto.clientPublicKey,
      aesKey,
    };

    this.lobbies.set(id, meta);
    const roomMap = new Map<string, LobbyPlayer>();
    roomMap.set(hostId, hostPlayer);
    this.players.set(id, roomMap);

    await this.redis.setHostHeartbeat(id, 8);
    await this.redis.publish(`pubsub:lobby:${id}`, {
      event: 'LOBBY_CREATED',
      lobbyId: id,
      hostName: meta.hostName,
    });

    return {
      success: true,
      lobbyId: id,
      playerId: hostId,
      serverPublicKey: serverEcdh.publicKeyHex,
      lobby: meta,
    };
  }

  async joinLobby(dto: JoinLobbyDto, clientIp: string) {
    const lobby = this.lobbies.get(dto.roomId);
    if (!lobby) {
      return { success: false, error: 'Lobby not found or already closed.' };
    }

    const roomPlayers = this.players.get(dto.roomId)!;
    if (roomPlayers.size >= lobby.maxPlayers) {
      return { success: false, error: 'Lobby is at maximum capacity.' };
    }

    const desiredUsername = (dto.username || 'Operative').trim();
    for (const p of roomPlayers.values()) {
      if (p.connected && p.username.toLowerCase() === desiredUsername.toLowerCase()) {
        return { success: false, error: `Callsign "${desiredUsername}" is already taken in this squad.` };
      }
    }

    const playerId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const serverEcdh = this.crypto.generateEcdhKeyPair();
    const aesKey = this.crypto.deriveAesKey(serverEcdh.privateKey, dto.clientPublicKey);

    const player: LobbyPlayer = {
      id: playerId,
      username: dto.username || 'Operative',
      ip: clientIp,
      isHost: false,
      connected: true,
      clientPublicKeyHex: dto.clientPublicKey,
      aesKey,
    };

    roomPlayers.set(playerId, player);
    await this.redis.publish(`pubsub:lobby:${dto.roomId}`, {
      event: 'PLAYER_JOINED',
      lobbyId: dto.roomId,
      username: player.username,
      playerCount: roomPlayers.size,
    });

    return {
      success: true,
      lobbyId: dto.roomId,
      playerId,
      serverPublicKey: serverEcdh.publicKeyHex,
      lobby,
    };
  }

  async recordHeartbeat(lobbyId: string, hostId: string) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || lobby.hostId !== hostId) {
      return { success: false, error: 'Unauthorized heartbeat.' };
    }
    await this.redis.setHostHeartbeat(lobbyId, 8);
    return { success: true, ack: true };
  }

  async deleteLobby(id: string, reason = 'Host disconnected.') {
    if (!this.lobbies.has(id)) return;
    this.lobbies.delete(id);
    this.players.delete(id);

    await this.redis.publish(`pubsub:lobby:${id}`, {
      event: 'LOBBY_TERMINATED',
      lobbyId: id,
      reason,
    });
    this.logger.log(`[LobbyService] Lobby ${id} terminated: ${reason}`);
  }
}
