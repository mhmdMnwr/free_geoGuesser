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

    const playerKey = Object.keys(room.players).find(
      (k) =>
        k === clientId ||
        k === ip ||
        room.players[k]?.id === clientId ||
        room.players[k]?.socketId === socket.id,
    );
    const player = playerKey ? room.players[playerKey] : null;

    if (player && player.socketId === socket.id) {
      player.connected = false;
      player.lastDisconnectedAt = Date.now();

      // Check if this player was the host of a custom room
      const wasHost =
        (room.hostId && (clientId === room.hostId || player.id === room.hostId)) ||
        (room.hostSocketId && socket.id === room.hostSocketId) ||
        (!room.hostId && ip === room.hostIp);

      if (wasHost && room.id !== 'LAN-01') {
        // Zero-Trust Host Invariant: Allow 8-second grace window for page reloads
        const t = setTimeout(() => {
          this.disconnectTimeouts.delete(clientId);
          const currentRoom = this.gameService.getRoom(room.id);
          if (!currentRoom) return;
          const hostPlayer =
            currentRoom.players[clientId] ||
            currentRoom.players[playerKey] ||
            (player.id ? currentRoom.players[player.id] : null);
          if (!hostPlayer || hostPlayer.connected !== true) {
            this.gameService.terminateLobby(
              room.id,
              this.server,
              `Squad Leader (${player.username}) disconnected. Room disbanded.`,
            );
          }
        }, 8000);
        this.disconnectTimeouts.set(clientId, t);
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
    const playerKey = Object.keys(room.players).find(
      (k) =>
        k === clientId ||
        room.players[k]?.id === clientId ||
        (socketId && room.players[k]?.socketId === socketId),
    );
    const player = playerKey ? room.players[playerKey] : null;
    if (!player) return;
    if (socketId && player.socketId !== socketId && player.connected === true) {
      return;
    }

    const username = player.username;
    if (playerKey) {
      delete room.players[playerKey];
    }

    const remainingConnected = Object.values(room.players).filter(
      (p) => p && p.connected === true,
    );

    if (remainingConnected.length === 0) {
      if (room.countdownInterval) {
        clearInterval(room.countdownInterval);
        room.countdownInterval = null;
      }
      room.status = 'LOBBY';
      room.currentRound = 0;
      room.selectedLocations = [];
      room.roundTarget = null;
      room.roundUplinkToken = null;
      room.countdownSeconds = null;
      room.firstGuesserName = null;
      room.lastRoundResults = null;
      room.hostId = null;
      room.hostIp = null;
      room.hostSocketId = null;
      room.hostName = null;
      if (room.id !== 'LAN-01') {
        this.gameService.deleteRoom(room.id);
        this.server.emit('lobbies_list', this.gameService.getLobbiesList());
        return;
      }
    } else {
      this.gameService.ensureActiveHost(room);
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

    this.gameService.broadcastLobbyUpdate(this.server, room);
    this.server.emit('lobbies_list', this.gameService.getLobbiesList());

    if (room.status === 'ROUND_ACTIVE' || room.status === 'ROUND_COUNTDOWN') {
      this.gameService.checkAllGuessed(this.server, room);
    }
  }

  // --- Legacy Single-Room & Automated Test Compatibility ---

  @SubscribeMessage('set_username')
  handleSetUsername(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const gameState = this.gameService.state;
    const rawUsername = typeof data === 'string' ? data : data?.username;
    let cleanName = String(rawUsername || '')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (!cleanName || cleanName.length < 2) {
      socket.emit('error_message', {
        message: 'Username must be at least 2 characters.',
      });
      return;
    }
    if (cleanName.length > 18) {
      cleanName = cleanName.substring(0, 18);
    }

    if (
      gameState.status !== 'LOBBY' &&
      gameState.players[ip] &&
      gameState.players[ip].username !== cleanName
    ) {
      socket.emit('error_message', {
        message: 'Cannot change username while match is active.',
      });
      return;
    }

    const activeDuplicate = Object.values(gameState.players).find(
      (p) =>
        p &&
        p.connected === true &&
        p.ip !== ip &&
        p.username &&
        p.username.toLowerCase() === cleanName.toLowerCase(),
    );
    if (activeDuplicate) {
      socket.emit('error_message', {
        message: `Callsign "${cleanName}" is already claimed by an active player.`,
      });
      return;
    }

    const pendingDuplicate = Object.values(gameState.pendingAdmissions).find(
      (adm) =>
        adm &&
        adm.ip !== ip &&
        adm.username &&
        adm.username.toLowerCase() === cleanName.toLowerCase(),
    );
    if (pendingDuplicate) {
      socket.emit('error_message', {
        message: `Callsign "${cleanName}" is currently awaiting host clearance from another device.`,
      });
      return;
    }

    this.gameService.ensureActiveHost(gameState);
    const hasActiveHost = Boolean(
      gameState.hostIp && gameState.players[gameState.hostIp]?.connected === true,
    );

    let preservedScore = 0;
    for (const otherIp of Object.keys(gameState.players)) {
      if (
        otherIp !== ip &&
        gameState.players[otherIp]?.username?.toLowerCase() ===
          cleanName.toLowerCase()
      ) {
        if (gameState.players[otherIp].connected === false) {
          if (gameState.players[otherIp].totalScore) {
            preservedScore = gameState.players[otherIp].totalScore;
          }
          delete gameState.players[otherIp];
        }
      }
    }

    const connectedCount = Object.values(gameState.players).filter(
      (p) => p && p.connected === true,
    ).length;
    const isFirstPlayer = connectedCount === 0;
    const isAlreadyRegistered = Boolean(gameState.players[ip] || gameState.players[clientId]);

    // Gated Entry
    if (
      hasActiveHost &&
      ip !== gameState.hostIp &&
      !isAlreadyRegistered &&
      !isFirstPlayer
    ) {
      gameState.pendingAdmissions[ip] = {
        ip,
        socketId: socket.id,
        username: cleanName,
        requestedAt: Date.now(),
      };

      socket.emit('admission_pending', {
        username: cleanName,
        ip,
        hostName: gameState.players[gameState.hostIp]?.username || 'Host',
      });

      const hostPlayer = gameState.players[gameState.hostIp];
      if (hostPlayer?.socketId) {
        this.server.to(hostPlayer.socketId).emit('admission_requested', {
          applicantIp: ip,
          applicantName: cleanName,
          pendingCount: Object.keys(gameState.pendingAdmissions).length,
          pendingAdmissions: Object.values(gameState.pendingAdmissions),
        });
      }

      this.gameService.broadcastLobbyUpdate(this.server, gameState);
      return;
    }

    let player = gameState.players[clientId] || gameState.players[ip];
    if (player) {
      player.username = cleanName;
      player.connected = true;
      player.socketId = socket.id;
      if (preservedScore > 0 && player.totalScore === 0) {
        player.totalScore = preservedScore;
      }
    } else {
      player = {
        id: clientId,
        ip,
        socketId: socket.id,
        username: cleanName,
        connected: true,
        totalScore: preservedScore,
        currentPin: null,
        lockedGuess: null,
        hasGuessed: false,
        lastRoundScore: 0,
        lastRoundDistanceKm: null,
        inGame: gameState.status === 'LOBBY',
      };
      gameState.players[clientId] = player;
    }

    if (!hasActiveHost) {
      gameState.hostIp = ip;
      gameState.hostId = clientId;
      gameState.hostSocketId = socket.id;
      gameState.hostName = cleanName;
      gameState.lastHostUsername = cleanName;
    }
    this.gameService.ensureActiveHost(gameState);

    const userIsHost =
      (gameState.hostId && clientId === gameState.hostId) ||
      (gameState.hostSocketId && socket.id === gameState.hostSocketId) ||
      (!gameState.hostId && ip === gameState.hostIp);

    socket.emit('username_set', {
      ip,
      username: cleanName,
      isHost: Boolean(userIsHost),
      hostIp: gameState.hostIp,
      selectedRegion: gameState.selectedRegion,
      difficulty: gameState.difficulty,
      totalRounds: gameState.totalRounds,
      countdownDuration: gameState.countdownDuration,
      gameStatus:
        gameState.status !== 'LOBBY'
          ? {
              status: gameState.status,
              currentRound: gameState.currentRound,
              totalRounds: gameState.totalRounds,
              difficulty: gameState.difficulty,
              hostName:
                gameState.players[gameState.hostIp]?.username || 'Host',
            }
          : null,
    });

    this.gameService.broadcastLobbyUpdate(this.server, gameState);
    this.logger.log(`Registered IP ${ip} as "${cleanName}" (Host: ${Boolean(userIsHost)})`);
  }

  @SubscribeMessage('decide_admission')
  handleDecideAdmission(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const gameState = this.gameService.state;
    this.gameService.ensureActiveHost(gameState);

    const isHost =
      (gameState.hostId && clientId === gameState.hostId) ||
      (gameState.hostSocketId && socket.id === gameState.hostSocketId) ||
      (!gameState.hostId && ip === gameState.hostIp);

    if (!isHost) {
      socket.emit('error_message', {
        message: 'Only the host can accept or decline admissions.',
      });
      return;
    }

    const applicantIp = data?.applicantIp;
    const accepted = Boolean(data?.accepted);
    const applicant = applicantIp ? gameState.pendingAdmissions[applicantIp] : null;

    if (!applicant) return;

    delete gameState.pendingAdmissions[applicantIp];

    if (accepted) {
      gameState.players[applicantIp] = {
        id: applicantIp,
        ip: applicantIp,
        socketId: applicant.socketId,
        username: applicant.username,
        connected: true,
        totalScore: 0,
        currentPin: null,
        lockedGuess: null,
        hasGuessed: false,
        lastRoundScore: 0,
        lastRoundDistanceKm: null,
        inGame: gameState.status === 'LOBBY',
      };

      this.server.to(applicant.socketId).emit('admission_accepted', {
        ip: applicantIp,
        username: applicant.username,
      });

      this.server.to(applicant.socketId).emit('username_set', {
        ip: applicantIp,
        username: applicant.username,
        isHost: false,
        hostIp: gameState.hostIp,
        selectedRegion: gameState.selectedRegion,
        difficulty: gameState.difficulty,
        totalRounds: gameState.totalRounds,
        countdownDuration: gameState.countdownDuration,
        gameStatus:
          gameState.status !== 'LOBBY'
            ? {
                status: gameState.status,
                currentRound: gameState.currentRound,
                totalRounds: gameState.totalRounds,
                difficulty: gameState.difficulty,
                hostName:
                  gameState.players[gameState.hostIp]?.username || 'Host',
              }
            : null,
      });

      this.gameService.broadcastLobbyUpdate(this.server, gameState);
    } else {
      this.server.to(applicant.socketId).emit('admission_declined', {
        message: 'The Host declined your admission request to this match.',
      });
      this.gameService.broadcastLobbyUpdate(this.server, gameState);
    }
  }

  @SubscribeMessage('cancel_admission')
  handleCancelAdmission(@ConnectedSocket() socket: Socket) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;
    if (gameState.pendingAdmissions[ip]) {
      delete gameState.pendingAdmissions[ip];
      this.gameService.broadcastLobbyUpdate(this.server, gameState);
    }
  }

  @SubscribeMessage('join_game')
  handleJoinGame(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data?: any,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    const player = room.players[clientId] || room.players[ip];

    if (!player) {
      socket.emit('error_message', { message: 'Please set your username first.' });
      return;
    }

    if (room.status === 'LOBBY') {
      socket.emit('error_message', {
        message: 'Match has not started yet. Waiting in lobby.',
      });
      return;
    }

    player.inGame = true;
    player.connected = true;
    player.socketId = socket.id;

    const inGamePlayers = Object.values(room.players).filter(
      (p) => p && p.connected && p.inGame !== false,
    );
    const guessedCount = inGamePlayers.filter((p) => p.hasGuessed).length;
    const totalPlayers = inGamePlayers.length;

    if (
      room.status === 'ROUND_ACTIVE' ||
      room.status === 'ROUND_COUNTDOWN'
    ) {
      socket.emit('round_started', {
        roomId: room.id,
        round: room.currentRound,
        totalRounds: room.totalRounds,
        difficulty: room.roundTarget?.difficulty || room.difficulty,
        uplinkToken: room.roundUplinkToken || null,
        roadToken: room.roadToken || null,
        sharedImage: room.currentSharedImage || null,
        guessedCount,
        totalPlayers,
        countdownSeconds: room.countdownSeconds,
        firstGuesserName: room.firstGuesserName,
        isHost: (room.hostId && clientId === room.hostId) || ip === room.hostIp,
        hostIp: room.hostIp,
      });
    } else if (room.status === 'ROUND_RESULTS') {
      socket.emit('round_results', room.lastRoundResults);
    } else if (room.status === 'GAME_OVER') {
      socket.emit('game_over', room.lastGameOver);
    }

    this.server.to(room.id).emit('player_joined', {
      username: player.username,
      ip: player.ip,
      totalPlayers,
    });
  }

  @SubscribeMessage('leave_game')
  handleLeaveGame(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data?: any,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    const player = room.players[clientId] || room.players[ip];
    const username = player?.username || 'A player';

    const wasHost = (room.hostId && clientId === room.hostId) || ip === room.hostIp;
    const otherConnected = Object.values(room.players).filter(
      (p) => p && p.connected === true && (p.id ? p.id !== clientId : p.ip !== ip),
    );

    if (wasHost || otherConnected.length === 0) {
      if (room.countdownInterval) {
        clearInterval(room.countdownInterval);
        room.countdownInterval = null;
      }
      room.status = 'LOBBY';
      room.currentRound = 0;
      room.selectedLocations = [];
      room.roundTarget = null;
      room.roundUplinkToken = null;
      room.countdownSeconds = null;
      room.firstGuesserName = null;
      room.lastRoundResults = null;
      for (const p of Object.values(room.players)) {
        if (p) {
          p.totalScore = 0;
          p.currentPin = null;
          p.lockedGuess = null;
          p.hasGuessed = false;
          p.lastRoundScore = 0;
          p.lastRoundDistanceKm = null;
          p.inGame = true;
        }
      }
      const payload = {
        players: this.gameService.getLobbyPlayers(room),
        hostIp: room.hostIp,
        selectedRegion: room.selectedRegion,
        difficulty: room.difficulty,
        status: room.status,
        currentRound: room.currentRound,
        message: wasHost
          ? `Host (${username}) left the game. Returned to Lobby.`
          : 'Match abandoned. Returned to Lobby.',
      };
      this.server.to(room.id).emit('return_to_lobby', payload);
      return;
    } else {
      if (player) {
        player.inGame = false;
        player.hasGuessed = true;
      }
      socket.emit('return_to_lobby', {
        players: this.gameService.getLobbyPlayers(room),
        hostIp: room.hostIp,
        selectedRegion: room.selectedRegion,
        difficulty: room.difficulty,
        status: room.status,
        currentRound: room.currentRound,
      });

      const activeInGame = Object.values(room.players).filter(
        (p) => p && p.connected === true && p.inGame !== false,
      );
      const leftPayload = {
        username,
        ip: player?.ip || ip,
        remainingCount: activeInGame.length,
        hostIp: room.hostIp,
      };
      this.server.to(room.id).emit('player_left', leftPayload);
      this.server.to(room.id).emit('player_left_game', leftPayload);
      if (room.status === 'ROUND_ACTIVE' || room.status === 'ROUND_COUNTDOWN') {
        this.gameService.checkAllGuessed(this.server, room);
      }
    }

    this.gameService.broadcastLobbyUpdate(this.server, room);
  }

  @SubscribeMessage('host_share_image')
  handleHostShareImage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    this.gameService.ensureActiveHost(room);

    const isHost = (room.hostId && clientId === room.hostId) || ip === room.hostIp;
    if (!isHost) {
      socket.emit('error_message', {
        message: 'Only the Host can fetch and share recon images.',
      });
      return;
    }

    if (
      room.status !== 'ROUND_ACTIVE' &&
      room.status !== 'ROUND_COUNTDOWN'
    ) {
      socket.emit('error_message', {
        message: 'Cannot share images outside an active expedition round.',
      });
      return;
    }

    if (!data || typeof data.image !== 'string') {
      socket.emit('error_message', { message: 'Invalid image data payload.' });
      return;
    }

    const isDataUrl = data.image.startsWith('data:image/');
    const isHttpUrl =
      data.image.startsWith('http://') || data.image.startsWith('https://');
    if (!isDataUrl && !isHttpUrl) {
      socket.emit('error_message', {
        message: 'Image must be a valid data:image or image URL.',
      });
      return;
    }

    if (data.image.length > 7 * 1024 * 1024) {
      socket.emit('error_message', {
        message: 'Image payload exceeds 5MB limit.',
      });
      return;
    }

    room.currentSharedImage = data.image;
    room.sharedImageTimestamp = Date.now();
    room.sharedImageCaption =
      typeof data.caption === 'string' ? data.caption.slice(0, 100) : '';

    const payload = {
      image: room.currentSharedImage,
      caption: room.sharedImageCaption,
      timestamp: room.sharedImageTimestamp,
      hostUsername: room.hostName || 'Host',
    };
    this.server.to(room.id).emit('shared_image_updated', payload);
  }

  @SubscribeMessage('transfer_host')
  handleTransferHost(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    this.gameService.ensureActiveHost(room);

    const isHost = (room.hostId && clientId === room.hostId) || ip === room.hostIp;
    if (!isHost) {
      socket.emit('error_message', {
        message: 'Only the current host can transfer leadership.',
      });
      return;
    }

    const targetIdentifier = data?.targetIp || data?.targetId;
    const targetPlayer = Object.values(room.players).find(
      (p) => p && (p.ip === targetIdentifier || p.id === targetIdentifier),
    );
    if (!targetPlayer || targetPlayer.connected !== true) {
      socket.emit('error_message', {
        message: 'Cannot transfer host: targeted operative is not connected.',
      });
      return;
    }

    const prevHostName = room.hostName || 'Host';
    room.hostIp = targetPlayer.ip;
    room.hostId = targetPlayer.id;
    room.hostSocketId = targetPlayer.socketId;
    room.hostName = targetPlayer.username;

    const payload = {
      previousHost: prevHostName,
      previousHostIp: ip,
      newHost: targetPlayer.username,
      newHostIp: targetPlayer.ip,
      newHostId: targetPlayer.id,
    };
    this.server.to(room.id).emit('host_transferred', payload);
    this.gameService.broadcastLobbyUpdate(this.server, room);
  }

  @SubscribeMessage('claim_host')
  handleClaimHost(@ConnectedSocket() socket: Socket) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket);
    this.gameService.ensureActiveHost(room);

    const hostPlayer = room.hostId ? room.players[room.hostId] : (room.hostIp ? room.players[room.hostIp] : null);
    if (hostPlayer && hostPlayer.connected === true) {
      socket.emit('error_message', {
        message: 'A host is already active. Only the current host can pass the crown.',
      });
      return;
    }

    const player = room.players[clientId] || room.players[ip];
    if (!player || player.connected !== true) return;

    room.hostIp = ip;
    room.hostId = clientId;
    room.hostSocketId = socket.id;
    room.hostName = player.username;
    this.gameService.broadcastLobbyUpdate(this.server, room);
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

      if (room.countdownInterval) clearInterval(room.countdownInterval);
      room.countdownInterval = setInterval(() => {
        if (room.countdownSeconds !== null) {
          room.countdownSeconds--;
          this.server.to(room.id).emit('timer_tick', {
            roomId: room.id,
            seconds: room.countdownSeconds,
          });

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
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    this.gameService.ensureActiveHost(room);

    const isHost =
      (room.hostId && clientId === room.hostId) ||
      (room.hostSocketId && socket.id === room.hostSocketId) ||
      (!room.hostId && ip === room.hostIp);

    if (!isHost) {
      socket.emit('error_message', {
        message: 'Only the host (Squad Leader) can configure countdown duration.',
      });
      return;
    }

    const secs = parseInt(data?.seconds || data?.duration, 10);
    if (!isNaN(secs) && secs >= 5 && secs <= 120) {
      room.countdownDuration = secs;
      this.gameService.broadcastLobbyUpdate(this.server, room);
      const updatePayload = {
        roomId: room.id,
        totalRounds: room.totalRounds,
        countdownDuration: room.countdownDuration,
      };
      this.server.to(room.id).emit('params_updated', updatePayload);
    }
  }

  @SubscribeMessage('set_total_rounds')
  handleSetTotalRounds(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    this.gameService.ensureActiveHost(room);

    const isHost =
      (room.hostId && clientId === room.hostId) ||
      (room.hostSocketId && socket.id === room.hostSocketId) ||
      (!room.hostId && ip === room.hostIp);

    if (!isHost) {
      socket.emit('error_message', {
        message: 'Only the host (Squad Leader) can configure round count.',
      });
      return;
    }

    const rounds = parseInt(data?.rounds, 10);
    if (!isNaN(rounds) && rounds >= 3 && rounds <= 20) {
      room.totalRounds = rounds;
      this.gameService.broadcastLobbyUpdate(this.server, room);
      const updatePayload = {
        roomId: room.id,
        totalRounds: room.totalRounds,
        countdownDuration: room.countdownDuration,
      };
      this.server.to(room.id).emit('params_updated', updatePayload);
    }
  }

  @SubscribeMessage('set_region')
  handleSetRegion(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    this.gameService.ensureActiveHost(room);

    const isHost =
      (room.hostId && clientId === room.hostId) ||
      (room.hostSocketId && socket.id === room.hostSocketId) ||
      (!room.hostId && ip === room.hostIp);

    if (!isHost) {
      socket.emit('error_message', {
        message: 'Only the host can change the map region.',
      });
      return;
    }

    const region = String(data?.region || 'all').toLowerCase();
    room.selectedRegion = region;
    const payload = { roomId: room.id, selectedRegion: room.selectedRegion };
    this.server.to(room.id).emit('region_updated', payload);
    this.gameService.broadcastLobbyUpdate(this.server, room);
  }

  @SubscribeMessage('set_difficulty')
  handleSetDifficulty(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const room = this.resolveRoom(socket, data);
    this.gameService.ensureActiveHost(room);

    const isHost =
      (room.hostId && clientId === room.hostId) ||
      (room.hostSocketId && socket.id === room.hostSocketId) ||
      (!room.hostId && ip === room.hostIp);

    if (!isHost) {
      socket.emit('error_message', {
        message: 'Only the host can set difficulty.',
      });
      return;
    }

    const diff = String(data?.difficulty || 'all').toLowerCase();
    if (['all', 'easy', 'medium', 'hard'].includes(diff)) {
      room.difficulty = diff;
      this.gameService.broadcastLobbyUpdate(this.server, room);
      const payload = { roomId: room.id, difficulty: room.difficulty };
      this.server.to(room.id).emit('difficulty_updated', payload);
    }
  }
}
