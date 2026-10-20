/**
 * Verification test for Operational Difficulty & Geographical DB integration
 */

const path = require('path');
const { io: ioClient } = require('socket.io-client');
const { spawn } = require('child_process');
const { GeoDatabaseService } = require('../dist/geo-database/geo-database.service');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('\n=============================================================');
  console.log('  STARTING DIFFICULTY & GEOGRAPHICAL DB TEST SUITE');
  console.log('=============================================================\n');

  // Phase 1: Database Adapter Verification
  console.log('--- PHASE 1: Geographical DB Adapter & Dataset Verification ---');
  const geoDb = new GeoDatabaseService();
  geoDb.onModuleInit();

  const allLocs = geoDb.getAllInMemoryLocations();
  console.log(`✅ [TEST 1] In-memory dataset loaded: ${allLocs.length} locations`);
  if (allLocs.length < 10000) throw new Error(`Expected at least 10,000 locations, got ${allLocs.length}`);

  const easyLocs = await geoDb.getLocations({ difficulty: 'easy' });
  console.log(`✅ [TEST 2] Queried easy difficulty locations: ${easyLocs.length} found`);
  if (easyLocs.length < 3000) throw new Error(`Expected at least 3,000 easy locations, got ${easyLocs.length}`);

  const mediumLocs = await geoDb.getLocations({ difficulty: 'medium' });
  console.log(`✅ [TEST 3] Queried medium difficulty locations: ${mediumLocs.length} found`);
  if (mediumLocs.length < 3000) throw new Error(`Expected at least 3,000 medium locations, got ${mediumLocs.length}`);

  const hardLocs = await geoDb.getLocations({ difficulty: 'hard' });
  console.log(`✅ [TEST 4] Queried hard difficulty locations: ${hardLocs.length} found`);
  if (hardLocs.length < 2500) throw new Error(`Expected at least 2,500 hard locations, got ${hardLocs.length}`);

  const europeEasy = await geoDb.getLocations({ region: 'europe', difficulty: 'easy' });
  console.log(`✅ [TEST 5] Filtered europe + easy: ${europeEasy.length} found`);
  if (europeEasy.length === 0) throw new Error('Expected at least 1 europe easy location');

  if (geoDb.getPool()) {
    await geoDb.getPool().end();
  }

  // Phase 2: Live Socket Server Difficulty Setting & Round Generation
  console.log('\n--- PHASE 2: Live Socket.IO Difficulty Negotiation ---');
  const PORT = '3006';
  const serverPath = path.resolve(__dirname, '../dist/main.js');
  const serverProcess = spawn('node', [serverPath], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT },
    stdio: 'pipe',
  });

  await sleep(1500); // Allow server to bind

  try {
    const hostSocket = ioClient(`http://localhost:${PORT}?mockIp=192.168.1.10`, {
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => {
      hostSocket.once('prompt_username', (data) => {
        console.log(`✅ [TEST 6] Host connected: detected default difficulty "${data.difficulty || 'all'}"`);
        hostSocket.emit('set_username', { username: 'CommanderHost' });
        resolve();
      });
    });

    await new Promise((resolve) => {
      hostSocket.once('username_set', (data) => {
        console.log(`✅ [TEST 7] Host username confirmed: ${data.username}, isHost=${data.isHost}`);
        resolve();
      });
    });

    // Host sets difficulty to "easy"
    await new Promise((resolve) => {
      hostSocket.once('difficulty_updated', (data) => {
        console.log(`✅ [TEST 8] Host set difficulty to "${data.difficulty}"`);
        if (data.difficulty !== 'easy') throw new Error(`Expected difficulty easy, got ${data.difficulty}`);
        resolve();
      });
      hostSocket.emit('set_difficulty', { difficulty: 'easy' });
    });

    // Host sets difficulty to "hard"
    await new Promise((resolve) => {
      hostSocket.once('difficulty_updated', (data) => {
        console.log(`✅ [TEST 9] Host set difficulty to "${data.difficulty}"`);
        if (data.difficulty !== 'hard') throw new Error(`Expected difficulty hard, got ${data.difficulty}`);
        resolve();
      });
      hostSocket.emit('set_difficulty', { difficulty: 'hard' });
    });

    // Host sets rounds to 3 and starts game with "hard" difficulty
    hostSocket.emit('set_total_rounds', { rounds: 3 });

    await new Promise((resolve) => {
      hostSocket.once('round_started', (data) => {
        console.log(`✅ [TEST 10] Round 1 started with difficulty: "${data.difficulty}" (Coordinates securely hidden: ${data.panoramaCoords === undefined})`);
        if (data.difficulty !== 'hard') throw new Error(`Expected round difficulty hard, got ${data.difficulty}`);
        resolve();
      });
      hostSocket.emit('start_game');
    });

    hostSocket.disconnect();
    serverProcess.kill();

    console.log('\n🎉 ALL 10 DIFFICULTY & DATABASE TESTS PASSED! 🎉\n');
    process.exit(0);
  } catch (err) {
    serverProcess.kill();
    throw err;
  }
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
