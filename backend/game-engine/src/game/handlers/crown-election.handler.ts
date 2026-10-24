import { Injectable, Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { GameService } from '../game.service';
import { getClientId } from './connection.handler';
import { GameRoom, CrownElection } from '../game.types';

@Injectable()
export class CrownElectionHandler {
  private readonly logger = new Logger(CrownElectionHandler.name);

  constructor(private readonly gameService: GameService) {}

  handleDemandCrown(socket: Socket, server: Server, room: GameRoom) {
    const clientId = getClientId(socket);
    this.gameService.ensureActiveHost(room);

    const player = room.players[clientId];
    if (!player || !player.connected) {
      socket.emit('error_message', { message: 'You must be a connected operative in this squad.' });
      return;
    }

    // Host cannot demand crown from themselves
    if (clientId === room.hostId || socket.id === room.hostSocketId) {
      socket.emit('error_message', { message: 'You are already the Squad Leader 👑.' });
      return;
    }

    // Only one active election at a time
    if (room.crownElection) {
      socket.emit('error_message', { message: 'A challenge for the Crown is already in progress.' });
      return;
    }

    // 15-second cooldown to prevent spamming
    if (room.lastCrownElectionAt && Date.now() - room.lastCrownElectionAt < 15000) {
      const waitSec = Math.ceil((15000 - (Date.now() - room.lastCrownElectionAt)) / 1000);
      socket.emit('error_message', { message: `Crown challenge is on cooldown. Wait ${waitSec}s.` });
      return;
    }

    const host = room.hostId ? room.players[room.hostId] : null;
    if (!host || !host.connected) {
      // If host is disconnected, claim host directly
      socket.emit('error_message', { message: 'Squad Leader is disconnected. Leadership can be claimed directly.' });
      return;
    }

    const election: CrownElection = {
      claimantId: clientId,
      claimantUsername: player.username,
      claimantPublicId: player.publicId || player.id,
      targetHostId: host.id,
      targetHostUsername: host.username,
      phase: 'PENDING_HOST',
      hostTimeout: null,
      votingTimeout: null,
      votes: {},
      eligibleVoterIds: [],
      totalEligible: 0,
      startedAt: Date.now(),
    };
    room.crownElection = election;

    this.logger.log(`[Room ${room.id}] Operative ${player.username} demanded the Crown from ${host.username}`);

    // Notify the host with a 4-second decision window
    if (host.socketId) {
      server.to(host.socketId).emit('crown_demanded', {
        roomId: room.id,
        claimantUsername: player.username,
        claimantId: election.claimantPublicId,
        timeoutSeconds: 4,
      });
    }

    // Acknowledge to claimant
    socket.emit('crown_demand_sent', {
      claimantUsername: player.username,
      timeoutSeconds: 4,
      message: `Challenge issued! Waiting 4s for ${host.username} to respond...`,
    });

    // 4-second timeout if host ignores or does not respond
    election.hostTimeout = setTimeout(() => {
      election.hostTimeout = null;
      if (room.crownElection === election && election.phase === 'PENDING_HOST') {
        this.logger.log(`[Room ${room.id}] Host ignored challenge. Proceeding to squad vote.`);
        this.startVotingPhase(server, room, election, false);
      }
    }, 4000);
  }

  handleRespondDemand(socket: Socket, server: Server, room: GameRoom, data: any) {
    const clientId = getClientId(socket);
    const election = room.crownElection;
    if (!election || election.phase !== 'PENDING_HOST') return;

    // Verify caller is the host
    const isHost = (room.hostId && clientId === room.hostId) || (room.hostSocketId && socket.id === room.hostSocketId);
    if (!isHost) {
      socket.emit('error_message', { message: 'Only the current Squad Leader can respond to this challenge.' });
      return;
    }

    if (election.hostTimeout) {
      clearTimeout(election.hostTimeout);
      election.hostTimeout = null;
    }

    if (data?.accept === true) {
      // Host accepts/yields voluntarily!
      const claimant = room.players[election.claimantId];
      if (claimant && claimant.connected) {
        this.gameService.transferHost(room, claimant, server);
        server.to(room.id).emit('crown_election_result', {
          success: true,
          newHost: claimant.username,
          message: `Squad Leader yielded leadership to ${claimant.username}! 👑`,
        });
      }
      room.crownElection = null;
      room.lastCrownElectionAt = Date.now();
    } else {
      // Host refused ("said no"). Proceed to squad vote immediately!
      this.logger.log(`[Room ${room.id}] Host refused challenge. Initiating squad referendum.`);
      this.startVotingPhase(server, room, election, true);
    }
  }

  private startVotingPhase(
    server: Server,
    room: GameRoom,
    election: CrownElection,
    hostExplicitlyRefused: boolean,
  ) {
    if (election.phase === 'RESOLVED') return;
    election.phase = 'VOTING';

    const connectedPlayers = Object.values(room.players).filter((p) => p && p.connected);
    election.eligibleVoterIds = connectedPlayers.map((p) => p.id);
    election.totalEligible = election.eligibleVoterIds.length;

    // Claimant automatically votes YES
    election.votes[election.claimantId] = true;

    // If host refused, record host's vote as NO
    if (hostExplicitlyRefused && election.targetHostId) {
      election.votes[election.targetHostId] = false;
    }

    const yesCount = Object.values(election.votes).filter((v) => v === true).length;
    const noCount = Object.values(election.votes).filter((v) => v === false).length;

    // Broadcast referendum start to all players in room
    server.to(room.id).emit('crown_vote_started', {
      roomId: room.id,
      claimantUsername: election.claimantUsername,
      claimantId: election.claimantPublicId,
      hostUsername: election.targetHostUsername,
      durationSeconds: 8,
      totalEligible: election.totalEligible,
      yesCount,
      noCount,
    });

    // 8-second window for all players to vote
    election.votingTimeout = setTimeout(() => {
      election.votingTimeout = null;
      if (room.crownElection === election && election.phase === 'VOTING') {
        this.tallyVotes(server, room, election);
      }
    }, 8000);

    // If all eligible voters have already cast their vote (e.g. 2-player squad where both are pre-filled)
    if (Object.keys(election.votes).length >= election.totalEligible) {
      this.tallyVotes(server, room, election);
    }
  }

  handleVoteCrown(socket: Socket, server: Server, room: GameRoom, data: any) {
    const clientId = getClientId(socket);
    const election = room.crownElection;
    if (!election || election.phase !== 'VOTING') {
      socket.emit('error_message', { message: 'No active Crown referendum to vote on.' });
      return;
    }

    if (!election.eligibleVoterIds.includes(clientId)) {
      socket.emit('error_message', { message: 'You are not eligible to vote in this referendum.' });
      return;
    }

    if (election.votes[clientId] !== undefined) {
      socket.emit('error_message', { message: 'You have already cast your vote.' });
      return;
    }

    const isYes = data?.vote === true || data?.vote === 'yes' || data?.vote === 'YES';
    election.votes[clientId] = isYes;

    const yesCount = Object.values(election.votes).filter((v) => v === true).length;
    const noCount = Object.values(election.votes).filter((v) => v === false).length;
    const totalVoted = Object.keys(election.votes).length;

    server.to(room.id).emit('crown_vote_update', {
      roomId: room.id,
      yesCount,
      noCount,
      totalVoted,
      totalEligible: election.totalEligible,
    });

    if (totalVoted >= election.totalEligible) {
      this.tallyVotes(server, room, election);
    }
  }

  private tallyVotes(server: Server, room: GameRoom, election: CrownElection) {
    if (election.hostTimeout) {
      clearTimeout(election.hostTimeout);
      election.hostTimeout = null;
    }
    if (election.votingTimeout) {
      clearTimeout(election.votingTimeout);
      election.votingTimeout = null;
    }

    if (election.phase === 'RESOLVED') return;
    election.phase = 'RESOLVED';

    const yesCount = Object.values(election.votes).filter((v) => v === true).length;
    const noCount = Object.values(election.votes).filter((v) => v === false).length;
    const totalEligible = election.totalEligible;

    // Strict majority check: more YES than NO, AND YES votes exceed 50% of the squad
    const isMajority = yesCount > noCount && yesCount > Math.floor(totalEligible / 2);

    if (isMajority) {
      const claimant = room.players[election.claimantId];
      if (claimant && claimant.connected) {
        this.gameService.transferHost(room, claimant, server);
        server.to(room.id).emit('crown_election_result', {
          success: true,
          newHost: claimant.username,
          yesCount,
          noCount,
          totalEligible,
          message: `Squad referendum passed (${yesCount} YES vs ${noCount} NO)! ${claimant.username} is the new Squad Leader! 👑`,
        });
      } else {
        server.to(room.id).emit('crown_election_result', {
          success: false,
          newHost: room.hostName,
          yesCount,
          noCount,
          totalEligible,
          message: `Claimant disconnected. Leadership remains with ${room.hostName}.`,
        });
      }
    } else {
      server.to(room.id).emit('crown_election_result', {
        success: false,
        newHost: room.hostName,
        yesCount,
        noCount,
        totalEligible,
        message: `Challenge defeated (${yesCount} YES vs ${noCount} NO). ${room.hostName} remains Squad Leader.`,
      });
    }

    room.crownElection = null;
    room.lastCrownElectionAt = Date.now();
  }

  cancelElection(room: GameRoom, server: Server, reason: string) {
    const election = room.crownElection;
    if (!election) return;

    if (election.hostTimeout) clearTimeout(election.hostTimeout);
    if (election.votingTimeout) clearTimeout(election.votingTimeout);

    server.to(room.id).emit('crown_election_result', {
      success: false,
      newHost: room.hostName,
      message: reason,
    });

    room.crownElection = null;
    room.lastCrownElectionAt = Date.now();
  }
}
