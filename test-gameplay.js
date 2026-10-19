/**
 * Comprehensive Automated End-to-End Test Suite for LAN-Guessr
 */

const { io: ioClient } = require('socket.io-client');
const { spawn } = require('child_process');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- Starting LAN-Guessr Server for Verification ---');
  const serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: '3001' },
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', (d) => {
    // console.log(`[SERVER] ${d.toString().trim()}`);
  });
  serverProcess.stderr.on('data', (d) => {
    console.error(`[SERVER ERR] ${d.toString().trim()}`);
  });

  await sleep(1000); // Wait for server to bind 3001

  const SERVER_URL = 'http://localhost:3001';
  let passedTests = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      serverProcess.kill();
      process.exit(1);
    }
    console.log(`✅ PASSED: ${message}`);
    passedTests++;
  }

  try {
    // 1. Connect Client 1 (Alice, mock IP 192.168.1.10)
    console.log('\n[TEST 1] Client 1 (Alice) connects during LOBBY...');
    const client1 = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.10' } });

    const prompt1 = await new Promise((resolve) => client1.once('prompt_username', resolve));
    assert(prompt1.ip === '192.168.1.10', 'Client 1 received prompt_username with normalized IP');

    client1.emit('set_username', { username: 'Alice' });
    const userSet1 = await new Promise((resolve) => client1.once('username_set', resolve));
    assert(userSet1.username === 'Alice', 'Client 1 registered as Alice');

    // 2. Connect Client 2 (Bob, mock IP 192.168.1.20)
    console.log('\n[TEST 2] Client 2 (Bob) connects during LOBBY...');
    const client2 = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.20' } });

    const prompt2 = await new Promise((resolve) => client2.once('prompt_username', resolve));
    assert(prompt2.ip === '192.168.1.20', 'Client 2 received prompt_username with normalized IP');

    client2.emit('set_username', { username: 'Bob' });
    const userSet2 = await new Promise((resolve) => client2.once('username_set', resolve));
    assert(userSet2.username === 'Bob', 'Client 2 registered as Bob');

    // Wait for lobby_update showing both players
    await sleep(200);

    // 3. Start Game
    console.log('\n[TEST 3] Client 1 triggers start_game...');
    const roundStartedPromise1 = new Promise((resolve) => client1.once('round_started', resolve));
    const roundStartedPromise2 = new Promise((resolve) => client2.once('round_started', resolve));

    client1.emit('start_game');

    const [roundData1, roundData2] = await Promise.all([roundStartedPromise1, roundStartedPromise2]);
    assert(roundData1.round === 1 && roundData1.totalRounds === 10, 'Round 1 started (1 of 10)');
    assert(roundData1.panoramaCoords && typeof roundData1.panoramaCoords.lat === 'number', 'Street View panorama coords provided');
    assert(roundData1.label === undefined, 'Round location label is HIDDEN from round_started payload');

    // 4. Test Lockout: New IP connects while game is active
    console.log('\n[TEST 4] Unrecognized Client 3 (Charlie, 192.168.1.99) connects during active match...');
    const client3 = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.99' } });
    const matchLockedPromise = new Promise((resolve) => client3.once('match_locked', resolve));
    const lockedData = await matchLockedPromise;
    assert(lockedData && lockedData.reason, 'Client 3 correctly blocked with match_locked event');

    // 5. Test Reconnection: Registered Client 1 disconnects and reconnects mid-game
    console.log('\n[TEST 5] Client 1 reconnects (simulating browser refresh) mid-game...');
    client1.disconnect();
    await sleep(300);

    const client1Rejoin = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.10' } });
    const rejoinData = await new Promise((resolve) => client1Rejoin.once('rejoin_match', resolve));
    assert(rejoinData.username === 'Alice' && rejoinData.round === 1, 'Client 1 seamlessly rejoined active round');
    assert(rejoinData.status === 'ROUND_ACTIVE', 'Rejoin status is ROUND_ACTIVE');

    // 6. Test First-Guess Dynamic 20s Timer
    console.log('\n[TEST 6] Alice places pin and locks guess (First guess of the round)...');
    const countdownPromise = new Promise((resolve) => client2.once('countdown_started', resolve));
    const timerTickPromise = new Promise((resolve) => client2.once('timer_tick', resolve));

    // Guess coordinates near Eiffel Tower (48.85, 2.29)
    client1Rejoin.emit('update_pin', { lat: 48.85, lng: 2.29 });
    client1Rejoin.emit('lock_guess', { lat: 48.85, lng: 2.29 });

    const countdownData = await countdownPromise;
    assert(countdownData.seconds === 20 && countdownData.triggeredBy === 'Alice', 'First guess triggered 20s countdown for all players');

    const tickData = await timerTickPromise;
    assert(typeof tickData.seconds === 'number', 'timer_tick broadcasted seconds remaining');

    // 7. Test All Players Guessed -> Round Ends Immediately
    console.log('\n[TEST 7] Bob locks guess before countdown reaches 0...');
    const roundResultsPromise = new Promise((resolve) => client2.once('round_results', resolve));

    client2.emit('lock_guess', { lat: 35.65, lng: 139.70 });
    const resultsData = await roundResultsPromise;
    assert(resultsData.round === 1, 'Round 1 ended immediately after all players guessed');
    assert(resultsData.target && resultsData.target.label, 'Target location revealed in round_results');
    assert(resultsData.results.length === 2, 'Results include both Alice and Bob');
    assert(typeof resultsData.results[0].roundScore === 'number', 'Round scores calculated via Haversine & decay math');

    // 8. Test Advance to Round 2
    console.log('\n[TEST 8] Trigger next_round -> Round 2...');
    const round2Promise = new Promise((resolve) => client2.once('round_started', resolve));
    client2.emit('next_round');
    const r2Data = await round2Promise;
    assert(r2Data.round === 2, 'Successfully advanced to Round 2');

    // 9. Fast-forward through remaining rounds to test GAME_OVER
    console.log('\n[TEST 9] Fast-forwarding through rounds 2 to 10...');
    for (let r = 2; r <= 10; r++) {
      // Both guess quickly
      const endPromise = new Promise((resolve) => client2.once('round_results', resolve));
      client1Rejoin.emit('lock_guess', { lat: 0, lng: 0 });
      client2.emit('lock_guess', { lat: 10, lng: 10 });
      await endPromise;

      if (r < 10) {
        const nextStartPromise = new Promise((resolve) => client2.once('round_started', resolve));
        client2.emit('next_round');
        await nextStartPromise;
      }
    }

    // Trigger next_round on Round 10 -> GAME_OVER
    console.log('\n[TEST 10] Trigger next_round from Round 10 -> Game Over...');
    const gameOverPromise = new Promise((resolve) => client2.once('game_over', resolve));
    client2.emit('next_round');
    const gameOverData = await gameOverPromise;
    assert(Array.isArray(gameOverData.leaderboard), 'Received game_over with final leaderboard');
    assert(gameOverData.leaderboard.length === 2, 'Leaderboard contains both players ranked');

    // 10. Test Reset to Lobby & Unlocking New Players
    console.log('\n[TEST 11] Trigger reset_to_lobby...');
    const returnLobbyPromise = new Promise((resolve) => client2.once('return_to_lobby', resolve));
    client2.emit('reset_to_lobby');
    await returnLobbyPromise;
    assert(true, 'Returned to lobby');

    // Charlie now connects and is NO LONGER blocked
    console.log('\n[TEST 12] Previously blocked Client 3 connects after reset_to_lobby...');
    client3.disconnect();
    await sleep(200);

    const client3Lobby = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.99' } });
    const prompt3 = await new Promise((resolve) => client3Lobby.once('prompt_username', resolve));
    assert(prompt3.ip === '192.168.1.99', 'Client 3 successfully received prompt_username now that lobby is open!');

    // Cleanup
    client1Rejoin.disconnect();
    client2.disconnect();
    client3Lobby.disconnect();

    console.log(`\n🎉 ALL ${passedTests} VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n`);
  } catch (err) {
    console.error('Test error:', err);
    serverProcess.kill();
    process.exit(1);
  } finally {
    serverProcess.kill();
  }
}

runTests();
