/**
 * Exhaustive Edge Case and Route Test Suite for LAN-Guessr
 */

const http = require('http');
const { spawn } = require('child_process');
const { io: ioClient } = require('socket.io-client');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// HTTP request helper
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function runExhaustiveTests() {
  const TEST_PORT = 3002;
  const SERVER_URL = `http://localhost:${TEST_PORT}`;

  console.log(`\n=============================================================`);
  console.log(`  STARTING EXHAUSTIVE ROUTE & EDGE CASE TEST SUITE (Port ${TEST_PORT})`);
  console.log(`=============================================================\n`);

  const serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', () => {});
  serverProcess.stderr.on('data', (d) => console.error('[SERVER ERR]', d.toString().trim()));

  await sleep(1000); // Allow server to bind

  let passed = 0;
  function assert(condition, testName) {
    if (!condition) {
      console.error(`❌ FAILED: ${testName}`);
      serverProcess.kill();
      process.exit(1);
    }
    console.log(`✅ [TEST ${++passed}] ${testName}`);
  }

  try {
    // =========================================================================
    // SUITE 1: HTTP ROUTES & STATIC ASSETS
    // =========================================================================
    console.log('\n--- SUITE 1: HTTP Routes & Static Assets ---');

    const resRoot = await httpGet(`${SERVER_URL}/`);
    assert(resRoot.status === 200, 'GET / returns 200 OK');
    assert(resRoot.body.includes('<!DOCTYPE html>'), 'GET / serves HTML index document');
    assert(resRoot.body.includes('anti-spoiler-hud'), 'GET / HTML contains anti-spoiler HUD');
    assert(resRoot.body.includes('leaflet@1.9.4'), 'GET / HTML includes Leaflet v1.9.4');
    assert(resRoot.body.includes('/socket.io/socket.io.js'), 'GET / HTML includes Socket.IO client tag');

    const resInfo = await httpGet(`${SERVER_URL}/api/info`);
    assert(resInfo.status === 200, 'GET /api/info returns 200 OK');
    const infoData = JSON.parse(resInfo.body);
    assert(infoData.port === TEST_PORT && typeof infoData.joinUrl === 'string', 'GET /api/info returns port and joinUrl');

    const resStatus = await httpGet(`${SERVER_URL}/api/status`);
    assert(resStatus.status === 200, 'GET /api/status returns 200 OK');
    const statusData = JSON.parse(resStatus.body);
    assert(statusData.status === 'LOBBY' && statusData.currentRound === 0, 'GET /api/status reports initial LOBBY state');

    const resCss = await httpGet(`${SERVER_URL}/style.css`);
    assert(resCss.status === 200, 'GET /style.css returns 200 OK');
    assert(resCss.body.includes('#anti-spoiler-hud'), 'GET /style.css contains #anti-spoiler-hud styling');

    const resJs = await httpGet(`${SERVER_URL}/app.js`);
    assert(resJs.status === 200, 'GET /app.js returns 200 OK');
    assert(resJs.body.includes('switchView'), 'GET /app.js contains SPA switchView logic');

    const res404 = await httpGet(`${SERVER_URL}/nonexistent-route-404`);
    assert(res404.status === 404, 'GET /nonexistent-route-404 returns 404 Not Found');

    // =========================================================================
    // SUITE 2: USERNAME VALIDATION EDGE CASES
    // =========================================================================
    console.log('\n--- SUITE 2: Username Validation Edge Cases ---');

    const clientVal = ioClient(SERVER_URL, { query: { mockIp: '10.0.0.1' } });
    await new Promise((r) => clientVal.once('prompt_username', r));

    // Empty username
    const errPromise1 = new Promise((r) => clientVal.once('error_message', r));
    clientVal.emit('set_username', { username: '' });
    const err1 = await errPromise1;
    assert(err1.message.includes('at least 2 characters'), 'Rejects empty username with error_message');

    // Whitespace-only username
    const errPromise2 = new Promise((r) => clientVal.once('error_message', r));
    clientVal.emit('set_username', { username: '     ' });
    const err2 = await errPromise2;
    assert(err2.message.includes('at least 2 characters'), 'Rejects whitespace-only username');

    // Single character username
    const errPromise3 = new Promise((r) => clientVal.once('error_message', r));
    clientVal.emit('set_username', { username: 'Z' });
    const err3 = await errPromise3;
    assert(err3.message.includes('at least 2 characters'), 'Rejects 1-character username');

    // HTML XSS injection in username
    const userPromiseXSS = new Promise((r) => clientVal.once('username_set', r));
    clientVal.emit('set_username', { username: '<script>alert(1)</script>Alex' });
    const userSetXSS = await userPromiseXSS;
    assert(userSetXSS.username === 'alert(1)Alex', 'Sanitizes HTML tags from username');

    // Overly long username (>18 chars)
    const userPromiseLong = new Promise((r) => clientVal.once('username_set', r));
    clientVal.emit('set_username', { username: 'SuperDuperLongExplorerName123' });
    const userSetLong = await userPromiseLong;
    assert(userSetLong.username.length === 18 && userSetLong.username === 'SuperDuperLongExpl', 'Truncates usernames exceeding 18 characters');

    // Renaming in lobby
    const userPromiseRename = new Promise((r) => clientVal.once('username_set', r));
    clientVal.emit('set_username', { username: 'CaptainAlex' });
    const userSetRename = await userPromiseRename;
    assert(userSetRename.username === 'CaptainAlex', 'Allows changing username while in LOBBY');

    // Session restoration in lobby
    clientVal.disconnect();
    await sleep(150);
    const clientValRejoin = ioClient(SERVER_URL, { query: { mockIp: '10.0.0.1' } });
    const restored = await new Promise((r) => clientValRejoin.once('session_restored', r));
    assert(restored.username === 'CaptainAlex', 'Session restored on reconnect during LOBBY');

    // =========================================================================
    // SUITE 3: START GAME EDGE CASES
    // =========================================================================
    console.log('\n--- SUITE 3: Start Game Edge Cases ---');

    // Start game with 0 players: We can test with a fresh client that hasn't registered a username
    const clientUnregistered = ioClient(SERVER_URL, { query: { mockIp: '10.0.0.99' } });
    await new Promise((r) => clientUnregistered.once('prompt_username', r));

    // Connect Player 2
    const clientPlayer2 = ioClient(SERVER_URL, { query: { mockIp: '10.0.0.2' } });
    await new Promise((r) => clientPlayer2.once('prompt_username', r));
    clientPlayer2.emit('set_username', { username: 'ExplorerBob' });
    await new Promise((r) => clientPlayer2.once('username_set', r));

    // Start game
    const roundStartedP = new Promise((r) => clientValRejoin.once('round_started', r));
    clientValRejoin.emit('start_game');
    const round1Data = await roundStartedP;
    assert(round1Data.round === 1 && round1Data.totalRounds === 10, 'Match begins: Round 1 of 10 started');

    // Duplicate start_game while match active -> ignored
    let duplicateStartEmitted = false;
    clientValRejoin.once('round_started', () => { duplicateStartEmitted = true; });
    clientValRejoin.emit('start_game');
    await sleep(200);
    assert(!duplicateStartEmitted, 'Duplicate start_game during active round is safely ignored');

    // Changing username mid-game -> rejected
    const errMidGameName = new Promise((r) => clientValRejoin.once('error_message', r));
    clientValRejoin.emit('set_username', { username: 'NewMidName' });
    const errNameMid = await errMidGameName;
    assert(errNameMid.message.includes('Cannot change username while match is active'), 'Rejects username changes while match is active');

    // =========================================================================
    // SUITE 4: GUESSING EDGE CASES
    // =========================================================================
    console.log('\n--- SUITE 4: Guessing Edge Cases ---');

    // Lock guess with no pin placed
    const errNoPinP = new Promise((r) => clientValRejoin.once('error_message', r));
    clientValRejoin.emit('lock_guess', {});
    const errNoPin = await errNoPinP;
    assert(errNoPin.message.includes('place a valid pin'), 'Rejects lock_guess with no coordinates or pin');

    // Lock guess with NaN coordinates
    const errNaNP = new Promise((r) => clientValRejoin.once('error_message', r));
    clientValRejoin.emit('lock_guess', { lat: NaN, lng: 10 });
    const errNaN = await errNaNP;
    assert(errNaN.message.includes('place a valid pin'), 'Rejects lock_guess with NaN coordinates');

    // Lock guess with out-of-range coordinates (e.g. lat > 90)
    const errRangeP = new Promise((r) => clientValRejoin.once('error_message', r));
    clientValRejoin.emit('lock_guess', { lat: 120, lng: 50 });
    const errRange = await errRangeP;
    assert(errRange.message.includes('place a valid pin'), 'Rejects coordinates with latitude > 90');

    // Valid guess locks in
    const guessBroadcastP = new Promise((r) => clientPlayer2.once('player_guessed', r));
    const countdownStartP = new Promise((r) => clientPlayer2.once('countdown_started', r));
    clientValRejoin.emit('lock_guess', { lat: 48.85, lng: 2.29 });
    const guessB = await guessBroadcastP;
    const countB = await countdownStartP;
    assert(guessB.username === 'CaptainAlex' && guessB.guessedCount === 1, 'Broadcasts player_guessed with count');
    assert(countB.seconds === 20 && countB.triggeredBy === 'CaptainAlex', 'First guess triggers 20s countdown');

    // Same player tries to lock guess again -> ignored
    let doubleGuessBroadcast = false;
    clientPlayer2.once('player_guessed', () => { doubleGuessBroadcast = true; });
    clientValRejoin.emit('lock_guess', { lat: 50, lng: 10 });
    await sleep(200);
    assert(!doubleGuessBroadcast, 'Double lock_guess by same player is ignored');

    // =========================================================================
    // SUITE 5: DRAFT PIN SCORING WHEN TIMER EXPIRES
    // =========================================================================
    console.log('\n--- SUITE 5: Draft Pin Scoring on Timer Expiration ---');
    // Player 2 places draft pin near the round target via update_pin, but DOES NOT click lock_guess
    const draftLat = round1Data.panoramaCoords.lat + 0.001;
    const draftLng = round1Data.panoramaCoords.lng + 0.001;
    clientPlayer2.emit('update_pin', { lat: draftLat, lng: draftLng });

    // Client 4 connects with mock IP 10.0.0.4 BEFORE round 1 ends, but match is in progress!
    // Let's verify Client 4 is blocked!
    const clientBlocked = ioClient(SERVER_URL, { query: { mockIp: '10.0.0.4' } });
    const lockedData = await new Promise((r) => clientBlocked.once('match_locked', r));
    assert(lockedData && lockedData.reason, 'Mid-game connection from new IP is blocked with match_locked');

    // Wait for the 20s countdown to finish
    console.log('  Waiting for countdown to expire naturally to verify draft pin scoring...');
    const round1ResultsP = new Promise((r) => clientPlayer2.once('round_results', r));
    const round1Results = await round1ResultsP;

    assert(round1Results.round === 1, 'Round 1 ended when 20s timer expired');
    const p2Result = round1Results.results.find((r) => r.username === 'ExplorerBob');
    assert(p2Result && p2Result.guessCoords && Math.abs(p2Result.guessCoords.lat - draftLat) < 0.0001, 'Draft pin (currentPin) was automatically scored when timer expired!');
    assert(p2Result.roundScore >= 4500, `Scored high points (${p2Result.roundScore}) using draft pin close to target`);

    // =========================================================================
    // SUITE 6: MID-GAME RECONNECTION
    // =========================================================================
    console.log('\n--- SUITE 6: Mid-Game Reconnection ---');
    // Advance to Round 2
    const r2StartP = new Promise((r) => clientValRejoin.once('round_started', r));
    clientValRejoin.emit('next_round');
    await r2StartP;

    // Disconnect CaptainAlex and reconnect mid-round
    clientValRejoin.disconnect();
    await sleep(200);

    const clientAlexReconnected = ioClient(SERVER_URL, { query: { mockIp: '10.0.0.1' } });
    const rejoinMatchData = await new Promise((r) => clientAlexReconnected.once('rejoin_match', r));
    assert(rejoinMatchData.username === 'CaptainAlex', 'Rejoin returns correct player identity');
    assert(rejoinMatchData.round === 2 && rejoinMatchData.status === 'ROUND_ACTIVE', 'Rejoin returns active round 2 state');
    assert(rejoinMatchData.panoramaCoords && typeof rejoinMatchData.panoramaCoords.lat === 'number', 'Rejoin provides panorama coordinates');
    assert(rejoinMatchData.hasGuessed === false, 'Rejoin accurately reflects hasGuessed = false');

    // =========================================================================
    // SUITE 7: ALL PLAYERS GUESS EARLY -> IMMEDIATE ROUND COMPLETION
    // =========================================================================
    console.log('\n--- SUITE 7: Early Guessing Immediate Completion ---');
    const round2ResultsP = new Promise((r) => clientPlayer2.once('round_results', r));
    clientAlexReconnected.emit('lock_guess', { lat: 35.65, lng: 139.7 });
    clientPlayer2.emit('lock_guess', { lat: 35.65, lng: 139.7 });

    const startTime = Date.now();
    const round2Results = await round2ResultsP;
    const duration = Date.now() - startTime;

    assert(duration < 2000, `Round ended immediately (${duration}ms) without waiting for 20s`);
    assert(round2Results.round === 2, 'Round 2 results broadcasted');

    // =========================================================================
    // SUITE 8: PROGRESSION THROUGH ROUND 10 TO GAME_OVER & RESET
    // =========================================================================
    console.log('\n--- SUITE 8: Progression to Game Over & Podium ---');

    for (let r = 3; r <= 10; r++) {
      const nextRoundP = new Promise((res) => clientPlayer2.once('round_started', res));
      clientPlayer2.emit('next_round');
      await nextRoundP;

      const rEndP = new Promise((res) => clientPlayer2.once('round_results', res));
      clientAlexReconnected.emit('lock_guess', { lat: 10, lng: 10 });
      clientPlayer2.emit('lock_guess', { lat: 10, lng: 10 });
      await rEndP;
    }

    // Trigger next_round on Round 10 -> Game Over
    const gameOverP = new Promise((res) => clientPlayer2.once('game_over', res));
    clientPlayer2.emit('next_round');
    const gameOverData = await gameOverP;

    assert(Array.isArray(gameOverData.leaderboard), 'Game over payload includes leaderboard array');
    assert(gameOverData.leaderboard.length === 2, 'Leaderboard ranks all 2 players');
    assert(gameOverData.leaderboard[0].totalScore >= gameOverData.leaderboard[1].totalScore, 'Leaderboard is sorted descending by totalScore');

    // Test reset_to_lobby
    console.log('\n--- SUITE 9: Reset to Lobby & Automatic Unlocking ---');
    const returnLobbyP = new Promise((res) => clientPlayer2.once('return_to_lobby', res));
    const unblockedPromptP = new Promise((res) => clientBlocked.once('prompt_username', res));

    clientPlayer2.emit('reset_to_lobby');
    await returnLobbyP;
    assert(true, 'Received return_to_lobby broadcast');

    // Verify previously blocked client received prompt_username automatically without reloading!
    const unblockedData = await unblockedPromptP;
    assert(unblockedData.ip === '10.0.0.4', 'Previously blocked client automatically unblocked and prompted for username!');

    // Cleanup
    clientAlexReconnected.disconnect();
    clientPlayer2.disconnect();
    clientBlocked.disconnect();
    clientUnregistered.disconnect();

    console.log(`\n=============================================================`);
    console.log(`  🎉 ALL ${passed} ROUTE & EDGE CASE TESTS PASSED PERFECTLY! 🎉`);
    console.log(`=============================================================\n`);

  } catch (err) {
    console.error('Test error:', err);
    serverProcess.kill();
    process.exit(1);
  } finally {
    serverProcess.kill();
  }
}

runExhaustiveTests();
