import { Controller, Get } from '@nestjs/common';
import { GameService } from '../game/game.service';
import { GeoDatabaseService } from '../geo-database/geo-database.service';
import { getLanAddresses } from '../game/game.helpers';

@Controller('api')
export class InfoController {
  constructor(
    private readonly gameService: GameService,
    private readonly geoDb: GeoDatabaseService,
  ) {}

  @Get('info')
  getInfo() {
    const lanIps = getLanAddresses();
    const primaryIp = lanIps.length > 0 ? lanIps[0].address : 'localhost';
    const backendPort = parseInt(process.env.PORT || '5000', 10);
    const frontendPort = parseInt(process.env.FRONTEND_PORT || '3000', 10);

    return {
      primaryIp,
      lanIps,
      port: backendPort,
      backendPort,
      frontendPort,
      joinUrl: `http://${primaryIp}:${frontendPort}`,
    };
  }

  @Get('status')
  getStatus() {
    const gameState = this.gameService.state;
    const connectedPlayers = Object.values(gameState.players).filter(
      (p) => p && p.connected === true,
    );

    return {
      status: gameState.status,
      currentRound: gameState.currentRound,
      totalRounds: gameState.totalRounds,
      difficulty: gameState.difficulty,
      locationCount: this.geoDb.getAllInMemoryLocations().length,
      playerCount: connectedPlayers.length,
      selectedRegion: gameState.selectedRegion,
      hostIp: gameState.hostIp,
    };
  }
}
