import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { GameService } from '../game.service';
import { getClientId, getClientIp } from './connection.handler';
import { GameRoom } from '../game.types';

@Injectable()
export class GameParticipationHandler {
  constructor(private readonly gameService: GameService) {}

  handleJoinGame(socket: Socket, server: Server, room: GameRoom) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const player = room.players[clientId] || room.players[ip];

    if (!player) {
      socket.emit('error_message', { message: 'Please set your username first.' });
      return;
    }
    if (room.status === 'LOBBY') {
      socket.emit('error_message', { message: 'Match has not started yet. Waiting in lobby.' });
      return;
    }

    player.inGame = true;
    player.connected = true;
    player.socketId = socket.id;

    const inGamePlayers = Object.values(room.players).filter((p) => p && p.connected && p.inGame !== false);
    const guessedCount = inGamePlayers.filter((p) => p.hasGuessed).length;
    const totalPlayers = inGamePlayers.length;

    const players = inGamePlayers.map((p) => ({
      id: p.id || p.ip,
      username: p.username,
      ip: p.ip,
      totalScore: p.totalScore || 0,
      hasGuessed: Boolean(p.hasGuessed),
      isHost: (room.hostId && p.id === room.hostId) || (!room.hostId && p.ip === room.hostIp),
      connected: p.connected,
    }));

    if (room.status === 'ROUND_ACTIVE' || room.status === 'ROUND_COUNTDOWN') {
      socket.emit('round_started', {
        roomId: room.id,
        round: room.currentRound,
        totalRounds: room.totalRounds,
        difficulty: room.roundTarget?.difficulty || room.difficulty,
        uplinkToken: room.roundUplinkToken || null,
        roadToken: room.roadToken || null,
        sharedImage: room.currentSharedImage || null,
        guessedCount,
        totalPlayers,
        countdownSeconds: room.countdownSeconds,
        firstGuesserName: room.firstGuesserName,
        isHost: (room.hostId && clientId === room.hostId) || ip === room.hostIp,
        hostIp: room.hostIp,
        players,
      });
    } else if (room.status === 'ROUND_RESULTS') {
      socket.emit('round_results', room.lastRoundResults);
    } else if (room.status === 'GAME_OVER') {
      socket.emit('game_over', room.lastGameOver);
    }

    server.to(room.id).emit('player_joined', {
      username: player.username,
      ip: player.ip,
      totalPlayers,
    });
  }

  handleLeaveGame(socket: Socket, server: Server, room: GameRoom, data?: any) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const player = room.players[clientId] || room.players[ip];
    const wasHost = (room.hostId && clientId === room.hostId) ||
      room.hostSocketId === socket.id ||
      Boolean(data?.isHost && (clientId === room.hostId || socket.id === room.hostSocketId));

    if (wasHost && room.id !== 'LAN-01') {
      this.gameService.terminateLobby(
        room.id,
        server,
        `Squad Leader (${player?.username || 'Host'}) has exited the game. Expedition disbanded.`,
      );
      socket.leave(room.id);
      return;
    }

    if (player) {
      delete room.players[clientId];
      delete room.players[ip];
      const key = Object.keys(room.players).find((k) => room.players[k]?.id === clientId || room.players[k]?.socketId === socket.id);
      if (key) delete room.players[key];
    }
    socket.leave(room.id);
    const remainingCount = Object.keys(room.players).length;
    if (remainingCount === 0 && room.id !== 'LAN-01') {
      this.gameService.deleteRoom(room.id);
      server.emit('lobbies_list', this.gameService.getLobbiesList());
      return;
    }
    server.to(room.id).emit('player_left', { username: player?.username, ip, remainingCount });
    this.gameService.guessEvaluator.checkAllGuessed(server, room);
    this.gameService.broadcastLobbyUpdate(server, room);
  }
}
