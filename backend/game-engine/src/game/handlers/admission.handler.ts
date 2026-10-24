import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { GameService } from '../game.service';
import { CryptoService } from '../../security/crypto.service';
import { getClientId, getClientIp } from './connection.handler';
import { createPlayer } from '../factories/lobby.factory';
import { GameRoom } from '../game.types';

@Injectable()
export class AdmissionHandler {
  constructor(
    private readonly gameService: GameService,
    private readonly crypto: CryptoService,
  ) {}

  admitPlayer(
    socket: Socket,
    server: Server,
    room: GameRoom,
    clientId: string,
    ip: string,
    username: string,
    clientPublicKey?: string,
  ) {
    socket.join(room.id);
    const isReconnect = Boolean(room.players[clientId]);
    let player = room.players[clientId];
    if (!player) {
      player = createPlayer(clientId, ip, socket.id, username);
      room.players[clientId] = player;
    } else {
      player.socketId = socket.id;
      player.connected = true;
      player.username = username;
    }

    const isHost = room.hostId === clientId || room.hostSocketId === socket.id;
    if (isHost) {
      room.hostSocketId = socket.id;
      room.hostIp = ip;
      room.hostId = clientId;
    }

    let serverPublicKey: string | null = null;
    if (clientPublicKey) {
      try {
        const serverEcdh = this.crypto.generateEcdhKeyPair();
        const aesKey = this.crypto.deriveAesKey(serverEcdh.privateKey, clientPublicKey);
        player.aesKey = aesKey;
        player.clientPublicKeyHex = clientPublicKey;
        serverPublicKey = serverEcdh.publicKeyHex;
        socket.emit('ecdh_derived', { serverPublicKey });
      } catch {}
    }

    socket.emit('lobby_joined', {
      roomId: room.id,
      code: room.code || room.id,
      isPrivate: Boolean(room.isPrivate),
      roomName: room.name,
      hostName: room.hostName,
      isHost: Boolean(isHost),
      hostIp: room.hostIp,
      maxPlayers: room.maxPlayers,
      role: isHost ? 'HOST' : 'OPERATIVE',
      serverPublicKey,
      players: this.gameService.getLobbyPlayers(room),
      selectedRegion: room.selectedRegion,
      difficulty: room.difficulty,
      totalRounds: room.totalRounds,
      status: room.status,
    });
    this.gameService.broadcastLobbyUpdate(server, room);
    if (!isReconnect) {
      server.to(room.id).emit('player_entered_lobby', {
        username,
        clientId,
        roomId: room.id,
        totalPlayers: Object.keys(room.players).length,
      });
    }
    server.emit('lobbies_list', this.gameService.getLobbiesList());
  }

  handleAdmitPlayer(socket: Socket, server: Server, data: any) {
    const clientId = getClientId(socket);
    const room = this.gameService.getRoom(data?.roomId);
    if (!room) return;

    const isHost = (room.hostId && clientId === room.hostId) || (room.hostSocketId && socket.id === room.hostSocketId);
    if (!isHost) {
      socket.emit('error_message', { message: 'Only the Squad Leader can admit players.' });
      return;
    }

    const pending = room.pendingAdmissions[data?.targetClientId];
    if (!pending) {
      socket.emit('error_message', { message: 'No pending admission for that operative.' });
      return;
    }

    const pendingSocket = server.sockets.sockets.get(pending.socketId);
    delete room.pendingAdmissions[data.targetClientId];

    if (!pendingSocket) {
      this.gameService.broadcastLobbyUpdate(server, room);
      return;
    }

    this.admitPlayer(pendingSocket, server, room, pending.clientId, pending.ip, pending.username, pending.clientPublicKey);
  }

  handleRejectPlayer(socket: Socket, server: Server, data: any) {
    const clientId = getClientId(socket);
    const room = this.gameService.getRoom(data?.roomId);
    if (!room) return;

    const isHost = (room.hostId && clientId === room.hostId) || (room.hostSocketId && socket.id === room.hostSocketId);
    if (!isHost) {
      socket.emit('error_message', { message: 'Only the Squad Leader can reject players.' });
      return;
    }

    const pending = room.pendingAdmissions[data?.targetClientId];
    if (!pending) return;

    delete room.pendingAdmissions[data.targetClientId];
    const pendingSocket = server.sockets.sockets.get(pending.socketId);
    if (pendingSocket) {
      pendingSocket.emit('admission_rejected', {
        roomId: room.id,
        message: 'Your request to join the squad was rejected by the Leader.',
      });
    }
    this.gameService.broadcastLobbyUpdate(server, room);
  }

  getClientIp = getClientIp;
  getClientId = getClientId;
}
