import * as crypto from 'crypto';
import { GameRoom, Player } from '../game.types';

export function toPublicPlayerId(clientId: string): string {
  const hash = crypto.createHash('sha256').update(String(clientId || '')).digest('hex').slice(0, 12);
  return `pub_${hash}`;
}

export function sanitizeText(raw: any, maxLen: number, fallback = ''): string {
  const cleaned = String(raw ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLen);
}

export function clampInt(val: any, min: number, max: number, fallback: number): number {
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function generateRoomCode(existingIds: Iterable<string>): string {
  const existing = new Set(existingIds);
  for (let i = 0; i < 50; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!existing.has(code)) return code;
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createGameRoom(
  id: string,
  name: string,
  hostId: string,
  hostIp: string,
  hostSocketId: string,
  hostName: string,
  data?: any,
): GameRoom {
  const validDifficulties = ['all', 'easy', 'medium', 'hard'];
  const rawDiff = String(data?.difficulty || 'all').toLowerCase();
  const difficulty = validDifficulties.includes(rawDiff) ? rawDiff : 'all';
  const selectedRegion = sanitizeText(data?.selectedRegion || 'all', 32, 'all').toLowerCase();
  const safeName = sanitizeText(name, 32, `Squad ${id}`);

  return {
    id,
    code: id,
    isPrivate: Boolean(data?.isPrivate),
    name: safeName,
    status: 'LOBBY',
    hostId,
    hostIp,
    hostSocketId,
    hostName,
    lastHostUsername: hostName,
    currentRound: 0,
    totalRounds: clampInt(data?.totalRounds ?? data?.rounds, 3, 20, 5),
    countdownDuration: clampInt(data?.countdownDuration ?? data?.duration, 5, 120, 20),
    selectedRegion,
    difficulty,
    maxPlayers: clampInt(data?.maxPlayers, 2, 32, 8),
    players: {},
    pendingAdmissions: {},
    selectedLocations: [],
    roundTarget: null,
    roundUplinkToken: null,
    countdownSeconds: null,
    countdownInterval: null,
    maxRoundTimeout: null,
    recentLocationKeys: new Set<string>(),
    firstGuesserName: null,
    lastRoundResults: null,
    lastGameOver: null,
    currentSharedImage: null,
    sharedImageTimestamp: null,
    sharedImageCaption: '',
    crownElection: null,
    lastCrownElectionAt: 0,
  };
}

export function createPlayer(
  id: string,
  ip: string,
  socketId: string,
  username: string,
): Player {
  return {
    id,
    publicId: toPublicPlayerId(id),
    ip,
    socketId,
    username: sanitizeText(username, 18, 'Operative'),
    connected: true,
    totalScore: 0,
    currentPin: null,
    lockedGuess: null,
    hasGuessed: false,
    lastRoundScore: 0,
    lastRoundDistanceKm: null,
    inGame: true,
  };
}

export function isCallsignTaken(
  rooms: GameRoom[],
  username: string,
  excludeClientId: string,
): boolean {
  const clean = username.trim().toLowerCase();
  return rooms.some((r) =>
    Object.values(r.players).some(
      (p) =>
        p &&
        p.connected &&
        p.id !== excludeClientId &&
        p.username?.trim().toLowerCase() === clean,
    ),
  );
}
