import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { GameService } from '../game.service';
import { CryptoService } from '../../security/crypto.service';
import { getClientId, getClientIp } from './connection.handler';
import { createGameRoom, createPlayer, isCallsignTaken } from '../factories/lobby.factory';
import { AdmissionHandler } from './admission.handler';

@Injectable()
export class LobbySocketHandler {
  constructor(
    private readonly gameService: GameService,
    private readonly crypto: CryptoService,
    private readonly admission: AdmissionHandler,
  ) {}

  handleGetLobbies(socket: Socket) {
    socket.emit('lobbies_list', this.gameService.getLobbiesList());
  }

  handleCheckUsername(socket: Socket, data: any) {
    const raw = typeof data === 'string' ? data : data?.username;
    const clean = String(raw || '').trim();
    const clientId = getClientId(socket);

    if (!clean || clean.length < 2) {
      socket.emit('username_check_result', { username: raw, available: false, reason: 'Too short' });
      return;
    }

    const allRooms = [this.gameService.state, ...Array.from(this.gameService.roomStore.customRooms.values())];
    const isTaken = isCallsignTaken(allRooms, clean, clientId);
    socket.emit('username_check_result', {
      username: raw,
      available: !isTaken,
      reason: isTaken ? 'Codename already claimed' : null,
    });
  }

  handleCreateLobby(socket: Socket, server: Server, data: any) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const username = String(data?.username || 'SquadLeader').trim();

    if (!username || username.length < 2) {
      socket.emit('error_message', { message: 'Username must be at least 2 characters.' });
      return;
    }

    const existing = this.gameService.roomStore.findRoomByPlayer(clientId);
    if (existing && existing.id !== 'LAN-01') {
      socket.emit('error_message', {
        message: 'You are already in an active squad. Leave your current squad before creating a new one.',
      });
      return;
    }

    const allRooms = [this.gameService.state, ...Array.from(this.gameService.roomStore.customRooms.values())];
    if (isCallsignTaken(allRooms, username, clientId)) {
      socket.emit('error_message', { message: `Codename "${username}" is already claimed by an active operative.` });
      return;
    }

    const roomId = `LAN-${Math.floor(1000 + Math.random() * 9000)}`;
    const room = createGameRoom(roomId, data?.name || `Squad ${roomId}`, clientId, ip, socket.id, username, data);
    const hostPlayer = createPlayer(clientId, ip, socket.id, username);
    room.players[clientId] = hostPlayer;

    let serverPublicKey: string | null = null;
    if (data?.clientPublicKey) {
      try {
        const serverEcdh = this.crypto.generateEcdhKeyPair();
        const aesKey = this.crypto.deriveAesKey(serverEcdh.privateKey, data.clientPublicKey);
        hostPlayer.aesKey = aesKey;
        hostPlayer.clientPublicKeyHex = data.clientPublicKey;
        serverPublicKey = serverEcdh.publicKeyHex;
        socket.emit('ecdh_derived', { serverPublicKey });
      } catch {}
    }

    this.gameService.roomStore.customRooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('lobby_joined', {
      roomId, roomName: room.name, hostName: username, isHost: true, hostIp: ip,
      role: 'HOST', serverPublicKey, players: this.gameService.getLobbyPlayers(room),
      selectedRegion: room.selectedRegion, difficulty: room.difficulty,
      totalRounds: room.totalRounds, status: room.status,
    });
    this.gameService.broadcastLobbyUpdate(server, room);
    server.emit('lobbies_list', this.gameService.getLobbiesList());
  }

  handleJoinLobby(socket: Socket, server: Server, data: any) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const targetRoom = this.gameService.getRoom(data?.roomId);

    if (!targetRoom) { socket.emit('error_message', { message: 'Lobby not found.' }); return; }

    const oldRoom = this.gameService.roomStore.findRoomByPlayer(clientId);
    if (oldRoom && oldRoom.id !== targetRoom.id && oldRoom.id !== 'LAN-01') {
      if (oldRoom.hostId === clientId || oldRoom.hostSocketId === socket.id) {
        this.gameService.terminateLobby(oldRoom.id, server, 'Squad Leader moved to another squad. Expedition disbanded.');
      } else {
        delete oldRoom.players[clientId];
        delete oldRoom.players[ip];
        socket.leave(oldRoom.id);
        if (Object.keys(oldRoom.players).length === 0) {
          this.gameService.deleteRoom(oldRoom.id);
          server.emit('lobbies_list', this.gameService.getLobbiesList());
        } else {
          this.gameService.broadcastLobbyUpdate(server, oldRoom);
        }
      }
    }

    const username = String(data?.username || 'Operative').trim();
    if (!username || username.length < 2) {
      socket.emit('error_message', { message: 'Username must be at least 2 characters.' }); return;
    }

    // Reconnect path OR host → directly admitted
    const isMember = Boolean(targetRoom.players[clientId]);
    const isHost = targetRoom.hostId === clientId || targetRoom.hostSocketId === socket.id;
    if (isMember || isHost) {
      return this.admission.admitPlayer(socket, server, targetRoom, clientId, ip, username, data?.clientPublicKey);
    }

    if (isCallsignTaken([targetRoom], username, clientId)) {
      socket.emit('error_message', { message: `Codename "${username}" is already claimed in this squad.` }); return;
    }

    const activeCount = Object.values(targetRoom.players).filter((p) => p && p.connected).length;
    if (activeCount >= (targetRoom.maxPlayers || 8)) {
      socket.emit('error_message', { message: `Squad is at maximum capacity (${targetRoom.maxPlayers || 8} operatives).` }); return;
    }

    // Queue as pending — host must approve
    targetRoom.pendingAdmissions[clientId] = {
      clientId, ip, socketId: socket.id, username,
      clientPublicKey: data?.clientPublicKey,
      requestedAt: Date.now(),
    };

    socket.emit('admission_pending', {
      roomId: targetRoom.id, roomName: targetRoom.name,
      message: 'Waiting for Squad Leader approval...',
    });

    if (targetRoom.hostSocketId) {
      server.to(targetRoom.hostSocketId).emit('admission_request', {
        roomId: targetRoom.id, clientId, username,
        requestedAt: targetRoom.pendingAdmissions[clientId].requestedAt,
      });
    }
  }

  handleLeaveLobby(socket: Socket, server: Server, data: any) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const roomId = data?.roomId;
    const room = roomId ? this.gameService.getRoom(roomId) : this.gameService.findRoomByPlayer(clientId);
    if (!room) { if (roomId) socket.leave(roomId); return; }

    if (room.pendingAdmissions[clientId]) delete room.pendingAdmissions[clientId];

    const wasHost = (room.hostId && clientId === room.hostId) ||
      (room.hostSocketId && socket.id === room.hostSocketId) ||
      Boolean(data?.isHost && (clientId === room.hostId || socket.id === room.hostSocketId || room.hostName === data?.username));

    if (wasHost && room.id !== 'LAN-01') {
      this.gameService.terminateLobby(room.id, server, 'Squad Leader has left the room. Expedition disbanded.');
      socket.leave(room.id); return;
    }

    delete room.players[clientId];
    delete room.players[ip];
    const key = Object.keys(room.players).find((k) => room.players[k]?.id === clientId || room.players[k]?.socketId === socket.id);
    if (key) delete room.players[key];

    socket.leave(room.id);
    const remainingCount = Object.keys(room.players).length;
    if (remainingCount === 0 && room.id !== 'LAN-01') {
      this.gameService.deleteRoom(room.id);
      server.emit('lobbies_list', this.gameService.getLobbiesList());
      return;
    }

    this.gameService.broadcastLobbyUpdate(server, room);
    server.to(room.id).emit('player_left', { ip, username: data?.username, remainingCount });
    this.gameService.guessEvaluator.checkAllGuessed(server, room);
  }
}
