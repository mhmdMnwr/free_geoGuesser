import { Socket } from 'socket.io';

export function getClientIp(socket: Socket): string {
  if (process.env.NODE_ENV !== 'production') {
    const queryIp = socket.handshake.query?.mockIp as string;
    if (queryIp) return queryIp;
  }

  const header = (socket.handshake.headers['x-forwarded-for'] as string) || '';
  if (header) {
    const first = header.split(',')[0].trim();
    return first.replace(/^::ffff:/, '');
  }
  const raw = socket.handshake.address || '';
  return raw.replace(/^::ffff:/, '');
}

export function getClientId(socket: Socket): string {
  const authId = socket.handshake.auth?.clientId as string;
  const queryId = socket.handshake.query?.clientId as string;
  return authId || queryId || socket.id;
}
