import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { RoomStoreService } from './services/room-store.service';
import { RoundCoordinatorService } from './services/round-coordinator.service';
import { GuessEvaluatorService } from './services/guess-evaluator.service';
import { TimerService } from './services/timer.service';
import { ScoringService } from './services/scoring.service';
import { ConnectionHandler } from './handlers/connection.handler';
import { LobbySocketHandler } from './handlers/lobby-socket.handler';
import { MatchControlHandler } from './handlers/match-control.handler';
import { GuessHandler } from './handlers/guess.handler';
import { HostActionHandler } from './handlers/host-action.handler';
import { MatchParamsHandler } from './handlers/match-params.handler';
import { LegacyAdmissionHandler } from './handlers/legacy-admission.handler';
import { GameParticipationHandler } from './handlers/game-participation.handler';
import { AdmissionHandler } from './handlers/admission.handler';
import { SecurityModule } from '../security/security.module';
import { RedisModule } from '../redis/redis.module';
import { GeoDatabaseModule } from '../geo-database/geo-database.module';

@Module({
  imports: [SecurityModule, RedisModule, GeoDatabaseModule],
  providers: [
    GameGateway,
    GameService,
    RoomStoreService,
    RoundCoordinatorService,
    GuessEvaluatorService,
    TimerService,
    ScoringService,
    ConnectionHandler,
    LobbySocketHandler,
    MatchControlHandler,
    GuessHandler,
    HostActionHandler,
    MatchParamsHandler,
    LegacyAdmissionHandler,
    GameParticipationHandler,
    AdmissionHandler,
  ],
  exports: [GameService],
})
export class GameModule {}
