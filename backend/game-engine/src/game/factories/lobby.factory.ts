import { GameRoom, Player } from '../game.types';

export function createGameRoom(
  id: string,
  name: string,
  hostId: string,
  hostIp: string,
  hostSocketId: string,
  hostName: string,
  data?: any,
): GameRoom {
  return {
    id,
    name,
    status: 'LOBBY',
    hostId,
    hostIp,
    hostSocketId,
    hostName,
    lastHostUsername: hostName,
    currentRound: 0,
    totalRounds: data?.totalRounds || 5,
    countdownDuration: data?.countdownDuration || 20,
    selectedRegion: data?.selectedRegion || 'all',
    difficulty: data?.difficulty || 'all',
    maxPlayers: data?.maxPlayers || 8,
    players: {},
    pendingAdmissions: {},
    selectedLocations: [],
    roundTarget: null,
    roundUplinkToken: null,
    countdownSeconds: null,
    countdownInterval: null,
    firstGuesserName: null,
    lastRoundResults: null,
    lastGameOver: null,
    currentSharedImage: null,
    sharedImageTimestamp: null,
    sharedImageCaption: '',
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
    ip,
    socketId,
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
