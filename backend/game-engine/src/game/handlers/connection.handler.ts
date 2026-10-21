import { Injectable, Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { GameService } from '../game.service';
import { GameRoom } from '../game.types';
import { getClientId, getClientIp } from '../utils/client-info.util';

export { getClientId, getClientIp } from '../utils/client-info.util';

@Injectable()
export class ConnectionHandler {
  private readonly logger = new Logger(ConnectionHandler.name);
  private disconnectTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(private readonly gameService: GameService) {}

  handleConnection(socket: Socket, server: Server) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const queryRoomId = socket.handshake.query?.roomId as string;
    this.logger.log(`Connection: ${socket.id} (Client: ${clientId}, Room: ${queryRoomId || 'none'})`);

    const pendingTimeout = this.disconnectTimeouts.get(clientId);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      this.disconnectTimeouts.delete(clientId);
    }

    const targetRoom = queryRoomId ? this.gameService.getRoom(queryRoomId) : null;
    const existingRoom = targetRoom;
    const gameState = existingRoom || this.gameService.state;
    socket.join(gameState.id);

    const player = existingRoom
      ? existingRoom.players[clientId] || Object.values(existingRoom.players).find((p) => p.id === clientId)
      : null;
    if (player) {
      player.socketId = socket.id;
      player.connected = true;
      player.lastDisconnectedAt = undefined;
    }

    if (existingRoom && existingRoom.hostId === clientId) {
      existingRoom.hostSocketId = socket.id;
      existingRoom.hostIp = ip;
    }

    socket.emit('prompt_username', {
      ip,
      inProgress: gameState.status !== 'LOBBY',
      gameStatus: gameState.status !== 'LOBBY' ? {
        status: gameState.status,
        currentRound: gameState.currentRound,
        totalRounds: gameState.totalRounds,
        difficulty: gameState.difficulty,
        hostName: gameState.players[gameState.hostIp || '']?.username || gameState.hostName || 'Host',
      } : null,
    });

    if (existingRoom && existingRoom.id !== 'LAN-01') {
      const isHost = existingRoom.hostId === clientId || existingRoom.hostSocketId === socket.id;
      socket.emit('lobby_joined', {
        roomId: existingRoom.id,
        roomName: existingRoom.name,
        hostName: existingRoom.hostName,
        hostIp: existingRoom.hostIp,
        isHost: Boolean(isHost),
        role: isHost ? 'HOST' : 'OPERATIVE',
        players: this.gameService.getLobbyPlayers(existingRoom),
        selectedRegion: existingRoom.selectedRegion,
        difficulty: existingRoom.difficulty,
        totalRounds: existingRoom.totalRounds,
        status: existingRoom.status,
      });

      if (existingRoom.status !== 'LOBBY' && player?.inGame) {
        socket.emit('round_started', {
          roomId: existingRoom.id,
          round: existingRoom.currentRound,
          totalRounds: existingRoom.totalRounds,
          difficulty: existingRoom.roundTarget?.difficulty || existingRoom.difficulty,
          uplinkToken: existingRoom.roundUplinkToken || null,
          roadToken: (existingRoom as any).roadToken || null,
          countdownSeconds: existingRoom.countdownSeconds,
          isHost: Boolean(isHost),
        });
      }
    }

    this.gameService.broadcastLobbyUpdate(server, gameState);
  }

  handleDisconnect(socket: Socket, server: Server) {
    const clientId = getClientId(socket);
    const room = this.gameService.findRoomByPlayer(clientId) || this.gameService.state;

    const playerKey = Object.keys(room.players).find(
      (k) => k === clientId || room.players[k]?.socketId === socket.id,
    );
    const player = playerKey ? room.players[playerKey] : null;

    if (player && player.socketId === socket.id) {
      player.connected = false;
      player.lastDisconnectedAt = Date.now();

      const wasHost = Boolean(
        (room.hostId && (clientId === room.hostId || player.id === room.hostId)) ||
        (room.hostSocketId && socket.id === room.hostSocketId) ||
        (room.hostName && player.username === room.hostName)
      );

      if (wasHost && room.id !== 'LAN-01') {
        const t = setTimeout(() => {
          this.disconnectTimeouts.delete(clientId);
          const currentRoom = this.gameService.getRoom(room.id);
          if (!currentRoom) return;
          const hostPlayer = currentRoom.players[clientId] || currentRoom.players[playerKey];
          if (!hostPlayer || hostPlayer.connected !== true) {
            this.gameService.terminateLobby(
              room.id,
              server,
              `Squad Leader (${player.username}) disconnected. Room disbanded.`,
            );
          }
        }, 8000);
        this.disconnectTimeouts.set(clientId, t);
        return;
      }

      const t = setTimeout(() => {
        this.disconnectTimeouts.delete(clientId);
        const currentRoom = this.gameService.getRoom(room.id);
        if (!currentRoom) return;
        const p = currentRoom.players[clientId];
        if (p && p.connected === false) {
          this.finalizeDisconnect(clientId, currentRoom, server, socket.id);
        }
      }, 6000);
      this.disconnectTimeouts.set(clientId, t);
    }
  }

  finalizeDisconnect(clientId: string, room: GameRoom, server: Server, socketId?: string) {
    const playerKey = Object.keys(room.players).find(
      (k) => k === clientId || room.players[k]?.id === clientId || room.players[k]?.socketId === socketId,
    );
    if (!playerKey) return;
    const player = room.players[playerKey];
    delete room.players[playerKey];

    const remaining = Object.values(room.players).filter((p) => p && p.connected);
    if (remaining.length === 0) {
      room.status = 'LOBBY';
      room.currentRound = 0;
      room.hostId = null;
      room.hostIp = null;
      if (room.id !== 'LAN-01') {
        this.gameService.deleteRoom(room.id);
        server.emit('lobbies_list', this.gameService.getLobbiesList());
        return;
      }
    } else {
      this.gameService.ensureActiveHost(room);
    }

    server.to(room.id).emit('player_left', {
      roomId: room.id,
      username: player.username,
      id: clientId,
      remainingCount: remaining.length,
      hostIp: room.hostIp,
    });
    this.gameService.broadcastLobbyUpdate(server, room);
  }
}
