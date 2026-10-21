#!/usr/bin/env node
/**
 * Multi-lobby investigation script
 * Tests: visibility, player counts, host-leave cleanup, guest kick on host leave
 */
const socketIo = require('../frontend/node_modules/socket.io-client');
const io = socketIo.io || socketIo.default || socketIo;
const URL = 'http://localhost:5000';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function mkSocket(clientId) {
  return io(URL, { query: { clientId, isBrowser: 'true' }, transports: ['polling'] });
}

async function waitFor(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (d) => { clearTimeout(t); resolve(d); });
  });
}

async function run() {
  console.log('\n=== MULTI-LOBBY INVESTIGATION ===\n');

  const h1 = mkSocket('inv-h1');
  const h2 = mkSocket('inv-h2');
  const g1 = mkSocket('inv-g1');
  const obs = mkSocket('inv-obs'); // observer only

  await new Promise(r => {
    let c = 0;
    [h1, h2, g1, obs].forEach(s => s.on('connect', () => { if (++c === 4) r(); }));
  });
  console.log('✓ 4 clients connected\n');

  let lobbyAId, lobbyBId;

  // ── 1. Initial lobby list ──
  const lst0 = await waitFor(obs, 'lobbies_list', 3000).catch(() => []);
  obs.emit('get_lobbies');
  const lst0b = await waitFor(obs, 'lobbies_list', 3000);
  console.log(`[1] Initial lobbies visible to observer: ${lst0b.length}`);
  lst0b.forEach(l => console.log(`     ${l.id} | ${l.name} | players:${l.playerCount} | status:${l.status}`));

  // ── 2. Host1 creates Lobby A ──
  console.log('\n[2] Host1 creates Lobby A');
  h1.emit('create_lobby', { username: 'ALPHA', name: 'Alpha Base' });
  const joinedA = await waitFor(h1, 'lobby_joined');
  lobbyAId = joinedA.roomId;
  console.log(`    Created: ${lobbyAId} players=${joinedA.players?.length}`);

  // ── 3. Host2 creates Lobby B ──
  await sleep(200);
  console.log('\n[3] Host2 creates Lobby B');
  h2.emit('create_lobby', { username: 'BRAVO', name: 'Bravo Base' });
  const joinedB = await waitFor(h2, 'lobby_joined');
  lobbyBId = joinedB.roomId;
  console.log(`    Created: ${lobbyBId} players=${joinedB.players?.length}`);

  // ── 4. Observer sees both ──
  await sleep(300);
  obs.emit('get_lobbies');
  const lst1 = await waitFor(obs, 'lobbies_list', 3000);
  console.log(`\n[4] Observer sees ${lst1.length} lobbies:`);
  lst1.forEach(l => console.log(`     ${l.id} | players:${l.playerCount}/${l.maxPlayers} | status:${l.status}`));
  const seesA = lst1.some(l => l.id === lobbyAId);
  const seesB = lst1.some(l => l.id === lobbyBId);
  console.log(`    Sees Lobby A: ${seesA ? 'YES ✓' : 'NO ✗'}`);
  console.log(`    Sees Lobby B: ${seesB ? 'YES ✓' : 'NO ✗'}`);

  // ── 5. Guest1 joins Lobby A (admission flow) ──
  console.log('\n[5] Guest1 requests entry to Lobby A');
  g1.emit('join_lobby', { roomId: lobbyAId, username: 'GAMMA' });
  const pendingEvt = await waitFor(g1, 'admission_pending', 3000).catch(() => null);
  const admReq = await waitFor(h1, 'admission_request', 3000).catch(() => null);
  if (pendingEvt) console.log(`    Guest1 got admission_pending ✓`);
  if (admReq) {
    console.log(`    Host1 got admission_request from ${admReq.username} ✓`);
    h1.emit('admit_player', { roomId: lobbyAId, targetClientId: admReq.clientId });
  }
  const admittedEvt = await waitFor(g1, 'lobby_joined', 4000).catch(() => null);
  if (admittedEvt) console.log(`    Guest1 admitted to ${admittedEvt.roomId} ✓  players=${admittedEvt.players?.length}`);

  // ── 6. Observer: Lobby A should now show 2 players ──
  await sleep(300);
  obs.emit('get_lobbies');
  const lst2 = await waitFor(obs, 'lobbies_list', 3000);
  const lobbyAInfo = lst2.find(l => l.id === lobbyAId);
  console.log(`\n[6] Lobby A player count after guest joined: ${lobbyAInfo?.playerCount}`);

  // ── 7. Host1 disconnects abruptly → should terminate Lobby A ──
  console.log('\n[7] Host1 DISCONNECTS abruptly...');
  const terminatedP = waitFor(g1, 'lobby_terminated', 12000);
  h1.disconnect();
  let terminated = null;
  try {
    terminated = await terminatedP;
    console.log(`    Guest1 got lobby_terminated ✓  msg: "${terminated.message}"`);
  } catch {
    console.log(`    Guest1 did NOT get lobby_terminated ✗`);
  }

  // ── 8. Lobby A should be gone from list ──
  await sleep(500);
  obs.emit('get_lobbies');
  const lst3 = await waitFor(obs, 'lobbies_list', 3000);
  console.log(`\n[8] Lobbies after host1 disconnected: ${lst3.length}`);
  lst3.forEach(l => console.log(`     ${l.id} | players:${l.playerCount} | status:${l.status}`));
  const aGone = !lst3.some(l => l.id === lobbyAId);
  console.log(`    Lobby A deleted: ${aGone ? 'YES ✓' : 'NO ✗'}`);
  console.log(`    Lobby B still exists: ${lst3.some(l => l.id === lobbyBId) ? 'YES ✓' : 'NO ✗'}`);

  // ── 9. Host2 leaves voluntarily → Lobby B deleted ──
  console.log('\n[9] Host2 leaves voluntarily...');
  h2.emit('leave_lobby', { roomId: lobbyBId, isHost: true });
  await sleep(1000);
  obs.emit('get_lobbies');
  const lst4 = await waitFor(obs, 'lobbies_list', 3000);
  console.log(`    Lobbies after host2 left: ${lst4.length}`);
  console.log(`    Lobby B deleted: ${!lst4.some(l => l.id === lobbyBId) ? 'YES ✓' : 'NO ✗'}`);

  // ── 10. Reconnection test ──
  console.log('\n[10] Testing guest reconnect with stale roomId...');
  const g2 = mkSocket('inv-g2');
  await new Promise(r => g2.on('connect', r));
  g2.emit('join_lobby', { roomId: lobbyAId, username: 'DELTA' }); // stale room
  const errEvt = await waitFor(g2, 'error_message', 3000).catch(() => null);
  console.log(`    Stale roomId error: ${errEvt?.message || 'NO ERROR (bad)'}`);
  g2.disconnect();

  h2.disconnect();
  g1.disconnect();
  obs.disconnect();

  console.log('\n=== INVESTIGATION COMPLETE ===\n');
  process.exit(0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
