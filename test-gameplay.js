/**
 * Comprehensive Automated End-to-End Test Suite for LAN-Guessr
 * Tests Host Controls, Region Selector (Africa/Asia), Mid-Game Join, Inactive Player Deletion,
 * Closest Guesser Reveal, 20s Dynamic Timer, and Return to Lobby.
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
    // 1. Connect Client 1 (Alice, mock IP 192.168.1.10) - becomes Host
    console.log('\n[TEST 1] Client 1 (Alice) connects during LOBBY...');
    const client1 = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.10' } });

    const prompt1 = await new Promise((resolve) => client1.once('prompt_username', resolve));
    assert(prompt1.ip === '192.168.1.10', 'Client 1 received prompt_username with normalized IP');

    client1.emit('set_username', { username: 'Alice' });
    const userSet1 = await new Promise((resolve) => client1.once('username_set', resolve));
    assert(userSet1.username === 'Alice', 'Client 1 registered as Alice');
    assert(userSet1.isHost === true, 'Client 1 (first operative) is designated Host 👑');

    // 2. Host Selects Map Region (Asia or Africa)
    console.log('\n[TEST 2] Host Alice selects Map Region "asia"...');
    const regionPromise = new Promise((resolve) => client1.once('region_updated', resolve));
    client1.emit('set_region', { region: 'asia' });
    const regData = await regionPromise;
    assert(regData.selectedRegion === 'asia', 'Map region successfully updated to "asia"');

    // 3. Connect Client 2 (Bob, mock IP 192.168.1.20)
    console.log('\n[TEST 3] Client 2 (Bob) connects during LOBBY...');
    const client2 = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.20' } });

    const prompt2 = await new Promise((resolve) => client2.once('prompt_username', resolve));
    assert(prompt2.ip === '192.168.1.20', 'Client 2 received prompt_username with normalized IP');

    client2.emit('set_username', { username: 'Bob' });
    const userSet2 = await new Promise((resolve) => client2.once('username_set', resolve));
    assert(userSet2.username === 'Bob', 'Client 2 registered as Bob');
    assert(userSet2.isHost === false, 'Client 2 is not host');

    // Wait for lobby_update showing both players
    await sleep(200);

    // 4. Start Game
    console.log('\n[TEST 4] Host Alice triggers start_game...');
    const roundStartedPromise1 = new Promise((resolve) => client1.once('round_started', resolve));
    const roundStartedPromise2 = new Promise((resolve) => client2.once('round_started', resolve));

    client1.emit('start_game');

    const [roundData1, roundData2] = await Promise.all([roundStartedPromise1, roundStartedPromise2]);
    assert(roundData1.round === 1 && roundData1.totalRounds === 10, 'Round 1 started (1 of 10)');
    assert(roundData1.panoramaCoords && typeof roundData1.panoramaCoords.lat === 'number', 'Street View panorama coords provided');
    assert(roundData1.label === undefined, 'Round location label is HIDDEN from round_started payload');

    // 5. User request: Mid-game connection receives lobby with match status and can join!
    console.log('\n[TEST 5] Mid-game Client 3 (Charlie, 192.168.1.99) connects and joins live match...');
    const client3 = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.99' } });
    const prompt3 = await new Promise((resolve) => client3.once('prompt_username', resolve));
    assert(prompt3.inProgress === true && prompt3.gameStatus.status === 'ROUND_ACTIVE', 'Client 3 receives live match status in lobby');

    client3.emit('set_username', { username: 'Charlie' });
    await new Promise((resolve) => client3.once('username_set', resolve));

    // Charlie clicks "Join Game"
    const charlieJoinPromise = new Promise((resolve) => client3.once('round_started', resolve));
    client3.emit('join_game');
    const charlieRound = await charlieJoinPromise;
    assert(charlieRound.round === 1, 'Client 3 successfully joined ongoing Round 1!');

    // 6. User request: "when a player is not playing at the time delete his name"
    console.log('\n[TEST 6] Inactive player Charlie disconnects -> name deleted from active players...');
    const playerLeftPromise = new Promise((resolve) => client1.once('player_left', resolve));
    client3.disconnect();
    const leftData = await playerLeftPromise;
    assert(leftData.username === 'Charlie', 'Charlie reported as left the match');
    assert(leftData.remainingCount === 2, 'Active players count accurately reduced to 2 (Charlie deleted)');

    // 7. Test First-Guess Dynamic 20s Timer
    console.log('\n[TEST 7] Alice places pin and locks guess (First guess of the round)...');
    const countdownPromise = new Promise((resolve) => client2.once('countdown_started', resolve));
    const timerTickPromise = new Promise((resolve) => client2.once('timer_tick', resolve));

    client1.emit('update_pin', { lat: 35.65, lng: 139.70 });
    client1.emit('lock_guess', { lat: 35.65, lng: 139.70 });

    const countdownData = await countdownPromise;
    assert(countdownData.seconds === 20 && countdownData.triggeredBy === 'Alice', 'First guess triggered 20s countdown for all players');

    const tickData = await timerTickPromise;
    assert(typeof tickData.seconds === 'number', 'timer_tick broadcasted seconds remaining');

    // 8. Bob locks guess -> Round Ends Immediately & Closest Guesser Revealed
    console.log('\n[TEST 8] Bob locks guess before countdown reaches 0...');
    const roundResultsPromise = new Promise((resolve) => client2.once('round_results', resolve));

    client2.emit('lock_guess', { lat: 35.00, lng: 135.77 });
    const resultsData = await roundResultsPromise;
    assert(resultsData.round === 1, 'Round 1 ended immediately after all active players guessed');
    assert(resultsData.target && resultsData.target.label, 'Target location revealed in round_results');
    assert(resultsData.results.length === 2, 'Results only include currently active players (Alice & Bob)');
    assert(resultsData.closestPlayer && resultsData.closestPlayer.username, `Closest guesser revealed: "${resultsData.closestPlayer.username}" (${resultsData.closestPlayer.distanceKm} km away)`);

    // 9. Host Stop Game at Any Time -> All Return to Lobby
    console.log('\n[TEST 9] Host Alice stops the game mid-match...');
    const stoppedPromise1 = new Promise((resolve) => client1.once('game_stopped', resolve));
    const stoppedPromise2 = new Promise((resolve) => client2.once('game_stopped', resolve));

    client1.emit('stop_game');

    const [stop1, stop2] = await Promise.all([stoppedPromise1, stoppedPromise2]);
    assert(stop1 && stop2, 'Host successfully stopped the match; all players returned to lobby');

    // 10. Non-host cannot stop game
    console.log('\n[TEST 10] Non-host Bob attempts to stop game -> rejected...');
    const errPromise = new Promise((resolve) => client2.once('error_message', resolve));
    client2.emit('stop_game');
    const errData = await errPromise;
    assert(errData && errData.message.includes('host'), 'Server correctly rejected non-host stop_game command');

    // 11. Cleanup
    client1.disconnect();
    client2.disconnect();

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
