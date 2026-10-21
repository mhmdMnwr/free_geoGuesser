#!/usr/bin/env node
/**
 * Test: Admission gate flow
 * 1. Host creates lobby
 * 2. Guest sends join_lobby → gets admission_pending (NOT lobby_joined)
 * 3. Host sends admit_player → Guest gets lobby_joined
 * 4. Kick logic test
 */
const socketIo = require('../frontend/node_modules/socket.io-client');
const io = socketIo.io || socketIo.default || socketIo;

const URL = 'http://localhost:5000';
let passed = 0, failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}`); failed++; }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\n=== ADMISSION GATE FLOW TEST ===\n');

  const hostSocket = io(URL, { query: { clientId: 'host-test-1', isBrowser: 'true' }, transports: ['polling'] });
  const guestSocket = io(URL, { query: { clientId: 'guest-test-1', isBrowser: 'true' }, transports: ['polling'] });

  await new Promise(r => {
    let c = 0;
    [hostSocket, guestSocket].forEach(s => s.on('connect', () => { if (++c === 2) r(); }));
  });
  console.log('Both clients connected.');

  // ── Test 1: Lobby list starts empty (no LAN-01) ──
  console.log('\n[1] Lobby list visibility');
  const lobbies1 = await new Promise(r => {
    hostSocket.once('lobbies_list', r);
    hostSocket.emit('get_lobbies');
  });
  assert('Lobby list is an array', Array.isArray(lobbies1));
  assert('LAN-01 NOT in public list', !lobbies1.find(l => l.id === 'LAN-01'));
  console.log(`    Found ${lobbies1.length} lobbies`);

  // ── Test 2: Create lobby ──
  console.log('\n[2] Host creates lobby');
  const lobbyJoined = await new Promise(r => {
    hostSocket.emit('create_lobby', { username: 'HOSTPLAYER', name: 'TestSquad' });
    hostSocket.once('lobby_joined', r);
  });
  assert('Host gets lobby_joined', Boolean(lobbyJoined.roomId));
  assert('Host role is HOST', lobbyJoined.role === 'HOST');
  const roomId = lobbyJoined.roomId;
  console.log(`    Room: ${roomId}`);

  // ── Test 3: Lobby visible after creation ──
  await sleep(300);
  const lobbies2 = await new Promise(r => {
    hostSocket.once('lobbies_list', r);
    hostSocket.emit('get_lobbies');
  });
  assert('New room appears in lobby list', Boolean(lobbies2.find(l => l.id === roomId)));

  // ── Test 4: Guest gets admission_pending (NOT lobby_joined) ──
  console.log('\n[3] Guest join → admission gate');
  const { guestEvent, hostEvent } = await new Promise(r => {
    let result = {};
    guestSocket.once('admission_pending', (d) => { result.guestEvent = { type: 'admission_pending', ...d }; if (result.hostEvent) r(result); });
    guestSocket.once('lobby_joined', (d) => { result.guestEvent = { type: 'lobby_joined', ...d }; if (result.hostEvent) r(result); });
    hostSocket.once('admission_request', (d) => { result.hostEvent = d; if (result.guestEvent) r(result); });
    guestSocket.emit('join_lobby', { roomId, username: 'GUESTPLAYER' });
    setTimeout(() => r(result), 3000);
  });
  assert('Guest gets admission_pending (not lobby_joined)', guestEvent?.type === 'admission_pending');
  assert('Host receives admission_request', Boolean(hostEvent?.clientId));
  assert('Admission request has correct username', hostEvent?.username === 'GUESTPLAYER');

  // ── Test 5: Host admits guest ──
  console.log('\n[4] Host admits guest');
  const guestAdmitted = await new Promise(r => {
    guestSocket.once('lobby_joined', r);
    hostSocket.emit('admit_player', { roomId, targetClientId: 'guest-test-1' });
    setTimeout(() => r(null), 3000);
  });
  assert('Guest gets lobby_joined after admit', Boolean(guestAdmitted?.roomId));
  assert('Guest role is OPERATIVE', guestAdmitted?.role === 'OPERATIVE');

  // ── Test 6: Kick player ──
  console.log('\n[5] Host kicks guest');
  const kickEvent = await new Promise(r => {
    guestSocket.once('kicked_from_lobby', r);
    hostSocket.emit('kick_player', { roomId, targetId: 'guest-test-1' });
    setTimeout(() => r(null), 3000);
  });
  assert('Guest receives kicked_from_lobby', Boolean(kickEvent));

  // ── Test 7: Reject flow ──
  console.log('\n[6] Reject flow');
  await sleep(300);
  // Guest rejoins
  const guest2Socket = io(URL, { query: { clientId: 'guest-test-2', isBrowser: 'true' }, transports: ['polling'] });
  await new Promise(r => guest2Socket.on('connect', r));

  const { pendingEvt } = await new Promise(r => {
    let res = {};
    guest2Socket.once('admission_pending', (d) => { res.pendingEvt = d; r(res); });
    guest2Socket.once('lobby_joined', (d) => { res.pendingEvt = null; r(res); });
    hostSocket.once('admission_request', () => {});
    guest2Socket.emit('join_lobby', { roomId, username: 'GUEST2' });
    setTimeout(() => r(res), 3000);
  });
  assert('Second guest gets admission_pending', Boolean(pendingEvt));

  const rejectedEvt = await new Promise(r => {
    guest2Socket.once('admission_rejected', r);
    hostSocket.emit('reject_player', { roomId, targetClientId: 'guest-test-2' });
    setTimeout(() => r(null), 3000);
  });
  assert('Second guest gets admission_rejected', Boolean(rejectedEvt));

  hostSocket.disconnect();
  guestSocket.disconnect();
  guest2Socket.disconnect();

  console.log(`\n═══════════════════════════════`);
  console.log(`PASSED: ${passed}  FAILED: ${failed}`);
  console.log(`═══════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
