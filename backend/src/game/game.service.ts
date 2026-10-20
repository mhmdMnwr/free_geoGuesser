import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { Server, Socket } from 'socket.io';
import {
  GameState,
  GameRoom,
  Player,
  PendingAdmission,
  GeoLocation,
  Coords,
  LobbySummary,
} from './game.types';
import {
  calculateDistanceKm,
  calculateScore,
  selectDiverseMatchLocations,
  sanitizeLocationLabel,
} from './game.helpers';
import { GeoDatabaseService } from '../geo-database/geo-database.service';
import { RedisService } from '../redis/redis.service';
import { CryptoService } from '../security/crypto.service';
import { RoadProxyService } from '../road-proxy/road-proxy.service';

@Injectable()
export class GameService implements OnModuleInit {
  private readonly logger = new Logger(GameService.name);
  public readonly rooms = new Map<string, GameRoom>();
  private serverInstance: Server | null = null;

  constructor(
    private readonly geoDb: GeoDatabaseService,
    private readonly redis: RedisService,
    private readonly cryptoService: CryptoService,
    private readonly roadProxy: RoadProxyService,
  ) {
    // Seed persistent default room LAN-01 for backward compatibility
    const defaultRoom = this.createDefaultRoom(
      'LAN-01',
      'EXPEDITION ALPHA (LAN PRIME)',
    );
    this.rooms.set('LAN-01', defaultRoom);
  }

  setServer(server: Server) {
    this.serverInstance = server;
  }

  onModuleInit() {
    // Start Redis Host Heartbeat Watchdog (checks every 2 seconds)
    this.redis.startHostWatchdog(
      () => Array.from(this.rooms.keys()),
      (expiredLobbyId) => {
        if (this.serverInstance) {
          this.terminateLobby(
            expiredLobbyId,
            this.serverInstance,
            'Squad Leader heartbeat expired. Expedition room disbanded.',
          );
        } else {
          this.deleteRoom(expiredLobbyId);
        }
      },
    );
  }

  // Backward compatibility getter for single-room calls
  public get state(): GameState {
    let defaultRoom = this.rooms.get('LAN-01');
    if (!defaultRoom) {
      defaultRoom = this.createDefaultRoom('LAN-01', 'EXPEDITION ALPHA (LAN PRIME)');
      this.rooms.set('LAN-01', defaultRoom);
    }
    return defaultRoom;
  }

  public createDefaultRoom(
    id: string,
    name: string,
    hostIp: string | null = null,
    hostName: string | null = null,
    hostId: string | null = null,
    hostSocketId: string | null = null,
  ): GameRoom {
    return {
      id,
      name,
      hostIp,
      hostName,
      hostId,
      hostSocketId,
      hostHeartbeat: Date.now(),
      lastHostUsername: null,
      status: 'LOBBY',
      currentRound: 0,
      totalRounds: 10,
      countdownDuration: 20,
      selectedRegion: 'all',
      difficulty: 'all',
      selectedLocations: [],
      roundTarget: null,
      roundUplinkToken: null,
      roadToken: null,
      currentSharedImage: null,
      sharedImageTimestamp: null,
      sharedImageCaption: '',
      countdownSeconds: null,
      countdownInterval: null,
      firstGuesserName: null,
      lastRoundResults: null,
      lastGameOver: null,
      players: {},
      pendingAdmissions: {},
      maxPlayers: 8,
      createdAt: Date.now(),
    };
  }

  public getRoom(roomId?: string): GameRoom {
    if (roomId && this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }
    return this.state;
  }

  public createRoom(
    name: string,
    hostIp: string,
    hostName: string,
    options?: Partial<GameRoom>,
    hostId?: string,
    hostSocketId?: string,
  ): GameRoom {
    let roomId = `LAN-${Math.floor(10 + Math.random() * 90)}`;
    while (this.rooms.has(roomId)) {
      roomId = `LAN-${Math.floor(100 + Math.random() * 900)}`;
    }

    const room = this.createDefaultRoom(roomId, name, hostIp, hostName, hostId, hostSocketId);
    if (options) {
      if (options.totalRounds) room.totalRounds = options.totalRounds;
      if (options.countdownDuration) room.countdownDuration = options.countdownDuration;
      if (options.selectedRegion) room.selectedRegion = options.selectedRegion;
      if (options.difficulty) room.difficulty = options.difficulty;
      if (options.maxPlayers) room.maxPlayers = options.maxPlayers;
    }

    this.rooms.set(roomId, room);
    this.redis.setLobbyMeta(roomId, {
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      hostName: room.hostName,
      selectedRegion: room.selectedRegion,
      difficulty: room.difficulty,
      totalRounds: room.totalRounds,
      status: room.status,
    });

    if (hostId) {
      this.redis.setHostHeartbeat(roomId, hostId, 8);
    }

    this.logger.log(
      `Created Zero-Trust Room: ${room.id} ("${room.name}") by Host: ${hostName} (${hostId || hostIp})`,
    );
    return room;
  }

  public deleteRoom(roomId: string): boolean {
    if (roomId === 'LAN-01') return false; // Preserve default room
    const room = this.rooms.get(roomId);
    if (room && room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
    }
    const deleted = this.rooms.delete(roomId);
    if (deleted) {
      this.redis.deleteLobby(roomId);
      this.logger.log(`Room ${roomId} deleted from memory & Redis.`);
    }
    return deleted;
  }

  public terminateLobby(roomId: string, server: Server, reason = 'Squad Leader disconnected.'): void {
    if (roomId === 'LAN-01') return; // Do not auto-terminate default
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.logger.warn(`[ZERO-TRUST] Disbanding Room ${roomId}: ${reason}`);
    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
    }

    const payload = {
      roomId,
      message: `${reason} Room disbanded.`,
      status: 'TERMINATED',
    };

    server.to(roomId).emit('lobby_terminated', payload);
    server.to(roomId).emit('return_to_lobby', payload);

    this.deleteRoom(roomId);
    server.emit('lobbies_list', this.getLobbiesList());
  }

  public recordHostHeartbeat(roomId: string, hostId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const isAuthorized =
      (room.hostId && room.hostId === hostId) ||
      (room.hostIp && room.hostIp === hostId);

    if (isAuthorized) {
      room.hostHeartbeat = Date.now();
      this.redis.setHostHeartbeat(roomId, hostId, 8);
      return true;
    }
    return false;
  }

  /**
   * Performs ECDH P-256 key exchange with a connecting player.
   * Derives in-memory AES-256 key without ever sending the key over the LAN.
   */
  public performEcdhHandshake(
    player: Player,
    clientPublicKeyHex?: string,
  ): { serverPublicKey?: string } {
    if (!clientPublicKeyHex || typeof clientPublicKeyHex !== 'string') {
      return {};
    }

    try {
      const serverKeyPair = this.cryptoService.generateEcdhKeyPair();
      const sharedAesKey = this.cryptoService.deriveSharedKey(
        clientPublicKeyHex,
        serverKeyPair.privateKey,
      );

      player.clientPublicKey = clientPublicKeyHex;
      player.serverPublicKey = serverKeyPair.publicKey;
      player.serverPrivateKey = serverKeyPair.privateKey;
      player.aesKey = sharedAesKey;

      this.logger.log(
        `[ECDH P-256] In-memory AES-256-GCM key derived independently for player ${player.username} (${player.id || player.ip}). Key never touched the wire!`,
      );

      return { serverPublicKey: serverKeyPair.publicKey };
    } catch (err: any) {
      this.logger.error(`ECDH Handshake failed for ${player.username}: ${err.message}`);
      return {};
    }
  }

  public findRoomByPlayer(keyOrId: string): GameRoom | null {
    for (const room of this.rooms.values()) {
      if (room.players[keyOrId]) return room;
      for (const p of Object.values(room.players)) {
        if (
          p.id === keyOrId ||
          p.ip === keyOrId ||
          p.socketId === keyOrId ||
          p.sessionToken === keyOrId
        ) {
          return room;
        }
      }
    }
    return null;
  }

  public findRoomByToken(token: string): GameRoom | null {
    for (const room of this.rooms.values()) {
      if (room.roundUplinkToken === token) {
        return room;
      }
    }
    return null;
  }

  public getLobbiesList(): LobbySummary[] {
    return Array.from(this.rooms.values()).map((r) => {
      const activePlayers = Object.values(r.players).filter(
        (p) =>
          p &&
          (p.connected === true ||
            (p.lastDisconnectedAt && Date.now() - p.lastDisconnectedAt < 30000)),
      );
      const host =
        r.hostId && r.players[r.hostId]
          ? r.players[r.hostId]
          : r.hostIp && r.players[r.hostIp]
          ? r.players[r.hostIp]
          : null;

      return {
        id: r.id,
        name: r.name,
        hostName: r.hostName || (host ? host.username : 'HOST'),
        hostIp: r.hostIp,
        playerCount: activePlayers.length,
        maxPlayers: r.maxPlayers || 8,
        selectedRegion: r.selectedRegion || 'all',
        difficulty: r.difficulty || 'all',
        totalRounds: r.totalRounds || 5,
        status: r.status,
        ping: 3,
      };
    });
  }

  ensureActiveHost(room?: GameRoom): string | null {
    const targetRoom = room || this.state;
    const connected = Object.values(targetRoom.players).filter(
      (p) => p && p.connected === true,
    );
    const inGrace = Object.values(targetRoom.players).filter(
      (p) =>
        p &&
        p.connected === false &&
        p.lastDisconnectedAt &&
        Date.now() - p.lastDisconnectedAt < 30000,
    );

    if (connected.length === 0 && inGrace.length === 0) {
      targetRoom.hostIp = null;
      targetRoom.hostSocketId = null;
      targetRoom.hostId = null;
      targetRoom.hostName = null;
      return null;
    }

    const currentHost = targetRoom.hostId
      ? targetRoom.players[targetRoom.hostId]
      : targetRoom.hostIp
      ? targetRoom.players[targetRoom.hostIp]
      : null;

    const isHostValid =
      currentHost &&
      (currentHost.connected === true ||
        (connected.length === 0 &&
          currentHost.lastDisconnectedAt &&
          Date.now() - currentHost.lastDisconnectedAt < 30000));

    if (!isHostValid) {
      // For default room LAN-01, assign first active player.
      // For custom user rooms, strict host invariant applies (handled by watchdog/disconnect).
      const candidate = connected[0] || inGrace[0];
      if (candidate) {
        targetRoom.hostIp = candidate.ip;
        targetRoom.hostSocketId = candidate.socketId;
        targetRoom.hostId = candidate.id || candidate.ip;
        targetRoom.hostName = candidate.username;
      }
    }
    return targetRoom.hostIp;
  }

  getLobbyPlayers(room?: GameRoom) {
    const targetRoom = room || this.state;
    this.ensureActiveHost(targetRoom);
    return Object.values(targetRoom.players)
      .filter(
        (p) =>
          p &&
          (p.connected === true ||
            (p.lastDisconnectedAt &&
              Date.now() - p.lastDisconnectedAt < 30000)),
      )
      .map((p) => {
        const isHost =
          (targetRoom.hostId && p.id === targetRoom.hostId) ||
          (targetRoom.hostSocketId && p.socketId === targetRoom.hostSocketId) ||
          (!targetRoom.hostId && p.ip === targetRoom.hostIp);
        return {
          id: p.id || p.ip,
          ip: p.ip,
          username: p.username,
          connected: p.connected,
          totalScore: p.totalScore,
          isHost: Boolean(isHost),
        };
      });
  }

  broadcastLobbyUpdate(server: Server, room?: GameRoom) {
    const targetRoom = room || this.state;
    this.ensureActiveHost(targetRoom);
    const payload = {
      roomId: targetRoom.id,
      roomName: targetRoom.name,
      players: this.getLobbyPlayers(targetRoom),
      hostIp: targetRoom.hostIp,
      hostName: targetRoom.hostName,
      selectedRegion: targetRoom.selectedRegion,
      difficulty: targetRoom.difficulty,
      totalRounds: targetRoom.totalRounds,
      countdownDuration: targetRoom.countdownDuration,
      pendingAdmissions: Object.values(targetRoom.pendingAdmissions),
      gameStatus: {
        status: targetRoom.status,
        currentRound: targetRoom.currentRound,
        totalRounds: targetRoom.totalRounds,
      },
    };

    server.to(targetRoom.id).emit('lobby_update', payload);
    server.emit('lobbies_list', this.getLobbiesList());
  }

  async startRound(roundNumber: number, server: Server, room?: GameRoom) {
    const targetRoom = room || this.state;
    if (targetRoom.countdownInterval) {
      clearInterval(targetRoom.countdownInterval);
      targetRoom.countdownInterval = null;
    }

    targetRoom.status = 'ROUND_ACTIVE';
    targetRoom.currentRound = roundNumber;
    targetRoom.roundTarget = targetRoom.selectedLocations[roundNumber - 1];
    targetRoom.countdownSeconds = null;
    targetRoom.firstGuesserName = null;

    for (const key of Object.keys(targetRoom.players)) {
      const p = targetRoom.players[key];
      p.currentPin = null;
      p.lockedGuess = null;
      p.hasGuessed = false;
      p.lastRoundScore = 0;
      p.lastRoundDistanceKm = null;
    }

    const activePlayers = Object.values(targetRoom.players).filter(
      (p) => p.connected && p.inGame !== false,
    );

    this.logger.log(
      `[Room ${targetRoom.id}] Starting Round ${roundNumber}/${targetRoom.totalRounds}: ${targetRoom.roundTarget?.label} (${targetRoom.roundTarget?.region || 'global'})`,
    );

    targetRoom.roundUplinkToken = crypto.randomBytes(16).toString('hex');
    targetRoom.currentSharedImage = null;
    targetRoom.sharedImageTimestamp = null;
    targetRoom.sharedImageCaption = '';

    // Cache sanitized road imagery in Redis
    if (targetRoom.roundTarget) {
      try {
        targetRoom.roadToken = await this.roadProxy.cacheRoadForTarget(targetRoom.roundTarget);
      } catch (err: any) {
        targetRoom.roadToken = null;
      }
    }

    const payload = {
      roomId: targetRoom.id,
      round: roundNumber,
      totalRounds: targetRoom.totalRounds,
      difficulty: targetRoom.roundTarget?.difficulty || targetRoom.difficulty,
      uplinkToken: targetRoom.roundUplinkToken,
      roadToken: targetRoom.roadToken,
      sharedImage: null,
      guessedCount: 0,
      totalPlayers: activePlayers.length,
      hostIp: targetRoom.hostIp,
    };

    server.to(targetRoom.id).emit('round_started', payload);
  }

  endRound(server: Server, room?: GameRoom) {
    const targetRoom = room || this.state;
    if (targetRoom.countdownInterval) {
      clearInterval(targetRoom.countdownInterval);
      targetRoom.countdownInterval = null;
    }
    targetRoom.countdownSeconds = null;
    targetRoom.status = 'ROUND_RESULTS';

    const target = targetRoom.roundTarget;
    if (!target) return;

    for (const key of Object.keys(targetRoom.players)) {
      const player = targetRoom.players[key];
      const finalCoords = player.lockedGuess || player.currentPin || null;

      if (finalCoords) {
        const dist = calculateDistanceKm(
          target.lat,
          target.lng,
          finalCoords.lat,
          finalCoords.lng,
        );
        const score = calculateScore(dist);
        player.lastRoundDistanceKm = Math.round(dist * 10) / 10;
        player.lastRoundScore = score;
        player.lockedGuess = finalCoords;
      } else {
        player.lastRoundDistanceKm = null;
        player.lastRoundScore = 0;
      }
      player.totalScore += player.lastRoundScore;
    }

    const sortedPlayers = Object.values(targetRoom.players)
      .filter((p) => p && p.connected === true && p.inGame !== false)
      .sort((a, b) => b.totalScore - a.totalScore);
    const results = sortedPlayers.map((p) => ({
      id: p.id || p.ip,
      username: p.username,
      ip: p.ip,
      guessCoords: p.lockedGuess,
      distanceKm: p.lastRoundDistanceKm,
      roundScore: p.lastRoundScore,
      totalScore: p.totalScore,
      hasGuessed: !!p.lockedGuess,
      connected: true,
      isHost:
        (targetRoom.hostId && p.id === targetRoom.hostId) ||
        (targetRoom.hostSocketId && p.socketId === targetRoom.hostSocketId) ||
        (!targetRoom.hostId && p.ip === targetRoom.hostIp),
    }));

    let closestPlayer: any = null;
    let minDistanceKm = Infinity;
    for (const p of results) {
      if (
        p.distanceKm !== null &&
        !isNaN(p.distanceKm) &&
        p.distanceKm < minDistanceKm
      ) {
        minDistanceKm = p.distanceKm;
        closestPlayer = p;
      }
    }

    const payload = {
      roomId: targetRoom.id,
      round: targetRoom.currentRound,
      totalRounds: targetRoom.totalRounds,
      target: {
        lat: target.lat,
        lng: target.lng,
        label: sanitizeLocationLabel(target),
      },
      results,
      leaderboard: results,
      closestPlayer: closestPlayer
        ? {
            username: closestPlayer.username,
            distanceKm: closestPlayer.distanceKm,
            roundScore: closestPlayer.roundScore,
            guessCoords: closestPlayer.guessCoords,
          }
        : null,
      hostIp: targetRoom.hostIp,
    };

    targetRoom.lastRoundResults = payload;
    this.logger.log(
      `[Room ${targetRoom.id}] Round ${targetRoom.currentRound} ended. Top: ${results[0]?.username} (${results[0]?.totalScore} pts)`,
    );

    server.to(targetRoom.id).emit('round_results', payload);
  }

  checkAllGuessed(server: Server, room?: GameRoom) {
    const targetRoom = room || this.state;
    const activePlayers = Object.values(targetRoom.players).filter(
      (p) => p.connected && p.inGame !== false,
    );
    if (activePlayers.length === 0) return;
    const allGuessed = activePlayers.every((p) => p.hasGuessed);
    if (allGuessed) {
      this.logger.log(`[Room ${targetRoom.id}] All active players have guessed! Ending round immediately.`);
      if (targetRoom.countdownInterval) {
        clearInterval(targetRoom.countdownInterval);
        targetRoom.countdownInterval = null;
      }
      this.endRound(server, targetRoom);
    }
  }

  async startGame(
    senderId: string,
    server: Server,
    room?: GameRoom,
    senderIp?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const targetRoom = room || this.state;
    if (targetRoom.status !== 'LOBBY') {
      return { success: false, error: 'Match already active in this room.' };
    }

    this.ensureActiveHost(targetRoom);

    const registeredPlayers = Object.values(targetRoom.players).filter(
      (p) => p && p.connected === true,
    );
    if (registeredPlayers.length === 0) {
      return { success: false, error: 'At least 1 operative must join before starting.' };
    }

    const isAuthorized =
      (targetRoom.hostId && senderId === targetRoom.hostId) ||
      (targetRoom.hostSocketId && senderId === targetRoom.hostSocketId) ||
      (targetRoom.hostIp && senderIp && senderIp === targetRoom.hostIp) ||
      (targetRoom.hostIp && senderId === targetRoom.hostIp);

    if (!isAuthorized) {
      return { success: false, error: 'Only the host (Squad Leader) can start the game.' };
    }

    this.logger.log(
      `[Room ${targetRoom.id}] Starting match with ${registeredPlayers.length} players. Region: ${targetRoom.selectedRegion}`,
    );

    let pool = await this.geoDb.getLocations({
      region: targetRoom.selectedRegion,
      difficulty: targetRoom.difficulty,
    });

    if (!pool || pool.length < targetRoom.totalRounds) {
      pool = await this.geoDb.getLocations({
        region: targetRoom.selectedRegion,
        difficulty: 'all',
      });
      if (!pool || pool.length < targetRoom.totalRounds) {
        pool = this.geoDb.getAllInMemoryLocations();
      }
    }

    targetRoom.selectedLocations = selectDiverseMatchLocations(
      pool,
      targetRoom.totalRounds,
    );

    for (const p of Object.values(targetRoom.players)) {
      p.totalScore = 0;
      p.lastRoundScore = 0;
      p.lastRoundDistanceKm = null;
      p.hasGuessed = false;
      p.lockedGuess = null;
      p.currentPin = null;
      p.inGame = true;
    }

    this.startRound(1, server, targetRoom);
    return { success: true };
  }

  stopGame(
    senderId: string,
    server: Server,
    room?: GameRoom,
    senderIp?: string,
  ): { success: boolean; error?: string } {
    const targetRoom = room || this.state;
    this.ensureActiveHost(targetRoom);

    const isAuthorized =
      (targetRoom.hostId && senderId === targetRoom.hostId) ||
      (targetRoom.hostSocketId && senderId === targetRoom.hostSocketId) ||
      (targetRoom.hostIp && senderIp && senderIp === targetRoom.hostIp) ||
      (targetRoom.hostIp && senderId === targetRoom.hostIp);

    if (!isAuthorized) {
      return { success: false, error: 'Only the host (Squad Leader) can stop the game.' };
    }

    this.logger.log(`[Room ${targetRoom.id}] Host stopped match.`);
    if (targetRoom.countdownInterval) {
      clearInterval(targetRoom.countdownInterval);
      targetRoom.countdownInterval = null;
    }

    targetRoom.status = 'LOBBY';
    targetRoom.currentRound = 0;
    targetRoom.selectedLocations = [];
    targetRoom.roundTarget = null;
    targetRoom.roundUplinkToken = null;
    targetRoom.countdownSeconds = null;
    targetRoom.firstGuesserName = null;
    targetRoom.lastRoundResults = null;
    targetRoom.lastGameOver = null;

    for (const p of Object.values(targetRoom.players)) {
      p.totalScore = 0;
      p.currentPin = null;
      p.lockedGuess = null;
      p.hasGuessed = false;
      p.lastRoundScore = 0;
      p.lastRoundDistanceKm = null;
      p.inGame = true;
    }

    const payload = {
      roomId: targetRoom.id,
      message: 'The squad leader returned the room to Lobby.',
      players: this.getLobbyPlayers(targetRoom),
      hostIp: targetRoom.hostIp,
      selectedRegion: targetRoom.selectedRegion,
      difficulty: targetRoom.difficulty,
      status: 'LOBBY',
      currentRound: 0,
    };

    server.to(targetRoom.id).emit('game_stopped', payload);
    server.to(targetRoom.id).emit('return_to_lobby', payload);
    return { success: true };
  }

  nextRound(server: Server, room?: GameRoom) {
    const targetRoom = room || this.state;
    if (targetRoom.status !== 'ROUND_RESULTS') return;

    if (targetRoom.currentRound < targetRoom.totalRounds) {
      this.startRound(targetRoom.currentRound + 1, server, targetRoom);
    } else {
      targetRoom.status = 'GAME_OVER';
      const sortedPlayers = Object.values(targetRoom.players)
        .filter((p) => p && p.connected === true)
        .sort((a, b) => b.totalScore - a.totalScore);
      const leaderboard = sortedPlayers.map((p) => ({
        id: p.id || p.ip,
        username: p.username,
        ip: p.ip,
        totalScore: p.totalScore,
        connected: true,
      }));

      const payload = {
        roomId: targetRoom.id,
        leaderboard,
        hostIp: targetRoom.hostIp,
      };
      targetRoom.lastGameOver = payload;
      this.logger.log(`[Room ${targetRoom.id}] Game Over Standings:`, leaderboard);

      server.to(targetRoom.id).emit('game_over', payload);
    }
  }

  resetToLobby(server: Server, room?: GameRoom, socket?: Socket) {
    const targetRoom = room || this.state;
    if (targetRoom.status === 'LOBBY') {
      const payload = {
        roomId: targetRoom.id,
        players: this.getLobbyPlayers(targetRoom),
        hostIp: targetRoom.hostIp,
        selectedRegion: targetRoom.selectedRegion,
        difficulty: targetRoom.difficulty,
        status: 'LOBBY',
        currentRound: 0,
      };
      if (socket) {
        socket.emit('return_to_lobby', payload);
      } else {
        server.to(targetRoom.id).emit('return_to_lobby', payload);
      }
      return;
    }

    if (targetRoom.countdownInterval) {
      clearInterval(targetRoom.countdownInterval);
      targetRoom.countdownInterval = null;
    }

    targetRoom.status = 'LOBBY';
    targetRoom.currentRound = 0;
    targetRoom.selectedLocations = [];
    targetRoom.roundTarget = null;
    targetRoom.roundUplinkToken = null;
    targetRoom.countdownSeconds = null;
    targetRoom.firstGuesserName = null;
    targetRoom.lastRoundResults = null;
    targetRoom.lastGameOver = null;

    for (const p of Object.values(targetRoom.players)) {
      p.totalScore = 0;
      p.currentPin = null;
      p.lockedGuess = null;
      p.hasGuessed = false;
      p.lastRoundScore = 0;
      p.lastRoundDistanceKm = null;
      p.inGame = true;
    }

    this.broadcastLobbyUpdate(server, targetRoom);
    const returnPayload = {
      roomId: targetRoom.id,
      players: this.getLobbyPlayers(targetRoom),
      hostIp: targetRoom.hostIp,
      selectedRegion: targetRoom.selectedRegion,
      difficulty: targetRoom.difficulty,
      status: 'LOBBY',
      currentRound: 0,
    };
    server.to(targetRoom.id).emit('return_to_lobby', returnPayload);
  }
}
