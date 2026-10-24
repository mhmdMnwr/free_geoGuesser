import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameRoom } from '../game.types';
import { RoundCoordinatorService } from './round-coordinator.service';
import { TimerService } from './timer.service';
import { toPublicPlayerId } from '../factories/lobby.factory';

@Injectable()
export class GuessEvaluatorService {
  private readonly logger = new Logger(GuessEvaluatorService.name);

  constructor(
    private readonly roundCoordinator: RoundCoordinatorService,
    private readonly timerService: TimerService,
  ) {}

  checkAllGuessed(server: Server, room: GameRoom) {
    const activePlayers = Object.values(room.players).filter(
      (p) => p.connected && p.inGame !== false,
    );
    if (activePlayers.length === 0) return;

    const allGuessed = activePlayers.every((p) => p.hasGuessed);
    if (allGuessed) {
      this.logger.log(`[Room ${room.id}] All active players guessed! Ending round immediately.`);
      this.timerService.clearCountdown(room);
      this.roundCoordinator.endRound(server, room);
    }
  }

  handleGuessSubmission(
    room: GameRoom,
    server: Server,
    playerId: string,
    coords: { lat: number; lng: number },
  ) {
    const player = room.players[playerId];
    if (!player || player.hasGuessed) return;

    player.lockedGuess = coords;
    player.hasGuessed = true;

    const activePlayers = Object.values(room.players).filter(
      (p) => p.connected && p.inGame !== false,
    );
    const guessedCount = activePlayers.filter((p) => p.hasGuessed).length;

    const players = activePlayers.map((p) => ({
      id: p.publicId || toPublicPlayerId(p.id || p.ip),
      username: p.username,
      ip: p.ip,
      totalScore: p.totalScore || 0,
      hasGuessed: Boolean(p.hasGuessed),
      isHost: (room.hostId && p.id === room.hostId) || (!room.hostId && p.ip === room.hostIp),
      connected: p.connected,
    }));

    server.to(room.id).emit('player_guessed', {
      username: player.username,
      playerId: player.publicId || toPublicPlayerId(player.id || player.ip),
      guessedCount,
      totalPlayers: activePlayers.length,
      players,
    });

    if (room.status === 'ROUND_ACTIVE') {
      const duration = room.countdownDuration || 20;
      this.timerService.startCountdown(room, server, duration, player.username, () => {
        this.roundCoordinator.endRound(server, room);
      });
    }

    this.checkAllGuessed(server, room);
  }
}
