#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('../frontend/node_modules/ws');

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getWsUrl(port = 9448) {
  for (let i = 0; i < 25; i++) {
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
  console.log('Capturing real game screenshots via Brave Headless CDP...');
  const tmpProfile = `/tmp/brave-screenshots-${Date.now()}`;
  const cdpPort = 9448;

  const browserProcess = spawn('brave-browser', [
    '--headless',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${tmpProfile}`,
    '--window-size=1400,900',
    'http://localhost:3000/',
  ]);

  try {
    const wsUrl = await getWsUrl(cdpPort);
    console.log('Connected to CDP at:', wsUrl);
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

    // Set viewport
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
      console.log(`Saved screenshot: ${filePath}`);
    }

    // 1. Landing Screen
    await sleep(2500);
    await takeScreenshot('01-landing-screen.png');

    // 2. Navigate to Squad Browser
    await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('ENTER SQUAD BROWSER'));
          if (btn) btn.click();
        })()
      `,
    });
    await sleep(1500);
    await takeScreenshot('02-squad-browser.png');

    // 3. Open Create Squad Modal and Create Squad
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
    await sleep(2000);
    await takeScreenshot('03-squad-lobby.png');

    // 4. Start Expedition Match
    await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('COMMENCE EXPEDITION'));
          if (startBtn) startBtn.click();
        })()
      `,
    });
    await sleep(3500);
    await takeScreenshot('04-gameplay-recon.png');

    // 5. Open Standings Tab
    await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const standingsTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('STANDINGS'));
          if (standingsTab) standingsTab.click();
        })()
      `,
    });
    await sleep(1200);
    await takeScreenshot('05-leaderboard-standings.png');

    console.log('All 5 screenshots captured successfully!');
    ws.close();
  } finally {
    browserProcess.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
