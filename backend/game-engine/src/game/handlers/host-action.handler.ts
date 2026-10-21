import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { GameService } from '../game.service';
import { getClientId, getClientIp } from './connection.handler';
import { GameRoom } from '../game.types';

@Injectable()
export class HostActionHandler {
  constructor(private readonly gameService: GameService) {}

  handleTransferHost(socket: Socket, server: Server, room: GameRoom, data: any) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    this.gameService.ensureActiveHost(room);

    const isHost = (room.hostId && clientId === room.hostId) || (room.hostSocketId && socket.id === room.hostSocketId);
    if (!isHost) {
      socket.emit('error_message', { message: 'Only the current host can transfer leadership.' });
      return;
    }

    const targetId = data?.targetIp || data?.targetId;
    const target = Object.values(room.players).find(
      (p) => p && (p.ip === targetId || p.id === targetId),
    );
    if (!target || target.connected !== true) {
      socket.emit('error_message', { message: 'Cannot transfer host: targeted operative is not connected.' });
      return;
    }

    const prevHostName = room.hostName || 'Host';
    room.hostIp = target.ip;
    room.hostId = target.id;
    room.hostSocketId = target.socketId;
    room.hostName = target.username;

    const payload = {
      previousHost: prevHostName,
      previousHostIp: ip,
      newHost: target.username,
      newHostIp: target.ip,
      newHostId: target.id,
    };
    server.to(room.id).emit('host_transferred', payload);
    this.gameService.broadcastLobbyUpdate(server, room);
  }

  handleClaimHost(socket: Socket, room: GameRoom) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    this.gameService.ensureActiveHost(room);

    const host = room.hostId ? room.players[room.hostId] : room.hostIp ? room.players[room.hostIp] : null;
    if (host && host.connected === true) {
      socket.emit('error_message', { message: `Squad leadership is actively held by ${host.username}.` });
      return;
    }

    const player = room.players[clientId] || room.players[ip];
    if (!player) return;

    room.hostIp = ip;
    room.hostId = clientId;
    room.hostSocketId = socket.id;
    room.hostName = player.username;
    socket.emit('host_claimed', { success: true, hostIp: ip });
  }

  handleHostShareImage(socket: Socket, server: Server, room: GameRoom, data: any) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const isHost = (room.hostId && clientId === room.hostId) || (room.hostSocketId && socket.id === room.hostSocketId);
    if (!isHost) {
      socket.emit('error_message', { message: 'Only the Host can fetch and share recon images.' });
      return;
    }

    room.currentSharedImage = data?.image || null;
    room.sharedImageTimestamp = Date.now();
    room.sharedImageCaption = data?.caption || '';

    server.to(room.id).emit('shared_image_updated', {
      image: room.currentSharedImage,
      caption: room.sharedImageCaption,
      timestamp: room.sharedImageTimestamp,
      hostUsername: room.hostName || 'Host',
    });
  }

  handleKickPlayer(socket: Socket, server: Server, room: GameRoom, data: any) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    this.gameService.ensureActiveHost(room);

    const isHost =
      (room.hostId && clientId === room.hostId) ||
      (room.hostSocketId && socket.id === room.hostSocketId);

    if (!isHost) {
      socket.emit('error_message', { message: 'Only the Squad Leader can kick operatives.' });
      return;
    }

    const targetId = data?.targetId || data?.targetIp;
    if (!targetId) return;

    const target = Object.values(room.players).find(
      (p) => p && (p.id === targetId || p.ip === targetId || p.socketId === targetId),
    );

    if (!target) {
      socket.emit('error_message', { message: 'Operative not found in this squad.' });
      return;
    }

    if (target.id === room.hostId || (room.hostSocketId && target.socketId === room.hostSocketId)) {
      socket.emit('error_message', { message: 'You cannot kick yourself.' });
      return;
    }

    if (target.socketId) {
      server.to(target.socketId).emit('kicked_from_lobby', {
        roomId: room.id,
        message: 'You were kicked from the squad by the leader.',
      });
      const targetSocket = server.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        targetSocket.leave(room.id);
      }
    }

    delete room.players[target.id];
    delete room.players[target.ip];

    const remainingCount = Object.keys(room.players).length;
    if (remainingCount === 0 && room.id !== 'LAN-01') {
      this.gameService.deleteRoom(room.id);
      server.emit('lobbies_list', this.gameService.getLobbiesList());
      return;
    }

    this.gameService.broadcastLobbyUpdate(server, room);
  }
}
