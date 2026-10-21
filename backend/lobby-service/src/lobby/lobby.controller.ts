import { Controller, Get, Post, Body, Param, Req, Headers, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { LobbyService } from './lobby.service';
import { CreateLobbyDto, JoinLobbyDto, HeartbeatDto } from './dto/lobby.dto';

@Controller('api/lobbies')
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  @Get()
  getLobbies() {
    return this.lobbyService.getAllLobbies();
  }

  @Post()
  async createLobby(@Body() dto: CreateLobbyDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    return this.lobbyService.createLobby(dto, ip);
  }

  @Post('join')
  async joinLobby(@Body() dto: JoinLobbyDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    return this.lobbyService.joinLobby(dto, ip);
  }

  @Post(':id/heartbeat')
  async heartbeat(
    @Param('id') id: string,
    @Body() dto: HeartbeatDto,
  ) {
    return this.lobbyService.recordHeartbeat(id, dto.hostId);
  }
}
