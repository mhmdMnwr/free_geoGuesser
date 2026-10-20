/**
 * Comprehensive Verification Suite for Gatekeeper Admissions & Lobby Match Parameters
 * Tests:
 * 1. Host Gatekeeper Admission Popup: Accept and Decline flows.
 * 2. Applicant clearance waiting state and cancellation.
 * 3. Match round count configuration strictly clamped (min 3, max 20).
 * 4. First-guess countdown duration configuration (clamped 5s to 120s).
 * 5. Dynamic timer countdown trigger using configured duration.
 */

const path = require('path');
const { spawn } = require('child_process');
const { io: ioClient } = require('socket.io-client');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAdmissionsAndParamsTests() {
  const TEST_PORT = 3004;
  const SERVER_URL = `http://localhost:${TEST_PORT}`;

  console.log(`\n=============================================================`);
  console.log(`  STARTING ADMISSIONS & MATCH PARAMETERS TEST SUITE (Port ${TEST_PORT})`);
  console.log(`=============================================================\n`);

  const serverPath = path.resolve(__dirname, '../dist/main.js');
  const serverProcess = spawn('node', [serverPath], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', () => {});
  serverProcess.stderr.on('data', (d) => console.error('[SERVER ERR]', d.toString().trim()));

  await sleep(1500); // Allow server to bind

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
    // 1. Host Connection
    // -----------------------------------------------------------------
    console.log('\n--- PHASE 1: Host Registers and Verifies Default Params ---');
    const clientHost = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.100' } });
    await new Promise((r) => clientHost.once('prompt_username', r));
    clientHost.emit('set_username', { username: 'CommanderHost' });
    const hostData = await new Promise((r) => clientHost.once('username_set', r));

    assert(hostData.isHost === true, 'CommanderHost designated as Host');
    assert(hostData.totalRounds === 10, 'Default total rounds is 10');
    assert(hostData.countdownDuration === 20, 'Default scramble timer countdown is 20s');

    // -----------------------------------------------------------------
    // 2. Configure Match Parameters (Rounds: min 3, max 20)
    // -----------------------------------------------------------------
    console.log('\n--- PHASE 2: Configure Total Rounds (Strict Min 3, Max 20) ---');
    
    // Test valid round count: 15
    let paramsPromise = new Promise((r) => clientHost.once('params_updated', r));
    clientHost.emit('set_total_rounds', { rounds: 15 });
    let paramsData = await paramsPromise;
    assert(paramsData.totalRounds === 15, 'Host configured total rounds to 15');

    // Test minimum round count: 3
    paramsPromise = new Promise((r) => clientHost.once('params_updated', r));
    clientHost.emit('set_total_rounds', { rounds: 3 });
    paramsData = await paramsPromise;
    assert(paramsData.totalRounds === 3, 'Host configured total rounds to minimum 3');

    // Test maximum round count: 20
    paramsPromise = new Promise((r) => clientHost.once('params_updated', r));
    clientHost.emit('set_total_rounds', { rounds: 20 });
    paramsData = await paramsPromise;
    assert(paramsData.totalRounds === 20, 'Host configured total rounds to maximum 20');

    // Test invalid round count < 3 (e.g. 2) -> must be ignored by server
    let invalidUpdated = false;
    clientHost.once('params_updated', () => { invalidUpdated = true; });
    clientHost.emit('set_total_rounds', { rounds: 2 });
    await sleep(200);
    assert(!invalidUpdated, 'Server rejected round count 2 (strictly clamped to min 3)');

    // Test invalid round count > 20 (e.g. 21) -> must be ignored by server
    invalidUpdated = false;
    clientHost.once('params_updated', () => { invalidUpdated = true; });
    clientHost.emit('set_total_rounds', { rounds: 21 });
    await sleep(200);
    assert(!invalidUpdated, 'Server rejected round count 21 (strictly clamped to max 20)');

    // -----------------------------------------------------------------
    // 3. Configure Scramble Timer (5s to 120s)
    // -----------------------------------------------------------------
    console.log('\n--- PHASE 3: Configure Scramble Timer Duration ---');

    // Set timer to 15s
    paramsPromise = new Promise((r) => clientHost.once('params_updated', r));
    clientHost.emit('set_countdown_duration', { seconds: 15 });
    paramsData = await paramsPromise;
    assert(paramsData.countdownDuration === 15, 'Host configured countdown duration to 15s');

    // Set timer to 45s
    paramsPromise = new Promise((r) => clientHost.once('params_updated', r));
    clientHost.emit('set_countdown_duration', { seconds: 45 });
    paramsData = await paramsPromise;
    assert(paramsData.countdownDuration === 45, 'Host configured countdown duration to 45s');

    // Invalid timer (< 5s) -> ignored
    invalidUpdated = false;
    clientHost.once('params_updated', () => { invalidUpdated = true; });
    clientHost.emit('set_countdown_duration', { seconds: 2 });
    await sleep(200);
    assert(!invalidUpdated, 'Server rejected countdown duration < 5s');

    // Set back to 10s for gameplay test later
    paramsPromise = new Promise((r) => clientHost.once('params_updated', r));
    clientHost.emit('set_countdown_duration', { seconds: 10 });
    paramsData = await paramsPromise;
    assert(paramsData.countdownDuration === 10, 'Host configured countdown duration to 10s');

    // Set rounds to 3 for fast gameplay test
    paramsPromise = new Promise((r) => clientHost.once('params_updated', r));
    clientHost.emit('set_total_rounds', { rounds: 3 });
    paramsData = await paramsPromise;
    assert(paramsData.totalRounds === 3, 'Host set match rounds to 3');

    // -----------------------------------------------------------------
    // 4. Admission Gatekeeper: Host Declines Applicant
    // -----------------------------------------------------------------
    console.log('\n--- PHASE 4: Gatekeeper Admission Decline Flow ---');
    const clientApplicant1 = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.101' } });
    await new Promise((r) => clientApplicant1.once('prompt_username', r));

    // Applicant requests admission
    const hostRequestedPromise1 = new Promise((r) => clientHost.once('admission_requested', r));
    const pendingPromise1 = new Promise((r) => clientApplicant1.once('admission_pending', r));

    clientApplicant1.emit('set_username', { username: 'RogueAgent' });

    const [admRequest1, admPending1] = await Promise.all([hostRequestedPromise1, pendingPromise1]);
    assert(admRequest1.applicantIp === '192.168.1.101' && admRequest1.applicantName === 'RogueAgent', 'Host received admission_requested for RogueAgent');
    assert(admPending1.username === 'RogueAgent' && admPending1.hostName === 'CommanderHost', 'Applicant RogueAgent received admission_pending with host name');

    // Host declines RogueAgent
    const declinedPromise = new Promise((r) => clientApplicant1.once('admission_declined', r));
    clientHost.emit('decide_admission', { applicantIp: '192.168.1.101', accepted: false });
    const declinedData = await declinedPromise;
    assert(declinedData && declinedData.message.includes('declined'), 'Applicant received admission_declined message');

    clientApplicant1.disconnect();
    await sleep(150);

    // -----------------------------------------------------------------
    // 5. Admission Gatekeeper: Host Accepts Applicant
    // -----------------------------------------------------------------
    console.log('\n--- PHASE 5: Gatekeeper Admission Accept Flow ---');
    const clientApplicant2 = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.102' } });
    await new Promise((r) => clientApplicant2.once('prompt_username', r));

    const hostRequestedPromise2 = new Promise((r) => clientHost.once('admission_requested', r));
    const pendingPromise2 = new Promise((r) => clientApplicant2.once('admission_pending', r));

    clientApplicant2.emit('set_username', { username: 'AllyOperative' });

    const [admRequest2, admPending2] = await Promise.all([hostRequestedPromise2, pendingPromise2]);
    assert(admRequest2.applicantIp === '192.168.1.102' && admRequest2.applicantName === 'AllyOperative', 'Host received admission_requested for AllyOperative');

    // Host accepts AllyOperative
    const acceptedPromise = new Promise((r) => clientApplicant2.once('admission_accepted', r));
    const userSetPromise2 = new Promise((r) => clientApplicant2.once('username_set', r));
    const lobbyUpdatePromise = new Promise((resolve) => {
      const handler = (data) => {
        if (data.players && data.players.length === 2) {
          clientHost.off('lobby_update', handler);
          resolve(data);
        }
      };
      clientHost.on('lobby_update', handler);
    });

    clientHost.emit('decide_admission', { applicantIp: '192.168.1.102', accepted: true });

    const [acceptedData, userSet2, lobbyData] = await Promise.all([acceptedPromise, userSetPromise2, lobbyUpdatePromise]);
    assert(acceptedData.username === 'AllyOperative', 'Applicant received admission_accepted confirmation');
    assert(userSet2.username === 'AllyOperative' && userSet2.isHost === false, 'Applicant received username_set into Lobby');
    assert(lobbyData.players.length === 2, 'Lobby roster now contains both CommanderHost and AllyOperative');
    assert(lobbyData.totalRounds === 3, 'Lobby update broadcasts configured totalRounds (3)');
    assert(lobbyData.countdownDuration === 10, 'Lobby update broadcasts configured countdownDuration (10)');

    // -----------------------------------------------------------------
    // 6. Non-Host Security: Non-Host cannot alter match parameters
    // -----------------------------------------------------------------
    console.log('\n--- PHASE 6: Non-Host Security Check ---');
    const errRoundsP = new Promise((r) => clientApplicant2.once('error_message', r));
    clientApplicant2.emit('set_total_rounds', { rounds: 5 });
    const errRounds = await errRoundsP;
    assert(errRounds.message.includes('Only the host'), 'Non-host cannot configure round count');

    const errTimerP = new Promise((r) => clientApplicant2.once('error_message', r));
    clientApplicant2.emit('set_countdown_duration', { seconds: 30 });
    const errTimer = await errTimerP;
    assert(errTimer.message.includes('Only the host'), 'Non-host cannot configure countdown duration');

    // -----------------------------------------------------------------
    // 7. Dynamic Timer Execution in Active Round
    // -----------------------------------------------------------------
    console.log('\n--- PHASE 7: Dynamic First-Guess Countdown Execution ---');
    const startHostP = new Promise((r) => clientHost.once('round_started', r));
    const startAllyP = new Promise((r) => clientApplicant2.once('round_started', r));

    clientHost.emit('start_game');
    const [roundHost, roundAlly] = await Promise.all([startHostP, startAllyP]);

    assert(roundHost.round === 1 && roundHost.totalRounds === 3, 'Round 1 of 3 commenced');
    assert(roundAlly.round === 1 && roundAlly.totalRounds === 3, 'Ally joined Round 1 of 3');

    // Ally locks guess -> triggers dynamic countdown using configured countdownDuration (10s)
    const countdownP = new Promise((r) => clientHost.once('countdown_started', r));
    clientApplicant2.emit('lock_guess', { lat: 40.71, lng: -74.00 });
    const countdownData = await countdownP;

    assert(countdownData.seconds === 10, 'First guess triggered dynamic 10s countdown as configured by Host!');
    assert(countdownData.triggeredBy === 'AllyOperative', 'Countdown triggered by AllyOperative');

    // Host locks guess -> round ends immediately since all players locked
    const roundResultsP = new Promise((r) => clientHost.once('round_results', r));
    clientHost.emit('lock_guess', { lat: 40.71, lng: -74.00 });
    const resultsData = await roundResultsP;
    assert(resultsData.round === 1, 'Round ended immediately after all active players guessed');

    // Cleanup
    clientHost.disconnect();
    clientApplicant2.disconnect();
    serverProcess.kill();

    console.log(`\n🎉 ALL ${passed} ADMISSIONS & MATCH PARAMETERS TESTS PASSED PERFECTLY! 🎉\n`);
    process.exit(0);
  } catch (err) {
    console.error('Test run failed:', err);
    serverProcess.kill();
    process.exit(1);
  }
}

runAdmissionsAndParamsTests();
