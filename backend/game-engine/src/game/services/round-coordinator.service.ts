import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import * as crypto from 'crypto';
import { GameRoom, Player } from '../game.types';
import { ScoringService } from './scoring.service';
import { RedisService } from '../../redis/redis.service';
import { GeoLocation, COUNTRY_TIER_WEIGHTS } from '../../geo-database/geo-database.service';
import { RoomStoreService } from './room-store.service';
import { TimerService } from './timer.service';
import { toPublicPlayerId } from '../factories/lobby.factory';

@Injectable()
export class RoundCoordinatorService {
  private readonly logger = new Logger(RoundCoordinatorService.name);

  constructor(
    private readonly scoring: ScoringService,
    private readonly redis: RedisService,
    private readonly roomStore: RoomStoreService,
    private readonly timerService: TimerService,
  ) {}

  private extractSubRegionKey(loc: GeoLocation): string {
    const label = loc.label || '';
    if (label.startsWith('Road in ')) {
      return label.slice(8).trim();
    }
    const parts = label.split(',').map((s) => s.trim());
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return label || loc.country;
  }

  private pickWeightedCountry(countries: string[]): string {
    const weights = countries.map((c) => COUNTRY_TIER_WEIGHTS[c] ?? 1.5);
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < countries.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return countries[i];
    }
    return countries[countries.length - 1];
  }

  private pickFromCountryStratified(candidates: GeoLocation[]): GeoLocation {
    const bySubRegion = new Map<string, GeoLocation[]>();
    for (const loc of candidates) {
      const sub = this.extractSubRegionKey(loc);
      let list = bySubRegion.get(sub);
      if (!list) {
        list = [];
        bySubRegion.set(sub, list);
      }
      list.push(loc);
    }
    const subKeys = Array.from(bySubRegion.keys());
    const chosenSub = subKeys[Math.floor(Math.random() * subKeys.length)];
    const bucket = bySubRegion.get(chosenSub)!;
    return bucket[Math.floor(Math.random() * bucket.length)];
  }

  selectDiverseLocations(
    pool: GeoLocation[],
    count: number,
    recentKeys?: Set<string>,
    options?: { region?: string; difficulty?: string },
  ): GeoLocation[] {
    if (!pool || pool.length === 0 || count <= 0) return [];

    const locKey = (l: GeoLocation) => `${l.lat.toFixed(4)},${l.lng.toFixed(4)}`;
    const freshPool =
      recentKeys && recentKeys.size > 0
        ? pool.filter((l) => !recentKeys.has(locKey(l)))
        : pool;
    const candidatePool = freshPool.length >= count ? freshPool : pool;

    // Group candidate pool by country
    const byCountry = new Map<string, GeoLocation[]>();
    const countryRegion = new Map<string, string>();
    for (const loc of candidatePool) {
      const country = loc.country || 'Unknown';
      let list = byCountry.get(country);
      if (!list) {
        list = [];
        byCountry.set(country, list);
        countryRegion.set(country, (loc.region || 'europe').toLowerCase());
      }
      list.push(loc);
    }

    const availableRegions = Array.from(new Set(countryRegion.values()));
    // Shuffle continents for worldwide rotation
    const continentOrder = [...availableRegions].sort(() => Math.random() - 0.5);
    const difficultyCycle = ['easy', 'easy', 'medium', 'medium', 'hard'];
    const isMixedDifficulty = !options?.difficulty || options.difficulty === 'all';

    const selected: GeoLocation[] = [];
    const selectedSet = new Set<GeoLocation>();
    const usedCountries = new Set<string>();

    for (let i = 0; i < count; i++) {
      const targetContinent = continentOrder[i % continentOrder.length];
      const targetDiff = isMixedDifficulty
        ? difficultyCycle[i % difficultyCycle.length]
        : options!.difficulty!.toLowerCase();

      const allUnusedCountries = Array.from(byCountry.keys()).filter(
        (c) => !usedCountries.has(c),
      );
      const baseCountries =
        allUnusedCountries.length > 0 ? allUnusedCountries : Array.from(byCountry.keys());

      // 1. Try matching both targetContinent & targetDiff
      let eligibleCountries = baseCountries.filter((c) => {
        if (availableRegions.length > 1 && countryRegion.get(c) !== targetContinent) {
          return false;
        }
        const locs = byCountry.get(c)!;
        return locs.some(
          (l) => !selectedSet.has(l) && (!isMixedDifficulty || l.difficulty === targetDiff),
        );
      });

      // 2. Fallback: match targetContinent with any difficulty
      if (eligibleCountries.length === 0 && availableRegions.length > 1) {
        eligibleCountries = baseCountries.filter(
          (c) =>
            countryRegion.get(c) === targetContinent &&
            byCountry.get(c)!.some((l) => !selectedSet.has(l)),
        );
      }

      // 3. Fallback: match any unused country with targetDiff
      if (eligibleCountries.length === 0 && isMixedDifficulty) {
        eligibleCountries = baseCountries.filter((c) =>
          byCountry.get(c)!.some((l) => !selectedSet.has(l) && l.difficulty === targetDiff),
        );
      }

      // 4. Final fallback: any country with unselected locations
      if (eligibleCountries.length === 0) {
        eligibleCountries = baseCountries.filter((c) =>
          byCountry.get(c)!.some((l) => !selectedSet.has(l)),
        );
      }

      if (eligibleCountries.length === 0) break;

      const chosenCountry = this.pickWeightedCountry(eligibleCountries);
      usedCountries.add(chosenCountry);

      const countryLocs = byCountry.get(chosenCountry)!.filter((l) => !selectedSet.has(l));
      const diffMatchedLocs = isMixedDifficulty
        ? countryLocs.filter((l) => l.difficulty === targetDiff)
        : countryLocs;
      const finalCountryCandidates =
        diffMatchedLocs.length > 0 ? diffMatchedLocs : countryLocs;

      const chosenLoc = this.pickFromCountryStratified(finalCountryCandidates);
      selected.push(chosenLoc);
      selectedSet.add(chosenLoc);
    }

    if (recentKeys) {
      for (const loc of selected) {
        recentKeys.add(locKey(loc));
      }
    }
    return selected;
  }

  async startRound(roundNumber: number, server: Server, room: GameRoom) {
    this.timerService.clearCountdown(room);
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
      id: p.publicId || toPublicPlayerId(p.id || p.ip),
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

    // B5: Ensure a round where nobody guesses still ends automatically after 180s
    this.timerService.startMaxRoundTimer(room, 180, () => {
      this.endRound(server, room);
    });
  }

  endRound(server: Server, room: GameRoom) {
    // B6: Guard against duplicate execution (idempotency)
    if (room.status !== 'ROUND_ACTIVE' && room.status !== 'ROUND_COUNTDOWN') {
      return;
    }
    const target = room.roundTarget;
    if (!target) return;

    this.timerService.clearCountdown(room);
    room.status = 'ROUND_RESULTS';

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
      id: p.publicId || toPublicPlayerId(p.id || p.ip),
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
