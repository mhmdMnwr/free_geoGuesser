import * as os from 'os';
import { Socket } from 'socket.io';
import { Request } from 'express';
import { GeoLocation } from './game.types';

export function getLanAddresses(): { interface: string; address: string }[] {
  const interfaces = os.networkInterfaces();
  const addresses: { interface: string; address: string }[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ interface: name, address: iface.address });
      }
    }
  }
  return addresses;
}

export function getClientIp(socket: Socket, allowDevMock = true): string {
  let rawIp =
    (socket.handshake?.headers?.['cf-connecting-ip'] as string) ||
    ((socket.handshake?.headers?.['x-forwarded-for'] as string)?.split(',')[0].trim()) ||
    socket.handshake.address ||
    (socket.request as any)?.socket?.remoteAddress ||
    (socket.request as any)?.connection?.remoteAddress ||
    'unknown';

  if (rawIp.startsWith('::ffff:')) {
    rawIp = rawIp.substring(7);
  }
  if (rawIp === '::1') {
    rawIp = '127.0.0.1';
  }

  const isLocalOrigin =
    rawIp === '127.0.0.1' ||
    rawIp === 'localhost' ||
    process.env.NODE_ENV === 'test';

  const devMockAllowed =
    allowDevMock &&
    process.env.NODE_ENV !== 'production' &&
    (isLocalOrigin || process.env.NODE_ENV === 'test');

  if (devMockAllowed && socket.handshake.query?.mockIp) {
    return String(socket.handshake.query.mockIp).trim();
  }

  return rawIp;
}

export function getClientId(socket: Socket): string {
  const token =
    (socket.handshake?.query?.clientId as string) ||
    (socket.handshake?.auth?.clientId as string) ||
    (socket.handshake?.query?.sessionToken as string) ||
    (socket.handshake?.auth?.sessionToken as string) ||
    (socket.handshake?.query?.mockIp as string);
  if (token && typeof token === 'string' && token.trim()) {
    return token.trim();
  }
  const ip = getClientIp(socket);
  return `${ip}_${socket.id}`;
}

export function getReqClientIp(req: Request, allowDevMock = true): string {
  let rawIp =
    (req.headers['cf-connecting-ip'] as string) ||
    ((req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()) ||
    req.socket?.remoteAddress ||
    (req.connection as any)?.remoteAddress ||
    req.ip ||
    'unknown';

  if (rawIp.startsWith('::ffff:')) {
    rawIp = rawIp.substring(7);
  }
  if (rawIp === '::1') {
    rawIp = '127.0.0.1';
  }

  const isLocalOrigin =
    rawIp === '127.0.0.1' ||
    rawIp === 'localhost' ||
    process.env.NODE_ENV === 'test';

  const devMockAllowed =
    allowDevMock &&
    process.env.NODE_ENV !== 'production' &&
    (isLocalOrigin || process.env.NODE_ENV === 'test');

  if (devMockAllowed && req.query?.mockIp) {
    return String(req.query.mockIp).trim();
  }

  return rawIp;
}

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's mean radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
  return R * c;
}

export function calculateScore(distanceKm: number | null | undefined): number {
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) {
    return 0;
  }
  if (distanceKm <= 0.025) return 5000;
  const score = Math.round(5000 * Math.exp(-distanceKm / 2000));
  return Math.max(0, Math.min(5000, score));
}

export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function selectDiverseMatchLocations(
  pool: GeoLocation[],
  totalRounds = 10,
): GeoLocation[] {
  if (!pool || pool.length === 0) return [];

  const byCountry: Record<string, GeoLocation[]> = {};
  for (const loc of pool) {
    const parts = (loc.label || '').split(',').map((s) => s.trim());
    const country = loc.country || parts[parts.length - 1] || 'Unknown';
    if (!byCountry[country]) byCountry[country] = [];
    byCountry[country].push(loc);
  }

  const distinctCountries = shuffleArray(Object.keys(byCountry));
  const selected: GeoLocation[] = [];

  // Pass 1: Select 1 random location per distinct country
  for (const country of distinctCountries) {
    if (selected.length >= totalRounds) break;
    const countryLocs = byCountry[country];
    const pick = countryLocs[Math.floor(Math.random() * countryLocs.length)];
    selected.push(pick);
  }

  // Pass 2: If pool has fewer distinct countries than totalRounds, pick remaining locations
  if (selected.length < totalRounds) {
    const remaining = pool.filter((l) => !selected.includes(l));
    const shuffledRemaining = shuffleArray(remaining);
    selected.push(...shuffledRemaining.slice(0, totalRounds - selected.length));
  }

  return shuffleArray(selected);
}

/**
 * Strips internal state, province, or county names from location labels to prevent spoilers
 */
export function sanitizeLocationLabel(target: { label?: string; country?: string }): string {
  if (target.country) {
    return `Highway Route, ${target.country}`;
  }
  if (!target.label) return 'Classified Highway Route';
  const commaIdx = target.label.lastIndexOf(',');
  if (commaIdx !== -1) {
    const country = target.label.substring(commaIdx + 1).trim();
    return `Highway Route, ${country}`;
  }
  return target.label.replace(/^Road in\s+[^,]+,\s*/i, 'Highway Route, ');
}
