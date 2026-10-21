import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { GameService } from '../game.service';
import { getClientId, getClientIp } from './connection.handler';
import { GameRoom } from '../game.types';

@Injectable()
export class MatchParamsHandler {
  constructor(private readonly gameService: GameService) {}

  private checkHost(socket: Socket, room: GameRoom, action: string): boolean {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    this.gameService.ensureActiveHost(room);

    const isHost =
      (room.hostId && clientId === room.hostId) ||
      (room.hostSocketId && socket.id === room.hostSocketId) ||
      (!room.hostId && ip === room.hostIp);

    if (!isHost) {
      socket.emit('error_message', {
        message: `Only the host (Squad Leader) can configure ${action}.`,
      });
      return false;
    }
    return true;
  }

  handleSetTotalRounds(socket: Socket, server: Server, room: GameRoom, data: any) {
    if (!this.checkHost(socket, room, 'round count')) return;

    const rounds = parseInt(data?.rounds, 10);
    if (!isNaN(rounds) && rounds >= 3 && rounds <= 20) {
      room.totalRounds = rounds;
      this.gameService.broadcastLobbyUpdate(server, room);
      server.to(room.id).emit('params_updated', {
        roomId: room.id,
        totalRounds: room.totalRounds,
        countdownDuration: room.countdownDuration,
      });
    }
  }

  handleSetCountdownDuration(socket: Socket, server: Server, room: GameRoom, data: any) {
    if (!this.checkHost(socket, room, 'countdown duration')) return;

    const secs = parseInt(data?.seconds || data?.duration, 10);
    if (!isNaN(secs) && secs >= 5 && secs <= 120) {
      room.countdownDuration = secs;
      this.gameService.broadcastLobbyUpdate(server, room);
      server.to(room.id).emit('params_updated', {
        roomId: room.id,
        totalRounds: room.totalRounds,
        countdownDuration: room.countdownDuration,
      });
    }
  }

  handleSetRegion(socket: Socket, server: Server, room: GameRoom, data: any) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    this.gameService.ensureActiveHost(room);

    const isHost =
      (room.hostId && clientId === room.hostId) ||
      (room.hostSocketId && socket.id === room.hostSocketId) ||
      (!room.hostId && ip === room.hostIp);

    if (!isHost) {
      socket.emit('error_message', { message: 'Only the host can change the map region.' });
      return;
    }

    const region = String(data?.region || 'all').toLowerCase();
    room.selectedRegion = region;
    server.to(room.id).emit('region_updated', { roomId: room.id, selectedRegion: room.selectedRegion });
    this.gameService.broadcastLobbyUpdate(server, room);
  }

  handleSetDifficulty(socket: Socket, server: Server, room: GameRoom, data: any) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    this.gameService.ensureActiveHost(room);

    const isHost =
      (room.hostId && clientId === room.hostId) ||
      (room.hostSocketId && socket.id === room.hostSocketId) ||
      (!room.hostId && ip === room.hostIp);

    if (!isHost) {
      socket.emit('error_message', { message: 'Only the host can set difficulty.' });
      return;
    }

    const diff = String(data?.difficulty || 'all').toLowerCase();
    if (['all', 'easy', 'medium', 'hard'].includes(diff)) {
      room.difficulty = diff;
      this.gameService.broadcastLobbyUpdate(server, room);
      server.to(room.id).emit('difficulty_updated', { roomId: room.id, difficulty: room.difficulty });
    }
  }

  handleSetMaxPlayers(socket: Socket, server: Server, room: GameRoom, data: any) {
    if (!this.checkHost(socket, room, 'squad capacity')) return;

    const max = parseInt(data?.maxPlayers || data?.capacity, 10);
    if (!isNaN(max) && max >= 2 && max <= 32) {
      room.maxPlayers = max;
      this.gameService.broadcastLobbyUpdate(server, room);
      server.to(room.id).emit('params_updated', {
        roomId: room.id,
        totalRounds: room.totalRounds,
        countdownDuration: room.countdownDuration,
        maxPlayers: room.maxPlayers,
      });
    }
  }
}
