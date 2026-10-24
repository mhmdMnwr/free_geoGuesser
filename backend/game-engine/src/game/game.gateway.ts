import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { ConnectionHandler, getClientId, getClientIp } from './handlers/connection.handler';
import { LobbySocketHandler } from './handlers/lobby-socket.handler';
import { MatchControlHandler } from './handlers/match-control.handler';
import { GuessHandler } from './handlers/guess.handler';
import { HostActionHandler } from './handlers/host-action.handler';
import { MatchParamsHandler } from './handlers/match-params.handler';
import { LegacyAdmissionHandler } from './handlers/legacy-admission.handler';
import { GameParticipationHandler } from './handlers/game-participation.handler';
import { AdmissionHandler } from './handlers/admission.handler';
import { CrownElectionHandler } from './handlers/crown-election.handler';
import { GameRoom } from './game.types';

@WebSocketGateway({
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
  maxHttpBufferSize: 65536,
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly rateLimits = new Map<string, { count: number; resetAt: number; spamScore: number }>();

  constructor(
    private readonly gameService: GameService,
    private readonly connectionHandler: ConnectionHandler,
    private readonly lobbyHandler: LobbySocketHandler,
    private readonly matchControl: MatchControlHandler,
    private readonly guessHandler: GuessHandler,
    private readonly hostActions: HostActionHandler,
    private readonly matchParams: MatchParamsHandler,
    private readonly legacyAdmission: LegacyAdmissionHandler,
    private readonly gameParticipation: GameParticipationHandler,
    private readonly admissionHandler: AdmissionHandler,
    private readonly crownElection: CrownElectionHandler,
  ) {}

  private setupRateLimiter(socket: Socket) {
    socket.use(([event, ...args], next) => {
      const now = Date.now();
      let record = this.rateLimits.get(socket.id);
      if (!record || now > record.resetAt) {
        record = { count: 1, resetAt: now + 1000, spamScore: 0 };
        this.rateLimits.set(socket.id, record);
      } else {
        record.count++;
      }

      // High-cost or spam-sensitive actions receive higher score
      const sensitiveEvents = [
        'check_username',
        'create_lobby',
        'join_lobby',
        'find_room_by_code',
        'claim_host',
        'start_game',
        'next_round',
      ];
      if (sensitiveEvents.includes(event)) {
        record.spamScore += 4;
      } else {
        record.spamScore += 1;
      }

      // Max 35 total events or > 40 spam score per second
      if (record.count > 35 || record.spamScore > 40) {
        if (record.count === 36) {
          socket.emit('error_message', { message: 'Too many requests. Please slow down.' });
        }
        return; // Drop packet
      }

      next();
    });
  }

  public resolveRoom(socket: Socket, data?: any): GameRoom {
    const clientId = getClientId(socket);
    if (data && typeof data === 'object' && data.roomId) {
      const r = this.gameService.getRoom(data.roomId);
      if (r) {
        const isMemberOrHost =
          r.id === 'LAN-01' ||
          Boolean(r.players[clientId]) ||
          r.hostId === clientId ||
          r.hostSocketId === socket.id ||
          Object.values(r.players).some((p) => p && (p.id === clientId || p.socketId === socket.id));
        if (isMemberOrHost) return r;
      }
    }
    return this.gameService.findRoomByPlayer(clientId) || this.gameService.state;
  }

  handleConnection(socket: Socket) {
    this.setupRateLimiter(socket);
    this.connectionHandler.handleConnection(socket, this.server);
  }

  handleDisconnect(socket: Socket) {
    this.rateLimits.delete(socket.id);
    this.connectionHandler.handleDisconnect(socket, this.server);
  }

  @SubscribeMessage('get_lobbies')
  handleGetLobbies(@ConnectedSocket() socket: Socket) {
    this.lobbyHandler.handleGetLobbies(socket);
  }

  @SubscribeMessage('find_room_by_code')
  handleFindRoomByCode(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.lobbyHandler.handleFindRoomByCode(socket, data);
  }

  @SubscribeMessage('check_username')
  handleCheckUsername(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.lobbyHandler.handleCheckUsername(socket, data);
  }

  @SubscribeMessage('create_lobby')
  handleCreateLobby(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.lobbyHandler.handleCreateLobby(socket, this.server, data);
  }

  @SubscribeMessage('join_lobby')
  handleJoinLobby(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.lobbyHandler.handleJoinLobby(socket, this.server, data);
  }

  @SubscribeMessage('leave_lobby')
  handleLeaveLobby(@ConnectedSocket() socket: Socket, @MessageBody() data?: any) {
    this.lobbyHandler.handleLeaveLobby(socket, this.server, data);
  }

  @SubscribeMessage('start_game')
  handleStartGame(@ConnectedSocket() socket: Socket, @MessageBody() data?: any) {
    this.matchControl.handleStartGame(socket, this.server, this.resolveRoom(socket, data));
  }

  @SubscribeMessage('stop_game')
  handleStopGame(@ConnectedSocket() socket: Socket, @MessageBody() data?: any) {
    this.matchControl.handleStopGame(socket, this.server, this.resolveRoom(socket, data));
  }

  @SubscribeMessage('next_round')
  handleNextRound(@ConnectedSocket() socket: Socket, @MessageBody() data?: any) {
    this.matchControl.handleNextRound(socket, this.server, this.resolveRoom(socket, data));
  }

  @SubscribeMessage('reset_to_lobby')
  handleResetToLobby(@ConnectedSocket() socket: Socket, @MessageBody() data?: any) {
    this.matchControl.handleResetToLobby(socket, this.server, this.resolveRoom(socket, data));
  }

  @SubscribeMessage('place_pin')
  handlePlacePin(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.guessHandler.handlePlacePin(socket, this.resolveRoom(socket, data), data);
  }

  @SubscribeMessage('lock_guess')
  handleLockGuess(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    return this.guessHandler.handleLockGuess(socket, this.server, this.resolveRoom(socket, data), data);
  }

  @SubscribeMessage('host_heartbeat')
  handleHostHeartbeat(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    socket.emit('heartbeat_ack', { success: true, timestamp: Date.now() });
  }

  @SubscribeMessage('transfer_host')
  handleTransferHost(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.hostActions.handleTransferHost(socket, this.server, this.resolveRoom(socket, data), data);
  }

  @SubscribeMessage('claim_host')
  handleClaimHost(@ConnectedSocket() socket: Socket) {
    this.hostActions.handleClaimHost(socket, this.server, this.resolveRoom(socket));
  }

  @SubscribeMessage('host_share_image')
  handleHostShareImage(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.hostActions.handleHostShareImage(socket, this.server, this.resolveRoom(socket, data), data);
  }

  @SubscribeMessage('kick_player')
  handleKickPlayer(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.hostActions.handleKickPlayer(socket, this.server, this.resolveRoom(socket, data), data);
  }

  @SubscribeMessage('set_total_rounds')
  handleSetTotalRounds(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.matchParams.handleSetTotalRounds(socket, this.server, this.resolveRoom(socket, data), data);
  }

  @SubscribeMessage('set_max_players')
  handleSetMaxPlayers(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.matchParams.handleSetMaxPlayers(socket, this.server, this.resolveRoom(socket, data), data);
  }

  @SubscribeMessage('set_countdown_duration')
  handleSetCountdownDuration(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.matchParams.handleSetCountdownDuration(socket, this.server, this.resolveRoom(socket, data), data);
  }

  @SubscribeMessage('set_region')
  handleSetRegion(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.matchParams.handleSetRegion(socket, this.server, this.resolveRoom(socket, data), data);
  }

  @SubscribeMessage('set_difficulty')
  handleSetDifficulty(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.matchParams.handleSetDifficulty(socket, this.server, this.resolveRoom(socket, data), data);
  }

  @SubscribeMessage('set_username')
  handleSetUsername(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.legacyAdmission.handleSetUsername(socket, this.server, data);
  }

  @SubscribeMessage('decide_admission')
  handleDecideAdmission(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.legacyAdmission.handleDecideAdmission(socket, this.server, data);
  }

  @SubscribeMessage('join_game')
  handleJoinGame(@ConnectedSocket() socket: Socket, @MessageBody() data?: any) {
    this.gameParticipation.handleJoinGame(socket, this.server, this.resolveRoom(socket, data));
  }

  @SubscribeMessage('leave_game')
  handleLeaveGame(@ConnectedSocket() socket: Socket, @MessageBody() data?: any) {
    this.gameParticipation.handleLeaveGame(socket, this.server, this.resolveRoom(socket, data), data);
  }

  @SubscribeMessage('admit_player')
  handleAdmitPlayer(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.admissionHandler.handleAdmitPlayer(socket, this.server, data);
  }

  @SubscribeMessage('reject_player')
  handleRejectPlayer(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.admissionHandler.handleRejectPlayer(socket, this.server, data);
  }

  @SubscribeMessage('demand_crown')
  handleDemandCrown(@ConnectedSocket() socket: Socket, @MessageBody() data?: any) {
    this.crownElection.handleDemandCrown(socket, this.server, this.resolveRoom(socket, data));
  }

  @SubscribeMessage('respond_crown_demand')
  handleRespondCrownDemand(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.crownElection.handleRespondDemand(socket, this.server, this.resolveRoom(socket, data), data);
  }

  @SubscribeMessage('vote_crown')
  handleVoteCrown(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    this.crownElection.handleVoteCrown(socket, this.server, this.resolveRoom(socket, data), data);
  }
}
