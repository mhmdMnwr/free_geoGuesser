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
import { getClientIp } from './game.helpers';
import { Coords } from './game.types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  pingTimeout: 7000,
  pingInterval: 5000,
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly gameService: GameService) {}

  handleConnection(socket: Socket) {
    const ip = getClientIp(socket);
    this.logger.log(`Connection from IP: ${ip} (Socket ID: ${socket.id})`);

    const gameState = this.gameService.state;

    // If this IP is already registered in memory, mark active socket connection
    if (gameState.players[ip]) {
      gameState.players[ip].connected = true;
      gameState.players[ip].socketId = socket.id;
    }

    this.gameService.ensureActiveHost();

    const connectedPlayers = Object.values(gameState.players).filter(
      (p) => p && p.connected === true,
    );

    // Case A: LOBBY Phase
    if (gameState.status === 'LOBBY') {
      if (gameState.players[ip]) {
        const player = gameState.players[ip];
        socket.emit('session_restored', {
          ip,
          username: player.username,
          totalScore: player.totalScore,
          status: gameState.status,
          isHost: ip === gameState.hostIp,
          hostIp: gameState.hostIp,
          selectedRegion: gameState.selectedRegion,
          difficulty: gameState.difficulty,
          totalRounds: gameState.totalRounds,
          countdownDuration: gameState.countdownDuration,
        });
        this.gameService.broadcastLobbyUpdate(this.server);
      } else {
        socket.emit('prompt_username', {
          ip,
          currentUsername: null,
          isHost:
            connectedPlayers.length === 0 ||
            !gameState.hostIp ||
            gameState.hostIp === ip,
          hostIp: gameState.hostIp,
          selectedRegion: gameState.selectedRegion,
          difficulty: gameState.difficulty,
          totalRounds: gameState.totalRounds,
          countdownDuration: gameState.countdownDuration,
        });
      }
    } else {
      // Case B: In-game or Results/Game Over phase
      if (gameState.players[ip]) {
        const player = gameState.players[ip];
        const guessedCount = Object.values(gameState.players).filter(
          (p) => p && p.connected === true && p.hasGuessed,
        ).length;
        const totalPlayers = Object.values(gameState.players).filter(
          (p) => p && p.connected === true,
        ).length;

        socket.emit('rejoin_match', {
          ip,
          username: player.username,
          status: gameState.status,
          round: gameState.currentRound,
          totalRounds: gameState.totalRounds,
          uplinkToken: gameState.roundUplinkToken || null,
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
          isHost: ip === gameState.hostIp,
          hostIp: gameState.hostIp,
        });
        this.logger.log(
          `Player ${player.username} (${ip}) rejoined match in status ${gameState.status}`,
        );
      } else {
        socket.emit('prompt_username', {
          ip,
          currentUsername: null,
          inProgress: true,
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
            playerCount: Object.values(gameState.players).filter(
              (p) => p && p.connected === true,
            ).length,
            hostName: gameState.players[gameState.hostIp]?.username || 'Host',
            selectedRegion: gameState.selectedRegion,
          },
        });
      }
    }
  }

  handleDisconnect(socket: Socket) {
    const ip = getClientIp(socket);
    this.logger.log(`Socket disconnected: ${socket.id} (IP: ${ip})`);
    const gameState = this.gameService.state;

    // Clean up if this was a pending admission applicant
    if (
      gameState.pendingAdmissions[ip] &&
      gameState.pendingAdmissions[ip].socketId === socket.id
    ) {
      this.logger.log(
        `Pending applicant ${gameState.pendingAdmissions[ip].username} (${ip}) disconnected.`,
      );
      delete gameState.pendingAdmissions[ip];
      this.gameService.broadcastLobbyUpdate(this.server);
    }

    if (
      gameState.players[ip] &&
      gameState.players[ip].socketId === socket.id
    ) {
      const username = gameState.players[ip].username;
      const wasHost = ip === gameState.hostIp;

      delete gameState.players[ip];

      const remainingConnected = Object.values(gameState.players).filter(
        (p) => p && p.connected === true,
      );

      if (wasHost) {
        gameState.lastHostUsername = username;
        gameState.hostIp =
          remainingConnected.length > 0 ? remainingConnected[0].ip : null;
      }
      this.gameService.ensureActiveHost();

      if (remainingConnected.length === 0) {
        if (gameState.countdownInterval) {
          clearInterval(gameState.countdownInterval);
          gameState.countdownInterval = null;
        }
        gameState.status = 'LOBBY';
        gameState.currentRound = 0;
        gameState.selectedLocations = [];
        gameState.roundTarget = null;
        gameState.roundUplinkToken = null;
        gameState.countdownSeconds = null;
        gameState.firstGuesserName = null;
        gameState.lastRoundResults = null;
        gameState.lastGameOver = null;
        gameState.hostIp = null;
        gameState.pendingAdmissions = {};
      }

      if (
        gameState.lastRoundResults &&
        Array.isArray(gameState.lastRoundResults.results)
      ) {
        gameState.lastRoundResults.results = gameState.lastRoundResults.results.filter(
          (r: any) => r.ip !== ip && r.username !== username,
        );
        gameState.lastRoundResults.leaderboard =
          gameState.lastRoundResults.results;
        if (
          gameState.lastRoundResults.closestPlayer &&
          gameState.lastRoundResults.closestPlayer.username === username
        ) {
          let newClosest: any = null;
          let minD = Infinity;
          for (const r of gameState.lastRoundResults.results) {
            if (
              r.distanceKm !== null &&
              !isNaN(r.distanceKm) &&
              r.distanceKm < minD
            ) {
              minD = r.distanceKm;
              newClosest = r;
            }
          }
          gameState.lastRoundResults.closestPlayer = newClosest;
        }
      }

      if (
        gameState.lastGameOver &&
        Array.isArray(gameState.lastGameOver.leaderboard)
      ) {
        gameState.lastGameOver.leaderboard = gameState.lastGameOver.leaderboard.filter(
          (p: any) => p.ip !== ip && p.username !== username,
        );
      }

      this.logger.log(
        `Deleted inactive player ${username} (${ip}). Remaining players: ${remainingConnected.length}`,
      );

      this.server.emit('player_left', {
        username,
        ip,
        remainingCount: remainingConnected.length,
        hostIp: gameState.hostIp,
        lastRoundResults: gameState.lastRoundResults,
        gameOverResults: gameState.lastGameOver,
      });

      if (
        gameState.status === 'ROUND_RESULTS' &&
        gameState.lastRoundResults
      ) {
        this.server.emit('round_results', gameState.lastRoundResults);
      } else if (
        gameState.status === 'GAME_OVER' &&
        gameState.lastGameOver
      ) {
        this.server.emit('game_over', gameState.lastGameOver);
      }

      this.gameService.broadcastLobbyUpdate(this.server);

      if (
        gameState.status === 'ROUND_ACTIVE' ||
        gameState.status === 'ROUND_COUNTDOWN'
      ) {
        this.gameService.checkAllGuessed(this.server);
      }
    }
  }

  @SubscribeMessage('set_username')
  handleSetUsername(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
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

    this.gameService.ensureActiveHost();
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
    const isAlreadyRegistered = Boolean(gameState.players[ip]);

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

      this.gameService.broadcastLobbyUpdate(this.server);
      return;
    }

    if (gameState.players[ip]) {
      gameState.players[ip].username = cleanName;
      gameState.players[ip].connected = true;
      gameState.players[ip].socketId = socket.id;
      if (preservedScore > 0 && gameState.players[ip].totalScore === 0) {
        gameState.players[ip].totalScore = preservedScore;
      }
    } else {
      gameState.players[ip] = {
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
    }

    if (!hasActiveHost) {
      gameState.hostIp = ip;
      gameState.lastHostUsername = cleanName;
    }
    this.gameService.ensureActiveHost();

    const userIsHost = ip === gameState.hostIp;

    socket.emit('username_set', {
      ip,
      username: cleanName,
      isHost: userIsHost,
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

    this.gameService.broadcastLobbyUpdate(this.server);
    this.logger.log(`Registered IP ${ip} as "${cleanName}" (Host: ${userIsHost})`);
  }

  @SubscribeMessage('decide_admission')
  handleDecideAdmission(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;
    this.gameService.ensureActiveHost();

    if (!gameState.hostIp || ip !== gameState.hostIp) {
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

      this.gameService.broadcastLobbyUpdate(this.server);
    } else {
      this.server.to(applicant.socketId).emit('admission_declined', {
        message: 'The Host declined your admission request to this match.',
      });
      this.gameService.broadcastLobbyUpdate(this.server);
    }
  }

  @SubscribeMessage('cancel_admission')
  handleCancelAdmission(@ConnectedSocket() socket: Socket) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;
    if (gameState.pendingAdmissions[ip]) {
      delete gameState.pendingAdmissions[ip];
      this.gameService.broadcastLobbyUpdate(this.server);
    }
  }

  @SubscribeMessage('set_countdown_duration')
  handleSetCountdownDuration(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;
    this.gameService.ensureActiveHost();

    if (!gameState.hostIp || ip !== gameState.hostIp) {
      socket.emit('error_message', {
        message: 'Only the host can configure countdown duration.',
      });
      return;
    }

    const secs = parseInt(data?.seconds, 10);
    if (!isNaN(secs) && secs >= 5 && secs <= 120) {
      gameState.countdownDuration = secs;
      this.gameService.broadcastLobbyUpdate(this.server);
      this.server.emit('params_updated', {
        totalRounds: gameState.totalRounds,
        countdownDuration: gameState.countdownDuration,
      });
    }
  }

  @SubscribeMessage('set_total_rounds')
  handleSetTotalRounds(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;
    this.gameService.ensureActiveHost();

    if (!gameState.hostIp || ip !== gameState.hostIp) {
      socket.emit('error_message', {
        message: 'Only the host can configure round count.',
      });
      return;
    }

    const rounds = parseInt(data?.rounds, 10);
    if (!isNaN(rounds) && rounds >= 3 && rounds <= 20) {
      gameState.totalRounds = rounds;
      this.gameService.broadcastLobbyUpdate(this.server);
      this.server.emit('params_updated', {
        totalRounds: gameState.totalRounds,
        countdownDuration: gameState.countdownDuration,
      });
    }
  }

  @SubscribeMessage('transfer_host')
  handleTransferHost(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;
    this.gameService.ensureActiveHost();

    if (gameState.hostIp && ip !== gameState.hostIp) {
      socket.emit('error_message', {
        message: 'Only the current Host 👑 can transfer host authority.',
      });
      return;
    }

    const targetIp = data?.targetIp;
    const targetPlayer = targetIp ? gameState.players[targetIp] : null;
    if (!targetPlayer || targetPlayer.connected !== true) {
      socket.emit('error_message', {
        message: 'Cannot transfer host: targeted operative is not connected.',
      });
      return;
    }

    const prevHostName = gameState.players[ip]?.username || 'Host';
    gameState.hostIp = targetIp;
    gameState.lastHostUsername = targetPlayer.username;

    this.server.emit('host_transferred', {
      previousHost: prevHostName,
      previousHostIp: ip,
      newHost: targetPlayer.username,
      newHostIp: targetIp,
    });

    this.gameService.broadcastLobbyUpdate(this.server);
  }

  @SubscribeMessage('claim_host')
  handleClaimHost(@ConnectedSocket() socket: Socket) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;
    this.gameService.ensureActiveHost();

    if (
      gameState.hostIp &&
      gameState.players[gameState.hostIp]?.connected === true
    ) {
      socket.emit('error_message', {
        message:
          'A host is already active. Only the current host can pass the crown.',
      });
      return;
    }

    const player = gameState.players[ip];
    if (!player || player.connected !== true) return;

    gameState.hostIp = ip;
    gameState.lastHostUsername = player.username;
    this.gameService.broadcastLobbyUpdate(this.server);
  }

  @SubscribeMessage('set_region')
  handleSetRegion(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;
    this.gameService.ensureActiveHost();

    if (!gameState.hostIp || ip !== gameState.hostIp) {
      socket.emit('error_message', {
        message: 'Only the host can change map region.',
      });
      return;
    }

    const region = String(data?.region || 'all').toLowerCase();
    gameState.selectedRegion = region;
    this.server.emit('region_updated', { selectedRegion: gameState.selectedRegion });
    this.gameService.broadcastLobbyUpdate(this.server);
  }

  @SubscribeMessage('set_difficulty')
  handleSetDifficulty(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;
    this.gameService.ensureActiveHost();

    if (!gameState.hostIp || ip !== gameState.hostIp) {
      socket.emit('error_message', {
        message: 'Only the host can configure difficulty.',
      });
      return;
    }

    const diff = String(data?.difficulty || 'all').toLowerCase();
    if (['all', 'easy', 'medium', 'hard'].includes(diff)) {
      gameState.difficulty = diff;
      this.gameService.broadcastLobbyUpdate(this.server);
      this.server.emit('difficulty_updated', { difficulty: gameState.difficulty });
    }
  }

  @SubscribeMessage('host_share_image')
  handleHostShareImage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;
    this.gameService.ensureActiveHost();

    if (!gameState.hostIp || ip !== gameState.hostIp) {
      socket.emit('error_message', {
        message: 'Only the Host can fetch and share recon images.',
      });
      return;
    }

    if (
      gameState.status !== 'ROUND_ACTIVE' &&
      gameState.status !== 'ROUND_COUNTDOWN'
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

    gameState.currentSharedImage = data.image;
    gameState.sharedImageTimestamp = Date.now();
    gameState.sharedImageCaption =
      typeof data.caption === 'string' ? data.caption.slice(0, 100) : '';

    this.server.emit('shared_image_updated', {
      image: gameState.currentSharedImage,
      caption: gameState.sharedImageCaption,
      timestamp: gameState.sharedImageTimestamp,
      hostUsername: gameState.players[ip]?.username || 'Host',
    });
  }

  @SubscribeMessage('join_game')
  handleJoinGame(@ConnectedSocket() socket: Socket) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;
    const player = gameState.players[ip];

    if (!player) {
      socket.emit('error_message', { message: 'Please set your username first.' });
      return;
    }

    if (gameState.status === 'LOBBY') {
      socket.emit('error_message', {
        message: 'Match has not started yet. Waiting in lobby.',
      });
      return;
    }

    player.inGame = true;
    player.connected = true;
    player.socketId = socket.id;

    const inGamePlayers = Object.values(gameState.players).filter(
      (p) => p.connected && p.inGame !== false,
    );
    const guessedCount = inGamePlayers.filter((p) => p.hasGuessed).length;
    const totalPlayers = inGamePlayers.length;

    if (
      gameState.status === 'ROUND_ACTIVE' ||
      gameState.status === 'ROUND_COUNTDOWN'
    ) {
      socket.emit('round_started', {
        round: gameState.currentRound,
        totalRounds: gameState.totalRounds,
        difficulty: gameState.roundTarget?.difficulty || gameState.difficulty,
        uplinkToken: gameState.roundUplinkToken || null,
        sharedImage: gameState.currentSharedImage || null,
        guessedCount,
        totalPlayers,
        countdownSeconds: gameState.countdownSeconds,
        firstGuesserName: gameState.firstGuesserName,
        isHost: ip === gameState.hostIp,
        hostIp: gameState.hostIp,
      });
    } else if (gameState.status === 'ROUND_RESULTS') {
      socket.emit('round_results', gameState.lastRoundResults);
    } else if (gameState.status === 'GAME_OVER') {
      socket.emit('game_over', gameState.lastGameOver);
    }

    this.server.emit('player_joined', {
      username: player.username,
      ip: player.ip,
      totalPlayers,
    });
  }

  @SubscribeMessage('start_game')
  async handleStartGame(@ConnectedSocket() socket: Socket) {
    const ip = getClientIp(socket);
    const res = await this.gameService.startGame(ip, this.server);
    if (!res.success && res.error) {
      socket.emit('error_message', { message: res.error });
    }
  }

  @SubscribeMessage('stop_game')
  handleStopGame(@ConnectedSocket() socket: Socket) {
    const ip = getClientIp(socket);
    const res = this.gameService.stopGame(ip, this.server);
    if (!res.success && res.error) {
      socket.emit('error_message', { message: res.error });
    }
  }

  @SubscribeMessage('leave_game')
  handleLeaveGame(@ConnectedSocket() socket: Socket) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;
    const player = gameState.players[ip];
    const username = player?.username || 'A player';

    const wasHost = ip === gameState.hostIp;
    const otherConnected = Object.values(gameState.players).filter(
      (p) => p && p.connected === true && p.ip !== ip,
    );

    if (wasHost || otherConnected.length === 0) {
      if (gameState.countdownInterval) {
        clearInterval(gameState.countdownInterval);
        gameState.countdownInterval = null;
      }
      gameState.status = 'LOBBY';
      gameState.currentRound = 0;
      gameState.selectedLocations = [];
      gameState.roundTarget = null;
      gameState.roundUplinkToken = null;
      gameState.countdownSeconds = null;
      gameState.firstGuesserName = null;
      gameState.lastRoundResults = null;
      gameState.lastGameOver = null;

      for (const p of Object.values(gameState.players)) {
        p.totalScore = 0;
        p.currentPin = null;
        p.lockedGuess = null;
        p.hasGuessed = false;
        p.lastRoundScore = 0;
        p.lastRoundDistanceKm = null;
        p.inGame = true;
      }

      this.server.emit('game_stopped', {
        message: wasHost ? 'Host returned match to Lobby.' : 'Returned to Lobby.',
        players: this.gameService.getLobbyPlayers(),
        hostIp: gameState.hostIp,
        selectedRegion: gameState.selectedRegion,
      });

      this.server.emit('lobby_update', {
        players: this.gameService.getLobbyPlayers(),
        hostIp: gameState.hostIp,
        selectedRegion: gameState.selectedRegion,
      });

      this.server.emit('return_to_lobby', {
        players: this.gameService.getLobbyPlayers(),
        hostIp: gameState.hostIp,
        selectedRegion: gameState.selectedRegion,
        difficulty: gameState.difficulty,
        status: gameState.status,
        currentRound: gameState.currentRound,
      });
      return;
    }

    if (player) {
      player.inGame = false;
      player.hasGuessed = true;
    }

    socket.emit('return_to_lobby', {
      players: this.gameService.getLobbyPlayers(),
      hostIp: gameState.hostIp,
      selectedRegion: gameState.selectedRegion,
      difficulty: gameState.difficulty,
      status: gameState.status,
      currentRound: gameState.currentRound,
    });

    const activeInGame = Object.values(gameState.players).filter(
      (p) => p.connected && p.inGame !== false,
    );

    this.server.emit('player_left', {
      username,
      ip,
      remainingCount: activeInGame.length,
      hostIp: gameState.hostIp,
    });

    this.gameService.broadcastLobbyUpdate(this.server);

    if (
      gameState.status === 'ROUND_ACTIVE' ||
      gameState.status === 'ROUND_COUNTDOWN'
    ) {
      this.gameService.checkAllGuessed(this.server);
    }
  }

  @SubscribeMessage('update_pin')
  handleUpdatePin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;

    if (
      gameState.status !== 'ROUND_ACTIVE' &&
      gameState.status !== 'ROUND_COUNTDOWN'
    ) {
      return;
    }

    const player = gameState.players[ip];
    if (!player || player.hasGuessed || !player.connected) return;

    if (data && typeof data === 'object') {
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        player.currentPin = {
          lat: Math.round(lat * 1000000) / 1000000,
          lng: Math.round(lng * 1000000) / 1000000,
        };
      }
    }
  }

  @SubscribeMessage('lock_guess')
  handleLockGuess(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    const ip = getClientIp(socket);
    const gameState = this.gameService.state;

    if (
      gameState.status !== 'ROUND_ACTIVE' &&
      gameState.status !== 'ROUND_COUNTDOWN'
    ) {
      socket.emit('error_message', {
        message: 'Cannot lock guess: expedition round is not currently active.',
      });
      return;
    }

    const player = gameState.players[ip];
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
    if (
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
      } else {
        socket.emit('error_message', {
          message:
            'Invalid coordinates: Please place a valid pin on the map first.',
        });
        return;
      }
    } else if (
      player.currentPin &&
      typeof player.currentPin.lat === 'number' &&
      Number.isFinite(player.currentPin.lat) &&
      typeof player.currentPin.lng === 'number' &&
      Number.isFinite(player.currentPin.lng)
    ) {
      coords = player.currentPin;
    }

    if (!coords) {
      socket.emit('error_message', {
        message: 'Please place a valid pin on the map first.',
      });
      return;
    }

    // Anti-Cheat: Detect impossible programmatic coordinate injection
    const target = gameState.roundTarget;
    if (
      target &&
      Math.abs(coords.lat - target.lat) < 0.0000001 &&
      Math.abs(coords.lng - target.lng) < 0.0000001
    ) {
      this.logger.warn(
        `[ANTI-CHEAT] Detected programmatic coordinate injection from ${player.username} (${ip})!`,
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

    const activeInGame = Object.values(gameState.players).filter(
      (p) => p && p.connected === true && p.inGame !== false,
    );
    const guessedCount = activeInGame.filter((p) => p.hasGuessed).length;
    const totalPlayers = Object.values(gameState.players).filter(
      (p) => p && p.connected === true,
    ).length;

    this.logger.log(`${player.username} locked guess (${guessedCount}/${totalPlayers})`);

    this.server.emit('player_guessed', {
      username: player.username,
      ip: player.ip,
      guessedCount,
      totalPlayers,
    });

    if (gameState.status === 'ROUND_ACTIVE') {
      gameState.status = 'ROUND_COUNTDOWN';
      const duration = gameState.countdownDuration || 20;
      gameState.countdownSeconds = duration;
      gameState.firstGuesserName = player.username;

      this.logger.log(
        `First guess by ${player.username}! ${duration}s countdown started.`,
      );
      this.server.emit('countdown_started', {
        seconds: duration,
        triggeredBy: player.username,
      });

      if (gameState.countdownInterval) clearInterval(gameState.countdownInterval);
      gameState.countdownInterval = setInterval(() => {
        if (gameState.countdownSeconds !== null) {
          gameState.countdownSeconds--;
          this.server.emit('timer_tick', { seconds: gameState.countdownSeconds });

          if (gameState.countdownSeconds <= 0) {
            clearInterval(gameState.countdownInterval!);
            gameState.countdownInterval = null;
            this.logger.log(`${duration}s countdown expired. Ending round.`);
            this.gameService.endRound(this.server);
          }
        }
      }, 1000);
    }

    this.gameService.checkAllGuessed(this.server);
  }

  @SubscribeMessage('next_round')
  handleNextRound() {
    this.gameService.nextRound(this.server);
  }

  @SubscribeMessage('reset_to_lobby')
  handleResetToLobby(@ConnectedSocket() socket: Socket) {
    this.gameService.resetToLobby(socket, this.server);
  }
}
