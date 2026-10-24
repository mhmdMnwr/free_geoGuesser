import { Injectable, Logger } from '@nestjs/common';
import { GameRoom, Player } from '../game.types';
import { toPublicPlayerId } from '../factories/lobby.factory';

@Injectable()
export class RoomStoreService {
  private readonly logger = new Logger(RoomStoreService.name);
  public state: GameRoom = this.createDefaultRoom();
  public customRooms: Map<string, GameRoom> = new Map();

  private createDefaultRoom(): GameRoom {
    return {
      id: 'LAN-01',
      name: 'Base Station',
      status: 'LOBBY',
      hostId: null,
      hostIp: null,
      hostSocketId: null,
      hostName: null,
      lastHostUsername: null,
      currentRound: 0,
      totalRounds: 10,
      countdownDuration: 20,
      selectedRegion: 'all',
      difficulty: 'all',
      maxPlayers: 12,
      players: {},
      pendingAdmissions: {},
      selectedLocations: [],
      roundTarget: null,
      roundUplinkToken: null,
      countdownSeconds: null,
      countdownInterval: null,
      maxRoundTimeout: null,
      recentLocationKeys: new Set<string>(),
      firstGuesserName: null,
      lastRoundResults: null,
      lastGameOver: null,
      currentSharedImage: null,
      sharedImageTimestamp: null,
      sharedImageCaption: '',
      crownElection: null,
      lastCrownElectionAt: 0,
    };
  }

  getRoom(roomId?: string): GameRoom | null {
    if (!roomId) return null;
    const clean = String(roomId).trim();
    if (!clean) return null;
    if (clean === 'LAN-01') return this.state;
    const direct = this.customRooms.get(clean);
    if (direct) return direct;
    for (const r of this.customRooms.values()) {
      if (r.code === clean || r.id === clean) return r;
    }
    return null;
  }

  /** Returns the custom room this clientId is currently hosting, or null. */
  findRoomHostedBy(clientId: string): GameRoom | null {
    for (const room of this.customRooms.values()) {
      if (room.hostId === clientId) return room;
    }
    return null;
  }

  findRoomByPlayer(identifier: string): GameRoom | null {
    if (!identifier) return null;
    const all = [this.state, ...Array.from(this.customRooms.values())];
    for (const r of all) {
      if (
        r.players[identifier] ||
        Object.values(r.players).some(
          (p) => p && (p.id === identifier || p.ip === identifier || p.socketId === identifier),
        )
      ) {
        return r;
      }
    }
    return null;
  }

  ensureActiveHost(room?: GameRoom): string | null {
    const targetRoom = room || this.state;
    const connected = Object.values(targetRoom.players).filter((p) => p && p.connected === true);
    const inGrace = Object.values(targetRoom.players).filter(
      (p) => p && p.connected === false && p.lastDisconnectedAt && Date.now() - p.lastDisconnectedAt < 30000,
    );

    if (connected.length === 0 && inGrace.length === 0) {
      targetRoom.hostIp = null;
      targetRoom.hostSocketId = null;
      targetRoom.hostId = null;
      targetRoom.hostName = null;
      return null;
    }

    const currentHost = targetRoom.hostId
      ? targetRoom.players[targetRoom.hostId]
      : targetRoom.hostIp
      ? targetRoom.players[targetRoom.hostIp]
      : null;

    const isHostValid =
      currentHost &&
      (currentHost.connected === true ||
        (connected.length === 0 &&
          currentHost.lastDisconnectedAt &&
          Date.now() - currentHost.lastDisconnectedAt < 30000));

    if (!isHostValid && targetRoom.id === 'LAN-01') {
      const candidate = connected[0] || inGrace[0];
      if (candidate) {
        targetRoom.hostIp = candidate.ip;
        targetRoom.hostSocketId = candidate.socketId;
        targetRoom.hostId = candidate.id || candidate.ip;
        targetRoom.hostName = candidate.username;
      }
    }
    return targetRoom.hostIp;
  }

  getLobbyPlayers(room?: GameRoom) {
    const targetRoom = room || this.state;
    this.ensureActiveHost(targetRoom);
    return Object.values(targetRoom.players)
      .filter((p) => p && (p.connected === true || (p.lastDisconnectedAt && Date.now() - p.lastDisconnectedAt < 30000)))
      .map((p) => {
        const isHost =
          (targetRoom.hostId && p.id === targetRoom.hostId) ||
          (targetRoom.hostSocketId && p.socketId === targetRoom.hostSocketId) ||
          (!targetRoom.hostId && p.ip === targetRoom.hostIp);
        return {
          id: p.publicId || toPublicPlayerId(p.id || p.ip),
          ip: p.ip,
          username: p.username,
          connected: p.connected,
          totalScore: p.totalScore,
          isHost: Boolean(isHost),
        };
      });
  }

  formatRoomSummary(r: GameRoom, playerCount: number) {
    return {
      id: r.id,
      code: r.code || r.id,
      isPrivate: Boolean(r.isPrivate),
      name: r.name,
      hostName: r.hostName || 'HOST',
      hostIp: r.hostIp,
      playerCount,
      maxPlayers: r.maxPlayers || 8,
      selectedRegion: r.selectedRegion || 'all',
      difficulty: r.difficulty || 'all',
      totalRounds: r.totalRounds || 5,
      currentRound: r.currentRound || 0,
      status: r.status,
      ping: 3,
    };
  }

  findRoomSummaryByCode(code?: string): any | null {
    const room = this.getRoom(code);
    if (!room || room.id === 'LAN-01') return null;
    const activePlayers = Object.values(room.players).filter(
      (p) => p && (p.connected === true || (p.lastDisconnectedAt && Date.now() - p.lastDisconnectedAt < 5000)),
    );
    if (activePlayers.length === 0) return null;
    return this.formatRoomSummary(room, activePlayers.length);
  }

  getLobbiesList(): any[] {
    const valid: any[] = [];
    for (const r of Array.from(this.customRooms.values())) {
      const activePlayers = Object.values(r.players).filter(
        (p) => p && (p.connected === true || (p.lastDisconnectedAt && Date.now() - p.lastDisconnectedAt < 5000)),
      );
      if (activePlayers.length === 0) {
        this.deleteRoom(r.id);
        continue;
      }
      this.ensureActiveHost(r);
      if (r.isPrivate) continue;
      valid.push(this.formatRoomSummary(r, activePlayers.length));
    }
    return valid;
  }

  deleteRoom(roomId: string) {
    if (this.customRooms.has(roomId)) {
      this.customRooms.delete(roomId);
      this.logger.log(`Room ${roomId} deleted.`);
    }
  }
}
