import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { GameService } from '../game.service';
import { getClientId, getClientIp } from './connection.handler';
import { GameRoom } from '../game.types';

@Injectable()
export class LegacyAdmissionHandler {
  constructor(private readonly gameService: GameService) {}

  handleSetUsername(socket: Socket, server: Server, data: any) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const gameState = this.gameService.state;
    const raw = typeof data === 'string' ? data : data?.username;
    let clean = String(raw || '').replace(/<[^>]*>/g, '').trim();

    if (!clean || clean.length < 2) {
      socket.emit('error_message', { message: 'Username must be at least 2 characters.' });
      return;
    }
    if (clean.length > 18) clean = clean.substring(0, 18);

    if (gameState.status !== 'LOBBY' && gameState.players[ip] && gameState.players[ip].username !== clean) {
      socket.emit('error_message', { message: 'Cannot change username while match is active.' });
      return;
    }

    const activeDup = Object.values(gameState.players).find(
      (p) => p && p.connected && p.id !== clientId && p.username?.toLowerCase() === clean.toLowerCase(),
    );
    if (activeDup) {
      socket.emit('error_message', { message: `Callsign "${clean}" is already claimed by an active player.` });
      return;
    }

    this.gameService.ensureActiveHost(gameState);
    const currentHost = gameState.hostId
      ? gameState.players[gameState.hostId]
      : (gameState.hostIp ? (gameState.players[gameState.hostIp] || Object.values(gameState.players).find((p) => p.ip === gameState.hostIp)) : null);
    const hasHost = Boolean(currentHost && currentHost.connected === true);
    const isFirst = Object.values(gameState.players).filter((p) => p && p.connected).length === 0;
    const registered = Boolean(gameState.players[ip] || gameState.players[clientId] || Object.values(gameState.players).some((p) => p.ip === ip));

    if (hasHost && ip !== gameState.hostIp && !registered && !isFirst) {
      gameState.pendingAdmissions[ip] = { clientId, ip, socketId: socket.id, username: clean, requestedAt: Date.now() };
      socket.emit('admission_pending', {
        username: clean,
        ip,
        hostName: currentHost?.username || gameState.hostName || 'Host',
      });
      if (currentHost?.socketId) {
        server.to(currentHost.socketId).emit('admission_requested', {
          applicantIp: ip,
          applicantName: clean,
          pendingCount: Object.keys(gameState.pendingAdmissions).length,
          pendingAdmissions: Object.values(gameState.pendingAdmissions),
        });
      }
      this.gameService.broadcastLobbyUpdate(server, gameState);
      return;
    }

    let player = gameState.players[clientId] || gameState.players[ip];
    if (player) {
      player.username = clean;
      player.connected = true;
      player.socketId = socket.id;
    } else {
      player = {
        id: clientId,
        ip,
        socketId: socket.id,
        username: clean,
        connected: true,
        totalScore: 0,
        currentPin: null,
        lockedGuess: null,
        hasGuessed: false,
        lastRoundScore: 0,
        lastRoundDistanceKm: null,
        inGame: gameState.status === 'LOBBY',
      };
      gameState.players[clientId] = player;
    }

    if (!hasHost) {
      gameState.hostIp = ip;
      gameState.hostId = clientId;
      gameState.hostSocketId = socket.id;
      gameState.hostName = clean;
    }
    this.gameService.ensureActiveHost(gameState);

    const isHost = (gameState.hostId && clientId === gameState.hostId) || (!gameState.hostId && ip === gameState.hostIp);
    socket.emit('username_set', {
      ip,
      username: clean,
      isHost: Boolean(isHost),
      hostIp: gameState.hostIp,
      selectedRegion: gameState.selectedRegion,
      difficulty: gameState.difficulty,
      totalRounds: gameState.totalRounds,
      countdownDuration: gameState.countdownDuration,
    });
    this.gameService.broadcastLobbyUpdate(server, gameState);
  }

  handleDecideAdmission(socket: Socket, server: Server, data: any) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const gameState = this.gameService.state;
    this.gameService.ensureActiveHost(gameState);

    const isHost = (gameState.hostId && clientId === gameState.hostId) || (!gameState.hostId && ip === gameState.hostIp);
    if (!isHost) {
      socket.emit('error_message', { message: 'Only the host can accept or decline admissions.' });
      return;
    }

    const applicantIp = data?.applicantIp;
    const applicant = applicantIp ? gameState.pendingAdmissions[applicantIp] : null;
    if (!applicant) return;

    delete gameState.pendingAdmissions[applicantIp];
    if (data?.accepted) {
      gameState.players[applicantIp] = {
        id: applicantIp,
        ip: applicantIp,
        socketId: applicant.socketId,
        username: applicant.username,
        connected: true,
        totalScore: 0,
        currentPin: null,
        lockedGuess: null,
        hasGuessed: false,
        lastRoundScore: 0,
        lastRoundDistanceKm: null,
        inGame: gameState.status === 'LOBBY',
      };
      server.to(applicant.socketId).emit('admission_accepted', { ip: applicantIp, username: applicant.username });
      server.to(applicant.socketId).emit('username_set', {
        ip: applicantIp,
        username: applicant.username,
        isHost: false,
        hostIp: gameState.hostIp,
        selectedRegion: gameState.selectedRegion,
        difficulty: gameState.difficulty,
        totalRounds: gameState.totalRounds,
        countdownDuration: gameState.countdownDuration,
      });
    } else {
      server.to(applicant.socketId).emit('admission_declined', { message: 'Admission declined.' });
    }
    this.gameService.broadcastLobbyUpdate(server, gameState);
  }
}
