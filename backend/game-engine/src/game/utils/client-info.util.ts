import { Socket } from 'socket.io';

export function getClientIp(socket: Socket): string {
  const queryIp = socket.handshake.query?.mockIp as string;
  if (queryIp) return queryIp;

  const header = (socket.handshake.headers['x-forwarded-for'] as string) || '';
  if (header) {
    const first = header.split(',')[0].trim();
    return first.replace(/^::ffff:/, '');
  }
  const raw = socket.handshake.address || '';
  return raw.replace(/^::ffff:/, '');
}

export function getClientId(socket: Socket): string {
  return (socket.handshake.query?.clientId as string) || socket.id;
}
