const socketIo = require('../frontend/node_modules/socket.io-client');
const io = socketIo.io || socketIo.default || socketIo;

const GATEWAY_URL = 'http://localhost:5000';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('=== STARTING TEST: Exit Game and Refresh Behavior ===');

  // STEP 1: Host creates lobby and starts game
  console.log('\n--- Step 1: Host creates squad and starts game ---');
  const hostClientId = 'host_client_' + Date.now();
  const hostSocket = io(GATEWAY_URL, {
    transports: ['websocket'],
    query: { clientId: hostClientId, isBrowser: 'true' },
  });

  await new Promise((res) => hostSocket.on('connect', res));
  console.log('Host connected to gateway');

  let roomId = null;
  hostSocket.emit('create_lobby', {
    name: 'TEST-EXIT-SQUAD',
    username: 'HostAlpha',
    totalRounds: 3,
  });

  const hostLobbyJoined = await new Promise((res) => {
    hostSocket.on('lobby_joined', (data) => res(data));
  });
  roomId = hostLobbyJoined.roomId;
  console.log(`Lobby created with ID: ${roomId}, host: ${hostLobbyJoined.hostName}`);

  // STEP 2: Guest joins lobby
  console.log('\n--- Step 2: Guest joins squad ---');
  const guestClientId = 'guest_client_' + Date.now();
  const guestSocket = io(GATEWAY_URL, {
    transports: ['websocket'],
    query: { clientId: guestClientId, isBrowser: 'true', roomId },
  });

  await new Promise((res) => guestSocket.on('connect', res));
  console.log('Guest connected to gateway');

  guestSocket.emit('join_lobby', {
    roomId,
    username: 'GuestBravo',
  });

  await new Promise((res) => {
    guestSocket.on('lobby_joined', (data) => {
      console.log(`Guest joined lobby: ${data.roomId}`);
      res(data);
    });
  });

  // STEP 3: Host starts the game
  console.log('\n--- Step 3: Starting match ---');
  hostSocket.emit('start_game', { roomId });

  await Promise.all([
    new Promise((res) => hostSocket.on('round_started', (d) => {
      console.log(`Host received round_started: round ${d.round}`);
      res(d);
    })),
    new Promise((res) => guestSocket.on('round_started', (d) => {
      console.log(`Guest received round_started: round ${d.round}`);
      res(d);
    })),
  ]);

  // STEP 4: Host exits the match
  console.log('\n--- Step 4: Host exits the match ---');
  let guestReceivedTerminated = false;
  guestSocket.on('lobby_terminated', (data) => {
    console.log(`Guest received lobby_terminated event:`, data);
    guestReceivedTerminated = true;
  });

  hostSocket.emit('leave_lobby', { roomId, isHost: true });
  hostSocket.emit('leave_game', { roomId, isHost: true });

  await wait(1000);

  if (!guestReceivedTerminated) {
    throw new Error('FAIL: Guest did not receive lobby_terminated event when host exited!');
  }
  console.log('PASS: Guest successfully notified that lobby was terminated.');

  // Disconnect host and guest
  hostSocket.disconnect();
  guestSocket.disconnect();

  // STEP 5: Simulate browser refresh after host exit (query without roomId)
  console.log('\n--- Step 5: Simulate Host page refresh (neutral reconnect) ---');
  const refreshedHostSocket = io(GATEWAY_URL, {
    transports: ['websocket'],
    query: { clientId: hostClientId, isBrowser: 'true', roomId: '' },
  });

  let refreshedReceivedLobbyJoined = false;
  let refreshedReceivedRoundStarted = false;

  refreshedHostSocket.on('lobby_joined', (d) => {
    console.error('UNEXPECTED: Host received lobby_joined on refresh!', d);
    refreshedReceivedLobbyJoined = true;
  });
  refreshedHostSocket.on('round_started', (d) => {
    console.error('UNEXPECTED: Host received round_started on refresh!', d);
    refreshedReceivedRoundStarted = true;
  });

  await new Promise((res) => refreshedHostSocket.on('connect', res));
  console.log('Host refreshed socket connected');

  // Query lobbies list
  const lobbiesListPromise = new Promise((res) => {
    refreshedHostSocket.on('lobbies_list', res);
  });
  refreshedHostSocket.emit('get_lobbies');
  const lobbiesList = await lobbiesListPromise;
  console.log(`Current active lobbies count: ${lobbiesList.length}`);
  const foundRoom = lobbiesList.find((r) => r.id === roomId);
  if (foundRoom) {
    throw new Error(`FAIL: Terminated room ${roomId} still exists in lobbies list!`);
  }
  console.log(`PASS: Room ${roomId} was deleted from active lobbies.`);

  await wait(1500);

  if (refreshedReceivedLobbyJoined || refreshedReceivedRoundStarted) {
    throw new Error('FAIL: Refreshed host was resurrected into deleted game!');
  }
  console.log('PASS: Refreshed host stayed in neutral state (no phantom game resurrection).');

  // STEP 6: Simulate host refreshing with stale roomId in cookie
  console.log('\n--- Step 6: Simulate Host refresh with stale roomId in cookie ---');
  const staleHostSocket = io(GATEWAY_URL, {
    transports: ['websocket'],
    query: { clientId: hostClientId, isBrowser: 'true', roomId },
  });

  let staleReceivedLobbyJoined = false;
  staleHostSocket.on('lobby_joined', () => { staleReceivedLobbyJoined = true; });

  const errorMessagePromise = new Promise((res) => {
    staleHostSocket.on('error_message', res);
  });

  await new Promise((res) => staleHostSocket.on('connect', res));
  staleHostSocket.emit('join_lobby', { roomId, username: 'HostAlpha' });

  const errMsg = await Promise.race([
    errorMessagePromise,
    wait(2000).then(() => null),
  ]);

  if (!errMsg) {
    throw new Error('FAIL: Server did not return error_message when attempting to join terminated room!');
  }
  console.log(`PASS: Server returned expected error for terminated room: "${errMsg.message}"`);

  if (staleReceivedLobbyJoined) {
    throw new Error('FAIL: Host was admitted into non-existent room!');
  }
  console.log('PASS: Host was not admitted into terminated room.');

  refreshedHostSocket.disconnect();
  staleHostSocket.disconnect();

  // STEP 7: Guest exit behavior
  console.log('\n--- Step 7: Test Guest exit behavior (room stays open, guest removed) ---');
  const host2 = io(GATEWAY_URL, {
    transports: ['websocket'],
    query: { clientId: 'host2_' + Date.now(), isBrowser: 'true' },
  });
  await new Promise((res) => host2.on('connect', res));
  host2.emit('create_lobby', { name: 'GUEST-EXIT-TEST', username: 'Leader2' });
  const room2Data = await new Promise((res) => host2.on('lobby_joined', res));
  const room2Id = room2Data.roomId;

  const guest2Id = 'guest2_' + Date.now();
  const guest2 = io(GATEWAY_URL, {
    transports: ['websocket'],
    query: { clientId: guest2Id, isBrowser: 'true', roomId: room2Id },
  });
  await new Promise((res) => guest2.on('connect', res));
  guest2.emit('join_lobby', { roomId: room2Id, username: 'GuestLeaving' });
  await new Promise((res) => guest2.on('lobby_joined', res));

  // Guest exits
  guest2.emit('leave_lobby', { roomId: room2Id });
  await wait(500);

  // Check that room still exists for host
  const hostCheckList = new Promise((res) => host2.on('lobbies_list', res));
  host2.emit('get_lobbies');
  const list2 = await hostCheckList;
  const room2 = list2.find((r) => r.id === room2Id);
  if (!room2) {
    throw new Error('FAIL: Room was deleted when only guest left!');
  }
  console.log(`PASS: Room ${room2Id} correctly remains open with ${room2.playerCount} player(s).`);

  // Guest re-connects without room: should NOT be put back in room2
  guest2.disconnect();
  const guest2Refreshed = io(GATEWAY_URL, {
    transports: ['websocket'],
    query: { clientId: guest2Id, isBrowser: 'true', roomId: '' },
  });
  let guestResurrected = false;
  guest2Refreshed.on('lobby_joined', () => { guestResurrected = true; });
  await new Promise((res) => guest2Refreshed.on('connect', res));
  await wait(1000);

  if (guestResurrected) {
    throw new Error('FAIL: Exited guest was resurrected into squad on refresh!');
  }
  console.log('PASS: Exited guest was not resurrected on refresh.');

  host2.disconnect();
  guest2Refreshed.disconnect();

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Clean exit and refresh verified.');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
