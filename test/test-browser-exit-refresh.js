const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');

async function getWsUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const url = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9446/json', (res) => {
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
      return url;
    } catch {
      await new Promise(r => setTimeout(r, 400));
    }
  }
  throw new Error('Could not connect to CDP');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('=== STARTING BROWSER E2E TEST: Exit & Hard Refresh Verification ===');
  const testDir = '/tmp/brave-test-exit-refresh-' + Date.now();
  const brave = spawn('brave-browser', [
    '--headless',
    '--remote-debugging-port=9446',
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

  try {
    const wsUrl = await getWsUrl();
    console.log('Connected to CDP at:', wsUrl);
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

    await send('Page.enable');
    await send('Runtime.enable');

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.method === 'Page.javascriptDialogOpening') {
        console.log('[Browser Alert Dialog]:', msg.params.message);
        send('Page.handleJavaScriptDialog', { accept: true });
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[Browser Console]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[Browser Exception Details]', JSON.stringify(msg.params.exceptionDetails, null, 2));
      }
    });

    await send('Page.navigate', { url: 'http://localhost:3000/' });

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result ? res.result.value : null;
    }

    // Wait until document is ready
    for (let i = 0; i < 30; i++) {
      const ready = await evaluate(`document.readyState === 'complete' && Boolean(document.body) && document.body.innerText.length > 5`);
      if (ready) break;
      await wait(300);
    }

    console.log('\n--- Step 1: Initial load on / ---');
    let title = await evaluate(`document.body.innerText`);
    console.log('Initial page text preview:', title.slice(0, 100).replace(/\n/g, ' '));

    // Click "ENTER SQUAD BROWSER"
    console.log('\n--- Step 2: Click ENTER SQUAD BROWSER ---');
    const buttons = await evaluate(`Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim())`);
    console.log('Available buttons on page:', buttons);
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('ENTER SQUAD BROWSER') || b.innerText.includes('ENTER CODENAME'));
      if (btn) btn.click();
    `);
    await wait(3000);
    const bodyTextStep2 = await evaluate(`document.body.innerText`);
    console.log('Body text after step 2 wait:', bodyTextStep2.slice(0, 200).replace(/\n/g, ' '));

    let isBrowserScreen = await evaluate(`
      document.body.innerText.includes('LAN EXPEDITION REGISTRY') || document.body.innerText.includes('CREATE SQUAD')
    `);
    console.log('Arrived at Squad Directory (Browser screen)?', isBrowserScreen);
    if (!isBrowserScreen) {
      throw new Error('FAIL: Not on squad directory after clicking start');
    }

    // Step 3: Create a squad
    console.log('\n--- Step 3: Open create squad modal and create squad ---');
    await evaluate(`
      const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('CREATE SQUAD'));
      if (createBtn) createBtn.click();
    `);
    await wait(1200);

    const modalButtons = await evaluate(`Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim())`);
    console.log('Available buttons with modal open:', modalButtons);

    await evaluate(`
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('CROWN'));
      if (submitBtn) submitBtn.click();
    `);
    await wait(3000);

    const afterCreateText = await evaluate(`document.body.innerText`);
    console.log('After create text preview:', afterCreateText.slice(0, 200).replace(/\n/g, ' '));
    const modalError = await evaluate(`document.querySelector('.modal-error')?.innerText || null`);
    console.log('Modal error if any:', modalError);

    let inLobby = await evaluate(`
      document.body.innerText.includes('EXPEDITION ROOM') || document.body.innerText.includes('EXIT SQUAD')
    `);
    console.log('Arrived in Squad Lobby?', inLobby);
    if (!inLobby) {
      throw new Error('FAIL: Did not enter lobby after creating squad');
    }

    // Step 4: Disband / Leave Squad from Lobby
    console.log('\n--- Step 4: Click EXIT SQUAD from Lobby ---');
    await evaluate(`
      const leaveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('EXIT SQUAD'));
      if (leaveBtn) leaveBtn.click();
    `);
    await wait(2000);

    isBrowserScreen = await evaluate(`
      document.body.innerText.includes('LAN EXPEDITION REGISTRY') || document.body.innerText.includes('CREATE SQUAD')
    `);
    console.log('Returned to Squad Directory?', isBrowserScreen);
    if (!isBrowserScreen) {
      throw new Error('FAIL: Did not return to Squad Directory after leaving lobby');
    }

    // Step 5: HARD REFRESH page after leaving lobby
    console.log('\n--- Step 5: Perform hard page reload ---');
    await send('Page.reload');
    await wait(2500);

    let postRefreshScreen = await evaluate(`
      (function() {
        const text = document.body.innerText;
        return {
          isBrowser: text.includes('LAN EXPEDITION REGISTRY') || text.includes('CREATE SQUAD'),
          isSelect: text.includes('ENTER SQUAD BROWSER'),
          isInLobby: text.includes('EXPEDITION ROOM') || text.includes('EXIT SQUAD'),
          isInGame: text.includes('ROUND 0') || text.includes('TACTICAL ATLAS') || text.includes('READ THE LANDSCAPE')
        };
      })()
    `);
    console.log('Screen state after refresh:', postRefreshScreen);

    if (postRefreshScreen.isInLobby || postRefreshScreen.isInGame) {
      throw new Error('FAIL: HARD RELOAD RESURRECTED EXITED LOBBY/GAME!');
    }
    console.log('PASS: Hard reload stayed cleanly on Browser/Select screen without resurrecting lobby!');

    // Step 6: Test Exit during active game
    console.log('\n--- Step 6: Create squad and start active game ---');
    // Click CREATE SQUAD
    await evaluate(`
      const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('CREATE SQUAD'));
      if (createBtn) createBtn.click();
    `);
    await wait(800);
    await evaluate(`
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('CROWN'));
      if (submitBtn) submitBtn.click();
    `);
    await wait(2500);

    // Click START / DEPLOY
    console.log('Clicking START EXPEDITION in lobby...');
    await evaluate(`
      const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('COMMENCE EXPEDITION') || b.innerText.includes('START EXPEDITION'));
      if (startBtn) startBtn.click();
    `);
    await wait(3000);
    const bodyTextGame = await evaluate(`document.body.innerText`);
    console.log('Body text after game wait:', bodyTextGame.slice(0, 200).replace(/\n/g, ' '));

    let inGame = await evaluate(`
      document.body.innerText.includes('EXIT') && (document.body.innerText.includes('ROUND') || document.body.innerText.includes('TACTICAL ATLAS'))
    `);
    console.log('Inside active game screen?', inGame);
    if (!inGame) {
      throw new Error('FAIL: Did not enter active game');
    }

    // Step 7: Click EXIT button during active game
    console.log('\n--- Step 7: Click EXIT button inside active game HUD ---');
    await evaluate(`
      const exitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'EXIT');
      if (exitBtn) exitBtn.click();
    `);
    await wait(1500);

    isBrowserScreen = await evaluate(`
      document.body.innerText.includes('LAN EXPEDITION REGISTRY') || document.body.innerText.includes('CREATE SQUAD')
    `);
    console.log('Returned to Squad Directory after game EXIT?', isBrowserScreen);
    if (!isBrowserScreen) {
      throw new Error('FAIL: Not on squad directory after clicking EXIT');
    }

    // Step 8: Hard page reload after game exit
    console.log('\n--- Step 8: Perform hard page reload after game exit ---');
    await send('Page.reload');
    await wait(2500);

    const postGameRefreshScreen = await evaluate(`
      (function() {
        const text = document.body.innerText;
        return {
          isBrowser: text.includes('LAN EXPEDITION REGISTRY') || text.includes('CREATE SQUAD'),
          isSelect: text.includes('ENTER SQUAD BROWSER'),
          isInLobby: text.includes('EXPEDITION ROOM') || text.includes('EXIT SQUAD'),
          isInGame: text.includes('TACTICAL ATLAS') || text.includes('READ THE LANDSCAPE')
        };
      })()
    `);
    console.log('Screen state after game exit reload:', postGameRefreshScreen);

    if (postGameRefreshScreen.isInGame || postGameRefreshScreen.isInLobby) {
      throw new Error('FAIL: HARD RELOAD RESURRECTED EXITED GAME!');
    }
    console.log('PASS: Hard reload stayed cleanly on Browser/Select screen without resurrecting game!');

    console.log('\n🎉 ALL BROWSER E2E TESTS PASSED SUCCESSFULLY!');
  } finally {
    if (ws) ws.close();
    brave.kill('SIGKILL');
  }
}

run().catch((e) => {
  console.error('\n❌ E2E TEST FAILED:', e);
  process.exit(1);
});
