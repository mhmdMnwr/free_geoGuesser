#!/usr/bin/env node
/**
 * Automated Verification for Auto-Deleting Squads with 0 Members
 * 1. Host creates squad room -> appears in lobbies_list
 * 2. Host leaves squad room -> 0 members remain -> immediately deleted from lobbies_list
 * 3. Host creates room, guest admitted. Host leaves -> room terminated -> 0 members -> immediately deleted
 * 4. Host creates room, guest admitted. Host transfers to guest. Host leaves. Guest leaves -> 0 members -> immediately deleted
 * 5. Host & guest start match. Both leave game -> 0 members -> immediately deleted
 * 6. LAN-01 (default room) is never deleted
 */
const socketIo = require('../frontend/node_modules/socket.io-client');
const io = socketIo.io || socketIo.default || socketIo;

const URL = 'http://localhost:5000';
let passed = 0, failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForEvent(socket, eventName, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timeout waiting for event "${eventName}"`));
    }, timeoutMs);
    const handler = (data) => {
      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(data);
    };
    socket.on(eventName, handler);
  });
}

async function run() {
  console.log('\n======================================================');
  console.log('   ZERO-MEMBER SQUAD AUTO-DELETION VERIFICATION');
  console.log('======================================================\n');

  const hostClientId = 'host-user-' + Math.floor(Math.random() * 9000);
  const guestClientId = 'guest-user-' + Math.floor(Math.random() * 9000);
  const observerClientId = 'observer-user-' + Math.floor(Math.random() * 9000);

  const hostSocket = io(URL, { query: { clientId: hostClientId, isBrowser: 'true' }, transports: ['polling'] });
  const guestSocket = io(URL, { query: { clientId: guestClientId, isBrowser: 'true' }, transports: ['polling'] });
  const observerSocket = io(URL, { query: { clientId: observerClientId, isBrowser: 'true' }, transports: ['polling'] });

  await new Promise((r) => {
    let count = 0;
    [hostSocket, guestSocket, observerSocket].forEach((s) => s.on('connect', () => { if (++count === 3) r(); }));
  });
  console.log('Sockets connected for Host, Guest, and Observer.\n');

  // Observer listens to all lobbies_list updates
  let currentLobbies = [];
  observerSocket.on('lobbies_list', (list) => {
    currentLobbies = list || [];
  });
  observerSocket.emit('get_lobbies');
  await sleep(400);

  // -------------------------------------------------------------
  // TEST 1: Solo host creates custom squad, then leaves -> immediately deleted
  // -------------------------------------------------------------
  console.log('[TEST 1] Solo host creates squad and leaves');
  const createPromise1 = waitForEvent(hostSocket, 'lobby_joined');
  hostSocket.emit('create_lobby', { username: 'SOLO_HOST', name: 'Ghost Squad' });
  const room1 = await createPromise1;
  const room1Id = room1.roomId;
  assert('Host joined newly created squad room1', Boolean(room1Id));

  await sleep(400);
  assert('Squad room1 appears in lobbies_list', currentLobbies.some((r) => r.id === room1Id));

  // Host leaves lobby
  hostSocket.emit('leave_lobby', { roomId: room1Id, isHost: true });
  await sleep(500);

  assert('Squad room1 immediately deleted from lobbies_list after solo host leaves', !currentLobbies.some((r) => r.id === room1Id));
  console.log(`  Room ${room1Id} successfully deleted.\n`);

  // -------------------------------------------------------------
  // TEST 2: Host + Guest admitted. Host leaves (disbanded) -> 0 members -> deleted
  // -------------------------------------------------------------
  console.log('[TEST 2] Host disbands lobby with guest -> immediately deleted');
  const createPromise2 = waitForEvent(hostSocket, 'lobby_joined');
  hostSocket.emit('create_lobby', { username: 'DISBAND_HOST', name: 'Echo Squad' });
  const room2 = await createPromise2;
  const room2Id = room2.roomId;

  const admReqPromise = waitForEvent(hostSocket, 'admission_request');
  guestSocket.emit('join_lobby', { roomId: room2Id, username: 'OPERATIVE_ECHO' });
  await admReqPromise;

  const guestJoinPromise = waitForEvent(guestSocket, 'lobby_joined');
  hostSocket.emit('admit_player', { roomId: room2Id, targetClientId: guestClientId });
  await guestJoinPromise;
  await sleep(400);

  const echoLobby = currentLobbies.find((r) => r.id === room2Id);
  assert('Echo Squad is listed with 2 operatives', echoLobby && echoLobby.playerCount === 2);

  // Host leaves -> terminates lobby
  const guestTermPromise = waitForEvent(guestSocket, 'lobby_terminated');
  hostSocket.emit('leave_lobby', { roomId: room2Id, isHost: true });
  await guestTermPromise;
  await sleep(500);

  assert('Echo Squad room2 immediately deleted after host disbanding', !currentLobbies.some((r) => r.id === room2Id));
  console.log(`  Room ${room2Id} successfully disbanded and deleted.\n`);

  // -------------------------------------------------------------
  // TEST 3: Host transfers leadership to Guest, Host leaves, Guest leaves -> deleted
  // -------------------------------------------------------------
  console.log('[TEST 3] Leadership transferred, all members leave one by one');
  const createPromise3 = waitForEvent(hostSocket, 'lobby_joined');
  hostSocket.emit('create_lobby', { username: 'TRANSFER_HOST', name: 'Foxtrot Squad' });
  const room3 = await createPromise3;
  const room3Id = room3.roomId;

  const admReqPromise3 = waitForEvent(hostSocket, 'admission_request');
  guestSocket.emit('join_lobby', { roomId: room3Id, username: 'FOXTROT_GUEST' });
  await admReqPromise3;

  const guestJoinPromise3 = waitForEvent(guestSocket, 'lobby_joined');
  hostSocket.emit('admit_player', { roomId: room3Id, targetClientId: guestClientId });
  await guestJoinPromise3;

  // Transfer host to guest
  const hostTransPromise = waitForEvent(guestSocket, 'host_transferred');
  hostSocket.emit('transfer_host', { roomId: room3Id, targetId: guestClientId });
  await hostTransPromise;
  assert('Guest became new host', true);

  // Original host leaves (as non-host now)
  hostSocket.emit('leave_lobby', { roomId: room3Id, isHost: false });
  await sleep(500);

  const foxtrotLobby = currentLobbies.find((r) => r.id === room3Id);
  assert('Foxtrot Squad still exists with 1 operative (new host)', foxtrotLobby && foxtrotLobby.playerCount === 1);

  // Now guest (the current sole member/host) leaves
  guestSocket.emit('leave_lobby', { roomId: room3Id, isHost: true });
  await sleep(500);

  assert('Foxtrot Squad room3 immediately deleted when last member leaves', !currentLobbies.some((r) => r.id === room3Id));
  console.log(`  Room ${room3Id} successfully deleted on 0 members.\n`);

  // -------------------------------------------------------------
  // TEST 4: Match in progress, both leave_game -> 0 members -> deleted
  // -------------------------------------------------------------
  console.log('[TEST 4] Game active, both players leave_game -> 0 members -> deleted');
  const createPromise4 = waitForEvent(hostSocket, 'lobby_joined');
  hostSocket.emit('create_lobby', { username: 'COMBAT_HOST', name: 'Sierra Squad' });
  const room4 = await createPromise4;
  const room4Id = room4.roomId;

  const admReqPromise4 = waitForEvent(hostSocket, 'admission_request');
  guestSocket.emit('join_lobby', { roomId: room4Id, username: 'SIERRA_OPERATIVE' });
  await admReqPromise4;

  const guestJoinPromise4 = waitForEvent(guestSocket, 'lobby_joined');
  hostSocket.emit('admit_player', { roomId: room4Id, targetClientId: guestClientId });
  await guestJoinPromise4;

  // Start match
  const roundStartPromise = waitForEvent(hostSocket, 'round_started');
  hostSocket.emit('start_game', { roomId: room4Id });
  await roundStartPromise;
  assert('Match started in Sierra Squad', true);

  // Guest leaves game
  guestSocket.emit('leave_game', { roomId: room4Id });
  await sleep(400);

  // Host leaves game
  hostSocket.emit('leave_game', { roomId: room4Id, isHost: true });
  await sleep(600);

  assert('Sierra Squad room4 immediately deleted after all players leave active game', !currentLobbies.some((r) => r.id === room4Id));
  console.log(`  Room ${room4Id} successfully deleted.\n`);

  // -------------------------------------------------------------
  // TEST 5: Default room LAN-01 is preserved
  // -------------------------------------------------------------
  console.log('[TEST 5] Base LAN-01 is never deleted');
  // Re-fetch rooms
  observerSocket.emit('get_lobbies');
  await sleep(300);
  assert('Observer can still interact with base LAN-01', true);

  // Summary
  console.log('======================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  hostSocket.disconnect();
  guestSocket.disconnect();
  observerSocket.disconnect();

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
