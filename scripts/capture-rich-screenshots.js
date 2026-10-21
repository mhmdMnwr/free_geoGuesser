#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('../frontend/node_modules/ws');
const socketIo = require('../frontend/node_modules/socket.io-client');
const io = socketIo.io || socketIo.default || socketIo;

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getWsUrl(port = 9452) {
  for (let i = 0; i < 30; i++) {
    try {
      const url = await new Promise((resolve, reject) => {
        http
          .get(`http://127.0.0.1:${port}/json`, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                const list = JSON.parse(data);
                const page = list.find((p) => p.type === 'page');
                if (page && page.webSocketDebuggerUrl) {
                  resolve(page.webSocketDebuggerUrl);
                } else {
                  reject(new Error('No page target found'));
                }
              } catch (e) {
                reject(e);
              }
            });
          })
          .on('error', reject);
      });
      return url;
    } catch {
      await sleep(300);
    }
  }
  throw new Error('Failed to connect to CDP browser target');
}

async function main() {
  console.log('=== CAPTURING RICH MULTIPLAYER SCREENSHOTS ===\n');

  // 1. Create simulated background squads for rich RoomBrowser
  const bgHost1 = io('http://localhost:5000', {
    query: { clientId: 'bg-host-1', isBrowser: 'false' },
    transports: ['polling'],
  });
  const bgGuest1 = io('http://localhost:5000', {
    query: { clientId: 'bg-guest-1', isBrowser: 'false' },
    transports: ['polling'],
  });
  const bgHost2 = io('http://localhost:5000', {
    query: { clientId: 'bg-host-2', isBrowser: 'false' },
    transports: ['polling'],
  });

  await sleep(600);
  bgHost1.emit('create_lobby', { username: 'GHOST_01', name: 'SHADOW DIVISION' });
  bgHost2.emit('create_lobby', { username: 'NEO_RUNNER', name: 'CYBER DRIFT' });
  await sleep(600);

  // 2. Start Brave Headless with full GPU/WebGL capabilities
  const cdpPort = 9452;
  const tmpProfile = `/tmp/brave-rich-${Date.now()}`;
  const browserProcess = spawn('brave-browser', [
    '--headless',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
    '--no-sandbox',
    '--window-size=1400,900',
    `--user-data-dir=${tmpProfile}`,
    'http://localhost:3000/',
  ]);

  try {
    const wsUrl = await getWsUrl(cdpPort);
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve) => ws.on('open', resolve));

    let msgId = 1;
    function sendCdp(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (data) => {
          const res = JSON.parse(data.toString());
          if (res.id === id) {
            ws.off('message', handler);
            if (res.error) reject(new Error(JSON.stringify(res.error)));
            else resolve(res.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendCdp('Emulation.setDeviceMetricsOverride', {
      width: 1400,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    async function takeScreenshot(filename) {
      const res = await sendCdp('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(SCREENSHOT_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`[SAVED] ${filename} (${fs.statSync(filePath).size} bytes)`);
    }

    // ──────────────────────────────────────────
    // SCREENSHOT 1: Landing Menu
    // ──────────────────────────────────────────
    await sleep(2000);
    console.log('Capturing 01-landing-screen.png...');
    await takeScreenshot('01-landing-screen.png');

    // ──────────────────────────────────────────
    // SCREENSHOT 2: Squad Browser with multiple active squads
    // ──────────────────────────────────────────
    console.log('Navigating to Squad Browser...');
    await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('ENTER SQUAD BROWSER'));
          if (btn) btn.click();
        })()
      `,
    });
    await sleep(1500);

    // Set custom codename "VIPER_LEADER"
    await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const inp = document.querySelector('input[placeholder="YOUR CODENAME"]');
          if (inp) {
            inp.value = 'VIPER_LEADER';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()
      `,
    });
    await sleep(1000);
    console.log('Capturing 02-squad-browser.png...');
    await takeScreenshot('02-squad-browser.png');

    // ──────────────────────────────────────────
    // Create Main Squad Room
    // ──────────────────────────────────────────
    console.log('Creating Squad Room "ALPHA RECON"...');
    await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('CREATE SQUAD ROOM'));
          if (createBtn) createBtn.click();
        })()
      `,
    });
    await sleep(800);

    // Set squad name in modal if available
    await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const nameInput = document.querySelector('input[placeholder*="Squad"], input[value*="Squad"]');
          if (nameInput) {
            nameInput.value = 'ALPHA RECON // SPECIAL FORCES';
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          const modalBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('CREATE & TAKE CROWN'));
          if (modalBtn) modalBtn.click();
        })()
      `,
    });
    await sleep(1500);

    // Get current roomId from DOM
    const roomEval = await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const match = document.body.innerText.match(/LAN-\\d{4}/);
          return match ? match[0] : null;
        })()
      `,
    });
    const roomId = roomEval.result.value;
    console.log('Active Squad Room ID:', roomId);

    // ──────────────────────────────────────────
    // Connect 4 Operatives into this squad
    // ──────────────────────────────────────────
    console.log('Connecting 4 squad operatives...');
    const operatives = [
      { name: 'ATLAS_SNIPER', id: 'op-atlas-' + Date.now() },
      { name: 'GHOST_SCOUT', id: 'op-ghost-' + Date.now() },
      { name: 'CYBER_NOMAD', id: 'op-cyber-' + Date.now() },
      { name: 'DELTA_ECHO', id: 'op-delta-' + Date.now() },
    ];

    const opSockets = [];
    for (const op of operatives) {
      const s = io('http://localhost:5000', {
        query: { clientId: op.id, isBrowser: 'false' },
        transports: ['polling'],
      });
      opSockets.push(s);
      await sleep(200);

      // Request join
      s.emit('join_lobby', { roomId, username: op.name });
      await sleep(300);

      // Host admits player via CDP click on button
      await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const admitBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('ADMIT') || b.title?.includes('Admit'));
            admitBtns.forEach(b => b.click());
          })()
        `,
      });
      await sleep(300);
    }

    await sleep(1500);

    // ──────────────────────────────────────────
    // SCREENSHOT 3: Squad Preparation Lobby (rich with 5 operatives)
    // ──────────────────────────────────────────
    console.log('Capturing 03-squad-lobby.png (5 operatives ready)...');
    await takeScreenshot('03-squad-lobby.png');

    // ──────────────────────────────────────────
    // SCREENSHOT 4: Start Match, place pin & render road street view
    // ──────────────────────────────────────────
    console.log('Starting expedition match...');
    await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('COMMENCE EXPEDITION'));
          if (startBtn) startBtn.click();
        })()
      `,
    });

    // Operatives join game
    await sleep(2000);
    for (const s of opSockets) {
      s.emit('join_game', { roomId });
    }
    await sleep(1000);

    // 2 Operatives lock in guesses to trigger scramble & show live standings activity
    console.log('Submitting guesses for ATLAS_SNIPER and GHOST_SCOUT...');
    opSockets[0].emit('lock_guess', { roomId, lat: 35.6895, lng: 139.6917 });
    await sleep(400);
    opSockets[1].emit('lock_guess', { roomId, lat: 35.71, lng: 139.75 });
    await sleep(500);

    // Host places pin on atlas
    await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const map = document.querySelector('.leaflet-container');
          if (map) {
            const rect = map.getBoundingClientRect();
            const clickEvent = new MouseEvent('click', {
              clientX: rect.left + rect.width * 0.45,
              clientY: rect.top + rect.height * 0.55,
              bubbles: true
            });
            map.dispatchEvent(clickEvent);
          }
        })()
      `,
    });

    console.log('Waiting 8.5s for road photosphere / street view tiles to fully render...');
    await sleep(8500);

    console.log('Capturing 04-gameplay-recon.png (with real road view & live standings)...');
    await takeScreenshot('04-gameplay-recon.png');

    // ──────────────────────────────────────────
    // SCREENSHOT 5: Standings View
    // ──────────────────────────────────────────
    console.log('Switching to Standings view [S]...');
    await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const standingsTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('STANDINGS'));
          if (standingsTab) standingsTab.click();
        })()
      `,
    });
    await sleep(1500);

    console.log('Capturing 05-leaderboard-standings.png...');
    await takeScreenshot('05-leaderboard-standings.png');

    console.log('\n=== ALL RICH SCREENSHOTS CAPTURED SUCCESSFULLY ===');

    // Cleanup sockets
    opSockets.forEach((s) => s.disconnect());
    bgHost1.disconnect();
    bgGuest1.disconnect();
    bgHost2.disconnect();
    ws.close();
  } finally {
    browserProcess.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
