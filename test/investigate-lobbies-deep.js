#!/usr/bin/env node
/**
 * Deep investigation: edge cases & problem areas
 */
const socketIo = require('../frontend/node_modules/socket.io-client');
const io = socketIo.io || socketIo.default || socketIo;
const URL = 'http://localhost:5000';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function mkSocket(id) { return io(URL, { query: { clientId: id, isBrowser: 'true' }, transports: ['polling'] }); }
async function waitFor(s, evt, ms=4000) {
  return new Promise((res,rej)=>{ const t=setTimeout(()=>rej(new Error(`timeout:${evt}`)),ms); s.once(evt,d=>{clearTimeout(t);res(d);}); });
}

let issues = [];
function report(label, ok, detail='') {
  const sym = ok ? '  ✓' : '  ✗ ISSUE';
  console.log(`${sym} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) issues.push(label);
}

async function run() {
  console.log('\n=== DEEP INVESTIGATION: Edge Cases ===\n');

  // ── A. STALE LOBBY CLEANUP ──
  console.log('[A] Stale lobby cleanup — host never heartbeats');
  {
    const h = mkSocket('edge-h1');
    await new Promise(r => h.on('connect', r));
    h.emit('create_lobby', { username: 'STALE_HOST', name: 'Stale Room' });
    const joined = await waitFor(h, 'lobby_joined');
    const roomId = joined.roomId;
    console.log(`    Created ${roomId}, now disconnecting without heartbeat...`);
    h.disconnect();
    // Wait the 8s host timeout
    await sleep(10000);
    const obs = mkSocket('edge-obs1');
    await new Promise(r => obs.on('connect', r));
    obs.emit('get_lobbies');
    const lst = await waitFor(obs, 'lobbies_list');
    const still = lst.find(l => l.id === roomId);
    report('Stale host room removed after disconnect timeout', !still, still ? `${roomId} still listed!` : 'cleaned');
    obs.disconnect();
  }

  // ── B. DUPLICATE CREATE — same user creates two rooms ──
  console.log('\n[B] User creates two lobbies (should fail second time)');
  {
    const h = mkSocket('edge-h2');
    await new Promise(r => h.on('connect', r));
    h.emit('create_lobby', { username: 'DOUBLE', name: 'Room 1' });
    const r1 = await waitFor(h, 'lobby_joined');
    console.log(`    First room: ${r1.roomId}`);
    // Create second — should this work? Right now there's no guard
    const errP = waitFor(h, 'error_message', 2000).catch(() => null);
    const r2P = waitFor(h, 'lobby_joined', 2000).catch(() => null);
    h.emit('create_lobby', { username: 'DOUBLE', name: 'Room 2' });
    const [err2, r2] = await Promise.all([errP, r2P]);
    if (r2) {
      report('User blocked from creating second lobby', false, `Created BOTH ${r1.roomId} and ${r2.roomId}`);
    } else if (err2) {
      report('User blocked from creating second lobby', true, err2.message);
    } else {
      report('User blocked from creating second lobby', false, 'No response at all');
    }
    // Cleanup
    h.emit('leave_lobby', { roomId: r1.roomId, isHost: true });
    await sleep(500);
    h.disconnect();
  }

  // ── C. GAME ISOLATION — two active games simultaneously ──
  console.log('\n[C] Two separate games running simultaneously');
  {
    const hA = mkSocket('edge-hA');
    const hB = mkSocket('edge-hB');
    const gA = mkSocket('edge-gA');
    await new Promise(r => { let c=0; [hA,hB,gA].forEach(s=>s.on('connect',()=>{if(++c===3)r();})); });

    hA.emit('create_lobby', { username: 'GAME_A_HOST', name: 'Game A' });
    const roomA = (await waitFor(hA, 'lobby_joined')).roomId;
    hB.emit('create_lobby', { username: 'GAME_B_HOST', name: 'Game B' });
    const roomB = (await waitFor(hB, 'lobby_joined')).roomId;
    console.log(`    Room A: ${roomA}, Room B: ${roomB}`);

    // Guest joins A
    gA.emit('join_lobby', { roomId: roomA, username: 'GAME_A_GUEST' });
    const pendA = await waitFor(gA, 'admission_pending', 3000).catch(()=>null);
    const reqA = await waitFor(hA, 'admission_request', 3000).catch(()=>null);
    if (reqA) hA.emit('admit_player', { roomId: roomA, targetClientId: reqA.clientId });
    await waitFor(gA, 'lobby_joined', 3000).catch(()=>null);

    // Start game A
    hA.emit('start_game', { roomId: roomA });
    const roundStartedA = await waitFor(hA, 'round_started', 5000).catch(()=>null);
    report('Game A starts independently', !!roundStartedA, roundStartedA ? `round ${roundStartedA.round}` : 'no round_started');

    // Does game B host get polluted by game A start?
    let polluted = false;
    hB.once('round_started', () => { polluted = true; });
    await sleep(1000);
    report('Game B NOT polluted by Game A start', !polluted);

    // Observer sees correct statuses
    const obs = mkSocket('edge-obs2');
    await new Promise(r => obs.on('connect', r));
    obs.emit('get_lobbies');
    const lst = await waitFor(obs, 'lobbies_list');
    const a = lst.find(l=>l.id===roomA);
    const b = lst.find(l=>l.id===roomB);
    console.log(`    Room A status in lobby list: ${a?.status}`);
    console.log(`    Room B status in lobby list: ${b?.status}`);
    report('Active game shows correct status in lobby list', a?.status !== 'LOBBY', `A is ${a?.status}`);
    report('Waiting room still shows LOBBY', b?.status === 'LOBBY', `B is ${b?.status}`);

    hA.emit('leave_lobby', { roomId: roomA, isHost: true });
    hB.emit('leave_lobby', { roomId: roomB, isHost: true });
    await sleep(300);
    [hA,hB,gA,obs].forEach(s=>s.disconnect());
  }

  // ── D. PLAYER COUNT ACCURACY ──
  console.log('\n[D] Player count accuracy in lobby list');
  {
    const h = mkSocket('edge-hD');
    const g1 = mkSocket('edge-gD1');
    const g2 = mkSocket('edge-gD2');
    await new Promise(r => { let c=0; [h,g1,g2].forEach(s=>s.on('connect',()=>{if(++c===3)r();})); });

    h.emit('create_lobby', { username: 'COUNT_HOST', name: 'Count Test' });
    const room = (await waitFor(h, 'lobby_joined')).roomId;

    // Admit g1
    const reqD1P = waitFor(h, 'admission_request', 3000).catch(()=>null);
    g1.emit('join_lobby', { roomId: room, username: 'COUNT_G1' });
    await waitFor(g1, 'admission_pending', 2000).catch(()=>{});
    const reqD1 = await reqD1P;
    if (reqD1) { h.emit('admit_player', { roomId: room, targetClientId: reqD1.clientId }); }
    await waitFor(g1, 'lobby_joined', 3000).catch(()=>{});

    // Admit g2
    const reqD2P = waitFor(h, 'admission_request', 3000).catch(()=>null);
    g2.emit('join_lobby', { roomId: room, username: 'COUNT_G2' });
    await waitFor(g2, 'admission_pending', 2000).catch(()=>{});
    const reqD2 = await reqD2P;
    if (reqD2) { h.emit('admit_player', { roomId: room, targetClientId: reqD2.clientId }); }
    await waitFor(g2, 'lobby_joined', 3000).catch(()=>{});
    await sleep(300);

    const obs = mkSocket('edge-obsD');
    await new Promise(r=>obs.on('connect',r));
    obs.emit('get_lobbies');
    const lst = await waitFor(obs, 'lobbies_list');
    const rm = lst.find(l=>l.id===room);
    report('3 players shows playerCount=3', rm?.playerCount===3, `got ${rm?.playerCount}`);

    // g1 disconnects
    g1.disconnect();
    await sleep(8000); // wait for grace period
    obs.emit('get_lobbies');
    const lst2 = await waitFor(obs, 'lobbies_list');
    const rm2 = lst2.find(l=>l.id===room);
    report('Player count decrements after disconnect', rm2?.playerCount===2, `got ${rm2?.playerCount}`);

    h.emit('leave_lobby', { roomId: room, isHost: true });
    await sleep(300);
    [h,g2,obs].forEach(s=>s.disconnect());
  }

  // ── Summary ──
  console.log('\n═══════════════════════════════════');
  if (issues.length === 0) {
    console.log('ALL CHECKS PASSED — no issues found');
  } else {
    console.log(`ISSUES FOUND (${issues.length}):`);
    issues.forEach(i => console.log(`  ✗ ${i}`));
  }
  console.log('═══════════════════════════════════\n');
  process.exit(0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
