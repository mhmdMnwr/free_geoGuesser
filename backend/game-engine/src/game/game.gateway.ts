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
import { GameRoom } from './game.types';

@WebSocketGateway({
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

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
  ) {}

  public resolveRoom(socket: Socket, data?: any): GameRoom {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    if (data && typeof data === 'object' && data.roomId) {
      const r = this.gameService.getRoom(data.roomId);
      if (r) return r;
    }
    return (
      this.gameService.findRoomByPlayer(clientId) ||
      this.gameService.findRoomByPlayer(ip) ||
      this.gameService.state
    );
  }

  handleConnection(socket: Socket) {
    this.connectionHandler.handleConnection(socket, this.server);
  }

  handleDisconnect(socket: Socket) {
    this.connectionHandler.handleDisconnect(socket, this.server);
  }

  @SubscribeMessage('get_lobbies')
  handleGetLobbies(@ConnectedSocket() socket: Socket) {
    this.lobbyHandler.handleGetLobbies(socket);
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
    this.guessHandler.handleLockGuess(socket, this.server, this.resolveRoom(socket, data), data);
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
    this.hostActions.handleClaimHost(socket, this.resolveRoom(socket));
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
}
