export interface LobbyPlayer {
  id: string;
  username: string;
  ip: string;
  isHost: boolean;
  connected: boolean;
  clientPublicKeyHex?: string;
  aesKey?: Buffer;
}

export interface LobbyMeta {
  id: string;
  name: string;
  hostId: string;
  hostIp: string;
  hostName: string;
  maxPlayers: number;
  selectedRegion: string;
  difficulty: string;
  totalRounds: number;
  status: string;
  createdAt: number;
}
