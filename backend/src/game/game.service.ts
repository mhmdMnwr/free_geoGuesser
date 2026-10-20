import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { Server, Socket } from 'socket.io';
import {
  GameState,
  Player,
  PendingAdmission,
  GeoLocation,
  Coords,
} from './game.types';
import {
  calculateDistanceKm,
  calculateScore,
  selectDiverseMatchLocations,
} from './game.helpers';
import { GeoDatabaseService } from '../geo-database/geo-database.service';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  public readonly state: GameState = {
    status: 'LOBBY',
    currentRound: 0,
    totalRounds: 10,
    countdownDuration: 20,
    selectedRegion: 'all',
    difficulty: 'all',
    selectedLocations: [],
    roundTarget: null,
    roundUplinkToken: null,
    currentSharedImage: null,
    sharedImageTimestamp: null,
    sharedImageCaption: '',
    countdownSeconds: null,
    countdownInterval: null,
    firstGuesserName: null,
    lastRoundResults: null,
    lastGameOver: null,
    hostIp: null,
    lastHostUsername: null,
    players: {},
    pendingAdmissions: {},
  };

  constructor(private readonly geoDb: GeoDatabaseService) {}

  ensureActiveHost(): string | null {
    const connected = Object.values(this.state.players).filter(
      (p) => p && p.connected === true,
    );
    if (connected.length === 0) {
      this.state.hostIp = null;
      return null;
    }
    // Check if current host is still valid and connected
    if (
      !this.state.hostIp ||
      !this.state.players[this.state.hostIp] ||
      this.state.players[this.state.hostIp].connected !== true
    ) {
      // If a loopback / localhost player is connected on server machine, prioritize as host
      const localPlayer = connected.find(
        (p) => p.ip === '127.0.0.1' || p.ip === 'localhost',
      );
      this.state.hostIp = localPlayer ? localPlayer.ip : connected[0].ip;
    }
    return this.state.hostIp;
  }

  getLobbyPlayers() {
    this.ensureActiveHost();
    return Object.values(this.state.players)
      .filter((p) => p && p.connected === true)
      .map((p) => ({
        ip: p.ip,
        username: p.username,
        connected: p.connected,
        totalScore: p.totalScore,
        isHost: p.ip === this.state.hostIp,
      }));
  }

  broadcastLobbyUpdate(server: Server) {
    this.ensureActiveHost();
    server.emit('lobby_update', {
      players: this.getLobbyPlayers(),
      hostIp: this.state.hostIp,
      selectedRegion: this.state.selectedRegion,
      difficulty: this.state.difficulty,
      totalRounds: this.state.totalRounds,
      countdownDuration: this.state.countdownDuration,
      pendingAdmissions: Object.values(this.state.pendingAdmissions),
      gameStatus: {
        status: this.state.status,
        currentRound: this.state.currentRound,
        totalRounds: this.state.totalRounds,
      },
    });
  }

  startRound(roundNumber: number, server: Server) {
    if (this.state.countdownInterval) {
      clearInterval(this.state.countdownInterval);
      this.state.countdownInterval = null;
    }

    this.state.status = 'ROUND_ACTIVE';
    this.state.currentRound = roundNumber;
    this.state.roundTarget = this.state.selectedLocations[roundNumber - 1];
    this.state.countdownSeconds = null;
    this.state.firstGuesserName = null;

    // Reset player states for the new round
    for (const ip of Object.keys(this.state.players)) {
      const p = this.state.players[ip];
      p.currentPin = null;
      p.lockedGuess = null;
      p.hasGuessed = false;
      p.lastRoundScore = 0;
      p.lastRoundDistanceKm = null;
    }

    const activePlayers = Object.values(this.state.players).filter(
      (p) => p.connected && p.inGame !== false,
    );

    this.logger.log(
      `Starting Round ${roundNumber}/${this.state.totalRounds}: ${this.state.roundTarget?.label} (${this.state.roundTarget?.region || 'global'})`,
    );

    // Generate an ephemeral one-time token for this round's uplink
    this.state.roundUplinkToken = crypto.randomBytes(16).toString('hex');
    this.state.currentSharedImage = null;
    this.state.sharedImageTimestamp = null;
    this.state.sharedImageCaption = '';

    // Anti-Cheat: Strictly omit target coordinates from WebSocket payload to prevent network snooping
    server.emit('round_started', {
      round: roundNumber,
      totalRounds: this.state.totalRounds,
      difficulty: this.state.roundTarget?.difficulty || this.state.difficulty,
      uplinkToken: this.state.roundUplinkToken,
      sharedImage: null,
      guessedCount: 0,
      totalPlayers: activePlayers.length,
      hostIp: this.state.hostIp,
    });
  }

  endRound(server: Server) {
    if (this.state.countdownInterval) {
      clearInterval(this.state.countdownInterval);
      this.state.countdownInterval = null;
    }
    this.state.countdownSeconds = null;
    this.state.status = 'ROUND_RESULTS';

    const target = this.state.roundTarget;
    if (!target) return;

    // Compute distances and scores
    for (const ip of Object.keys(this.state.players)) {
      const player = this.state.players[ip];
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

    // Build sorted results
    const sortedPlayers = Object.values(this.state.players)
      .filter((p) => p && p.connected === true && p.inGame !== false)
      .sort((a, b) => b.totalScore - a.totalScore);
    const results = sortedPlayers.map((p) => ({
      username: p.username,
      ip: p.ip,
      guessCoords: p.lockedGuess,
      distanceKm: p.lastRoundDistanceKm,
      roundScore: p.lastRoundScore,
      totalScore: p.totalScore,
      hasGuessed: !!p.lockedGuess,
      connected: true,
      isHost: p.ip === this.state.hostIp,
    }));

    // Identify closest guesser
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
      round: this.state.currentRound,
      totalRounds: this.state.totalRounds,
      target: {
        lat: target.lat,
        lng: target.lng,
        label: target.label,
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
      hostIp: this.state.hostIp,
    };

    this.state.lastRoundResults = payload;
    this.logger.log(
      `Round ${this.state.currentRound} ended. Closest: ${closestPlayer?.username || 'None'} (${closestPlayer?.distanceKm || 0} km). Top score: ${results[0]?.username} (${results[0]?.totalScore} pts)`,
    );
    server.emit('round_results', payload);
  }

  checkAllGuessed(server: Server) {
    const activePlayers = Object.values(this.state.players).filter(
      (p) => p.connected && p.inGame !== false,
    );
    if (activePlayers.length === 0) return;
    const allGuessed = activePlayers.every((p) => p.hasGuessed);
    if (allGuessed) {
      this.logger.log('All active players have guessed! Ending round immediately.');
      if (this.state.countdownInterval) {
        clearInterval(this.state.countdownInterval);
        this.state.countdownInterval = null;
      }
      this.endRound(server);
    }
  }

  async startGame(ip: string, server: Server): Promise<{ success: boolean; error?: string }> {
    if (this.state.status !== 'LOBBY') return { success: false, error: 'Match already active' };

    this.ensureActiveHost();

    const registeredPlayers = Object.values(this.state.players).filter(
      (p) => p && p.connected === true,
    );
    if (registeredPlayers.length === 0) {
      return { success: false, error: 'At least 1 player must join before starting.' };
    }

    if (!this.state.hostIp || ip !== this.state.hostIp) {
      return { success: false, error: 'Only the host can commence the match.' };
    }

    this.logger.log(
      `Starting game with ${registeredPlayers.length} players! Region: ${this.state.selectedRegion}, Diff: ${this.state.difficulty}`,
    );

    let pool = await this.geoDb.getLocations({
      region: this.state.selectedRegion,
      difficulty: this.state.difficulty,
    });

    if (!pool || pool.length < this.state.totalRounds) {
      this.logger.warn(
        `Insufficient locations for region=${this.state.selectedRegion} diff=${this.state.difficulty} (${pool ? pool.length : 0}), broadening search`,
      );
      pool = await this.geoDb.getLocations({
        region: this.state.selectedRegion,
        difficulty: 'all',
      });
      if (!pool || pool.length < this.state.totalRounds) {
        pool = this.geoDb.getAllInMemoryLocations();
      }
    }

    this.state.selectedLocations = selectDiverseMatchLocations(
      pool,
      this.state.totalRounds,
    );

    for (const p of Object.values(this.state.players)) {
      p.totalScore = 0;
      p.lastRoundScore = 0;
      p.lastRoundDistanceKm = null;
      p.hasGuessed = false;
      p.lockedGuess = null;
      p.currentPin = null;
      p.inGame = true;
    }

    this.startRound(1, server);
    return { success: true };
  }

  stopGame(ip: string, server: Server): { success: boolean; error?: string } {
    this.ensureActiveHost();
    if (!this.state.hostIp || ip !== this.state.hostIp) {
      return { success: false, error: 'Only the host can stop the game.' };
    }

    this.logger.log(`Host (${this.state.players[ip]?.username || ip}) stopped the match.`);
    if (this.state.countdownInterval) {
      clearInterval(this.state.countdownInterval);
      this.state.countdownInterval = null;
    }

    this.state.status = 'LOBBY';
    this.state.currentRound = 0;
    this.state.selectedLocations = [];
    this.state.roundTarget = null;
    this.state.roundUplinkToken = null;
    this.state.countdownSeconds = null;
    this.state.firstGuesserName = null;
    this.state.lastRoundResults = null;
    this.state.lastGameOver = null;

    for (const p of Object.values(this.state.players)) {
      p.totalScore = 0;
      p.currentPin = null;
      p.lockedGuess = null;
      p.hasGuessed = false;
      p.lastRoundScore = 0;
      p.lastRoundDistanceKm = null;
      p.inGame = true;
    }

    server.emit('game_stopped', {
      message: 'The host has stopped the game. Returned to Lobby.',
      players: this.getLobbyPlayers(),
      hostIp: this.state.hostIp,
      selectedRegion: this.state.selectedRegion,
    });
    server.emit('return_to_lobby', {
      players: this.getLobbyPlayers(),
      hostIp: this.state.hostIp,
      selectedRegion: this.state.selectedRegion,
      difficulty: this.state.difficulty,
      status: 'LOBBY',
      currentRound: 0,
    });

    return { success: true };
  }

  nextRound(server: Server) {
    if (this.state.status !== 'ROUND_RESULTS') return;

    if (this.state.currentRound < this.state.totalRounds) {
      this.startRound(this.state.currentRound + 1, server);
    } else {
      this.state.status = 'GAME_OVER';
      const sortedPlayers = Object.values(this.state.players)
        .filter((p) => p && p.connected === true)
        .sort((a, b) => b.totalScore - a.totalScore);
      const leaderboard = sortedPlayers.map((p) => ({
        username: p.username,
        ip: p.ip,
        totalScore: p.totalScore,
        connected: true,
      }));

      const payload = { leaderboard, hostIp: this.state.hostIp };
      this.state.lastGameOver = payload;
      this.logger.log('Game Over! Final Standings:', leaderboard);
      server.emit('game_over', payload);
    }
  }

  resetToLobby(socket: Socket, server: Server) {
    if (this.state.status === 'LOBBY') {
      socket.emit('return_to_lobby', {
        players: this.getLobbyPlayers(),
        hostIp: this.state.hostIp,
        selectedRegion: this.state.selectedRegion,
        difficulty: this.state.difficulty,
        status: 'LOBBY',
        currentRound: 0,
      });
      return;
    }

    this.logger.log('Resetting match to LOBBY. New players can now join.');
    if (this.state.countdownInterval) {
      clearInterval(this.state.countdownInterval);
      this.state.countdownInterval = null;
    }

    this.state.status = 'LOBBY';
    this.state.currentRound = 0;
    this.state.selectedLocations = [];
    this.state.roundTarget = null;
    this.state.roundUplinkToken = null;
    this.state.countdownSeconds = null;
    this.state.firstGuesserName = null;
    this.state.lastRoundResults = null;
    this.state.lastGameOver = null;

    for (const p of Object.values(this.state.players)) {
      p.totalScore = 0;
      p.currentPin = null;
      p.lockedGuess = null;
      p.hasGuessed = false;
      p.lastRoundScore = 0;
      p.lastRoundDistanceKm = null;
      p.inGame = true;
    }

    this.broadcastLobbyUpdate(server);
    server.emit('return_to_lobby', {
      players: this.getLobbyPlayers(),
      hostIp: this.state.hostIp,
      selectedRegion: this.state.selectedRegion,
      difficulty: this.state.difficulty,
      status: 'LOBBY',
      currentRound: 0,
    });
  }
}
