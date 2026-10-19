/**
 * Targeted verification for all Lobby Return Buttons & Lifecycle flows
 */

const { spawn } = require('child_process');
const { io: ioClient } = require('socket.io-client');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLobbyButtonTests() {
  const TEST_PORT = 3003;
  const SERVER_URL = `http://localhost:${TEST_PORT}`;

  console.log(`\n=============================================================`);
  console.log(`  STARTING LOBBY RETURN BUTTON VERIFICATION SUITE (Port ${TEST_PORT})`);
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
    // -----------------------------------------------------------------
    // TEST 1: Solo player leaves active match -> resets to LOBBY cleanly
    // -----------------------------------------------------------------
    console.log('\n--- SCENARIO 1: Solo Player Returns to Lobby ---');
    const clientSolo = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.10' } });
    await new Promise((r) => clientSolo.once('prompt_username', r));
    clientSolo.emit('set_username', { username: 'SoloHero' });
    const regSolo = await new Promise((r) => clientSolo.once('username_set', r));
    assert(regSolo.isHost === true, 'SoloHero registered as Host');

    const startSoloP = new Promise((r) => clientSolo.once('round_started', r));
    clientSolo.emit('start_game');
    const soloRound = await startSoloP;
    assert(soloRound.round === 1, 'Solo game started on Round 1');

    // Solo player clicks "Go to Lobby" (#hud-btn-leave-game -> leave_game)
    const returnLobbyP = new Promise((r) => clientSolo.once('return_to_lobby', r));
    clientSolo.emit('leave_game');
    const returnData = await returnLobbyP;
    assert(returnData.status === 'LOBBY' || returnData.currentRound === 0, 'Solo player returned to lobby cleanly');
    assert(returnData.hostIp === '192.168.1.10', 'Solo player remains designated as Host');

    // Verify Solo player can immediately commence a new match
    const restartP = new Promise((r) => clientSolo.once('round_started', r));
    clientSolo.emit('start_game');
    const restartedRound = await restartP;
    assert(restartedRound.round === 1, 'Solo player successfully commenced a new match after returning to lobby');
    clientSolo.disconnect();
    await sleep(200);

    // -----------------------------------------------------------------
    // TEST 2: Multiplayer leave_game keeps player in roster and allows rejoin
    // -----------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Multiplayer Player Returns to Lobby & Rejoins ---');
    const clientHost = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.20' } });
    await new Promise((r) => clientHost.once('prompt_username', r));
    clientHost.emit('set_username', { username: 'HostAlice' });
    await new Promise((r) => clientHost.once('username_set', r));

    const clientPlayer = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.21' } });
    await new Promise((r) => clientPlayer.once('prompt_username', r));
    clientPlayer.emit('set_username', { username: 'PlayerBob' });
    await new Promise((r) => clientPlayer.once('username_set', r));

    const mStartHost = new Promise((r) => clientHost.once('round_started', r));
    const mStartPlayer = new Promise((r) => clientPlayer.once('round_started', r));
    clientHost.emit('start_game');
    await Promise.all([mStartHost, mStartPlayer]);
    assert(true, 'Multiplayer Round 1 commenced with HostAlice & PlayerBob');

    // PlayerBob clicks "Go to Lobby" (#hud-btn-leave-game -> leave_game)
    const bobLobbyP = new Promise((r) => clientPlayer.once('return_to_lobby', r));
    const hostNotifiedP = new Promise((r) => clientHost.once('player_left', r));
    clientPlayer.emit('leave_game');
    const bobLobbyData = await bobLobbyP;
    const hostNotice = await hostNotifiedP;

    assert(bobLobbyData.players.length === 2, 'PlayerBob is STILL registered in the lobby roster');
    assert(hostNotice.remainingCount === 1, 'Host notified 1 active in-game player remains');

    // HostAlice locks guess -> Round 1 should end immediately since Bob is in lobby
    const roundResultsP = new Promise((r) => clientHost.once('round_results', r));
    clientHost.emit('lock_guess', { lat: 35.68, lng: 139.76 });
    const resultsData = await roundResultsP;
    assert(resultsData.round === 1, 'Round ended immediately because all in-game players guessed');

    // PlayerBob clicks "Join Match Now" (#btn-join-in-progress -> join_game)
    const bobRejoinP = new Promise((r) => clientPlayer.once('round_results', r));
    clientPlayer.emit('join_game');
    const bobRejoinResults = await bobRejoinP;
    assert(bobRejoinResults.round === 1, 'PlayerBob rejoined ongoing match without losing registration or error');

    // -----------------------------------------------------------------
    // TEST 3: Host Stop Game returns all players to lobby
    // -----------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Host Stop Game Returns All ---');
    const stopP1 = new Promise((r) => clientHost.once('game_stopped', r));
    const stopP2 = new Promise((r) => clientPlayer.once('game_stopped', r));
    clientHost.emit('stop_game');
    const [stoppedHost, stoppedBob] = await Promise.all([stopP1, stopP2]);
    assert(stoppedHost && stoppedBob, 'Host stop_game returned all players to lobby');

    // -----------------------------------------------------------------
    // TEST 4: Reset to Lobby after Game Over / Idempotent Reset
    // -----------------------------------------------------------------
    console.log('\n--- SCENARIO 4: Reset to Lobby Idempotency ---');
    const lobbyResetP = new Promise((r) => clientPlayer.once('return_to_lobby', r));
    clientPlayer.emit('reset_to_lobby');
    const lobbyData = await lobbyResetP;
    assert(lobbyData.status === 'LOBBY' || lobbyData.currentRound === 0, 'reset_to_lobby while in LOBBY emits return_to_lobby to requesting client');

    // Cleanup
    clientHost.disconnect();
    clientPlayer.disconnect();
    serverProcess.kill();

    console.log(`\n🎉 ALL ${passed} LOBBY RETURN BUTTON TESTS PASSED PERFECTLY! 🎉\n`);
    process.exit(0);
  } catch (err) {
    console.error('Test run failed:', err);
    serverProcess.kill();
    process.exit(1);
  }
}

runLobbyButtonTests();
