import { Injectable, Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { GameService } from '../game.service';
import { CryptoService } from '../../security/crypto.service';
import { getClientId, getClientIp } from './connection.handler';
import { GameRoom } from '../game.types';

@Injectable()
export class GuessHandler {
  private readonly logger = new Logger(GuessHandler.name);

  constructor(
    private readonly gameService: GameService,
    private readonly crypto: CryptoService,
  ) {}

  handlePlacePin(socket: Socket, room: GameRoom, data: any) {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const player = room.players[clientId] || room.players[ip];
    if (!player || player.hasGuessed) return;

    const lat = parseFloat(data?.lat);
    const lng = parseFloat(data?.lng);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      player.currentPin = { lat, lng };
    }
  }

  handleLockGuess(socket: Socket, server: Server, room: GameRoom, data: any): { ok: boolean; error?: string } {
    const ip = getClientIp(socket);
    const clientId = getClientId(socket);
    const playerKey = Object.keys(room.players).find(
      (k) => k === clientId || k === ip || room.players[k]?.socketId === socket.id,
    );
    if (!playerKey) {
      return { ok: false, error: 'Operative not found in this squad.' };
    }
    const player = room.players[playerKey];
    if (player.hasGuessed) {
      return { ok: true };
    }

    if (room.status !== 'ROUND_ACTIVE' && room.status !== 'ROUND_COUNTDOWN') {
      return { ok: false, error: 'Round is no longer accepting guesses.' };
    }

    let coords: { lat: number; lng: number } | null = null;
    const encPayload = data?.encryptedGuess || data?.encrypted;
    if (encPayload && player.aesKey) {
      try {
        coords = this.crypto.decryptPayload(encPayload, player.aesKey);
      } catch (err: any) {
        socket.emit('error_message', { message: 'Decryption failed for secure guess.' });
        return { ok: false, error: 'Decryption failed for secure guess.' };
      }
    } else if (data?.lat !== undefined && data?.lng !== undefined) {
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        coords = { lat, lng };
      }
    } else if (player.currentPin) {
      coords = player.currentPin;
    }

    if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number' ||
        isNaN(coords.lat) || isNaN(coords.lng) ||
        coords.lat < -90 || coords.lat > 90 || coords.lng < -180 || coords.lng > 180) {
      socket.emit('error_message', { message: 'Invalid coordinates for guess.' });
      return { ok: false, error: 'Invalid coordinates for guess.' };
    }

    this.gameService.guessEvaluator.handleGuessSubmission(room, server, playerKey, coords);
    return { ok: true };
  }
}
