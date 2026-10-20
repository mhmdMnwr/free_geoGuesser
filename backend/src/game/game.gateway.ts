import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { getClientIp, getClientId } from './game.helpers';
import { Coords, GameRoom, Player } from './game.types';
import { CryptoService } from '../security/crypto.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  pingTimeout: 7000,
  pingInterval: 5000,
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);
  private disconnectTimeouts = new Map<string, NodeJS.Timeout>();

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly gameService: GameService,
    private readonly cryptoService: CryptoService,
  ) {}

  public resolveRoom(socket: Socket, data?: any): GameRoom {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    if (data && typeof data === 'object' && data.roomId) {
      const r = this.gameService.getRoom(data.roomId);
      if (r) return r;
    }
    const playerRoom =
      this.gameService.findRoomByPlayer(clientId) ||
      this.gameService.findRoomByPlayer(ip) ||
      this.gameService.findRoomByPlayer(socket.id);
    if (playerRoom) return playerRoom;
    return this.gameService.state;
  }

  handleConnection(socket: Socket) {
    this.gameService.setServer(this.server);

    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const sessionToken =
      (socket.handshake.query?.sessionToken as string) ||
      (socket.handshake.auth?.sessionToken as string);

    this.logger.log(
      `Connection from Client: ${clientId} (IP: ${ip}, Socket: ${socket.id})`,
    );

    if (this.disconnectTimeouts.has(clientId)) {
      clearTimeout(this.disconnectTimeouts.get(clientId)!);
      this.disconnectTimeouts.delete(clientId);
    }

    // Always push live lobbies list to every connecting client
    socket.emit('lobbies_list', this.gameService.getLobbiesList());

    // Check if player is already in a specific room
    const existingRoom =
      this.gameService.findRoomByPlayer(clientId) ||
      this.gameService.findRoomByPlayer(ip);

    const gameState = existingRoom || this.gameService.state;
    socket.join(gameState.id);

    let player = gameState.players[clientId] || gameState.players[ip];
    if (!player && sessionToken) {
      player = Object.values(gameState.players).find(
        (p) => p && p.sessionToken === sessionToken,
      );
    }

    if (player) {
      player.connected = true;
      player.socketId = socket.id;
      player.id = clientId;
      player.isRefreshing = false;
      player.lastDisconnectedAt = undefined;
      gameState.players[clientId] = player;
      if (gameState.hostId === clientId || gameState.hostIp === ip) {
        gameState.hostSocketId = socket.id;
        gameState.hostId = clientId;
        gameState.hostIp = ip;
      }
    }

    this.gameService.ensureActiveHost(gameState);

    const connectedPlayers = Object.values(gameState.players).filter(
      (p) => p && p.connected === true,
    );

    const isHost =
      (gameState.hostId && clientId === gameState.hostId) ||
      (gameState.hostSocketId && socket.id === gameState.hostSocketId) ||
      (!gameState.hostId && ip === gameState.hostIp);

    if (gameState.status === 'LOBBY') {
      if (player) {
        socket.emit('session_restored', {
          id: clientId,
          ip,
          username: player.username,
          totalScore: player.totalScore,
          status: gameState.status,
          isHost: Boolean(isHost),
          hostIp: gameState.hostIp,
          hostName: gameState.hostName,
          roomId: gameState.id,
          roomName: gameState.name,
          selectedRegion: gameState.selectedRegion,
          difficulty: gameState.difficulty,
          totalRounds: gameState.totalRounds,
          countdownDuration: gameState.countdownDuration,
        });
        this.gameService.broadcastLobbyUpdate(this.server, gameState);
      } else {
        socket.emit('prompt_username', {
          id: clientId,
          ip,
          currentUsername: null,
          isHost:
            connectedPlayers.length === 0 ||
            !gameState.hostIp ||
            Boolean(isHost),
          hostIp: gameState.hostIp,
          hostName: gameState.hostName,
          roomId: gameState.id,
          roomName: gameState.name,
          selectedRegion: gameState.selectedRegion,
          difficulty: gameState.difficulty,
          totalRounds: gameState.totalRounds,
          countdownDuration: gameState.countdownDuration,
        });
      }
    } else {
      if (player) {
        const guessedCount = Object.values(gameState.players).filter(
          (p) => p && p.connected === true && p.hasGuessed,
        ).length;
        const totalPlayers = Object.values(gameState.players).filter(
          (p) => p && p.connected === true,
        ).length;

        socket.emit('rejoin_match', {
          id: clientId,
          ip,
          username: player.username,
          roomId: gameState.id,
          roomName: gameState.name,
          status: gameState.status,
          round: gameState.currentRound,
          totalRounds: gameState.totalRounds,
          uplinkToken: gameState.roundUplinkToken || null,
          roadToken: gameState.roadToken || null,
          sharedImage: gameState.currentSharedImage || null,
          countdownSeconds: gameState.countdownSeconds,
          firstGuesserName: gameState.firstGuesserName,
          hasGuessed: player.hasGuessed,
          currentPin: player.currentPin,
          lockedGuess: player.lockedGuess,
          totalScore: player.totalScore,
          lastRoundScore: player.lastRoundScore,
          lastRoundDistanceKm: player.lastRoundDistanceKm,
          lastRoundResults: gameState.lastRoundResults,
          gameOverResults: gameState.lastGameOver,
          guessedCount,
          totalPlayers,
          isHost: Boolean(isHost),
          hostIp: gameState.hostIp,
        });
      } else {
        socket.emit('prompt_username', {
          id: clientId,
          ip,
          currentUsername: null,
          inProgress: true,
          roomId: gameState.id,
          roomName: gameState.name,
          isHost: connectedPlayers.length === 0 || !gameState.hostIp,
          hostIp: gameState.hostIp,
          selectedRegion: gameState.selectedRegion,
          difficulty: gameState.difficulty,
          totalRounds: gameState.totalRounds,
          countdownDuration: gameState.countdownDuration,
          gameStatus: {
            status: gameState.status,
            currentRound: gameState.currentRound,
            totalRounds: gameState.totalRounds,
            difficulty: gameState.difficulty,
            playerCount: connectedPlayers.length,
            hostName: gameState.players[gameState.hostIp]?.username || 'Host',
            selectedRegion: gameState.selectedRegion,
          },
        });
      }
    }
  }

  handleDisconnect(socket: Socket) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    this.logger.log(`Socket disconnected: ${socket.id} (Client: ${clientId}, IP: ${ip})`);
    const room =
      this.gameService.findRoomByPlayer(clientId) ||
      this.gameService.findRoomByPlayer(ip) ||
      this.gameService.findRoomByPlayer(socket.id) ||
      this.gameService.state;

    const player =
      room.players[clientId] ||
      room.players[ip] ||
      Object.values(room.players).find((p) => p.socketId === socket.id);

    if (player && player.socketId === socket.id) {
      player.connected = false;
      player.lastDisconnectedAt = Date.now();

      // Check if this player was the host of a custom room
      const wasHost =
        (room.hostId && clientId === room.hostId) ||
        (room.hostSocketId && socket.id === room.hostSocketId) ||
        (!room.hostId && ip === room.hostIp);

      if (wasHost && room.id !== 'LAN-01') {
        // Zero-Trust Host Invariant: Host left -> Lobby is instantly terminated!
        this.gameService.terminateLobby(
          room.id,
          this.server,
          `Squad Leader (${player.username}) disconnected. Room disbanded.`,
        );
        return;
      }

      this.finalizePlayerDisconnect(clientId, room, socket.id);
    }
  }

  finalizePlayerDisconnect(clientId: string, roomArg?: GameRoom, socketId?: string) {
    const room =
      roomArg ||
      this.gameService.findRoomByPlayer(clientId) ||
      this.gameService.state;
    const player = room.players[clientId];
    if (!player) return;
    if (socketId && player.socketId !== socketId && player.connected === true) {
      return;
    }

    const username = player.username;
    delete room.players[clientId];

    const remainingConnected = Object.values(room.players).filter(
      (p) => p && p.connected === true,
    );

    if (remainingConnected.length === 0 && room.id !== 'LAN-01') {
      this.gameService.deleteRoom(room.id);
      this.server.emit('lobbies_list', this.gameService.getLobbiesList());
      return;
    }

    const leavePayload = {
      roomId: room.id,
      username,
      id: clientId,
      remainingCount: remainingConnected.length,
      hostIp: room.hostIp,
      lastRoundResults: room.lastRoundResults,
      gameOverResults: room.lastGameOver,
    };

    this.server.to(room.id).emit('player_left', leavePayload);
    if (room.id === 'LAN-01') {
      this.server.emit('player_left', leavePayload);
    }

    this.gameService.broadcastLobbyUpdate(this.server, room);
    this.server.emit('lobbies_list', this.gameService.getLobbiesList());

    if (room.status === 'ROUND_ACTIVE' || room.status === 'ROUND_COUNTDOWN') {
      this.gameService.checkAllGuessed(this.server, room);
    }
  }

  // --- Multi-Lobby Protocol & ECDH Key Exchange ---

  @SubscribeMessage('get_lobbies')
  handleGetLobbies(@ConnectedSocket() socket: Socket) {
    socket.emit('lobbies_list', this.gameService.getLobbiesList());
  }

  @SubscribeMessage('create_lobby')
  handleCreateLobby(
    @MessageBody()
    data: {
      name?: string;
      totalRounds?: number;
      countdownDuration?: number;
      selectedRegion?: string;
      difficulty?: string;
      username: string;
      clientPublicKey?: string;
    },
    @ConnectedSocket() socket: Socket,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const username = data?.username?.trim() || 'OPERATIVE';

    const prevRoom = this.gameService.findRoomByPlayer(clientId);
    if (prevRoom) {
      socket.leave(prevRoom.id);
      delete prevRoom.players[clientId];
      this.gameService.broadcastLobbyUpdate(this.server, prevRoom);
    }

    const room = this.gameService.createRoom(
      data?.name || `${username}'S SQUAD`,
      ip,
      username,
      {
        totalRounds: data?.totalRounds || 5,
        countdownDuration: data?.countdownDuration || 20,
        selectedRegion: data?.selectedRegion || 'all',
        difficulty: data?.difficulty || 'all',
      },
      clientId,
      socket.id,
    );

    const player: Player = {
      id: clientId,
      ip,
      socketId: socket.id,
      username,
      connected: true,
      totalScore: 0,
      currentPin: null,
      lockedGuess: null,
      hasGuessed: false,
      lastRoundScore: 0,
      lastRoundDistanceKm: null,
      inGame: true,
    };

    // Perform ECDH Key Exchange if client sent curve public key
    const ecdhRes = this.gameService.performEcdhHandshake(player, data?.clientPublicKey);

    room.players[clientId] = player;
    room.hostIp = ip;
    room.hostId = clientId;
    room.hostSocketId = socket.id;
    room.hostName = username;

    socket.join(room.id);
    socket.emit('lobby_joined', {
      roomId: room.id,
      roomName: room.name,
      isHost: true,
      hostIp: ip,
      hostName: username,
      serverPublicKey: ecdhRes.serverPublicKey,
      players: this.gameService.getLobbyPlayers(room),
      selectedRegion: room.selectedRegion,
      difficulty: room.difficulty,
      totalRounds: room.totalRounds,
      countdownDuration: room.countdownDuration,
      status: room.status,
    });

    this.gameService.broadcastLobbyUpdate(this.server, room);
    this.server.emit('lobbies_list', this.gameService.getLobbiesList());
  }

  @SubscribeMessage('join_lobby')
  handleJoinLobby(
    @MessageBody()
    data: {
      roomId: string;
      username: string;
      clientPublicKey?: string;
    },
    @ConnectedSocket() socket: Socket,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const username = data?.username?.trim() || 'OPERATIVE';
    const targetRoom = this.gameService.getRoom(data?.roomId);
    if (!targetRoom) {
      socket.emit('error_message', { message: 'Expedition room not found.' });
      return;
    }

    const prevRoom = this.gameService.findRoomByPlayer(clientId);
    if (prevRoom && prevRoom.id !== targetRoom.id) {
      socket.leave(prevRoom.id);
      delete prevRoom.players[clientId];
      this.gameService.broadcastLobbyUpdate(this.server, prevRoom);
    }

    socket.join(targetRoom.id);

    let player = targetRoom.players[clientId];
    if (!player) {
      player = {
        id: clientId,
        ip,
        socketId: socket.id,
        username,
        connected: true,
        totalScore: 0,
        currentPin: null,
        lockedGuess: null,
        hasGuessed: false,
        lastRoundScore: 0,
        lastRoundDistanceKm: null,
        inGame: true,
      };
      targetRoom.players[clientId] = player;
    } else {
      player.connected = true;
      player.socketId = socket.id;
      player.username = username;
    }

    // Perform ECDH Key Exchange if client sent curve public key
    const ecdhRes = this.gameService.performEcdhHandshake(player, data?.clientPublicKey);

    this.gameService.ensureActiveHost(targetRoom);

    const isHost =
      (targetRoom.hostId && clientId === targetRoom.hostId) ||
      (targetRoom.hostSocketId && socket.id === targetRoom.hostSocketId) ||
      (!targetRoom.hostId && ip === targetRoom.hostIp);

    socket.emit('lobby_joined', {
      roomId: targetRoom.id,
      roomName: targetRoom.name,
      isHost: Boolean(isHost),
      hostIp: targetRoom.hostIp,
      hostName: targetRoom.hostName,
      serverPublicKey: ecdhRes.serverPublicKey,
      players: this.gameService.getLobbyPlayers(targetRoom),
      selectedRegion: targetRoom.selectedRegion,
      difficulty: targetRoom.difficulty,
      totalRounds: targetRoom.totalRounds,
      countdownDuration: targetRoom.countdownDuration,
      status: targetRoom.status,
    });

    this.gameService.broadcastLobbyUpdate(this.server, targetRoom);
    this.server.emit('lobbies_list', this.gameService.getLobbiesList());
  }

  @SubscribeMessage('host_heartbeat')
  handleHostHeartbeat(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const clientId = getClientId(socket);
    const success = this.gameService.recordHostHeartbeat(data.roomId, clientId);
    socket.emit('heartbeat_ack', { success });
  }

  @SubscribeMessage('leave_lobby')
  handleLeaveLobby(
    @MessageBody() data: { roomId?: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const clientId = getClientId(socket);
    const room = data?.roomId
      ? this.gameService.getRoom(data.roomId)
      : this.gameService.findRoomByPlayer(clientId);

    if (room) {
      socket.leave(room.id);
      const isHost =
        (room.hostId && clientId === room.hostId) ||
        (room.hostSocketId && socket.id === room.hostSocketId);

      if (isHost && room.id !== 'LAN-01') {
        // Zero-Trust Host Invariant: Host leaves -> terminate entire room immediately!
        this.gameService.terminateLobby(
          room.id,
          this.server,
          'Squad Leader left the room. Expedition disbanded.',
        );
      } else {
        delete room.players[clientId];
        const remainingActive = Object.values(room.players).filter((p) => p.connected);
        if (remainingActive.length === 0 && room.id !== 'LAN-01') {
          this.gameService.deleteRoom(room.id);
        } else {
          this.gameService.ensureActiveHost(room);
          this.gameService.broadcastLobbyUpdate(this.server, room);
        }
        this.server.emit('lobbies_list', this.gameService.getLobbiesList());
      }
    }
    socket.emit('lobby_left');
  }

  @SubscribeMessage('start_game')
  async handleStartGame(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data?: any,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    const res = await this.gameService.startGame(clientId, this.server, room, ip);
    if (!res.success && res.error) {
      socket.emit('error_message', { message: res.error });
    }
  }

  @SubscribeMessage('stop_game')
  handleStopGame(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data?: any,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    const res = this.gameService.stopGame(clientId, this.server, room, ip);
    if (!res.success && res.error) {
      socket.emit('error_message', { message: res.error });
    }
  }

  @SubscribeMessage('update_pin')
  handleUpdatePin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);

    if (
      room.status !== 'ROUND_ACTIVE' &&
      room.status !== 'ROUND_COUNTDOWN'
    ) {
      return;
    }

    const player =
      room.players[clientId] ||
      Object.values(room.players).find((p) => p.socketId === socket.id);
    if (!player || !player.connected || player.hasGuessed) {
      return;
    }

    if (
      data &&
      typeof data.lat === 'number' &&
      typeof data.lng === 'number' &&
      Number.isFinite(data.lat) &&
      Number.isFinite(data.lng) &&
      !isNaN(data.lat) &&
      !isNaN(data.lng) &&
      data.lat >= -90 &&
      data.lat <= 90 &&
      data.lng >= -180 &&
      data.lng <= 180
    ) {
      player.currentPin = {
        lat: Math.round(data.lat * 1000000) / 1000000,
        lng: Math.round(data.lng * 1000000) / 1000000,
      };
    }
  }

  @SubscribeMessage('lock_guess')
  handleLockGuess(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);

    if (
      room.status !== 'ROUND_ACTIVE' &&
      room.status !== 'ROUND_COUNTDOWN'
    ) {
      socket.emit('error_message', {
        message: 'Cannot lock guess: expedition round is not currently active.',
      });
      return;
    }

    const player =
      room.players[clientId] ||
      Object.values(room.players).find((p) => p.socketId === socket.id);
    if (!player || !player.connected) {
      socket.emit('error_message', {
        message: 'You must be a connected operative to submit guesses.',
      });
      return;
    }

    if (player.hasGuessed) {
      socket.emit('error_message', {
        message: 'Your guess is already locked for this round.',
      });
      return;
    }

    let coords: Coords | null = null;

    // Check for AES-256-GCM Zero-Trust Encrypted Guess Payload
    if (data && data.encryptedGuess && player.aesKey) {
      try {
        const decrypted = this.cryptoService.decryptAesGcm(
          data.encryptedGuess,
          player.aesKey,
        );
        if (decrypted && typeof decrypted.lat === 'number' && typeof decrypted.lng === 'number') {
          coords = {
            lat: Math.round(decrypted.lat * 1000000) / 1000000,
            lng: Math.round(decrypted.lng * 1000000) / 1000000,
          };
          this.logger.log(`[ZERO-TRUST] Decrypted AES-256-GCM guess from ${player.username}`);
        }
      } catch (err: any) {
        this.logger.error(`Failed to decrypt guess from ${player.username}: ${err.message}`);
        socket.emit('error_message', { message: 'Decryption failed: integrity compromised.' });
        return;
      }
    } else if (
      data &&
      typeof data === 'object' &&
      data.lat !== undefined &&
      data.lat !== null &&
      data.lng !== undefined &&
      data.lng !== null
    ) {
      const lat = typeof data.lat === 'number' ? data.lat : Number(data.lat);
      const lng = typeof data.lng === 'number' ? data.lng : Number(data.lng);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        coords = {
          lat: Math.round(lat * 1000000) / 1000000,
          lng: Math.round(lng * 1000000) / 1000000,
        };
      }
    } else if (player.currentPin) {
      coords = player.currentPin;
    }

    if (!coords) {
      socket.emit('error_message', {
        message: 'Please place a valid pin on the map first.',
      });
      return;
    }

    // Anti-Cheat: Detect impossible programmatic coordinate injection
    const target = room.roundTarget;
    if (
      target &&
      Math.abs(coords.lat - target.lat) < 0.0000001 &&
      Math.abs(coords.lng - target.lng) < 0.0000001
    ) {
      this.logger.warn(
        `[ANTI-CHEAT] Programmatic coordinate injection penalized for ${player.username} in Room ${room.id}!`,
      );
      coords = {
        lat:
          coords.lat +
          (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.05),
        lng:
          coords.lng +
          (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.05),
      };
      socket.emit('error_message', {
        message: 'Anti-Cheat: Exact coordinate injection detected and penalized.',
      });
    }

    player.lockedGuess = coords;
    player.currentPin = coords;
    player.hasGuessed = true;

    const activeInGame = Object.values(room.players).filter(
      (p) => p && p.connected === true && p.inGame !== false,
    );
    const guessedCount = activeInGame.filter((p) => p.hasGuessed).length;
    const totalPlayers = Object.values(room.players).filter(
      (p) => p && p.connected === true,
    ).length;

    this.logger.log(`[Room ${room.id}] ${player.username} locked guess (${guessedCount}/${totalPlayers})`);

    const guessedPayload = {
      roomId: room.id,
      username: player.username,
      id: clientId,
      ip: player.ip,
      guessedCount,
      totalPlayers,
    };
    this.server.to(room.id).emit('player_guessed', guessedPayload);
    if (room.id === 'LAN-01') {
      this.server.emit('player_guessed', guessedPayload);
    }

    if (room.status === 'ROUND_ACTIVE') {
      room.status = 'ROUND_COUNTDOWN';
      const duration = room.countdownDuration || 20;
      room.countdownSeconds = duration;
      room.firstGuesserName = player.username;

      this.logger.log(
        `[Room ${room.id}] First guess by ${player.username}! ${duration}s countdown started.`,
      );
      const countdownPayload = {
        roomId: room.id,
        seconds: duration,
        triggeredBy: player.username,
      };
      this.server.to(room.id).emit('countdown_started', countdownPayload);
      if (room.id === 'LAN-01') {
        this.server.emit('countdown_started', countdownPayload);
      }

      if (room.countdownInterval) clearInterval(room.countdownInterval);
      room.countdownInterval = setInterval(() => {
        if (room.countdownSeconds !== null) {
          room.countdownSeconds--;
          this.server.to(room.id).emit('timer_tick', {
            roomId: room.id,
            seconds: room.countdownSeconds,
          });
          if (room.id === 'LAN-01') {
            this.server.emit('timer_tick', { seconds: room.countdownSeconds });
          }

          if (room.countdownSeconds <= 0) {
            clearInterval(room.countdownInterval!);
            room.countdownInterval = null;
            this.logger.log(`[Room ${room.id}] ${duration}s countdown expired. Ending round.`);
            this.gameService.endRound(this.server, room);
          }
        }
      }, 1000);
    }

    this.gameService.checkAllGuessed(this.server, room);
  }

  @SubscribeMessage('next_round')
  handleNextRound(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data?: any,
  ) {
    const room = this.resolveRoom(socket, data);
    this.gameService.nextRound(this.server, room);
  }

  @SubscribeMessage('reset_to_lobby')
  handleResetToLobby(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data?: any,
  ) {
    const room = this.resolveRoom(socket, data);
    this.gameService.resetToLobby(this.server, room, socket);
  }

  @SubscribeMessage('set_countdown_duration')
  handleSetCountdownDuration(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    this.gameService.ensureActiveHost(room);

    if (room.hostId && clientId !== room.hostId && socket.id !== room.hostSocketId) {
      return;
    }

    const secs = parseInt(data?.seconds || data?.duration, 10);
    if (!isNaN(secs) && secs >= 5 && secs <= 180) {
      room.countdownDuration = secs;
      this.gameService.broadcastLobbyUpdate(this.server, room);
      const updatePayload = {
        roomId: room.id,
        totalRounds: room.totalRounds,
        countdownDuration: room.countdownDuration,
      };
      this.server.to(room.id).emit('params_updated', updatePayload);
      if (room.id === 'LAN-01') {
        this.server.emit('params_updated', updatePayload);
      }
    }
  }

  @SubscribeMessage('set_total_rounds')
  handleSetTotalRounds(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    this.gameService.ensureActiveHost(room);

    if (room.hostId && clientId !== room.hostId && socket.id !== room.hostSocketId) {
      return;
    }

    const rounds = parseInt(data?.rounds, 10);
    if (!isNaN(rounds) && rounds >= 1 && rounds <= 25) {
      room.totalRounds = rounds;
      this.gameService.broadcastLobbyUpdate(this.server, room);
      const updatePayload = {
        roomId: room.id,
        totalRounds: room.totalRounds,
        countdownDuration: room.countdownDuration,
      };
      this.server.to(room.id).emit('params_updated', updatePayload);
      if (room.id === 'LAN-01') {
        this.server.emit('params_updated', updatePayload);
      }
    }
  }

  @SubscribeMessage('set_region')
  handleSetRegion(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    this.gameService.ensureActiveHost(room);

    if (room.hostId && clientId !== room.hostId && socket.id !== room.hostSocketId) {
      return;
    }

    const region = String(data?.region || 'all').toLowerCase();
    room.selectedRegion = region;
    const payload = { roomId: room.id, selectedRegion: room.selectedRegion };
    this.server.to(room.id).emit('region_updated', payload);
    if (room.id === 'LAN-01') {
      this.server.emit('region_updated', payload);
    }
    this.gameService.broadcastLobbyUpdate(this.server, room);
  }

  @SubscribeMessage('set_difficulty')
  handleSetDifficulty(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    this.gameService.ensureActiveHost(room);

    if (room.hostId && clientId !== room.hostId && socket.id !== room.hostSocketId) {
      return;
    }

    const diff = String(data?.difficulty || 'all').toLowerCase();
    if (['all', 'easy', 'medium', 'hard'].includes(diff)) {
      room.difficulty = diff;
      this.gameService.broadcastLobbyUpdate(this.server, room);
      const payload = { roomId: room.id, difficulty: room.difficulty };
      this.server.to(room.id).emit('difficulty_updated', payload);
      if (room.id === 'LAN-01') {
        this.server.emit('difficulty_updated', payload);
      }
    }
  }
}
