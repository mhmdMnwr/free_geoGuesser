const socketIo = require('../frontend/node_modules/socket.io-client');
const io = socketIo.io || socketIo;
const http = require('http');

const SERVER_URL = 'http://localhost:5000';

function log(test, msg, success = true) {
  const icon = success ? '✅' : '❌';
  console.log(`[${test}] ${icon} ${msg}`);
}

async function run() {
  console.log('\n--- VERIFYING USERNAME UNIQUENESS & COOKIE PERSISTENCE ---');

  // Socket 1: Host creates lobby with username "GHOST_RECON"
  const clientId1 = 'cookie_player_1';
  const socket1 = io(SERVER_URL, {
    transports: ['websocket'],
    query: { clientId: clientId1, isBrowser: 'true' },
    auth: { clientId: clientId1 },
  });

  let roomId = null;

  await new Promise((resolve, reject) => {
    socket1.on('connect', () => {
      socket1.emit('create_lobby', {
        name: 'GHOST TEAM',
        username: 'GHOST_RECON',
      });
    });

    socket1.on('lobby_joined', (data) => {
      roomId = data.roomId;
      log('Host Creation', `Lobby created: ${roomId} with leader ${data.hostName}`);
      resolve();
    });

    socket1.on('error_message', (err) => reject(new Error(err.message)));
  });

  // Socket 2: Another user tries to join with identical username "GHOST_RECON" (different clientId)
  const clientId2 = 'cookie_player_2';
  const socket2 = io(SERVER_URL, {
    transports: ['websocket'],
    query: { clientId: clientId2, isBrowser: 'true' },
    auth: { clientId: clientId2 },
  });

  let duplicateRejected = false;

  await new Promise((resolve) => {
    socket2.on('connect', () => {
      socket2.emit('join_lobby', {
        roomId,
        username: 'ghost_recon', // Case-insensitive test
      });
    });

    socket2.on('error_message', (err) => {
      log('Duplicate Check', `Successfully blocked duplicate callsign: "${err.message}"`);
      duplicateRejected = true;
      resolve();
    });

    socket2.on('lobby_joined', () => {
      log('Duplicate Check', 'FAILED: Allowed duplicate username in same room!', false);
      resolve();
    });
  });

  if (!duplicateRejected) {
    console.error('FAIL: Duplicate username was not rejected!');
    process.exit(1);
  }

  // Socket 3: Reconnecting original user (same clientId) with same username -> ALLOWED!
  const socket1Reconnect = io(SERVER_URL, {
    transports: ['websocket'],
    query: { clientId: clientId1, isBrowser: 'true', roomId },
    auth: { clientId: clientId1 },
  });

  let reconnectSuccess = false;
  await new Promise((resolve) => {
    socket1Reconnect.on('connect', () => {
      socket1Reconnect.emit('join_lobby', {
        roomId,
        username: 'GHOST_RECON',
      });
    });

    socket1Reconnect.on('lobby_joined', (data) => {
      log('Cookie Reconnect', `Original player reconnected smoothly: isHost=${data.isHost}`);
      reconnectSuccess = true;
      resolve();
    });

    socket1Reconnect.on('error_message', (err) => {
      log('Cookie Reconnect', `Unexpected error on reconnect: ${err.message}`, false);
      resolve();
    });
  });

  socket1.disconnect();
  socket2.disconnect();
  socket1Reconnect.disconnect();

  if (duplicateRejected && reconnectSuccess) {
    console.log('\n🎉 ALL DUPLICATE USERNAME & COOKIE PERSISTENCE CHECKS PASSED!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
