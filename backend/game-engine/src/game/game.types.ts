import { GeoLocation } from '../geo-database/geo-database.service';

export interface Player {
  id: string;
  publicId?: string;
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
  publicId?: string;
  ip: string;
  socketId: string;
  username: string;
  clientPublicKey?: string;
  requestedAt: number;
}

export interface CrownElection {
  claimantId: string;
  claimantUsername: string;
  claimantPublicId: string;
  targetHostId: string;
  targetHostUsername: string;
  phase: 'PENDING_HOST' | 'VOTING' | 'RESOLVED';
  hostTimeout?: NodeJS.Timeout | null;
  votingTimeout?: NodeJS.Timeout | null;
  votes: Record<string, boolean>;
  eligibleVoterIds: string[];
  totalEligible: number;
  startedAt: number;
}

export interface GameRoom {
  id: string;
  code?: string;
  isPrivate?: boolean;
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
  maxRoundTimeout?: NodeJS.Timeout | null;
  recentLocationKeys?: Set<string>;
  firstGuesserName: string | null;
  lastRoundResults: any | null;
  lastGameOver: any | null;
  currentSharedImage: string | null;
  sharedImageTimestamp: number | null;
  sharedImageCaption: string;
  crownElection?: CrownElection | null;
  lastCrownElectionAt?: number;
}
