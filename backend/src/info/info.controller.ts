import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { GameService } from '../game/game.service';
import { GeoDatabaseService } from '../geo-database/geo-database.service';
import { getLanAddresses, getReqClientIp } from '../game/game.helpers';
import { Player } from '../game/game.types';

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
      roomsCount: this.gameService.rooms.size,
    };
  }

  @Get('lobbies')
  getLobbies() {
    return {
      lobbies: this.gameService.getLobbiesList(),
    };
  }

  /**
   * Zero-Trust REST Endpoint: Create Lobby with ECDH Key Exchange
   */
  @Post('lobbies')
  createLobbyRest(
    @Body()
    body: {
      name?: string;
      username: string;
      clientPublicKey?: string;
      rounds?: number;
      duration?: number;
      region?: string;
      difficulty?: string;
    },
    @Req() req: Request,
  ) {
    const ip = getReqClientIp(req);
    const username = body.username?.trim() || 'OPERATIVE';
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const room = this.gameService.createRoom(
      body.name || `${username}'S SQUAD`,
      ip,
      username,
      {
        totalRounds: body.rounds || 5,
        countdownDuration: body.duration || 20,
        selectedRegion: body.region || 'all',
        difficulty: body.difficulty || 'all',
      },
      clientId,
    );

    const player: Player = {
      id: clientId,
      ip,
      socketId: '',
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

    const ecdhRes = this.gameService.performEcdhHandshake(player, body.clientPublicKey);
    room.players[clientId] = player;
    room.hostIp = ip;
    room.hostId = clientId;
    room.hostName = username;

    return {
      roomId: room.id,
      roomName: room.name,
      playerId: clientId,
      isHost: true,
      serverPublicKey: ecdhRes.serverPublicKey,
      players: this.gameService.getLobbyPlayers(room),
      selectedRegion: room.selectedRegion,
      difficulty: room.difficulty,
      totalRounds: room.totalRounds,
      status: room.status,
    };
  }

  /**
   * Zero-Trust REST Endpoint: Join Lobby with ECDH Key Exchange
   */
  @Post('lobbies/join')
  joinLobbyRest(
    @Body()
    body: {
      roomId: string;
      username: string;
      clientPublicKey?: string;
    },
    @Req() req: Request,
  ) {
    const ip = getReqClientIp(req);
    const targetRoom = this.gameService.getRoom(body.roomId);
    if (!targetRoom) {
      throw new HttpException('Lobby not found', HttpStatus.NOT_FOUND);
    }

    const username = body.username?.trim() || 'OPERATIVE';
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const player: Player = {
      id: clientId,
      ip,
      socketId: '',
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

    const ecdhRes = this.gameService.performEcdhHandshake(player, body.clientPublicKey);
    targetRoom.players[clientId] = player;
    this.gameService.ensureActiveHost(targetRoom);

    const isHost =
      (targetRoom.hostId && clientId === targetRoom.hostId) ||
      (!targetRoom.hostId && ip === targetRoom.hostIp);

    return {
      roomId: targetRoom.id,
      roomName: targetRoom.name,
      playerId: clientId,
      isHost: Boolean(isHost),
      serverPublicKey: ecdhRes.serverPublicKey,
      players: this.gameService.getLobbyPlayers(targetRoom),
      selectedRegion: targetRoom.selectedRegion,
      difficulty: targetRoom.difficulty,
      totalRounds: targetRoom.totalRounds,
      status: targetRoom.status,
    };
  }

  /**
   * Host Heartbeat Ping (8-second watchdog TTL)
   */
  @Post('lobbies/:id/heartbeat')
  hostHeartbeat(
    @Param('id') id: string,
    @Body() body: { hostId?: string },
  ) {
    const hostId = body?.hostId || '';
    const recorded = this.gameService.recordHostHeartbeat(id, hostId);
    return { success: recorded };
  }
}
