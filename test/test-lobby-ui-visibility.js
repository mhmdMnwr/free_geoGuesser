#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const socketIo = require('../frontend/node_modules/socket.io-client');
const io = socketIo.io || socketIo.default || socketIo;

const CDP_PORT = 9449;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const url = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
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
            } catch (e) { reject(e); }
          });
        }).on('error', reject);
      });
      return url;
    } catch {
      await sleep(200);
    }
  }
  throw new Error('Failed to get WebSocket debugger URL');
}

async function run() {
  console.log('\n=== HEADLESS BROWSER: LOBBY UI VISIBILITY TEST ===\n');

  // Step 1: Create a lobby from a mock socket (PC 1)
  console.log('[1] Creating lobby from PC 1...');
  const pc1Id = 'pc1_' + Date.now();
  const pc1Name = 'SQUAD_' + Math.floor(100 + Math.random() * 900);
  const pc1 = io('http://localhost:3000', { query: { clientId: pc1Id, isBrowser: 'true' }, transports: ['polling'] });
  await new Promise(r => pc1.on('connect', r));
  const joined = await new Promise((r, rej) => {
    pc1.once('lobby_joined', r);
    pc1.emit('create_lobby', { username: pc1Name, name: 'VISIBLE EPIC SQUAD' });
    setTimeout(() => rej(new Error('Lobby create timeout')), 4000);
  });
  console.log(`    PC 1 created: ${joined.roomId} ("VISIBLE EPIC SQUAD")`);

  // Step 2: Launch Brave
  console.log('\n[2] Launching Brave browser as PC 2 visiting http://localhost:3000...');
  const testDir = '/tmp/brave_test_ui_' + Date.now();
  const browserProc = spawn('brave-browser', [
    '--headless',
    `--remote-debugging-port=${CDP_PORT}`,
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + testDir,
    'http://localhost:3000/',
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

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  try {
    const wsUrl = await getWsUrl();
    ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      });
    });

    console.log('    CDP connected. Waiting 2.5s for DOM render...');
    await sleep(2500);

    // Step 3: Evaluate DOM elements on the page
    console.log('\n[3] Checking DOM on PC 2 browser:');
    const pageTitle = await evaluate('document.title');
    console.log(`    Document title: "${pageTitle}"`);

    const hasBrowserScreen = await evaluate('Boolean(document.querySelector(".browser-screen"))');
    console.log(`    .browser-screen rendered: ${hasBrowserScreen ? 'YES ✓' : 'NO ✗'}`);

    const codenameDisplay = await evaluate('document.querySelector(".lobby-nav input")?.value || "NONE"');
    console.log(`    Codename in nav: "${codenameDisplay}"`);

    const roomRowsCount = await evaluate('document.querySelectorAll(".room-row").length');
    console.log(`    Number of .room-row elements in DOM: ${roomRowsCount}`);

    const roomNames = await evaluate('Array.from(document.querySelectorAll(".room-row .room-name strong")).map(el => el.textContent.trim())');
    console.log(`    Lobby names found:`, roomNames);

    // Step 4: Check CSS COMPUTED STYLE (opacity, visibility, display)
    console.log('\n[4] Checking COMPUTED CSS PROPERTIES of .room-row:');
    const computedStyles = await evaluate(`
      (() => {
        const row = document.querySelector(".room-row");
        if (!row) return null;
        const s = window.getComputedStyle(row);
        return {
          opacity: s.opacity,
          visibility: s.visibility,
          display: s.display,
          height: s.height,
        };
      })()
    `);
    console.log(`    Computed styles:`, computedStyles);

    const isVisible = computedStyles && parseFloat(computedStyles.opacity) > 0.8 && computedStyles.visibility === 'visible' && computedStyles.display === 'grid';
    console.log(`    Row visually visible on screen: ${isVisible ? 'YES ✓' : 'NO ✗'}`);

    // Step 5: Check Status Badge
    const badgeText = await evaluate('document.querySelector(".status-badge")?.textContent?.trim() || "NONE"');
    console.log(`    Status badge text: "${badgeText}"`);

    // Step 6: Check Operatives count
    const opsText = await evaluate('document.querySelector(".room-players strong")?.textContent?.trim() || "NONE"');
    console.log(`    Operatives count text: "${opsText}"`);

    ws.close();

    console.log('\n═══════════════════════════════════');
    if (hasBrowserScreen && roomRowsCount > 0 && isVisible && roomNames.some(n => n.includes('VISIBLE EPIC SQUAD'))) {
      console.log('🎉 SUCCESS: LOBBIES ARE 100% VISIBLE ON UI!');
    } else {
      console.error('❌ FAILURE: LOBBY UI IS NOT VISIBLE PROPERLY');
      process.exit(1);
    }
    console.log('═══════════════════════════════════\n');
  } finally {
    browserProc.kill('SIGKILL');
    pc1.emit('leave_lobby', { roomId: joined.roomId, isHost: true });
    pc1.disconnect();
  }
  process.exit(0);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
