const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const socketIo = require('../frontend/node_modules/socket.io-client');
const io = socketIo.io || socketIo;

async function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9444/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(p => p.type === 'page');
          if (page && page.webSocketDebuggerUrl) {
            resolve(page.webSocketDebuggerUrl);
          } else {
            reject(new Error('No page found'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const testDir = '/tmp/brave-test-mp-' + Date.now();
  const brave = spawn('brave-browser', [
    '--headless',
    '--remote-debugging-port=9444',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + testDir,
    'http://localhost:3000/'
  ]);

  let msgId = 1;
  let ws;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  let guestSocket;

  try {
    let wsUrl;
    for (let i = 0; i < 20; i++) {
      try {
        await wait(200);
        wsUrl = await getWsUrl();
        if (wsUrl) break;
      } catch (e) {}
    }

    if (!wsUrl) throw new Error('Could not connect to Brave CDP');
    console.log('Connected to Host Brave CDP at', wsUrl);

    ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.on('open', res);
      ws.on('error', rej);
    });

    ws.on('message', (raw) => {
      const data = JSON.parse(raw);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('DOM.enable');

    console.log('Step 1: Wait for entry screen & click enter squad browser');
    await wait(1500);

    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('.continue-button');
        if (btn) btn.click();
      })()`
    });

    await wait(1500);

    console.log('Step 2: Create room');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const createBtn = btns.find(b => b.textContent.includes('CREATE SQUAD ROOM'));
        if (createBtn) createBtn.click();
      })()`
    });

    await wait(800);

    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const launchBtn = btns.find(b => b.textContent.includes('CREATE & TAKE CROWN'));
        if (launchBtn) launchBtn.click();
      })()`
    });

    await wait(2000);

    const lobbyInfo = await send('Runtime.evaluate', {
      expression: `(() => {
        const codeEl = document.querySelector('.section-index');
        return codeEl ? codeEl.textContent : '';
      })()`,
      returnByValue: true
    });
    console.log('Lobby Info:', lobbyInfo.result.value);
    const roomMatch = lobbyInfo.result.value.match(/LAN-\d+/);
    if (!roomMatch) throw new Error('Failed to find room ID in lobby');
    const roomId = roomMatch[0];
    console.log('Created Room ID:', roomId);

    console.log('Step 3: Connect Guest player via Socket.IO');
    guestSocket = io('http://localhost:5000', {
      transports: ['websocket'],
      query: { clientId: 'guest_operative_bob', mockIp: '192.168.1.102', isBrowser: 'true' }
    });

    guestSocket.onAny((event, ...args) => {
      console.log('[GUEST SOCKET EVENT]', event, args[0]);
    });

    await new Promise((resolve) => {
      if (guestSocket.connected) resolve();
      else guestSocket.on('connect', resolve);
    });
    console.log('Guest connected to Gateway');

    const guestJoinedPromise = new Promise((resolve, reject) => {
      guestSocket.on('lobby_joined', (data) => {
        console.log('Guest joined lobby successfully:', data.roomId);
        resolve(data);
      });
      guestSocket.on('error_message', (err) => {
        reject(new Error(err.message));
      });
    });

    const crypto = require('crypto');
    const guestEcdh = crypto.createECDH('prime256v1');
    guestEcdh.generateKeys();
    const guestPublicKeyHex = guestEcdh.getPublicKey('hex');

    guestSocket.emit('join_lobby', {
      roomId,
      username: 'BOB_SNIPER',
      clientPublicKey: guestPublicKeyHex
    });

    await wait(800);
    // Host clicks Admit in the UI
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const admitBtn = btns.find(b => b.textContent.includes('ADMIT'));
        if (admitBtn) admitBtn.click();
      })()`
    });

    await guestJoinedPromise;

    await wait(1000);

    console.log('Step 4: Host commences expedition');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const startBtn = btns.find(b => b.textContent.includes('COMMENCE EXPEDITION'));
        if (startBtn) startBtn.click();
      })()`
    });

    console.log('Waiting for round to start...');
    let roundTarget;
    await new Promise((resolve) => {
      guestSocket.on('round_started', (data) => {
        console.log('Guest received round_started:', data.round, '/', data.totalRounds);
        resolve();
      });
    });

    await wait(1500);

    console.log('Step 5: Both Host and Guest submit guesses');
    // Host clicks map
    const mapBox = await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector('.tactical-map');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      })()`,
      returnByValue: true
    });
    if (mapBox.result.value) {
      const { x, y } = mapBox.result.value;
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }

    await wait(1000);
    // Host locks guess
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const confirmBtn = btns.find(b => b.textContent.includes('CONFIRM GUESS'));
        if (confirmBtn) confirmBtn.click();
      })()`
    });
    console.log('Host confirmed guess');

    // Guest locks guess at coords (35.0, 139.0)
    guestSocket.emit('lock_guess', { roomId, lat: 35.0, lng: 139.0 });
    console.log('Guest confirmed guess at (35.0, 139.0)');

    console.log('Waiting for round results...');
    const resultsData = await new Promise((resolve) => {
      guestSocket.on('round_results', (data) => {
        console.log('Guest received round_results!');
        resolve(data);
      });
    });

    await wait(2000);

    console.log('Step 6: Inspect Results View in Host Browser');
    const resultsPageText = await send('Runtime.evaluate', {
      expression: 'document.body.innerText',
      returnByValue: true
    });
    console.log('Host Results View Text:\n', resultsPageText.result.value);

    // Verify target revealed, km distance, and leaderboard
    const text = resultsPageText.result.value;
    if (!text.includes('TARGET REVEALED')) throw new Error('TARGET REVEALED badge not found in results');
    if (!text.includes('KM')) throw new Error('KM distance not found in results');
    if (!text.includes('ACTUAL:')) throw new Error('ACTUAL location label not found in results');
    if (!text.includes('BOB_SNIPER')) throw new Error('Guest BOB_SNIPER not found in results leaderboard');
    if (!text.includes('ADVANCE TO NEXT ROUND')) throw new Error('ADVANCE TO NEXT ROUND button not found for Host');

    console.log('Step 7: Check Map Markers on Host DOM');
    const markersCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const targetMarker = document.querySelector('.custom-target-marker');
        const guessMarkers = document.querySelectorAll('.custom-guess-marker');
        return {
          hasTargetMarker: Boolean(targetMarker),
          guessMarkersCount: guessMarkers.length,
          guessTexts: Array.from(guessMarkers).map(m => m.textContent.trim())
        };
      })()`,
      returnByValue: true
    });
    console.log('Markers on Map:', markersCheck.result.value);
    if (!markersCheck.result.value.hasTargetMarker) throw new Error('Target beacon marker missing from map');
    if (markersCheck.result.value.guessMarkersCount < 2) throw new Error('Expected at least 2 player guess markers on map');

    console.log('Step 8: Non-host attempts to advance (should be rejected)');
    let guestError = null;
    guestSocket.on('error_message', (err) => {
      guestError = err.message;
    });
    guestSocket.emit('next_round', { roomId });
    await wait(600);
    console.log('Guest advance attempt result:', guestError);
    if (!guestError || !guestError.includes('leader')) {
      throw new Error('Guest was not properly rejected when attempting to advance');
    }
    console.log('✓ Non-host advance correctly blocked by backend security!');

    console.log('Step 9: Host advances to Next Round');
    const nextRoundStartedPromise = new Promise((resolve) => {
      guestSocket.on('round_started', (data) => {
        resolve(data);
      });
    });

    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const nextBtn = btns.find(b => b.textContent.includes('ADVANCE TO NEXT ROUND'));
        if (nextBtn) nextBtn.click();
      })()`
    });

    const round2Data = await nextRoundStartedPromise;
    console.log('✓ Round 2 commenced successfully by Host! Round:', round2Data.round);

    console.log('\n>>> ALL MULTIPLAYER RESULTS & ADVANCE TESTS PASSED! <<<');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    if (guestSocket) guestSocket.disconnect();
    if (ws) ws.close();
    brave.kill('SIGKILL');
  }
}

run();
