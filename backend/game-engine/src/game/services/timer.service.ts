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
    room.countdownSeconds = null;
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
