import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameRoom, Player } from './game.types';
import { RoomStoreService } from './services/room-store.service';
import { RoundCoordinatorService } from './services/round-coordinator.service';
import { GuessEvaluatorService } from './services/guess-evaluator.service';
import { TimerService } from './services/timer.service';
import { GeoDatabaseService } from '../geo-database/geo-database.service';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    public readonly roomStore: RoomStoreService,
    public readonly roundCoordinator: RoundCoordinatorService,
    public readonly guessEvaluator: GuessEvaluatorService,
    public readonly timerService: TimerService,
    private readonly geoDb: GeoDatabaseService,
  ) {}

  get state(): GameRoom {
    return this.roomStore.state;
  }

  getRoom(roomId?: string): GameRoom | null {
    return this.roomStore.getRoom(roomId);
  }

  findRoomByPlayer(id: string): GameRoom | null {
    return this.roomStore.findRoomByPlayer(id);
  }

  ensureActiveHost(room?: GameRoom) {
    return this.roomStore.ensureActiveHost(room);
  }

  getLobbyPlayers(room?: GameRoom) {
    return this.roomStore.getLobbyPlayers(room);
  }

  getLobbiesList() {
    return this.roomStore.getLobbiesList();
  }

  deleteRoom(id: string) {
    this.roomStore.deleteRoom(id);
  }

  async startGame(
    senderId: string,
    server: Server,
    room?: GameRoom,
    senderIp?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const targetRoom = room || this.state;
    if (targetRoom.status !== 'LOBBY') {
      return { success: false, error: 'Match already active in this room.' };
    }

    this.ensureActiveHost(targetRoom);
    const active = Object.values(targetRoom.players).filter((p) => p && p.connected === true);
    if (active.length === 0) {
      return { success: false, error: 'At least 1 operative must join before starting.' };
    }

    const isAuthorized =
      (targetRoom.hostId && senderId === targetRoom.hostId) ||
      (targetRoom.hostSocketId && senderId === targetRoom.hostSocketId) ||
      (targetRoom.hostIp && senderIp && senderIp === targetRoom.hostIp) ||
      (targetRoom.hostIp && senderId === targetRoom.hostIp);

    if (!isAuthorized) {
      return { success: false, error: 'Only the host (Squad Leader) can start the game.' };
    }

    let pool = await this.geoDb.getLocations({
      region: targetRoom.selectedRegion,
      difficulty: targetRoom.difficulty,
    });
    if (!pool || pool.length < targetRoom.totalRounds) {
      pool = this.geoDb.getAllInMemoryLocations();
    }

    targetRoom.selectedLocations = this.roundCoordinator.selectDiverseLocations(
      pool,
      targetRoom.totalRounds,
    );

    for (const p of Object.values(targetRoom.players)) {
      p.totalScore = 0;
      p.inGame = true;
    }

    await this.roundCoordinator.startRound(1, server, targetRoom);
    server.emit('lobbies_list', this.getLobbiesList());
    return { success: true };
  }

  stopGame(
    senderId: string,
    server: Server,
    room?: GameRoom,
    senderIp?: string,
  ): { success: boolean; error?: string } {
    const targetRoom = room || this.state;
    this.ensureActiveHost(targetRoom);

    const isAuthorized =
      (targetRoom.hostId && senderId === targetRoom.hostId) ||
      (targetRoom.hostSocketId && senderId === targetRoom.hostSocketId) ||
      (targetRoom.hostIp && senderIp && senderIp === targetRoom.hostIp) ||
      (targetRoom.hostIp && senderId === targetRoom.hostIp);

    if (!isAuthorized) {
      return { success: false, error: 'Only the host (Squad Leader) can stop the game.' };
    }

    this.timerService.clearCountdown(targetRoom);
    targetRoom.status = 'LOBBY';
    targetRoom.currentRound = 0;
    targetRoom.selectedLocations = [];
    targetRoom.roundTarget = null;
    targetRoom.lastRoundResults = null;

    for (const p of Object.values(targetRoom.players)) {
      p.totalScore = 0;
      p.currentPin = null;
      p.lockedGuess = null;
      p.hasGuessed = false;
      p.inGame = true;
    }

    const payload = {
      roomId: targetRoom.id,
      message: 'The squad leader returned the room to Lobby.',
      players: this.getLobbyPlayers(targetRoom),
      hostIp: targetRoom.hostIp,
      selectedRegion: targetRoom.selectedRegion,
      difficulty: targetRoom.difficulty,
      status: 'LOBBY',
      currentRound: 0,
    };

    server.to(targetRoom.id).emit('game_stopped', payload);
    server.to(targetRoom.id).emit('return_to_lobby', payload);
    server.emit('lobbies_list', this.getLobbiesList());
    return { success: true };
  }

  broadcastLobbyUpdate(server: Server, room?: GameRoom) {
    const targetRoom = room || this.state;
    this.ensureActiveHost(targetRoom);
    server.to(targetRoom.id).emit('lobby_update', {
      roomId: targetRoom.id,
      roomName: targetRoom.name,
      players: this.getLobbyPlayers(targetRoom),
      hostIp: targetRoom.hostIp,
      hostName: targetRoom.hostName,
      selectedRegion: targetRoom.selectedRegion,
      difficulty: targetRoom.difficulty,
      totalRounds: targetRoom.totalRounds,
      countdownDuration: targetRoom.countdownDuration,
      maxPlayers: targetRoom.maxPlayers || 8,
      pendingAdmissions: Object.values(targetRoom.pendingAdmissions),
      gameStatus: {
        status: targetRoom.status,
        currentRound: targetRoom.currentRound,
        totalRounds: targetRoom.totalRounds,
      },
    });
    server.emit('lobbies_list', this.getLobbiesList());
  }

  terminateLobby(roomId: string, server: Server, reason: string) {
    const room = this.getRoom(roomId);
    if (!room) return;
    this.timerService.clearCountdown(room);
    for (const pending of Object.values(room.pendingAdmissions || {})) {
      if (pending?.socketId) {
        server.to(pending.socketId).emit('admission_rejected', { roomId, message: reason });
      }
    }
    room.players = {};
    room.pendingAdmissions = {};
    this.deleteRoom(roomId);
    server.to(roomId).emit('lobby_terminated', { roomId, reason, message: reason });
    try { (server.in(roomId) as any).socketsLeave(roomId); } catch {}
    server.emit('lobbies_list', this.getLobbiesList());
  }
}
