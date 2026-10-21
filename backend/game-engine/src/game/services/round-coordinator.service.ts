import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import * as crypto from 'crypto';
import { GameRoom, Player } from '../game.types';
import { ScoringService } from './scoring.service';
import { RedisService } from '../../redis/redis.service';
import { GeoLocation } from '../../geo-database/geo-database.service';
import { RoomStoreService } from './room-store.service';

@Injectable()
export class RoundCoordinatorService {
  private readonly logger = new Logger(RoundCoordinatorService.name);

  constructor(
    private readonly scoring: ScoringService,
    private readonly redis: RedisService,
    private readonly roomStore: RoomStoreService,
  ) {}

  selectDiverseLocations(pool: GeoLocation[], count: number): GeoLocation[] {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected: GeoLocation[] = [];
    const usedCountries = new Set<string>();

    for (const loc of shuffled) {
      if (!usedCountries.has(loc.country)) {
        selected.push(loc);
        usedCountries.add(loc.country);
        if (selected.length === count) break;
      }
    }
    if (selected.length < count) {
      for (const loc of shuffled) {
        if (!selected.includes(loc)) {
          selected.push(loc);
          if (selected.length === count) break;
        }
      }
    }
    return selected;
  }

  async startRound(roundNumber: number, server: Server, room: GameRoom) {
    room.status = 'ROUND_ACTIVE';
    room.currentRound = roundNumber;
    room.roundTarget = room.selectedLocations[roundNumber - 1] || null;
    room.roundUplinkToken = crypto.randomBytes(16).toString('hex');
    room.roadToken = `road_${crypto.randomBytes(12).toString('hex')}`;
    room.currentSharedImage = null;
    room.sharedImageTimestamp = null;
    room.sharedImageCaption = '';

    if (room.roundTarget) {
      await this.redis.setRoundTarget(
        room.id,
        room.roundUplinkToken,
        { lat: room.roundTarget.lat, lng: room.roundTarget.lng },
      );
    }

    for (const p of Object.values(room.players)) {
      p.currentPin = null;
      p.lockedGuess = null;
      p.hasGuessed = false;
      p.lastRoundScore = 0;
      p.lastRoundDistanceKm = null;
    }

    const activePlayers = Object.values(room.players).filter((p) => p.connected && p.inGame !== false);
    const players = activePlayers.map((p) => ({
      id: p.id || p.ip,
      username: p.username,
      ip: p.ip,
      totalScore: p.totalScore || 0,
      hasGuessed: false,
      isHost: (room.hostId && p.id === room.hostId) || (!room.hostId && p.ip === room.hostIp),
      connected: p.connected,
    }));

    const payload = {
      roomId: room.id,
      round: roundNumber,
      totalRounds: room.totalRounds,
      difficulty: room.roundTarget?.difficulty || room.difficulty,
      uplinkToken: room.roundUplinkToken,
      roadToken: room.roadToken || null,
      sharedImage: null,
      guessedCount: 0,
      totalPlayers: activePlayers.length,
      hostIp: room.hostIp,
      players,
    };

    server.to(room.id).emit('round_started', payload);
    server.emit('lobbies_list', this.roomStore.getLobbiesList());
  }

  endRound(server: Server, room: GameRoom) {
    room.status = 'ROUND_RESULTS';
    const target = room.roundTarget;
    if (!target) return;

    for (const player of Object.values(room.players)) {
      const finalCoords = player.lockedGuess || player.currentPin || null;
      if (finalCoords) {
        const dist = this.scoring.calculateDistanceKm(
          target.lat,
          target.lng,
          finalCoords.lat,
          finalCoords.lng,
        );
        const score = this.scoring.calculateScore(dist);
        player.lastRoundDistanceKm = Math.round(dist * 10) / 10;
        player.lastRoundScore = score;
        player.lockedGuess = finalCoords;
      } else {
        player.lastRoundDistanceKm = null;
        player.lastRoundScore = 0;
      }
      player.totalScore = (player.totalScore || 0) + player.lastRoundScore;
    }

    const activePlayers = Object.values(room.players).filter((p) => p.connected && p.inGame !== false);
    const results = activePlayers.map((p) => ({
      id: p.id || p.ip,
      ip: p.ip,
      username: p.username,
      guess: p.lockedGuess,
      guessCoords: p.lockedGuess,
      coords: p.lockedGuess,
      distanceKm: p.lastRoundDistanceKm,
      roundScore: p.lastRoundScore,
      totalScore: p.totalScore,
      isHost: (room.hostId && p.id === room.hostId) || (!room.hostId && p.ip === room.hostIp),
    }));

    const guessersWithDist = activePlayers
      .filter((p) => p.lastRoundDistanceKm !== null)
      .sort((a, b) => a.lastRoundDistanceKm! - b.lastRoundDistanceKm!);

    const closestPlayer = guessersWithDist.length > 0 ? guessersWithDist[0] : null;

    const targetData = {
      lat: target.lat,
      lng: target.lng,
      label: target.label,
      country: target.country,
      region: target.region,
    };

    const payload = {
      roomId: room.id,
      round: room.currentRound,
      totalRounds: room.totalRounds,
      target: targetData,
      targetLocation: targetData,
      results,
      leaderboard: [...results].sort((a, b) => b.totalScore - a.totalScore),
      closestPlayer: closestPlayer
        ? {
            username: closestPlayer.username,
            distanceKm: closestPlayer.lastRoundDistanceKm,
            score: closestPlayer.lastRoundScore,
            guess: closestPlayer.lockedGuess,
            coords: closestPlayer.lockedGuess,
          }
        : null,
      hostIp: room.hostIp,
    };

    room.lastRoundResults = payload;
    server.to(room.id).emit('round_results', payload);
    server.emit('lobbies_list', this.roomStore.getLobbiesList());
  }
}
