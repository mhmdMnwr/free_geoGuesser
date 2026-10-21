import { GeoLocation } from '../geo-database/geo-database.service';

export interface Player {
  id: string;
  ip: string;
  socketId: string;
  username: string;
  connected: boolean;
  totalScore: number;
  currentPin: { lat: number; lng: number } | null;
  lockedGuess: { lat: number; lng: number } | null;
  hasGuessed: boolean;
  lastRoundScore: number;
  lastRoundDistanceKm: number | null;
  inGame?: boolean;
  lastDisconnectedAt?: number;
  clientPublicKeyHex?: string;
  aesKey?: Buffer;
  sessionToken?: string;
}

export interface PendingAdmission {
  clientId: string;
  ip: string;
  socketId: string;
  username: string;
  clientPublicKey?: string;
  requestedAt: number;
}

export interface GameRoom {
  id: string;
  name: string;
  status: 'LOBBY' | 'ROUND_ACTIVE' | 'ROUND_COUNTDOWN' | 'ROUND_RESULTS' | 'GAME_OVER';
  hostId: string | null;
  hostIp: string | null;
  hostSocketId: string | null;
  hostName: string | null;
  lastHostUsername?: string | null;
  currentRound: number;
  totalRounds: number;
  countdownDuration: number;
  selectedRegion: string;
  difficulty: string;
  maxPlayers: number;
  players: Record<string, Player>;
  pendingAdmissions: Record<string, PendingAdmission>;
  selectedLocations: GeoLocation[];
  roundTarget: GeoLocation | null;
  roundUplinkToken: string | null;
  roadToken?: string | null;
  countdownSeconds: number | null;
  countdownInterval: NodeJS.Timeout | null;
  firstGuesserName: string | null;
  lastRoundResults: any | null;
  lastGameOver: any | null;
  currentSharedImage: string | null;
  sharedImageTimestamp: number | null;
  sharedImageCaption: string;
}
