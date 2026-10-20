/**
 * Security & Crown Hijacking Verification Test Suite
 * Validates:
 * 1. Username Collision & Active Player Impersonation Rejection
 * 2. Crown & Host Hijacking Prevention
 * 3. Non-Host Privilege Escalation Prevention
 * 4. Admission Gating Integrity
 * 5. Mock IP LAN Spoofing Protection
 */

const { spawn } = require('child_process');
const ioClient = require('socket.io-client');
const path = require('path');

const TEST_PORT = 3008;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let passed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ [TEST ${++passed}] ${message}`);
}

async function runSecuritySuite() {
  console.log('\n=============================================================');
  console.log(`  STARTING SECURITY & CROWN HIJACKING TEST SUITE (Port ${TEST_PORT})`);
  console.log('=============================================================\n');

  const serverPath = path.resolve(__dirname, '../dist/main.js');
  const serverProcess = spawn('node', [serverPath], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'test' },
    stdio: 'pipe',
  });

  serverProcess.stderr.on('data', (d) => console.error('[SERVER ERR]', d.toString().trim()));
  await sleep(1500);

  let hostClient = null;
  let attackerClient = null;
  let regularClient = null;

  try {
    // -------------------------------------------------------------
    // PHASE 1: Legitimate Host Connects & Claims Crown
    // -------------------------------------------------------------
    console.log('\n--- PHASE 1: Legitimate Host Registration ---');
    hostClient = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.10' } });

    const hostPrompt = await new Promise((r) => hostClient.once('prompt_username', r));
    assert(hostPrompt.isHost === true, 'Legitimate first player is recognized as initial Host candidate');

    const hostSetPromise = new Promise((r) => hostClient.once('username_set', r));
    hostClient.emit('set_username', { username: 'CommanderAlice' });
    const hostSet = await hostSetPromise;
    assert(hostSet.isHost === true, 'CommanderAlice designated as Host 👑');
    assert(hostSet.hostIp === '192.168.1.10', 'Host IP correctly recorded as 192.168.1.10');

    // -------------------------------------------------------------
    // PHASE 2: Impersonator Attempts to Steal Host's Callsign & Crown
    // -------------------------------------------------------------
    console.log('\n--- PHASE 2: Impersonator Attempts to Steal Callsign & Crown ---');
    attackerClient = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.99' } });

    await new Promise((r) => attackerClient.once('prompt_username', r));

    // Attempt 1: Exact matching username
    const errPromise1 = new Promise((r) => attackerClient.once('error_message', r));
    attackerClient.emit('set_username', { username: 'CommanderAlice' });
    const err1 = await errPromise1;
    assert(err1.message.includes('already claimed by an active player'), 'Attacker blocked from reusing active Host callsign "CommanderAlice"');

    // Attempt 2: Case-insensitive variation
    const errPromise2 = new Promise((r) => attackerClient.once('error_message', r));
    attackerClient.emit('set_username', { username: 'commanderALICE' });
    const err2 = await errPromise2;
    assert(err2.message.includes('already claimed by an active player'), 'Attacker blocked from reusing case-insensitive callsign "commanderALICE"');

    // Verify Host identity was NOT corrupted or stolen
    const lobbyUpdatePromise = new Promise((r) => hostClient.once('lobby_update', r));
    hostClient.emit('set_countdown_duration', { seconds: 20 });
    const lobbyUpdate = await lobbyUpdatePromise;
    assert(lobbyUpdate.hostIp === '192.168.1.10', 'Legitimate Host IP remained 192.168.1.10');
    const hostInLobby = lobbyUpdate.players.find((p) => p.ip === '192.168.1.10');
    assert(hostInLobby && hostInLobby.username === 'CommanderAlice' && hostInLobby.isHost, 'CommanderAlice is intact with host crown 👑');

    // -------------------------------------------------------------
    // PHASE 3: Attacker Attempts to Claim Host Directly
    // -------------------------------------------------------------
    console.log('\n--- PHASE 3: Attacker Attempts to Claim Host Directly ---');
    const claimErrPromise = new Promise((r) => attackerClient.once('error_message', r));
    attackerClient.emit('claim_host');
    const claimErr = await claimErrPromise;
    assert(claimErr.message.includes('A host is already active'), 'Attacker claim_host strictly rejected while Host is active');

    // Attacker attempts Host-only controls
    const startErrPromise = new Promise((r) => attackerClient.once('error_message', r));
    attackerClient.emit('start_game');
    const startErr = await startErrPromise;
    assert(startErr.message.includes('Only the host'), 'Attacker start_game rejected');

    const regionErrPromise = new Promise((r) => attackerClient.once('error_message', r));
    attackerClient.emit('set_region', { region: 'asia' });
    const regionErr = await regionErrPromise;
    assert(regionErr.message.includes('Only the host'), 'Attacker set_region rejected');

    const roundsErrPromise = new Promise((r) => attackerClient.once('error_message', r));
    attackerClient.emit('set_total_rounds', { rounds: 15 });
    const roundsErr = await roundsErrPromise;
    assert(roundsErr.message.includes('Only the host'), 'Attacker set_total_rounds rejected');

    // -------------------------------------------------------------
    // PHASE 4: Legitimate Player Gated Admission & Host Approval
    // -------------------------------------------------------------
    console.log('\n--- PHASE 4: Legitimate Player Gated Admission & Approval ---');
    regularClient = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.25' } });
    await new Promise((r) => regularClient.once('prompt_username', r));

    const admissionPendingPromise = new Promise((r) => regularClient.once('admission_pending', r));
    const admissionReqPromise = new Promise((r) => hostClient.once('admission_requested', r));

    regularClient.emit('set_username', { username: 'RangerBob' });

    const pendingData = await admissionPendingPromise;
    const reqData = await admissionReqPromise;

    assert(pendingData.username === 'RangerBob', 'Applicant received admission_pending for "RangerBob"');
    assert(reqData.applicantName === 'RangerBob' && reqData.applicantIp === '192.168.1.25', 'Host notified of admission request from RangerBob');

    // Attacker tries to decide admission -> rejected
    const decideErrPromise = new Promise((r) => attackerClient.once('error_message', r));
    attackerClient.emit('decide_admission', { applicantIp: '192.168.1.25', accepted: true });
    const decideErr = await decideErrPromise;
    assert(decideErr.message.includes('Only the host can accept or decline'), 'Non-host cannot accept/decline admissions');

    // Host accepts RangerBob
    const acceptedPromise = new Promise((r) => regularClient.once('admission_accepted', r));
    hostClient.emit('decide_admission', { applicantIp: '192.168.1.25', accepted: true });
    await acceptedPromise;
    assert(true, 'Host accepted RangerBob into the match');

    // -------------------------------------------------------------
    // PHASE 5: Controlled Host Crown Transfer
    // -------------------------------------------------------------
    console.log('\n--- PHASE 5: Host Transfers Crown Voluntarily ---');
    const transferPromise = new Promise((r) => {
      hostClient.once('host_transferred', (d) => r(d));
    });
    hostClient.emit('transfer_host', { targetIp: '192.168.1.25' });
    const transferData = await transferPromise;
    assert(transferData.newHost === 'RangerBob' && transferData.newHostIp === '192.168.1.25', 'Crown 👑 transferred voluntarily from Alice to Bob');

    // Non-host Alice attempts Host action now -> rejected
    const aliceStopPromise = new Promise((r) => hostClient.once('error_message', r));
    hostClient.emit('set_region', { region: 'europe' });
    const aliceStopErr = await aliceStopPromise;
    assert(aliceStopErr.message.includes('Only the host'), 'Former host Alice is now a regular player and cannot perform host actions');

    // New Host Bob can now change region
    const regionUpdatePromise = new Promise((r) => regularClient.once('region_updated', r));
    regularClient.emit('set_region', { region: 'europe' });
    const updatedRegion = await regionUpdatePromise;
    assert(updatedRegion.selectedRegion === 'europe', 'New Host Bob successfully updated match region to "europe"');

    // -------------------------------------------------------------
    // PHASE 6: Anti-Leak Telemetry & Coordinate Shielding Verification
    // -------------------------------------------------------------
    console.log('\n--- PHASE 6: Plain Text Coordinate Leakage Shielding ---');
    const bobRoundStartedP = new Promise((r) => regularClient.once('round_started', r));
    const aliceRoundStartedP = new Promise((r) => hostClient.once('round_started', r));

    regularClient.emit('start_game');
    const [bobRound, aliceRound] = await Promise.all([bobRoundStartedP, aliceRoundStartedP]);

    assert(bobRound.round === 1, 'Match successfully started by Host Bob');
    assert(bobRound.panoramaCoords === undefined, 'Anti-Cheat: Host socket round_started payload has ZERO panoramaCoords');
    assert(aliceRound.panoramaCoords === undefined, 'Anti-Cheat: Operative socket round_started payload has ZERO panoramaCoords');
    assert(bobRound.lat === undefined && bobRound.lng === undefined, 'Zero plain text coordinates in WebSocket frame');

    // Test Street View Uplink Endpoint: Unauthorized IP is blocked
    const unauthRes = await fetch(`${SERVER_URL}/api/streetview/uplink?mockIp=192.168.1.99`);
    assert(unauthRes.status === 403, 'Unauthorized client IP blocked from accessing /api/streetview/uplink (403 Forbidden)');

    // Test Street View Uplink Endpoint: Authorized player receives 200 OK without 302 Location header leak
    const authRes = await fetch(`${SERVER_URL}/api/streetview/uplink?mockIp=192.168.1.25`);
    assert(authRes.status === 200, 'Authorized operative receives 200 OK from /api/streetview/uplink');
    assert(!authRes.headers.get('location'), 'Zero 302 Location redirect header leakage in response');

    const uplinkHtml = await authRes.text();
    assert(uplinkHtml.includes('<!DOCTYPE html>'), 'Uplink serves isolated HTML wrapper');
    assert(!uplinkHtml.includes('cbll='), 'No plain text cbll parameter in HTTP response body');
    assert(uplinkHtml.includes('atob(_p)'), 'Uplink HTML utilizes dynamic in-memory deciphering');

    // Test mid-game reconnection: rejoin_match must NOT leak panoramaCoords
    const rejoinClient = ioClient(SERVER_URL, { query: { mockIp: '192.168.1.25' } });
    const rejoinP = new Promise((r) => rejoinClient.once('rejoin_match', r));
    const rejoinData = await rejoinP;
    assert(rejoinData.panoramaCoords === undefined, 'Anti-Cheat: rejoin_match payload strictly omits plain text panoramaCoords');
    rejoinClient.disconnect();

    console.log('\n=============================================================');
    console.log('  🎉 ALL 29 SECURITY & HIJACKING TESTS PASSED PERFECTLY! 🎉');
    console.log('=============================================================\n');
  } finally {
    if (hostClient) hostClient.disconnect();
    if (attackerClient) attackerClient.disconnect();
    if (regularClient) regularClient.disconnect();
    serverProcess.kill('SIGTERM');
  }
}

runSecuritySuite();
