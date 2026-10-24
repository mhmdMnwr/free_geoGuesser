import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { GameService } from '../game.service';
import { getClientId, getClientIp } from './connection.handler';
import { GameRoom } from '../game.types';
import { toPublicPlayerId } from '../factories/lobby.factory';

@Injectable()
export class MatchControlHandler {
  constructor(private readonly gameService: GameService) {}

  async handleStartGame(socket: Socket, server: Server, room: GameRoom) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const res = await this.gameService.startGame(clientId, server, room, ip);
    if (!res.success && res.error) {
      socket.emit('error_message', { message: res.error });
    }
  }

  handleStopGame(socket: Socket, server: Server, room: GameRoom) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const res = this.gameService.stopGame(clientId, server, room, ip);
    if (!res.success && res.error) {
      socket.emit('error_message', { message: res.error });
    }
  }

  async handleNextRound(socket: Socket, server: Server, room: GameRoom) {
    if (room.status !== 'ROUND_RESULTS') return;

    const clientId = getClientId(socket);
    const isAuthorized =
      (room.hostId && clientId === room.hostId) ||
      (room.hostSocketId && socket.id === room.hostSocketId);

    if (!isAuthorized) {
      socket.emit('error_message', { message: 'Only the squad leader 👑 can advance to the next round.' });
      return;
    }

    if (room.currentRound < room.totalRounds) {
      try {
        await this.gameService.roundCoordinator.startRound(room.currentRound + 1, server, room);
        server.emit('lobbies_list', this.gameService.getLobbiesList());
      } catch (err: any) {
        socket.emit('error_message', { message: 'Failed to advance to the next round.' });
      }
    } else {
      room.status = 'GAME_OVER';
      const sorted = Object.values(room.players)
        .filter((p) => p && p.connected === true)
        .sort((a, b) => b.totalScore - a.totalScore);

      const leaderboard = sorted.map((p) => ({
        id: p.publicId || toPublicPlayerId(p.id || p.ip),
        username: p.username,
        ip: p.ip,
        totalScore: p.totalScore,
        connected: true,
      }));

      const payload = { roomId: room.id, leaderboard, hostIp: room.hostIp };
      room.lastGameOver = payload;
      server.to(room.id).emit('game_over', payload);
      server.emit('lobbies_list', this.gameService.getLobbiesList());
    }
  }

  handleResetToLobby(socket: Socket, server: Server, room: GameRoom) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const res = this.gameService.stopGame(clientId, server, room, ip);
    if (!res.success && res.error) {
      socket.emit('error_message', { message: res.error });
    }
  }
}
