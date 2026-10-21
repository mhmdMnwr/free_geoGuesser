export class CreateLobbyDto {
  name: string;
  hostName: string;
  clientPublicKey: string;
  selectedRegion?: string;
  difficulty?: string;
  totalRounds?: number;
  maxPlayers?: number;
}

export class JoinLobbyDto {
  roomId: string;
  username: string;
  clientPublicKey: string;
}

export class HeartbeatDto {
  hostId: string;
}
