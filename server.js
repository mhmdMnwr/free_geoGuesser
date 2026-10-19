const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const PORT = parseInt(process.env.PORT, 10) || 3000;

// Load locations dataset
const locationsPath = path.join(__dirname, 'locations.json');
let allLocations = [];
try {
  allLocations = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
  console.log(`[LAN-Guessr] Loaded ${allLocations.length} locations from locations.json`);
} catch (err) {
  console.error('[LAN-Guessr] Error loading locations.json:', err);
  process.exit(1);
}

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Helper: Get local network IP addresses
function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ interface: name, address: iface.address });
      }
    }
  }
  return addresses;
}

// API endpoint to get LAN info for lobby display
app.get('/api/info', (req, res) => {
  const lanIps = getLanAddresses();
  const primaryIp = lanIps.length > 0 ? lanIps[0].address : 'localhost';
  res.json({
    primaryIp,
    lanIps,
    port: PORT,
    joinUrl: `http://${primaryIp}:${PORT}`,
  });
});

// API endpoint to inspect server status and player count
app.get('/api/status', (req, res) => {
  res.json({
    status: gameState.status,
    currentRound: gameState.currentRound,
    totalRounds: gameState.totalRounds,
    playerCount: Object.keys(gameState.players).length,
    selectedRegion: gameState.selectedRegion,
    hostIp: gameState.hostIp,
  });
});

// IP Extraction & Normalization
function getClientIp(socket, allowDevMock = true) {
  // Optional dev helper: allow ?mockIp=192.168.1.X for testing multiple tabs on 1 PC
  if (allowDevMock && socket.handshake.query?.mockIp) {
    return String(socket.handshake.query.mockIp).trim();
  }
  let rawIp =
    socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    socket.handshake.address ||
    socket.request?.socket?.remoteAddress ||
    socket.request?.connection?.remoteAddress ||
    'unknown';

  // Strip IPv6-mapped IPv4 prefix
  if (rawIp.startsWith('::ffff:')) {
    rawIp = rawIp.substring(7);
  }
  if (rawIp === '::1') {
    rawIp = '127.0.0.1';
  }
  return rawIp;
}

// Distance & Scoring Math
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's mean radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
  return R * c;
}

function calculateScore(distanceKm) {
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) return 0;
  // Within 25 meters = perfect 5000 points
  if (distanceKm <= 0.025) return 5000;
  // GeoGuessr world scale exponential decay
  const score = Math.round(5000 * Math.exp(-distanceKm / 2000));
  return Math.max(0, Math.min(5000, score));
}

// Authoritative in-memory game state
const gameState = {
  status: 'LOBBY', // 'LOBBY' | 'ROUND_ACTIVE' | 'ROUND_COUNTDOWN' | 'ROUND_RESULTS' | 'GAME_OVER'
  currentRound: 0,
  totalRounds: 10,
  selectedRegion: 'all', // 'all' | 'asia' | 'africa' | 'europe' | 'americas'
  selectedLocations: [], // Array of 10 { lat, lng, label, region }
  roundTarget: null,     // Current round target (lat, lng, label, region)
  countdownSeconds: null,
  countdownInterval: null,
  firstGuesserName: null,
  lastRoundResults: null,
  lastGameOver: null,
  hostIp: null,
  players: {
    // Keyed by normalized IP
  },
};

function getLobbyPlayers() {
  return Object.values(gameState.players).map((p) => ({
    ip: p.ip,
    username: p.username,
    connected: p.connected,
    totalScore: p.totalScore,
    isHost: p.ip === gameState.hostIp,
  }));
}

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function checkAllGuessed() {
  const activePlayers = Object.values(gameState.players).filter((p) => p.connected && p.inGame !== false);
  if (activePlayers.length === 0) return;
  const allGuessed = activePlayers.every((p) => p.hasGuessed);
  if (allGuessed) {
    console.log('[LAN-Guessr] All active players have guessed! Ending round immediately.');
    if (gameState.countdownInterval) {
      clearInterval(gameState.countdownInterval);
      gameState.countdownInterval = null;
    }
    endRound();
  }
}

function startRound(roundNumber) {
  if (gameState.countdownInterval) {
    clearInterval(gameState.countdownInterval);
    gameState.countdownInterval = null;
  }

  gameState.status = 'ROUND_ACTIVE';
  gameState.currentRound = roundNumber;
  gameState.roundTarget = gameState.selectedLocations[roundNumber - 1];
  gameState.countdownSeconds = null;
  gameState.firstGuesserName = null;

  // Reset player states for the new round
  for (const ip of Object.keys(gameState.players)) {
    const p = gameState.players[ip];
    p.currentPin = null;
    p.lockedGuess = null;
    p.hasGuessed = false;
    p.lastRoundScore = 0;
    p.lastRoundDistanceKm = null;
  }

  const activePlayers = Object.values(gameState.players).filter((p) => p.connected && p.inGame !== false);

  console.log(`[LAN-Guessr] Starting Round ${roundNumber}/${gameState.totalRounds}: ${gameState.roundTarget.label} (${gameState.roundTarget.region || 'global'})`);

  // Crucial: emit panoramaCoords only, never leak roundTarget.label during round
  io.emit('round_started', {
    round: roundNumber,
    totalRounds: gameState.totalRounds,
    panoramaCoords: {
      lat: gameState.roundTarget.lat,
      lng: gameState.roundTarget.lng,
    },
    guessedCount: 0,
    totalPlayers: activePlayers.length,
    hostIp: gameState.hostIp,
  });
}

function endRound() {
  if (gameState.countdownInterval) {
    clearInterval(gameState.countdownInterval);
    gameState.countdownInterval = null;
  }
  gameState.countdownSeconds = null;
  gameState.status = 'ROUND_RESULTS';

  const target = gameState.roundTarget;

  // Compute distances and scores
  for (const ip of Object.keys(gameState.players)) {
    const player = gameState.players[ip];
    const finalCoords = player.lockedGuess || player.currentPin || null;

    if (finalCoords) {
      const dist = calculateDistanceKm(target.lat, target.lng, finalCoords.lat, finalCoords.lng);
      const score = calculateScore(dist);
      player.lastRoundDistanceKm = Math.round(dist * 10) / 10;
      player.lastRoundScore = score;
      player.lockedGuess = finalCoords;
    } else {
      player.lastRoundDistanceKm = null;
      player.lastRoundScore = 0;
    }
    player.totalScore += player.lastRoundScore;
  }

  // Build sorted results (prioritizing players actively in the round)
  const sortedPlayers = Object.values(gameState.players)
    .filter((p) => p.inGame !== false)
    .sort((a, b) => b.totalScore - a.totalScore);
  const results = sortedPlayers.map((p) => ({
    username: p.username,
    ip: p.ip,
    guessCoords: p.lockedGuess,
    distanceKm: p.lastRoundDistanceKm,
    roundScore: p.lastRoundScore,
    totalScore: p.totalScore,
    hasGuessed: !!p.lockedGuess,
    isHost: p.ip === gameState.hostIp,
  }));

  // Identify closest guesser of the round (reveals username of the closest one)
  let closestPlayer = null;
  let minDistanceKm = Infinity;
  for (const p of results) {
    if (p.distanceKm !== null && !isNaN(p.distanceKm) && p.distanceKm < minDistanceKm) {
      minDistanceKm = p.distanceKm;
      closestPlayer = p;
    }
  }

  const payload = {
    round: gameState.currentRound,
    totalRounds: gameState.totalRounds,
    target: {
      lat: target.lat,
      lng: target.lng,
      label: target.label,
    },
    results,
    leaderboard: results,
    closestPlayer: closestPlayer
      ? {
          username: closestPlayer.username,
          distanceKm: closestPlayer.distanceKm,
          roundScore: closestPlayer.roundScore,
          guessCoords: closestPlayer.guessCoords,
        }
      : null,
    hostIp: gameState.hostIp,
  };

  gameState.lastRoundResults = payload;
  console.log(`[LAN-Guessr] Round ${gameState.currentRound} ended. Closest: ${closestPlayer?.username || 'None'} (${closestPlayer?.distanceKm || 0} km). Top score: ${results[0]?.username} (${results[0]?.totalScore} pts)`);
  io.emit('round_results', payload);
}

// Socket.io Connection & Event Handling
io.on('connection', (socket) => {
  const ip = getClientIp(socket);
  console.log(`[LAN-Guessr] Connection from IP: ${ip} (Socket ID: ${socket.id})`);

  // Ensure host exists if there are registered players
  if (!gameState.hostIp && Object.keys(gameState.players).length > 0) {
    gameState.hostIp = Object.keys(gameState.players)[0];
  }

  // Case A: LOBBY Phase
  if (gameState.status === 'LOBBY') {
    if (gameState.players[ip]) {
      // Existing player returning/refreshing in lobby
      const player = gameState.players[ip];
      player.connected = true;
      player.socketId = socket.id;

      socket.emit('session_restored', {
        ip,
        username: player.username,
        totalScore: player.totalScore,
        status: gameState.status,
        isHost: (ip === gameState.hostIp),
        hostIp: gameState.hostIp,
        selectedRegion: gameState.selectedRegion,
      });
      io.emit('lobby_update', {
        players: getLobbyPlayers(),
        hostIp: gameState.hostIp,
        selectedRegion: gameState.selectedRegion,
      });
    } else {
      // New IP during lobby
      socket.emit('prompt_username', {
        ip,
        currentUsername: null,
        isHost: (Object.keys(gameState.players).length === 0),
        selectedRegion: gameState.selectedRegion,
      });
    }
  } else {
    // Case B: In-game or Results/Game Over phase
    if (gameState.players[ip]) {
      // Returning registered player mid-game! Reconnect seamlessly
      const player = gameState.players[ip];
      player.connected = true;
      player.socketId = socket.id;

      const guessedCount = Object.values(gameState.players).filter((p) => p.hasGuessed).length;
      const totalPlayers = Object.keys(gameState.players).length;

      socket.emit('rejoin_match', {
        ip,
        username: player.username,
        status: gameState.status,
        round: gameState.currentRound,
        totalRounds: gameState.totalRounds,
        panoramaCoords: gameState.roundTarget
          ? { lat: gameState.roundTarget.lat, lng: gameState.roundTarget.lng }
          : null,
        countdownSeconds: gameState.countdownSeconds,
        firstGuesserName: gameState.firstGuesserName,
        hasGuessed: player.hasGuessed,
        currentPin: player.currentPin,
        lockedGuess: player.lockedGuess,
        totalScore: player.totalScore,
        lastRoundScore: player.lastRoundScore,
        lastRoundDistanceKm: player.lastRoundDistanceKm,
        lastRoundResults: gameState.lastRoundResults,
        gameOverResults: gameState.lastGameOver,
        guessedCount,
        totalPlayers,
        isHost: (ip === gameState.hostIp),
        hostIp: gameState.hostIp,
      });
      console.log(`[LAN-Guessr] Player ${player.username} (${ip}) rejoined match in status ${gameState.status}`);
    } else {
      // User request: Give them lobby, current game status, and the possibility to join
      console.log(`[LAN-Guessr] New user from IP ${ip} connected while game in progress (Status: ${gameState.status})`);
      socket.emit('prompt_username', {
        ip,
        currentUsername: null,
        inProgress: true,
        gameStatus: {
          status: gameState.status,
          currentRound: gameState.currentRound,
          totalRounds: gameState.totalRounds,
          playerCount: Object.keys(gameState.players).length,
          hostName: gameState.players[gameState.hostIp]?.username || 'Host',
          selectedRegion: gameState.selectedRegion,
        },
      });
    }
  }

  // Event: set_username (Registers or updates username)
  socket.on('set_username', (data) => {
    const rawUsername = typeof data === 'string' ? data : data?.username;
    let cleanName = String(rawUsername || '').replace(/<[^>]*>/g, '').trim();

    if (!cleanName || cleanName.length < 2) {
      socket.emit('error_message', { message: 'Username must be at least 2 characters.' });
      return;
    }
    if (cleanName.length > 18) {
      cleanName = cleanName.substring(0, 18);
    }

    // If game is active, only reject if an existing player tries to change name
    if (gameState.status !== 'LOBBY' && gameState.players[ip] && gameState.players[ip].username !== cleanName) {
      socket.emit('error_message', { message: 'Cannot change username while match is active.' });
      return;
    }

    const isFirstPlayer = Object.keys(gameState.players).length === 0;

    if (gameState.players[ip]) {
      gameState.players[ip].username = cleanName;
      gameState.players[ip].connected = true;
      gameState.players[ip].socketId = socket.id;
    } else {
      gameState.players[ip] = {
        ip,
        socketId: socket.id,
        username: cleanName,
        connected: true,
        totalScore: 0,
        currentPin: null,
        lockedGuess: null,
        hasGuessed: false,
        lastRoundScore: 0,
        lastRoundDistanceKm: null,
        inGame: (gameState.status === 'LOBBY'),
      };

      if (!gameState.hostIp || isFirstPlayer) {
        gameState.hostIp = ip;
      }
    }

    const userIsHost = (ip === gameState.hostIp);

    socket.emit('username_set', {
      ip,
      username: cleanName,
      isHost: userIsHost,
      hostIp: gameState.hostIp,
      selectedRegion: gameState.selectedRegion,
      gameStatus: gameState.status !== 'LOBBY' ? {
        status: gameState.status,
        currentRound: gameState.currentRound,
        totalRounds: gameState.totalRounds,
        hostName: gameState.players[gameState.hostIp]?.username || 'Host',
      } : null,
    });

    io.emit('lobby_update', {
      players: getLobbyPlayers(),
      hostIp: gameState.hostIp,
      selectedRegion: gameState.selectedRegion,
      gameStatus: {
        status: gameState.status,
        currentRound: gameState.currentRound,
        totalRounds: gameState.totalRounds,
      },
    });
    console.log(`[LAN-Guessr] Registered IP ${ip} as "${cleanName}" (Host: ${userIsHost})`);
  });

  // Event: set_region (Host only: select map pack / region)
  socket.on('set_region', (data) => {
    if (ip !== gameState.hostIp) {
      socket.emit('error_message', { message: 'Only the host can change map region.' });
      return;
    }
    const region = String(data?.region || 'all').toLowerCase();
    gameState.selectedRegion = region;
    console.log(`[LAN-Guessr] Host updated map region to: ${region}`);

    io.emit('region_updated', { selectedRegion: gameState.selectedRegion });
    io.emit('lobby_update', {
      players: getLobbyPlayers(),
      hostIp: gameState.hostIp,
      selectedRegion: gameState.selectedRegion,
    });
  });

  // Event: join_game (Allows user in lobby to jump directly into ongoing game)
  socket.on('join_game', () => {
    let player = gameState.players[ip];
    if (!player) {
      socket.emit('error_message', { message: 'Please set your username first.' });
      return;
    }

    if (gameState.status === 'LOBBY') {
      socket.emit('error_message', { message: 'Match has not started yet. Waiting in lobby.' });
      return;
    }

    player.inGame = true;
    player.connected = true;
    player.socketId = socket.id;

    console.log(`[LAN-Guessr] Player ${player.username} (${ip}) joining live game in status ${gameState.status}`);

    const inGamePlayers = Object.values(gameState.players).filter((p) => p.connected && p.inGame !== false);
    const guessedCount = inGamePlayers.filter((p) => p.hasGuessed).length;
    const totalPlayers = inGamePlayers.length;

    if (gameState.status === 'ROUND_ACTIVE' || gameState.status === 'ROUND_COUNTDOWN') {
      socket.emit('round_started', {
        round: gameState.currentRound,
        totalRounds: gameState.totalRounds,
        panoramaCoords: {
          lat: gameState.roundTarget.lat,
          lng: gameState.roundTarget.lng,
        },
        guessedCount,
        totalPlayers,
        countdownSeconds: gameState.countdownSeconds,
        firstGuesserName: gameState.firstGuesserName,
        isHost: (ip === gameState.hostIp),
        hostIp: gameState.hostIp,
      });
    } else if (gameState.status === 'ROUND_RESULTS') {
      socket.emit('round_results', gameState.lastRoundResults);
    } else if (gameState.status === 'GAME_OVER') {
      socket.emit('game_over', gameState.lastGameOver);
    }

    io.emit('player_joined', {
      username: player.username,
      ip: player.ip,
      totalPlayers,
    });
  });

  // Event: start_game (Lobby -> Round 1)
  socket.on('start_game', () => {
    if (gameState.status !== 'LOBBY') return;

    const registeredCount = Object.keys(gameState.players).length;
    if (registeredCount === 0) {
      socket.emit('error_message', { message: 'At least 1 player must join before starting.' });
      return;
    }

    console.log(`[LAN-Guessr] Starting game with ${registeredCount} players! Region filter: ${gameState.selectedRegion}`);

    // Filter locations by selected region if applicable
    let pool = allLocations;
    if (gameState.selectedRegion && gameState.selectedRegion !== 'all') {
      const filtered = allLocations.filter((l) => l.region === gameState.selectedRegion);
      if (filtered.length >= gameState.totalRounds) {
        pool = filtered;
      }
    }

    // Shuffle and pick 10 locations
    const shuffled = shuffleArray(pool);
    gameState.selectedLocations = shuffled.slice(0, gameState.totalRounds);

    // Reset scores & activate all registered players
    for (const p of Object.values(gameState.players)) {
      p.totalScore = 0;
      p.lastRoundScore = 0;
      p.lastRoundDistanceKm = null;
      p.hasGuessed = false;
      p.lockedGuess = null;
      p.currentPin = null;
      p.inGame = true;
    }

    startRound(1);
  });

  // Event: stop_game (Host only: stop match at any time and return to lobby)
  socket.on('stop_game', () => {
    if (ip !== gameState.hostIp) {
      socket.emit('error_message', { message: 'Only the host can stop the game.' });
      return;
    }

    console.log(`[LAN-Guessr] Host (${gameState.players[ip]?.username || ip}) stopped the match.`);
    if (gameState.countdownInterval) {
      clearInterval(gameState.countdownInterval);
      gameState.countdownInterval = null;
    }

    gameState.status = 'LOBBY';
    gameState.currentRound = 0;
    gameState.selectedLocations = [];
    gameState.roundTarget = null;
    gameState.countdownSeconds = null;
    gameState.firstGuesserName = null;
    gameState.lastRoundResults = null;
    gameState.lastGameOver = null;

    for (const p of Object.values(gameState.players)) {
      p.totalScore = 0;
      p.currentPin = null;
      p.lockedGuess = null;
      p.hasGuessed = false;
      p.lastRoundScore = 0;
      p.lastRoundDistanceKm = null;
      p.inGame = true;
    }

    io.emit('game_stopped', {
      message: 'The host has stopped the game. Returned to Lobby.',
      players: getLobbyPlayers(),
      hostIp: gameState.hostIp,
      selectedRegion: gameState.selectedRegion,
    });
    io.emit('return_to_lobby', {
      players: getLobbyPlayers(),
      hostIp: gameState.hostIp,
      selectedRegion: gameState.selectedRegion,
      status: 'LOBBY',
      currentRound: 0,
    });
  });

  // Event: leave_game (Any player can return to lobby from active match)
  socket.on('leave_game', () => {
    const player = gameState.players[ip];
    const username = player?.username || 'A player';
    console.log(`[LAN-Guessr] Player ${username} (${ip}) chose to leave match to lobby.`);

    const wasHost = (ip === gameState.hostIp);
    const otherIps = Object.keys(gameState.players).filter((pIp) => pIp !== ip);

    if (wasHost || otherIps.length === 0) {
      // Host or solo player returned to lobby: reset match state cleanly back to LOBBY
      if (gameState.countdownInterval) {
        clearInterval(gameState.countdownInterval);
        gameState.countdownInterval = null;
      }
      gameState.status = 'LOBBY';
      gameState.currentRound = 0;
      gameState.selectedLocations = [];
      gameState.roundTarget = null;
      gameState.countdownSeconds = null;
      gameState.firstGuesserName = null;
      gameState.lastRoundResults = null;
      gameState.lastGameOver = null;

      for (const p of Object.values(gameState.players)) {
        p.totalScore = 0;
        p.currentPin = null;
        p.lockedGuess = null;
        p.hasGuessed = false;
        p.lastRoundScore = 0;
        p.lastRoundDistanceKm = null;
        p.inGame = true;
      }

      io.emit('game_stopped', {
        message: wasHost ? 'Host returned match to Lobby.' : 'Returned to Lobby.',
        players: getLobbyPlayers(),
        hostIp: gameState.hostIp,
        selectedRegion: gameState.selectedRegion,
      });

      io.emit('lobby_update', {
        players: getLobbyPlayers(),
        hostIp: gameState.hostIp,
        selectedRegion: gameState.selectedRegion,
      });

      io.emit('return_to_lobby', {
        players: getLobbyPlayers(),
        hostIp: gameState.hostIp,
        selectedRegion: gameState.selectedRegion,
        status: gameState.status,
        currentRound: gameState.currentRound,
      });
      return;
    }

    // Multiplayer: Non-host player returns to lobby while match continues for others
    if (player) {
      player.inGame = false;
      player.hasGuessed = true;
    }

    socket.emit('return_to_lobby', {
      players: getLobbyPlayers(),
      hostIp: gameState.hostIp,
      selectedRegion: gameState.selectedRegion,
      status: gameState.status,
      currentRound: gameState.currentRound,
    });

    const activeInGame = Object.values(gameState.players).filter((p) => p.connected && p.inGame !== false);

    io.emit('player_left', {
      username,
      ip,
      remainingCount: activeInGame.length,
      hostIp: gameState.hostIp,
    });

    io.emit('lobby_update', {
      players: getLobbyPlayers(),
      hostIp: gameState.hostIp,
      selectedRegion: gameState.selectedRegion,
      gameStatus: {
        status: gameState.status,
        currentRound: gameState.currentRound,
        totalRounds: gameState.totalRounds,
      },
    });

    if (gameState.status === 'ROUND_ACTIVE' || gameState.status === 'ROUND_COUNTDOWN') {
      checkAllGuessed();
    }
  });

  // Event: update_pin (Draft pin before locking)
  socket.on('update_pin', (data) => {
    if (gameState.status !== 'ROUND_ACTIVE' && gameState.status !== 'ROUND_COUNTDOWN') return;

    const player = gameState.players[ip];
    if (!player || player.hasGuessed) return;

    if (data && typeof data.lat === 'number' && !isNaN(data.lat) && typeof data.lng === 'number' && !isNaN(data.lng)) {
      if (data.lat >= -90 && data.lat <= 90 && data.lng >= -180 && data.lng <= 180) {
        player.currentPin = { lat: data.lat, lng: data.lng };
      }
    }
  });

  // Event: lock_guess (Final guess for round)
  socket.on('lock_guess', (data) => {
    if (gameState.status !== 'ROUND_ACTIVE' && gameState.status !== 'ROUND_COUNTDOWN') return;

    const player = gameState.players[ip];
    if (!player || player.hasGuessed) return;

    let coords = null;
    if (data && typeof data.lat === 'number' && !isNaN(data.lat) && typeof data.lng === 'number' && !isNaN(data.lng)) {
      if (data.lat >= -90 && data.lat <= 90 && data.lng >= -180 && data.lng <= 180) {
        coords = { lat: data.lat, lng: data.lng };
      }
    } else if (player.currentPin && typeof player.currentPin.lat === 'number' && !isNaN(player.currentPin.lat)) {
      coords = player.currentPin;
    }

    if (!coords) {
      socket.emit('error_message', { message: 'Please place a valid pin on the map first.' });
      return;
    }

    player.lockedGuess = coords;
    player.currentPin = coords;
    player.hasGuessed = true;

    const guessedCount = Object.values(gameState.players).filter((p) => p.hasGuessed).length;
    const totalPlayers = Object.keys(gameState.players).length;

    console.log(`[LAN-Guessr] ${player.username} locked guess (${guessedCount}/${totalPlayers})`);

    // Broadcast guess update
    io.emit('player_guessed', {
      username: player.username,
      ip: player.ip,
      guessedCount,
      totalPlayers,
    });

    // Dynamic 20s Countdown Check:
    // If this is the FIRST guess of the round, start 20s countdown
    if (gameState.status === 'ROUND_ACTIVE') {
      gameState.status = 'ROUND_COUNTDOWN';
      gameState.countdownSeconds = 20;
      gameState.firstGuesserName = player.username;

      console.log(`[LAN-Guessr] First guess by ${player.username}! 20s countdown started.`);
      io.emit('countdown_started', {
        seconds: 20,
        triggeredBy: player.username,
      });

      if (gameState.countdownInterval) clearInterval(gameState.countdownInterval);
      gameState.countdownInterval = setInterval(() => {
        gameState.countdownSeconds--;
        io.emit('timer_tick', { seconds: gameState.countdownSeconds });

        if (gameState.countdownSeconds <= 0) {
          clearInterval(gameState.countdownInterval);
          gameState.countdownInterval = null;
          console.log('[LAN-Guessr] 20s countdown expired. Ending round.');
          endRound();
        }
      }, 1000);
    }

    // Check if ALL registered players have now guessed
    checkAllGuessed();
  });

  // Event: next_round (From ROUND_RESULTS to next round or GAME_OVER)
  socket.on('next_round', () => {
    if (gameState.status !== 'ROUND_RESULTS') return;

    if (gameState.currentRound < gameState.totalRounds) {
      startRound(gameState.currentRound + 1);
    } else {
      // Round 10 completed -> GAME_OVER
      gameState.status = 'GAME_OVER';
      const sortedPlayers = Object.values(gameState.players).sort((a, b) => b.totalScore - a.totalScore);
      const leaderboard = sortedPlayers.map((p) => ({
        username: p.username,
        ip: p.ip,
        totalScore: p.totalScore,
      }));

      const payload = { leaderboard, hostIp: gameState.hostIp };
      gameState.lastGameOver = payload;
      console.log('[LAN-Guessr] Game Over! Final Standings:', leaderboard);
      io.emit('game_over', payload);
    }
  });

  // Event: reset_to_lobby (Reset back to lobby after game over)
  socket.on('reset_to_lobby', () => {
    if (gameState.status === 'LOBBY') {
      // Already in LOBBY state: ensure the requesting socket returns to the lobby view
      socket.emit('return_to_lobby', {
        players: getLobbyPlayers(),
        hostIp: gameState.hostIp,
        selectedRegion: gameState.selectedRegion,
        status: 'LOBBY',
        currentRound: 0,
      });
      return;
    }

    console.log('[LAN-Guessr] Resetting match to LOBBY. New players can now join.');
    if (gameState.countdownInterval) {
      clearInterval(gameState.countdownInterval);
      gameState.countdownInterval = null;
    }

    gameState.status = 'LOBBY';
    gameState.currentRound = 0;
    gameState.selectedLocations = [];
    gameState.roundTarget = null;
    gameState.countdownSeconds = null;
    gameState.firstGuesserName = null;
    gameState.lastRoundResults = null;
    gameState.lastGameOver = null;

    for (const p of Object.values(gameState.players)) {
      p.totalScore = 0;
      p.currentPin = null;
      p.lockedGuess = null;
      p.hasGuessed = false;
      p.lastRoundScore = 0;
      p.lastRoundDistanceKm = null;
      p.inGame = true;
    }

    io.emit('lobby_update', {
      players: getLobbyPlayers(),
      hostIp: gameState.hostIp,
      selectedRegion: gameState.selectedRegion,
    });
    io.emit('return_to_lobby', {
      players: getLobbyPlayers(),
      hostIp: gameState.hostIp,
      selectedRegion: gameState.selectedRegion,
      status: 'LOBBY',
      currentRound: 0,
    });
  });

  // Disconnection handler: "when a player is not playing at the time delete his name"
  socket.on('disconnect', () => {
    console.log(`[LAN-Guessr] Socket disconnected: ${socket.id} (IP: ${ip})`);
    if (gameState.players[ip] && gameState.players[ip].socketId === socket.id) {
      const username = gameState.players[ip].username;
      const wasHost = (ip === gameState.hostIp);

      // User requirement: delete inactive / disconnected player's name
      delete gameState.players[ip];

      if (wasHost) {
        gameState.hostIp = Object.keys(gameState.players)[0] || null;
      }

      if (Object.keys(gameState.players).length === 0) {
        if (gameState.countdownInterval) {
          clearInterval(gameState.countdownInterval);
          gameState.countdownInterval = null;
        }
        gameState.status = 'LOBBY';
        gameState.currentRound = 0;
        gameState.selectedLocations = [];
        gameState.roundTarget = null;
        gameState.countdownSeconds = null;
        gameState.firstGuesserName = null;
        gameState.lastRoundResults = null;
        gameState.lastGameOver = null;
        gameState.hostIp = null;
      }

      console.log(`[LAN-Guessr] Deleted inactive player ${username} (${ip}). Remaining players: ${Object.keys(gameState.players).length}`);

      io.emit('player_left', {
        username,
        ip,
        remainingCount: Object.keys(gameState.players).length,
        hostIp: gameState.hostIp,
      });

      io.emit('lobby_update', {
        players: getLobbyPlayers(),
        hostIp: gameState.hostIp,
        selectedRegion: gameState.selectedRegion,
        gameStatus: {
          status: gameState.status,
          currentRound: gameState.currentRound,
          totalRounds: gameState.totalRounds,
        },
      });

      if (gameState.status === 'ROUND_ACTIVE' || gameState.status === 'ROUND_COUNTDOWN') {
        checkAllGuessed();
      }
    }
  });
});

// Start HTTP & WebSocket Server on 0.0.0.0
server.listen(PORT, '0.0.0.0', () => {
  const lanIps = getLanAddresses();
  console.log('\n=============================================================');
  console.log('       LAN-GUESS-R: MULTIPLAYER GEOGUESSR CLONE');
  console.log('=============================================================');
  console.log(`  Local host:    http://localhost:${PORT}`);
  if (lanIps.length > 0) {
    lanIps.forEach((net) => {
      console.log(`  LAN URL (${net.interface}): http://${net.address}:${PORT}`);
    });
  } else {
    console.log(`  LAN URL:       http://0.0.0.0:${PORT}`);
  }
  console.log('  Testing tip:   Open multiple tabs with ?mockIp=192.168.1.X');
  console.log('=============================================================\n');
});
