const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('../frontend/node_modules/ws');

async function test() {
  const cdpPort = 9449;
  const browser = spawn('brave-browser', [
    '--headless',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
    '--no-sandbox',
    '--use-gl=angle',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--window-size=1400,900',
    'http://localhost:5000/api/streetview/uplink?roomId=LAN-01&lat=35.6895&lng=139.6917'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const pageTarget = await new Promise(resolve => {
    http.get(`http://127.0.0.1:${cdpPort}/json`, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        const list = JSON.parse(raw);
        resolve(list.find(p => p.type === 'page'));
      });
    });
  });

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  let id = 1;
  function send(method, params = {}) {
    return new Promise(resolve => {
      const cur = id++;
      const handler = data => {
        const parsed = JSON.parse(data.toString());
        if (parsed.id === cur) {
          ws.off('message', handler);
          resolve(parsed.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id: cur, method, params }));
    });
  }

  // Listen to console
  await send('Console.enable');
  ws.on('message', data => {
    const p = JSON.parse(data.toString());
    if (p.method === 'Console.messageAdded') {
      console.log('Console:', p.params.message.text);
    }
  });

  await new Promise(r => setTimeout(r, 6000));
  const snap = await send('Page.captureScreenshot', { format: 'png' });
  const fs = require('fs');
  fs.writeFileSync('/tmp/test-uplink.png', Buffer.from(snap.data, 'base64'));
  console.log('Saved /tmp/test-uplink.png, size:', fs.statSync('/tmp/test-uplink.png').size);

  browser.kill('SIGKILL');
}

test().catch(console.error);
