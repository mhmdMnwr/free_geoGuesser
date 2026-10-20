export interface Coords {
  lat: number;
  lng: number;
}

export interface Player {
  ip: string;
  socketId: string;
  username: string;
  connected: boolean;
  totalScore: number;
  currentPin: Coords | null;
  lockedGuess: Coords | null;
  hasGuessed: boolean;
  lastRoundScore: number;
  lastRoundDistanceKm: number | null;
  inGame: boolean;
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

export interface GameState {
  status: GameStatus;
  currentRound: number;
  totalRounds: number;
  countdownDuration: number;
  selectedRegion: string;
  difficulty: string;
  selectedLocations: GeoLocation[];
  roundTarget: GeoLocation | null;
  roundUplinkToken: string | null;
  currentSharedImage: string | null;
  sharedImageTimestamp: number | null;
  sharedImageCaption: string;
  countdownSeconds: number | null;
  countdownInterval: NodeJS.Timeout | null;
  firstGuesserName: string | null;
  lastRoundResults: any;
  lastGameOver: any;
  hostIp: string | null;
  lastHostUsername: string | null;
  players: Record<string, Player>;
  pendingAdmissions: Record<string, PendingAdmission>;
}
