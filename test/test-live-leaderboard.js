#!/usr/bin/env node
/**
 * Test: Live Leaderboard during gameplay
 * 1. Host creates squad room, Guest joins & gets admitted.
 * 2. Host starts match.
 * 3. Verify 'round_started' contains players array with totalScore and hasGuessed.
 * 4. Guest locks in guess.
 * 5. Verify 'player_guessed' is broadcast with updated players array showing hasGuessed: true.
 * 6. Headless Brave browser checks DOM for .live-standings-widget and Standings view [S].
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
  console.log('   LIVE LEADERBOARD VERIFICATION TEST SUITE');
  console.log('======================================================\n');

  const hostId = 'host_lb_' + Math.floor(Math.random() * 9000);
  const guestId = 'guest_lb_' + Math.floor(Math.random() * 9000);

  const hostSocket = io(URL, { query: { clientId: hostId, isBrowser: 'true' }, transports: ['polling'] });
  const guestSocket = io(URL, { query: { clientId: guestId, isBrowser: 'true' }, transports: ['polling'] });

  await new Promise(r => {
    let count = 0;
    [hostSocket, guestSocket].forEach(s => s.on('connect', () => { if (++count === 2) r(); }));
  });
  console.log('Host and Guest connected.');

  // 1. Create Room & Admit Guest
  const createPromise = new Promise(r => hostSocket.once('lobby_joined', r));
  hostSocket.emit('create_lobby', { username: 'HOST_LEADER', name: 'Leaderboard Squad' });
  const created = await createPromise;
  const roomId = created.roomId;
  assert('Host created squad', Boolean(roomId));

  const guestPending = new Promise(r => guestSocket.once('admission_pending', r));
  const hostReq = new Promise(r => hostSocket.once('admission_request', r));
  guestSocket.emit('join_lobby', { roomId, username: 'GUEST_SNIPER' });
  await Promise.all([guestPending, hostReq]);

  const guestAdmitted = new Promise(r => guestSocket.once('lobby_joined', r));
  hostSocket.emit('admit_player', { roomId, targetClientId: guestId });
  await guestAdmitted;
  assert('Guest admitted to squad', true);

  // 2. Start Match
  const hostRoundPromise = new Promise(r => hostSocket.once('round_started', r));
  const guestRoundPromise = new Promise(r => guestSocket.once('round_started', r));
  hostSocket.emit('start_game', { roomId });
  const [hostRound, guestRound] = await Promise.all([hostRoundPromise, guestRoundPromise]);

  assert('round_started emitted to Host', Boolean(hostRound.round));
  assert('round_started has players list', Array.isArray(hostRound.players) && hostRound.players.length === 2);
  console.log('    Active round players:', hostRound.players.map(p => `${p.username}: score ${p.totalScore}, guessed: ${p.hasGuessed}`));

  // 3. Guest Submits Guess
  const guessBroadcastPromise = new Promise(r => hostSocket.once('player_guessed', r));
  guestSocket.emit('lock_guess', { roomId, lat: 48.8566, lng: 2.3522 });
  const guessData = await guessBroadcastPromise;

  assert('player_guessed event received by Host', guessData.username === 'GUEST_SNIPER');
  assert('player_guessed includes updated players array', Array.isArray(guessData.players));
  const guessedGuest = guessData.players?.find(p => p.username === 'GUEST_SNIPER');
  assert('Guest marked as hasGuessed: true in live players array', guessedGuest?.hasGuessed === true);

  hostSocket.disconnect();
  guestSocket.disconnect();

  // 4. Headless Browser Check for Live Standings DOM
  console.log('\n[UI Verification] Live Standings UI in Browser');
  try {
    const cdpPort = 9499;
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

      await sleep(1000);
      // Navigate to browser
      await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('ENTER SQUAD BROWSER'));
            if (btn) btn.click();
          })()
        `,
      });

      await sleep(1000);

      // Create squad room
      await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('CREATE SQUAD ROOM'));
            if (createBtn) createBtn.click();
          })()
        `,
      });

      await sleep(800);

      await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const modalBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('CREATE & TAKE CROWN'));
            if (modalBtn) modalBtn.click();
          })()
        `,
      });

      await sleep(1200);

      // Start match
      await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('COMMENCE EXPEDITION'));
            if (startBtn) startBtn.click();
          })()
        `,
      });

      await sleep(2500);

      // Verify .live-standings-widget exists
      const evalLiveWidget = await sendCdp('Runtime.evaluate', {
        expression: `Boolean(document.querySelector('.live-standings-widget'))`,
      });
      assert('Live standings widget (.live-standings-widget) rendered during gameplay', evalLiveWidget.result.value === true);

      const evalWidgetText = await sendCdp('Runtime.evaluate', {
        expression: `document.querySelector('.live-standings-widget')?.innerText || ''`,
      });
      console.log('    Widget text:', evalWidgetText.result.value.replace(/\n+/g, ' '));
      assert('Widget displays "LIVE STANDINGS"', evalWidgetText.result.value.includes('LIVE STANDINGS'));
      assert('Widget displays guess count e.g. "GUESSED"', evalWidgetText.result.value.includes('GUESSED'));

      // Switch to Standings View [S]
      await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const standingsTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('STANDINGS'));
            if (standingsTab) standingsTab.click();
          })()
        `,
      });

      await sleep(1000);

      const evalStandingsView = await sendCdp('Runtime.evaluate', {
        expression: `Boolean(document.querySelector('.leaderboard-view'))`,
      });
      assert('Full Standings view (.leaderboard-view) rendered upon selecting tab', evalStandingsView.result.value === true);

      const evalStandingRows = await sendCdp('Runtime.evaluate', {
        expression: `document.querySelectorAll('.standing-row').length`,
      });
      assert('Standings view contains active operative rows (length > 0)', evalStandingRows.result.value > 0);

      const evalStandingsText = await sendCdp('Runtime.evaluate', {
        expression: `document.querySelector('.leaderboard-view')?.innerText || ''`,
      });
      console.log('    Standings view text preview:', evalStandingsText.result.value.slice(0, 150).replace(/\n+/g, ' '));
      assert('Standings view shows "LIVE EXPEDITION STANDINGS"', evalStandingsText.result.value.includes('LIVE EXPEDITION STANDINGS'));

      ws.close();
    }
    brave.kill();
  } catch (err) {
    console.error('Browser check error:', err);
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
