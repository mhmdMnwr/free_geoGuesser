#!/usr/bin/env node
/**
 * Automated Verification for New Features:
 * 1. Entry notification: 'player_entered_lobby' emitted on admission
 * 2. Mid-game admission: host can admit guest during active round, guest gets round_started
 * 3. Stop & Lobby: host can reset active match back to LOBBY, all players receive return_to_lobby
 * 4. UI check: static menu landing page, navigation to squad browser, back button to main menu
 */
const socketIo = require('../frontend/node_modules/socket.io-client');
const io = socketIo.io || socketIo.default || socketIo;
const { spawn } = require('child_process');
const http = require('http');

const URL = 'http://localhost:5000';
let passed = 0, failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}`); failed++; }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\n======================================================');
  console.log('   NEW FEATURES INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  const hostClientId = 'host-user-' + Math.floor(Math.random() * 9000);
  const guest1ClientId = 'guest1-user-' + Math.floor(Math.random() * 9000);
  const guest2ClientId = 'guest2-user-' + Math.floor(Math.random() * 9000);

  const hostSocket = io(URL, { query: { clientId: hostClientId, isBrowser: 'true' }, transports: ['polling'] });
  const guest1Socket = io(URL, { query: { clientId: guest1ClientId, isBrowser: 'true' }, transports: ['polling'] });
  const guest2Socket = io(URL, { query: { clientId: guest2ClientId, isBrowser: 'true' }, transports: ['polling'] });

  await new Promise(r => {
    let count = 0;
    [hostSocket, guest1Socket, guest2Socket].forEach(s => s.on('connect', () => { if (++count === 3) r(); }));
  });
  console.log('Sockets connected for Host, Guest 1, and Guest 2.\n');

  // ──────────────────────────────────────────────────────────
  // 1. Host creates squad room
  // ──────────────────────────────────────────────────────────
  console.log('[FEATURE 1 & 2] Host creates squad lobby');
  const createPromise = new Promise(r => hostSocket.once('lobby_joined', r));
  hostSocket.emit('create_lobby', { username: 'ALPHA_HOST', name: 'Alpha Squad' });
  const createdRoom = await createPromise;
  const roomId = createdRoom.roomId;
  assert('Host created room', Boolean(roomId));
  console.log(`  Room ID: ${roomId}\n`);

  // ──────────────────────────────────────────────────────────
  // 2. Guest 1 requests entry & Host admits → verify player_entered_lobby
  // ──────────────────────────────────────────────────────────
  console.log('[FEATURE 1] Lobby Entry Notification');
  let entryNotifReceived = false;
  hostSocket.on('player_entered_lobby', (data) => {
    if (data.username === 'OPERATIVE_ONE') {
      entryNotifReceived = true;
    }
  });

  const guest1PendingPromise = new Promise(r => guest1Socket.once('admission_pending', r));
  const hostReqPromise = new Promise(r => hostSocket.once('admission_request', r));
  guest1Socket.emit('join_lobby', { roomId, username: 'OPERATIVE_ONE' });
  await Promise.all([guest1PendingPromise, hostReqPromise]);

  const guest1JoinedPromise = new Promise(r => guest1Socket.once('lobby_joined', r));
  hostSocket.emit('admit_player', { roomId, targetClientId: guest1ClientId });
  const guest1Joined = await guest1JoinedPromise;
  assert('Guest 1 admitted to lobby', guest1Joined.roomId === roomId);

  await sleep(200);
  assert('Host received player_entered_lobby event for OPERATIVE_ONE', entryNotifReceived === true);

  // ──────────────────────────────────────────────────────────
  // 3. Host starts the game
  // ──────────────────────────────────────────────────────────
  console.log('\n[FEATURE 3] Mid-Game Admission');
  const roundStartedHost = new Promise(r => hostSocket.once('round_started', r));
  const roundStartedGuest1 = new Promise(r => guest1Socket.once('round_started', r));
  hostSocket.emit('start_game', { roomId });
  const [hostRound, guest1Round] = await Promise.all([roundStartedHost, roundStartedGuest1]);
  assert('Host in active round', hostRound.round === 1);
  assert('Guest 1 in active round', guest1Round.round === 1);

  // ──────────────────────────────────────────────────────────
  // 4. Guest 2 joins mid-game → Host receives admission_request and admits
  // ──────────────────────────────────────────────────────────
  let midGameEntryNotif = false;
  hostSocket.on('player_entered_lobby', (data) => {
    if (data.username === 'MID_GAME_JOINER') {
      midGameEntryNotif = true;
    }
  });

  const guest2PendingPromise = new Promise(r => guest2Socket.once('admission_pending', r));
  const hostMidGameReqPromise = new Promise(r => hostSocket.once('admission_request', r));
  guest2Socket.emit('join_lobby', { roomId, username: 'MID_GAME_JOINER' });
  const [, hostMidGameReq] = await Promise.all([guest2PendingPromise, hostMidGameReqPromise]);
  assert('Host received mid-game admission request for MID_GAME_JOINER', hostMidGameReq.username === 'MID_GAME_JOINER');

  // Host admits Guest 2 while match is running
  const guest2JoinedPromise = new Promise(r => guest2Socket.once('lobby_joined', r));
  hostSocket.emit('admit_player', { roomId, targetClientId: guest2ClientId });
  const guest2Joined = await guest2JoinedPromise;
  assert('Guest 2 admitted with active game status', guest2Joined.status === 'ROUND_ACTIVE');

  // Guest 2 emits join_game and gets round_started
  const guest2RoundPromise = new Promise(r => guest2Socket.once('round_started', r));
  guest2Socket.emit('join_game', { roomId });
  const guest2Round = await guest2RoundPromise;
  assert('Guest 2 received active round_started telemetry mid-game', guest2Round.round === 1);
  assert('Notification player_entered_lobby fired for mid-game joiner', midGameEntryNotif === true);

  // ──────────────────────────────────────────────────────────
  // 5. Host stops game and resets to lobby
  // ──────────────────────────────────────────────────────────
  console.log('\n[FEATURE 2] Stop Game & Return to Lobby');
  const hostResetPromise = new Promise(r => hostSocket.once('return_to_lobby', r));
  const guest1ResetPromise = new Promise(r => guest1Socket.once('return_to_lobby', r));
  const guest2ResetPromise = new Promise(r => guest2Socket.once('return_to_lobby', r));

  hostSocket.emit('reset_to_lobby', { roomId });
  const [hostReset, guest1Reset, guest2Reset] = await Promise.all([hostResetPromise, guest1ResetPromise, guest2ResetPromise]);
  assert('Host received return_to_lobby with status LOBBY', hostReset.status === 'LOBBY');
  assert('Guest 1 received return_to_lobby with status LOBBY', guest1Reset.status === 'LOBBY');
  assert('Guest 2 received return_to_lobby with status LOBBY', guest2Reset.status === 'LOBBY');

  // Check lobby status in lobbies list
  const lobbiesAfterStop = await new Promise(r => {
    hostSocket.once('lobbies_list', r);
    hostSocket.emit('get_lobbies');
  });
  const stoppedRoom = lobbiesAfterStop.find(l => l.id === roomId);
  assert('Lobby status updated to LOBBY in public registry', stoppedRoom?.status === 'LOBBY');

  hostSocket.disconnect();
  guest1Socket.disconnect();
  guest2Socket.disconnect();

  // ──────────────────────────────────────────────────────────
  // 6. Headless Browser UI Test (First page / menu / navigation)
  // ──────────────────────────────────────────────────────────
  console.log('\n[FEATURE 4] First Page / Static Menu UI Verification');
  try {
    const cdpPort = 9488;
    const brave = spawn('brave-browser', [
      '--headless',
      `--remote-debugging-port=${cdpPort}`,
      '--remote-allow-origins=*',
      '--no-sandbox',
      '--disable-gpu',
      'http://localhost:3000'
    ]);

    await sleep(1500);

    const cdpTargets = await new Promise(resolve => {
      http.get(`http://127.0.0.1:${cdpPort}/json`, res => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => resolve(JSON.parse(raw)));
      });
    });

    const pageTarget = cdpTargets.find(t => t.type === 'page');
    if (pageTarget && pageTarget.webSocketDebuggerUrl) {
      const WebSocket = require('../frontend/node_modules/ws');
      const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

      await new Promise(r => ws.on('open', r));

      let msgId = 1;
      function sendCdp(method, params = {}) {
        return new Promise((resolve) => {
          const id = msgId++;
          const handler = (data) => {
            const parsed = JSON.parse(data.toString());
            if (parsed.id === id) {
              ws.off('message', handler);
              resolve(parsed.result);
            }
          };
          ws.on('message', handler);
          ws.send(JSON.stringify({ id, method, params }));
        });
      }

      // Check first page landing
      await sleep(1000);
      const evalTitle = await sendCdp('Runtime.evaluate', {
        expression: 'document.body.innerText',
      });
      const pageText = evalTitle.result.value || '';
      assert('Landing screen has "YOU MUST SEARCH FOR INTERNSHIP WHAT ARE YOU DOING!!!"', pageText.includes('YOU MUST SEARCH FOR INTERNSHIP'));
      assert('Landing screen has "ENTER SQUAD BROWSER" button', pageText.includes('ENTER SQUAD BROWSER'));

      // Click "ENTER SQUAD BROWSER"
      const clickContinue = await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('ENTER SQUAD BROWSER'));
            if (btn) { btn.click(); return true; }
            return false;
          })()
        `,
      });
      assert('Clicked "ENTER SQUAD BROWSER"', clickContinue.result.value === true);

      await sleep(800);
      const evalBrowser = await sendCdp('Runtime.evaluate', {
        expression: 'document.body.innerText',
      });
      const browserText = evalBrowser.result.value || '';
      assert('Navigated to AVAILABLE SQUADS screen', browserText.includes('AVAILABLE SQUADS'));
      assert('Squad browser has "MAIN MENU" button', browserText.includes('MAIN MENU'));

      // Click "MAIN MENU" to test return
      const clickBack = await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('MAIN MENU'));
            if (btn) { btn.click(); return true; }
            return false;
          })()
        `,
      });
      assert('Clicked "MAIN MENU" button', clickBack.result.value === true);

      await sleep(600);
      const evalMainMenu = await sendCdp('Runtime.evaluate', {
        expression: 'document.body.innerText',
      });
      const menuText = evalMainMenu.result.value || '';
      assert('Successfully returned to landing screen', menuText.includes('YOU MUST SEARCH FOR INTERNSHIP'));

      ws.close();
    } else {
      console.warn('  ⚠ Could not attach CDP session to headless browser.');
    }

    brave.kill();
  } catch (err) {
    console.error('  Browser test error:', err);
    failed++;
  }

  console.log(`\n======================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
