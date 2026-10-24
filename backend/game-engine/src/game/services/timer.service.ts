import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameRoom } from '../game.types';

@Injectable()
export class TimerService {
  private readonly logger = new Logger(TimerService.name);

  clearCountdown(room: GameRoom) {
    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
    }
    if (room.maxRoundTimeout) {
      clearTimeout(room.maxRoundTimeout);
      room.maxRoundTimeout = null;
    }
    room.countdownSeconds = null;
  }

  startMaxRoundTimer(room: GameRoom, maxSeconds: number, onExpire: () => void) {
    if (room.maxRoundTimeout) {
      clearTimeout(room.maxRoundTimeout);
      room.maxRoundTimeout = null;
    }
    if (maxSeconds <= 0) return;
    room.maxRoundTimeout = setTimeout(() => {
      room.maxRoundTimeout = null;
      this.logger.log(`[Room ${room.id}] Max round time (${maxSeconds}s) elapsed with no guesses. Ending round.`);
      onExpire();
    }, maxSeconds * 1000);
  }

  startCountdown(
    room: GameRoom,
    server: Server,
    duration: number,
    triggeredByName: string,
    onExpire: () => void,
  ) {
    this.clearCountdown(room);
    room.status = 'ROUND_COUNTDOWN';
    room.countdownSeconds = duration;
    room.firstGuesserName = triggeredByName;

    this.logger.log(`[Room ${room.id}] First guess by ${triggeredByName}! ${duration}s countdown.`);
    server.to(room.id).emit('countdown_started', {
      roomId: room.id,
      seconds: duration,
      triggeredBy: triggeredByName,
    });

    room.countdownInterval = setInterval(() => {
      if (room.countdownSeconds !== null) {
        room.countdownSeconds--;
        server.to(room.id).emit('timer_tick', {
          roomId: room.id,
          seconds: room.countdownSeconds,
        });

        if (room.countdownSeconds <= 0) {
          this.clearCountdown(room);
          this.logger.log(`[Room ${room.id}] Countdown expired. Ending round.`);
          onExpire();
        }
      }
    }, 1000);
  }
}
