export interface Coords {
  lat: number;
  lng: number;
}

export interface Player {
  id?: string;
  ip: string;
  socketId: string;
  username: string;
  clientPublicKey?: string;
  serverPublicKey?: string;
  serverPrivateKey?: string;
  aesKey?: Buffer;
  connected: boolean;
  totalScore: number;
  currentPin: Coords | null;
  lockedGuess: Coords | null;
  hasGuessed: boolean;
  lastRoundScore: number;
  lastRoundDistanceKm: number | null;
  inGame: boolean;
  sessionToken?: string;
  isRefreshing?: boolean;
  lastDisconnectedAt?: number;
}

export interface PendingAdmission {
  ip: string;
  socketId: string;
  username: string;
  requestedAt: number;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  label: string;
  country?: string;
  region?: string;
  difficulty?: string;
}

export type GameStatus =
  | 'LOBBY'
  | 'ROUND_ACTIVE'
  | 'ROUND_COUNTDOWN'
  | 'ROUND_RESULTS'
  | 'GAME_OVER';

export interface GameRoom {
  id: string;
  name: string;
  hostIp: string | null;
  hostName: string | null;
  hostSocketId?: string | null;
  hostId?: string | null;
  hostHeartbeat?: number;
  lastHostUsername: string | null;
  status: GameStatus;
  currentRound: number;
  totalRounds: number;
  countdownDuration: number;
  selectedRegion: string;
  difficulty: string;
  selectedLocations: GeoLocation[];
  roundTarget: GeoLocation | null;
  roundUplinkToken: string | null;
  roadToken?: string | null;
  currentSharedImage: string | null;
  sharedImageTimestamp: number | null;
  sharedImageCaption: string;
  countdownSeconds: number | null;
  countdownInterval: NodeJS.Timeout | null;
  firstGuesserName: string | null;
  lastRoundResults: any;
  lastGameOver: any;
  players: Record<string, Player>;
  pendingAdmissions: Record<string, PendingAdmission>;
  maxPlayers: number;
  createdAt: number;
}

export type GameState = GameRoom;

export interface LobbySummary {
  id: string;
  name: string;
  hostName: string;
  hostIp: string | null;
  playerCount: number;
  maxPlayers: number;
  selectedRegion: string;
  difficulty: string;
  totalRounds: number;
  status: GameStatus;
  ping: number;
}
