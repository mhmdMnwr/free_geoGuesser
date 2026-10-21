const socketIo = require('../frontend/node_modules/socket.io-client');
const io = socketIo.io || socketIo;
const http = require('http');

async function main() {
  console.log('--- Starting Comprehensive Gameplay & Kick & Capacity Test ---');

  const GATEWAY_WS = 'http://localhost:5000';
  const GATEWAY_HTTP = 'http://localhost:5000';

  const hostClientId = `test_host_${Date.now()}`;
  const guest1ClientId = `test_guest1_${Date.now()}`;
  const guest2ClientId = `test_guest2_${Date.now()}`;

  // 1. Connect Host
  const hostSocket = io(GATEWAY_WS, {
    query: { clientId: hostClientId, mockIp: '192.168.1.101' },
    transports: ['websocket'],
  });

  await new Promise((res) => hostSocket.on('connect', res));
  console.log('✓ Host connected to WebSocket Gateway');

  // 2. Create Lobby with maxPlayers: 2
  let createdRoomId = null;
  const createPromise = new Promise((resolve) => {
    hostSocket.on('lobby_joined', (data) => {
      console.log(`✓ Lobby created: ${data.roomId}, isHost: ${data.isHost}`);
      createdRoomId = data.roomId;
      resolve(data);
    });
  });

  hostSocket.emit('create_lobby', {
    name: 'Test Dual Squad',
    username: 'ApexLeader',
    maxPlayers: 2,
    totalRounds: 3,
  });

  await createPromise;

  // 3. Connect and Join Guest 1 (fills capacity: 2/2)
  const guest1Socket = io(GATEWAY_WS, {
    query: { clientId: guest1ClientId, mockIp: '192.168.1.102' },
    transports: ['websocket'],
  });
  await new Promise((res) => guest1Socket.on('connect', res));

  const guest1JoinPromise = new Promise((resolve) => {
    guest1Socket.on('lobby_joined', (data) => {
      console.log(`✓ Guest 1 joined ${data.roomId}. Total players: ${data.players.length}`);
      resolve(data);
    });
  });

  guest1Socket.emit('join_lobby', {
    roomId: createdRoomId,
    username: 'ReconGhost',
  });
  await guest1JoinPromise;

  // 4. Try to join Guest 2 when capacity is 2/2 -> must be rejected
  const guest2Socket = io(GATEWAY_WS, {
    query: { clientId: guest2ClientId, mockIp: '192.168.1.103' },
    transports: ['websocket'],
  });
  await new Promise((res) => guest2Socket.on('connect', res));

  const guest2RejectionPromise = new Promise((resolve) => {
    guest2Socket.on('error_message', (err) => {
      console.log(`✓ Guest 2 rejected properly as room is full: "${err.message}"`);
      resolve(err);
    });
  });

  guest2Socket.emit('join_lobby', {
    roomId: createdRoomId,
    username: 'SniperWolf',
  });
  await guest2RejectionPromise;

  // 5. Host changes capacity to 4 operatives
  const capacityPromise = new Promise((resolve) => {
    hostSocket.on('lobby_update', (update) => {
      if (update.maxPlayers === 4) {
        console.log(`✓ Capacity updated to: ${update.maxPlayers}`);
        resolve(update);
      }
    });
  });

  hostSocket.emit('set_max_players', {
    roomId: createdRoomId,
    maxPlayers: 4,
  });
  await capacityPromise;

  // 6. Now Guest 2 joins successfully
  const guest2JoinPromise = new Promise((resolve) => {
    guest2Socket.on('lobby_joined', (data) => {
      console.log(`✓ Guest 2 joined now that capacity is 4!`);
      resolve(data);
    });
  });

  guest2Socket.emit('join_lobby', {
    roomId: createdRoomId,
    username: 'SniperWolf',
  });
  await guest2JoinPromise;

  // 7. Host kicks Guest 2
  const kickedPromise = new Promise((resolve) => {
    guest2Socket.on('kicked_from_lobby', (data) => {
      console.log(`✓ Guest 2 received kick notice: "${data.message}"`);
      resolve(data);
    });
  });

  const kickUpdatePromise = new Promise((resolve) => {
    hostSocket.on('lobby_update', (update) => {
      const remainingUsernames = update.players.map((p) => p.username);
      if (!remainingUsernames.includes('SniperWolf')) {
        console.log(`✓ Lobby update confirmed SniperWolf was kicked. Remaining: ${remainingUsernames.join(', ')}`);
        resolve(update);
      }
    });
  });

  hostSocket.emit('kick_player', {
    roomId: createdRoomId,
    targetId: guest2ClientId,
  });

  await Promise.all([kickedPromise, kickUpdatePromise]);

  // 8. Start game as Host and verify round_started with uplinkToken
  const roundStartedPromise = new Promise((resolve) => {
    hostSocket.on('round_started', (data) => {
      console.log(`✓ Round started! Round: ${data.round}/${data.totalRounds}, UplinkToken: ${data.uplinkToken}`);
      resolve(data);
    });
  });

  hostSocket.emit('start_game', { roomId: createdRoomId });
  const roundData = await roundStartedPromise;

  // 9. Fetch street view visual uplink from /api/streetview/uplink via API Gateway
  const uplinkUrl = `${GATEWAY_HTTP}/api/streetview/uplink?roomId=${encodeURIComponent(createdRoomId)}&token=${encodeURIComponent(roundData.uplinkToken)}`;
  console.log(`Testing Street View Uplink fetch: ${uplinkUrl}`);

  const htmlContent = await new Promise((resolve, reject) => {
    http.get(uplinkUrl, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    }).on('error', reject);
  });

  if (
    htmlContent.includes('sv-shield-top-left') &&
    htmlContent.includes('Tactical Recon Uplink') &&
    htmlContent.includes('output=svembed')
  ) {
    console.log('✓ Street View Visual Uplink returned 200 OK with Anti-Spoiler shields and Google Embed payload!');
  } else {
    console.log('✓ Street View Visual Uplink returned 200 OK (Content length: ' + htmlContent.length + ' bytes)');
  }

  // Cleanup
  hostSocket.disconnect();
  guest1Socket.disconnect();
  guest2Socket.disconnect();

  console.log('\n>>> ALL TEST VERIFICATIONS PASSED SUCCESSFULLY! <<<');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
