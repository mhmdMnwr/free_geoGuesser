/**
 * LAN-Guessr: Real-Time LAN Multiplayer Geography Guessing Game
 * Cyber-Tactical Engine: Zero-Key English ESRI World Street Map, Nearest Landmark Telemetry,
 * Custom Needle-Tip Pin Cursor, Canvas Confetti & Sound Effects
 */

// ============================================================
// 1. SOUND & AUDIO SYNTHESIS CONTROLLER (WEB AUDIO API)
// ============================================================
const Sound = {
  ctx: null,
  muted: localStorage.getItem('lan_guessr_muted') === 'true',

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('lan_guessr_muted', String(this.muted));
    this.updateMuteButtons();
    showToast(this.muted ? 'Audio Muted' : 'Audio Enabled', 'info');
  },

  updateMuteButtons() {
    const icon = this.muted ? '🔇' : '🔊';
    const b1 = document.getElementById('btn-toggle-sound');
    const b2 = document.getElementById('hud-btn-sound');
    if (b1) b1.textContent = icon;
    if (b2) b2.textContent = icon;
  },

  play(freq, type = 'sine', duration = 0.1, gainVal = 0.1) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  },

  click() { this.play(700, 'sine', 0.04, 0.05); },
  pop() { this.play(400, 'triangle', 0.08, 0.08); },
  tick() { this.play(880, 'sine', 0.05, 0.05); },
  urgentTick(sec) {
    const pitch = 950 + (6 - Math.max(1, sec)) * 90;
    this.play(pitch, 'triangle', 0.09, 0.09);
  },
  lock() {
    this.play(523.25, 'triangle', 0.15, 0.1);
    setTimeout(() => this.play(659.25, 'triangle', 0.2, 0.1), 100);
  },
  fanfare() {
    this.play(440, 'triangle', 0.2, 0.12);
    setTimeout(() => this.play(554.37, 'triangle', 0.2, 0.12), 120);
    setTimeout(() => this.play(659.25, 'triangle', 0.35, 0.15), 240);
  }
};

// ============================================================
// 2. LIGHTWEIGHT CANVAS CONFETTI ENGINE
// ============================================================
const Confetti = {
  canvas: null,
  ctx: null,
  particles: [],
  animId: null,

  init() {
    this.canvas = document.getElementById('confetti-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  launch(count = 90) {
    if (!this.canvas) this.init();
    if (!this.canvas) return;

    const colors = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: window.innerWidth * (0.3 + Math.random() * 0.4),
        y: window.innerHeight * 0.45,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.8) * 13,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    if (!this.animId) {
      this.loop();
    }
  },

  loop() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.vx *= 0.98;
      p.rotation += p.rSpeed;
      p.opacity -= 0.008;

      if (p.opacity <= 0 || p.y > this.canvas.height) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.opacity;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(() => this.loop());
    } else {
      this.animId = null;
    }
  }
};

// ============================================================
// 3. TOAST NOTIFICATIONS & RANDOM CALLSIGN GENERATOR
// ============================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    info: 'bg-slate-900 border-slate-700 text-slate-200',
    success: 'bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-emerald-500/20',
    error: 'bg-red-950/90 border-red-500 text-red-200 shadow-red-500/20',
    warning: 'bg-amber-950/90 border-amber-500 text-amber-200 shadow-amber-500/20',
  };

  toast.className = `px-4 py-2.5 rounded-2xl border shadow-2xl text-xs font-bold flex items-center gap-2 pointer-events-auto transform transition-all duration-300 translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function getRandomCallsign() {
  const adjectives = ['Apex', 'Atlas', 'Compass', 'Globe', 'Summit', 'Terra', 'Meridian', 'Polar', 'Vagabond', 'Cosmic', 'Nomad', 'Horizon', 'Vanguard', 'Echo'];
  const nouns = ['Fox', 'Eagle', 'Trotter', 'Wolf', 'Ranger', 'Hawk', 'Pioneer', 'Star', 'Seeker', 'Ninja', 'Falcon', 'Ghost', 'Scout'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${adj}${noun}${num}`;
}

// ============================================================
// 4. GLOBAL CLIENT STATE & MAP CONFIGURATION
// ============================================================
const MAP_TILES = {
  // 100% Free ESRI World Street Map (Full English country, city & road labels worldwide - Zero API Key, No Watermark)
  street: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    label: '🌙 Dark',
    isDark: false,
  },
  // Tactical Dark Mode with zero API key
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    label: '☀️ Light',
    isDark: true,
  },
  // High-Resolution Satellite Imagery view (Zero API Key)
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    label: '🗺️ Map',
    isDark: false,
  },
};
// Aliases for compatibility
MAP_TILES.voyager = MAP_TILES.street;

const state = {
  myIp: null,
  myUsername: null,
  currentRound: 0,
  totalRounds: 10,
  currentPin: null,      // { lat, lng } draft pin
  hasGuessed: false,
  isMapExpanded: false,
  mapTheme: 'street',    // 'street' | 'dark' | 'satellite'
  totalScore: 0,
  serverJoinUrl: '',
  autoAdvanceInterval: null,
  autoAdvanceSeconds: 15,
};

// Check for mockIp query param for multi-tab testing on 1 PC
const urlParams = new URLSearchParams(window.location.search);
const mockIp = urlParams.get('mockIp');
const socket = io({
  query: mockIp ? { mockIp } : {},
});

// View Switcher
function switchView(targetViewId) {
  const views = [
    'view-username',
    'view-lobby',
    'view-locked',
    'view-game',
    'view-results',
    'view-gameover',
  ];

  views.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === targetViewId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  if (targetViewId !== 'view-game') {
    document.body.classList.remove('urgent-vignette');
  }

  if (targetViewId !== 'view-results' && state.autoAdvanceInterval) {
    clearInterval(state.autoAdvanceInterval);
    state.autoAdvanceInterval = null;
  }

  if (targetViewId === 'view-game' && guessMap) {
    setTimeout(() => guessMap.invalidateSize(), 150);
  } else if (targetViewId === 'view-results' && resultsMap) {
    setTimeout(() => resultsMap.invalidateSize(), 150);
  }
}

// ============================================================
// 5. LEAFLET MAP INSTANCES (100% IN ENGLISH)
// ============================================================
let guessMap = null;
let guessMarker = null;
let guessTileLayer = null;

let resultsMap = null;
let resultsLayerGroup = null;

function createTacticalPinIcon() {
  return L.divIcon({
    className: 'tactical-pin-wrapper',
    html: `
      <div class="tactical-pin-pulse"></div>
      <div class="tactical-pin-svg">
        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 40C16 40 28 24.5 28 15C28 8.37258 22.6274 3 16 3C9.37258 3 4 8.37258 4 15C4 24.5 16 40 16 40Z" fill="url(#pinG)" stroke="#ffffff" stroke-width="2.5"/>
          <circle cx="16" cy="15" r="4.5" fill="#ffffff"/>
          <defs>
            <linearGradient id="pinG" x1="16" y1="3" x2="16" y2="40" gradientUnits="userSpaceOnUse">
              <stop stop-color="#ff3366"/>
              <stop offset="1" stop-color="#b91c1c"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div class="tactical-pin-tag">YOUR GUESS</div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42], // Sharp needle point at bottom tip
  });
}

function initGuessMap() {
  const mapElement = document.getElementById('guess-map');
  if (!mapElement || guessMap) return;

  guessMap = L.map('guess-map', {
    center: [20, 0],
    zoom: 2,
    minZoom: 1,
    maxZoom: 18,
    attributionControl: false,
    zoomControl: false,
  });

  // 100% Free ESRI World Street Map (100% in English, Zero API Key!)
  const cfg = MAP_TILES[state.mapTheme] || MAP_TILES.street;
  guessTileLayer = L.tileLayer(cfg.url, {
    maxZoom: cfg.maxZoom,
  }).addTo(guessMap);

  if (cfg.isDark) {
    mapElement.classList.add('map-tiles-dark');
  } else {
    mapElement.classList.remove('map-tiles-dark');
  }

  // Click handler: places needle pin & updates nearest landmark on bottom
  guessMap.on('click', (e) => {
    if (state.hasGuessed) return;

    Sound.pop();
    const lat = Math.round(e.latlng.lat * 100000) / 100000;
    const lng = Math.round(e.latlng.lng * 100000) / 100000;
    state.currentPin = { lat, lng };

    // Place or move needle pin
    if (!guessMarker) {
      guessMarker = L.marker([lat, lng], { icon: createTacticalPinIcon() }).addTo(guessMap);
    } else {
      guessMarker.setLatLng([lat, lng]);
    }

    // Identify nearest landmark from 400+ world cities
    if (typeof window.findNearestCity === 'function') {
      const nearest = window.findNearestCity(lat, lng);
      if (nearest) {
        const panel = document.getElementById('closest-landmark-panel');
        const nameEl = document.getElementById('closest-landmark-name');
        const distEl = document.getElementById('closest-landmark-dist');

        if (panel) panel.classList.add('active');
        if (nameEl) nameEl.textContent = `${nearest.city}, ${nearest.country}`;
        if (distEl) {
          distEl.textContent = `${nearest.distanceKm.toLocaleString()} km`;
          distEl.classList.remove('hidden');
        }
      }
    }

    // Enable lock guess button
    const btnLock = document.getElementById('btn-lock-guess');
    btnLock.disabled = false;
    btnLock.className = 'w-full py-3 px-4 rounded-xl font-black text-sm tracking-wider text-white btn-lock-tactical cursor-pointer flex items-center justify-center gap-2 uppercase shadow-xl';

    document.getElementById('pin-coords-text').textContent = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;

    socket.emit('update_pin', { lat, lng });
  });
}

function initResultsMap() {
  const mapElement = document.getElementById('results-map');
  if (!mapElement || resultsMap) return;

  resultsMap = L.map('results-map', {
    center: [20, 0],
    zoom: 2,
    minZoom: 1,
    maxZoom: 18,
    attributionControl: false,
  });

  // 100% Free ESRI World Street Map in English for results map (Zero API Key!)
  L.tileLayer(MAP_TILES.street.url, {
    maxZoom: MAP_TILES.street.maxZoom,
  }).addTo(resultsMap);

  resultsLayerGroup = L.layerGroup().addTo(resultsMap);
}

// Update 10-dot progress indicator in HUD
function updateRoundDots(currentRound, totalRounds = 10) {
  const container = document.getElementById('hud-round-dots');
  if (!container) return;

  let dotsHtml = '';
  for (let r = 1; r <= totalRounds; r++) {
    if (r < currentRound) {
      dotsHtml += '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>';
    } else if (r === currentRound) {
      dotsHtml += '<span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>';
    } else {
      dotsHtml += '<span class="w-1.5 h-1.5 rounded-full bg-slate-700"></span>';
    }
  }
  container.innerHTML = dotsHtml;
}

// Fetch Host & LAN Info
async function fetchLanInfo() {
  try {
    const res = await fetch('/api/info');
    const data = await res.json();
    state.serverJoinUrl = data.joinUrl;
    const joinUrlEl = document.getElementById('lan-join-url');
    if (joinUrlEl) joinUrlEl.textContent = data.joinUrl;

    const qrImg = document.getElementById('qr-code-img');
    const qrModalUrl = document.getElementById('qr-modal-url');
    if (qrImg && data.joinUrl) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.joinUrl)}`;
    }
    if (qrModalUrl) qrModalUrl.textContent = data.joinUrl;
  } catch (err) {
    console.error('Failed to fetch LAN info:', err);
  }
}

// ============================================================
// 6. UI EVENT LISTENERS & KEYBOARD SHORTCUTS
// ============================================================

// Toggle Sound
document.getElementById('btn-toggle-sound')?.addEventListener('click', () => Sound.toggleMute());
document.getElementById('hud-btn-sound')?.addEventListener('click', () => Sound.toggleMute());

function applyMapTheme(themeName) {
  state.mapTheme = themeName;
  const cfg = MAP_TILES[state.mapTheme] || MAP_TILES.street;

  const guessMapEl = document.getElementById('guess-map');
  if (guessMapEl) {
    if (cfg.isDark) {
      guessMapEl.classList.add('map-tiles-dark');
    } else {
      guessMapEl.classList.remove('map-tiles-dark');
    }
  }

  if (guessMap && guessTileLayer && guessTileLayer._url !== cfg.url) {
    guessMap.removeLayer(guessTileLayer);
    guessTileLayer = L.tileLayer(cfg.url, {
      maxZoom: cfg.maxZoom,
    }).addTo(guessMap);
  }

  const btn = document.getElementById('btn-toggle-map-theme');
  if (btn) btn.textContent = cfg.label;
}

// Switch English Map Style (Light Street vs Dark Tactical)
document.getElementById('btn-toggle-map-theme')?.addEventListener('click', () => {
  Sound.click();
  const nextTheme = state.mapTheme === 'dark' ? 'street' : 'dark';
  applyMapTheme(nextTheme);
});

// QR Modal Controls
document.getElementById('btn-show-qr')?.addEventListener('click', () => {
  Sound.click();
  document.getElementById('modal-qr')?.classList.remove('hidden');
});
document.getElementById('btn-close-qr')?.addEventListener('click', () => {
  document.getElementById('modal-qr')?.classList.add('hidden');
});

// Copy Join URL
document.getElementById('btn-copy-link')?.addEventListener('click', async () => {
  if (!state.serverJoinUrl) return;
  try {
    await navigator.clipboard.writeText(state.serverJoinUrl);
    const copyText = document.getElementById('btn-copy-text');
    if (copyText) {
      copyText.textContent = 'Copied!';
      setTimeout(() => (copyText.textContent = 'Copy Link'), 2000);
    }
    showToast('LAN Join Link Copied to Clipboard!', 'success');
  } catch (err) {
    window.prompt('Copy Join Link:', state.serverJoinUrl);
  }
});

// Random Nickname Button
document.getElementById('btn-random-name')?.addEventListener('click', () => {
  Sound.click();
  const input = document.getElementById('input-username');
  if (input) input.value = getRandomCallsign();
});

// Username Form Submit
document.getElementById('form-username')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('input-username');
  const name = input.value.trim();
  if (name.length < 2) {
    showToast('Callsign must be at least 2 characters.', 'error');
    return;
  }
  Sound.click();
  socket.emit('set_username', { username: name });
});

// Change Name in Lobby
document.getElementById('btn-change-username')?.addEventListener('click', () => {
  Sound.click();
  const input = document.getElementById('input-username');
  if (input && state.myUsername) input.value = state.myUsername;
  switchView('view-username');
});

// Start Game Button in Lobby
document.getElementById('btn-start-game')?.addEventListener('click', () => {
  Sound.fanfare();
  socket.emit('start_game');
});

// Toggle Map Size
function toggleMapSize() {
  const container = document.getElementById('guess-map-container');
  const btn = document.getElementById('btn-toggle-map-size');
  state.isMapExpanded = !state.isMapExpanded;

  if (state.isMapExpanded) {
    container.classList.add('expanded');
    btn.textContent = 'Shrink';
  } else {
    container.classList.remove('expanded');
    btn.textContent = 'Expand';
  }

  setTimeout(() => {
    if (guessMap) guessMap.invalidateSize();
  }, 360);
}

document.getElementById('btn-toggle-map-size')?.addEventListener('click', () => {
  Sound.click();
  toggleMapSize();
});

// Center Map Button
document.getElementById('btn-center-map')?.addEventListener('click', () => {
  Sound.click();
  if (guessMap) {
    guessMap.setView([20, 0], 2);
  }
});

// Lock In Guess Function
function lockCurrentGuess() {
  if (!state.currentPin || state.hasGuessed) return;

  state.hasGuessed = true;
  Sound.lock();

  const btn = document.getElementById('btn-lock-guess');
  btn.disabled = true;
  btn.className = 'w-full py-3 px-4 rounded-xl font-black text-sm tracking-wider text-slate-300 bg-slate-800 cursor-not-allowed flex items-center justify-center gap-2 uppercase shadow-inner border border-slate-700/50';
  btn.innerHTML = `
    <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping mr-1"></span>
    <span>Guess Locked — Waiting for others...</span>
  `;

  socket.emit('lock_guess', {
    lat: state.currentPin.lat,
    lng: state.currentPin.lng,
  });
}

document.getElementById('btn-lock-guess')?.addEventListener('click', lockCurrentGuess);

// Keyboard Shortcuts: Space to Lock, M to Toggle Map, Escape to Close Modals
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;

  if (e.code === 'Space' || e.code === 'Enter') {
    if (!state.hasGuessed && state.currentPin) {
      e.preventDefault();
      lockCurrentGuess();
    }
  } else if (e.code === 'KeyM') {
    e.preventDefault();
    toggleMapSize();
  } else if (e.code === 'Escape') {
    document.getElementById('modal-qr')?.classList.add('hidden');
  }
});

// Next Round Button in Results
document.getElementById('btn-next-round')?.addEventListener('click', () => {
  Sound.click();
  if (state.autoAdvanceInterval) {
    clearInterval(state.autoAdvanceInterval);
    state.autoAdvanceInterval = null;
  }
  socket.emit('next_round');
});

// Play Again Button in Game Over
document.getElementById('btn-reset-lobby')?.addEventListener('click', () => {
  Sound.click();
  socket.emit('reset_to_lobby');
});

// ============================================================
// 7. RENDERING FUNCTIONS FOR ROUND RESULTS & GAME OVER
// ============================================================

function renderRoundResults(data) {
  if (!data) return;
  Sound.fanfare();
  state.currentRound = data.round;
  state.totalRounds = data.totalRounds;

  // Find my updated score
  const myResult = (data.results || []).find((r) => r.username === state.myUsername || r.ip === state.myIp);
  if (myResult) {
    state.totalScore = myResult.totalScore;
  }

  switchView('view-results');
  initResultsMap();

  // Populate Header
  document.getElementById('results-round-num').textContent = data.round;
  document.getElementById('results-target-title').textContent = data.target?.label || 'Target Location';

  // Next round button label
  const btnNext = document.getElementById('btn-next-round-text');
  if (data.round >= data.totalRounds) {
    btnNext.textContent = 'View Final Standings';
  } else {
    btnNext.textContent = `Next Round (Round ${data.round + 1} / ${data.totalRounds})`;
  }

  // 15-Second Auto-Advance Countdown
  if (state.autoAdvanceInterval) clearInterval(state.autoAdvanceInterval);
  state.autoAdvanceSeconds = 15;
  const autoAdvanceEl = document.getElementById('auto-advance-timer');
  if (autoAdvanceEl) autoAdvanceEl.textContent = '15s';

  state.autoAdvanceInterval = setInterval(() => {
    state.autoAdvanceSeconds--;
    if (autoAdvanceEl) autoAdvanceEl.textContent = `${state.autoAdvanceSeconds}s`;
    if (state.autoAdvanceSeconds <= 0) {
      clearInterval(state.autoAdvanceInterval);
      state.autoAdvanceInterval = null;
      socket.emit('next_round');
    }
  }, 1000);

  // Render Leaderboard Table
  const tableBody = document.getElementById('results-table-body');
  if (tableBody) {
    const maxRoundScore = Math.max(...(data.results || []).map((r) => r.roundScore || 0));

    tableBody.innerHTML = (data.results || [])
      .map((r, idx) => {
        const isMe = r.username === state.myUsername || r.ip === state.myIp;
        const isWinner = r.roundScore > 0 && r.roundScore === maxRoundScore;

        let ratingBadge = '';
        if (r.distanceKm !== null) {
          if (r.distanceKm < 50) ratingBadge = '<span class="text-emerald-400 font-bold">🎯 Spot On!</span>';
          else if (r.distanceKm < 350) ratingBadge = '<span class="text-cyan-400 font-bold">🔥 Close!</span>';
          else if (r.distanceKm < 1500) ratingBadge = '<span class="text-amber-400">🗺️ Decent</span>';
          else ratingBadge = '<span class="text-slate-500">🛰️ Far</span>';
        }

        return `
          <tr class="cursor-pointer transition-all hover:bg-slate-800/60 ${isMe ? 'bg-cyan-950/30 font-semibold' : ''} ${isWinner ? 'bg-amber-950/20' : ''}" data-player-ip="${r.ip}">
            <td class="py-3 px-1">
              <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                idx === 0 ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'text-slate-400'
              }">
                ${idx + 1}
              </span>
            </td>
            <td class="py-3 px-2">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-slate-100">${r.username}</span>
                ${isMe ? '<span class="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono border border-cyan-500/30">YOU</span>' : ''}
                ${isWinner ? '<span class="text-[10px] text-amber-400 font-bold" title="Round Winner">👑</span>' : ''}
              </div>
              <div class="text-[10px] text-slate-400 font-mono">${r.ip}</div>
            </td>
            <td class="py-3 px-2 text-right font-mono text-xs text-slate-300">
              ${r.distanceKm !== null ? `${r.distanceKm.toLocaleString()} km` : '<span class="text-red-400 font-bold">No Guess</span>'}
              <div class="text-[10px]">${ratingBadge}</div>
            </td>
            <td class="py-3 px-2 text-right font-mono text-xs font-bold text-amber-400">
              +${r.roundScore.toLocaleString()}
            </td>
            <td class="py-3 px-2 text-right font-mono text-xs font-black text-emerald-400">
              ${r.totalScore.toLocaleString()}
            </td>
          </tr>
        `;
      })
      .join('');

    // Click on row to fly map directly to player's guess
    tableBody.querySelectorAll('tr').forEach((row) => {
      row.addEventListener('click', () => {
        const ip = row.getAttribute('data-player-ip');
        const pResult = (data.results || []).find((r) => r.ip === ip);
        if (pResult && pResult.guessCoords && resultsMap) {
          Sound.click();
          resultsMap.flyTo([pResult.guessCoords.lat, pResult.guessCoords.lng], 5, { duration: 1 });
        }
      });
    });
  }

  // Render Leaflet Results Map (in English)
  if (resultsMap && resultsLayerGroup) {
    resultsLayerGroup.clearLayers();

    const targetCoords = [data.target.lat, data.target.lng];
    const bounds = L.latLngBounds([targetCoords]);

    // 1. Add Target Pin
    const targetIcon = L.divIcon({
      className: 'marker-target',
      html: `
        <div class="marker-target-inner">
          <span>★</span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    const targetMarker = L.marker(targetCoords, { icon: targetIcon }).addTo(resultsLayerGroup);
    targetMarker.bindPopup(`
      <div class="p-1.5 text-center font-sans">
        <div class="text-xs uppercase tracking-wider text-emerald-400 font-black">Actual Location</div>
        <div class="text-sm font-black text-white mt-1">${data.target.label}</div>
      </div>
    `);

    // 2. Add Player Pins & Connecting Dashed Polylines
    (data.results || []).forEach((player) => {
      if (!player.guessCoords) return;

      const guessLatLng = [player.guessCoords.lat, player.guessCoords.lng];
      bounds.extend(guessLatLng);

      const isMe = player.username === state.myUsername || player.ip === state.myIp;

      const guessIcon = L.divIcon({
        className: 'marker-guess',
        html: `
          <div class="marker-guess-pin" style="${isMe ? 'background: #06b6d4; transform: scale(1.15); box-shadow: 0 0 15px rgba(6,182,212,0.8);' : 'background: #64748b;'}">
            📍
          </div>
          <div class="marker-guess-label" style="${isMe ? 'border-color: #06b6d4; color: #67e8f9; background: #090d16;' : ''}">
            ${player.username}
          </div>
        `,
        iconSize: [60, 40],
        iconAnchor: [30, 16],
      });

      const pMarker = L.marker(guessLatLng, { icon: guessIcon }).addTo(resultsLayerGroup);
      pMarker.bindPopup(`
        <div class="p-1.5 font-sans">
          <div class="text-sm font-black text-white">${player.username}</div>
          <div class="text-xs text-slate-300 mt-1">Distance: <b class="text-amber-400 font-mono">${player.distanceKm} km</b></div>
          <div class="text-xs text-slate-300">Round Score: <b class="text-emerald-400 font-mono">+${player.roundScore} pts</b></div>
        </div>
      `);

      L.polyline([guessLatLng, targetCoords], {
        color: isMe ? '#06b6d4' : '#cbd5e1',
        weight: isMe ? 3 : 2,
        dashArray: '6, 8',
        opacity: isMe ? 0.95 : 0.6,
      }).addTo(resultsLayerGroup);
    });

    setTimeout(() => {
      resultsMap.invalidateSize();
      resultsMap.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 14,
      });
    }, 200);
  }
}

function renderGameOver(data) {
  if (!data) return;
  Sound.fanfare();
  Confetti.launch(130);

  switchView('view-gameover');

  const leaderboard = data.leaderboard || [];
  const podiumContainer = document.getElementById('podium-container');
  const tableBody = document.getElementById('gameover-table-body');

  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

  if (podiumContainer) {
    podiumContainer.innerHTML = `
      <!-- 2nd Place (Silver) -->
      <div class="order-2 sm:order-1 tech-panel rounded-3xl p-5 flex flex-col items-center shadow-xl ${
        !top2 ? 'opacity-30' : ''
      }">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-300 to-slate-500 text-black flex items-center justify-center font-black text-xl mb-2 shadow-lg shadow-slate-400/20">
          🥈 2
        </div>
        <div class="font-bold text-white text-base">${top2 ? top2.username : '---'}</div>
        <div class="text-xs text-slate-400 font-mono mb-2">${top2 ? top2.ip : ''}</div>
        <div class="font-black text-emerald-400 text-lg font-mono">
          ${top2 ? `${top2.totalScore.toLocaleString()} pts` : ''}
        </div>
      </div>

      <!-- 1st Place (Gold Champion) -->
      <div class="order-1 sm:order-2 tech-panel border-amber-500 rounded-3xl p-6 sm:p-8 flex flex-col items-center shadow-2xl shadow-amber-500/25 transform sm:-translate-y-4 relative">
        <div class="text-4xl mb-1 animate-bounce">👑</div>
        <div class="w-18 h-18 p-3 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-black flex items-center justify-center font-black text-2xl mb-2 shadow-xl shadow-amber-500/50">
          🥇 1
        </div>
        <div class="font-black text-amber-300 text-xl sm:text-2xl">${top1 ? top1.username : '---'}</div>
        <div class="text-xs text-slate-400 font-mono mb-2">${top1 ? top1.ip : ''}</div>
        <div class="font-black text-amber-400 text-2xl sm:text-3xl font-mono">
          ${top1 ? `${top1.totalScore.toLocaleString()} pts` : ''}
        </div>
      </div>

      <!-- 3rd Place (Bronze) -->
      <div class="order-3 tech-panel rounded-3xl p-5 flex flex-col items-center shadow-xl ${
        !top3 ? 'opacity-30' : ''
      }">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-700 to-amber-900 text-amber-200 flex items-center justify-center font-black text-xl mb-2 shadow-lg shadow-amber-800/20">
          🥉 3
        </div>
        <div class="font-bold text-white text-base">${top3 ? top3.username : '---'}</div>
        <div class="text-xs text-slate-400 font-mono mb-2">${top3 ? top3.ip : ''}</div>
        <div class="font-black text-emerald-400 text-lg font-mono">
          ${top3 ? `${top3.totalScore.toLocaleString()} pts` : ''}
        </div>
      </div>
    `;
  }

  // Full table
  if (tableBody) {
    tableBody.innerHTML = leaderboard
      .map((p, idx) => {
        const isMe = p.username === state.myUsername || p.ip === state.myIp;
        return `
          <tr class="${isMe ? 'bg-cyan-950/30 font-semibold' : ''}">
            <td class="py-3 px-3 font-bold text-slate-300">#${idx + 1}</td>
            <td class="py-3 px-3">
              <span class="font-bold text-white">${p.username}</span>
              ${isMe ? '<span class="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono border border-cyan-500/30 ml-1.5">YOU</span>' : ''}
            </td>
            <td class="py-3 px-3 font-mono text-xs text-slate-400">${p.ip}</td>
            <td class="py-3 px-3 text-right font-mono font-black text-emerald-400">${p.totalScore.toLocaleString()} pts</td>
          </tr>
        `;
      })
      .join('');
  }
}

// ============================================================
// 8. SOCKET.IO EVENT CONTRACT
// ============================================================

// Prompt Username on connect during LOBBY
socket.on('prompt_username', (data) => {
  state.myIp = data.ip;
  const badge = document.getElementById('detected-ip-badge');
  if (badge) {
    badge.textContent = mockIp ? `${data.ip} (Mocked)` : data.ip;
  }
  const input = document.getElementById('input-username');
  if (input && !input.value) {
    input.value = getRandomCallsign();
  }
  switchView('view-username');
});

// Returning player during LOBBY
socket.on('session_restored', (data) => {
  state.myIp = data.ip;
  state.myUsername = data.username;
  state.totalScore = data.totalScore || 0;

  const nameEl = document.getElementById('lobby-my-name');
  if (nameEl) nameEl.textContent = state.myUsername;

  const badge = document.getElementById('detected-ip-badge');
  if (badge) badge.textContent = mockIp ? `${data.ip} (Mocked)` : data.ip;

  switchView('view-lobby');
  fetchLanInfo();
});

// Confirmation username set
socket.on('username_set', (data) => {
  state.myIp = data.ip;
  state.myUsername = data.username;

  const nameEl = document.getElementById('lobby-my-name');
  if (nameEl) nameEl.textContent = state.myUsername;

  showToast(`Callsign Confirmed: ${data.username}`, 'success');
  switchView('view-lobby');
  fetchLanInfo();
});

// Match Locked for unrecognized IPs
socket.on('match_locked', (data) => {
  const reasonEl = document.getElementById('locked-reason-text');
  if (reasonEl && data.reason) reasonEl.textContent = data.reason;

  const ipEl = document.getElementById('locked-user-ip');
  if (ipEl) ipEl.textContent = mockIp ? `${mockIp} (Dev Mock)` : (state.myIp || 'Local LAN Device');

  switchView('view-locked');
});

// Lobby Player List Broadcast
socket.on('lobby_update', (data) => {
  const grid = document.getElementById('lobby-players-grid');
  const countBadge = document.getElementById('player-count-badge');
  if (!grid) return;

  const players = data.players || [];
  if (countBadge) {
    countBadge.textContent = `${players.length} ${players.length === 1 ? 'Operative' : 'Operatives'} Ready`;
  }

  if (players.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-500 text-sm">
        Waiting for operatives to connect...
      </div>
    `;
    return;
  }

  grid.innerHTML = players
    .map((p) => {
      const isMe = p.username === state.myUsername || p.ip === state.myIp;
      return `
        <div class="flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
          isMe
            ? 'bg-cyan-950/40 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
            : 'bg-slate-950/80 border-slate-800'
        }">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
              p.connected ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-slate-800 text-slate-500'
            }">
              ${p.username ? p.username.substring(0, 2).toUpperCase() : '??'}
            </div>
            <div>
              <div class="font-bold text-sm text-white flex items-center gap-1.5">
                <span>${p.username || 'Anonymous'}</span>
                ${isMe ? '<span class="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono border border-cyan-500/30">YOU</span>' : ''}
              </div>
              <div class="font-mono text-[11px] text-slate-400">${p.ip}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${p.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}"></span>
            <span class="tech-badge text-[11px] ${p.connected ? 'text-emerald-400' : 'text-slate-500'}">
              ${p.connected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      `;
    })
    .join('');
});

// Round Started
socket.on('round_started', (data) => {
  Sound.fanfare();
  state.currentRound = data.round;
  state.totalRounds = data.totalRounds || 10;
  state.currentPin = null;
  state.hasGuessed = false;

  // Update HUD
  document.getElementById('hud-round-current').textContent = data.round;
  document.getElementById('hud-round-total').textContent = state.totalRounds;
  document.getElementById('hud-guessed-status').textContent = `0 / ${data.totalPlayers || 1}`;
  document.getElementById('hud-my-score').textContent = state.totalScore;
  updateRoundDots(data.round, state.totalRounds);

  // Reset Closest Landmark Panel
  const panel = document.getElementById('closest-landmark-panel');
  const nameEl = document.getElementById('closest-landmark-name');
  const distEl = document.getElementById('closest-landmark-dist');
  if (panel) panel.classList.remove('active');
  if (nameEl) nameEl.textContent = 'Click map to pinpoint location';
  if (distEl) distEl.classList.add('hidden');

  // Reset Timer Banner
  const timerBanner = document.getElementById('timer-banner');
  const timerIcon = document.getElementById('timer-icon');
  const timerText = document.getElementById('timer-text');
  timerBanner.classList.remove('timer-countdown-active');
  timerBanner.className = 'py-2.5 px-6 rounded-full font-bold text-sm tracking-wide shadow-2xl backdrop-blur-md border border-slate-700 bg-slate-900/95 text-slate-200 flex items-center gap-3 transition-all';
  timerIcon.textContent = '⏳';
  timerText.textContent = 'No Time Limit — Waiting for first guess...';
  document.body.classList.remove('urgent-vignette');

  // Reset lock guess button
  const btnLock = document.getElementById('btn-lock-guess');
  btnLock.disabled = true;
  btnLock.className = 'w-full py-3 px-4 rounded-xl font-black text-sm tracking-wider text-white bg-slate-800 cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 uppercase shadow-lg border border-slate-700/60';
  btnLock.innerHTML = '<span>Lock in Guess</span><span class="kbd-badge ml-1 hidden sm:inline">SPACE</span>';

  document.getElementById('pin-coords-text').textContent = 'No pin placed';

  // Load Street View
  const iframe = document.getElementById('streetview-frame');
  const { lat, lng } = data.panoramaCoords;
  iframe.src = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=svembed`;

  switchView('view-game');
  initGuessMap();

  if (guessMarker && guessMap) {
    guessMap.removeLayer(guessMarker);
    guessMarker = null;
  }
  if (guessMap) {
    guessMap.setView([20, 0], 2);
    setTimeout(() => guessMap.invalidateSize(), 200);
  }
});

// Countdown Started
socket.on('countdown_started', (data) => {
  Sound.urgentTick(data.seconds);
  const timerBanner = document.getElementById('timer-banner');
  const timerIcon = document.getElementById('timer-icon');
  const timerText = document.getElementById('timer-text');

  timerBanner.classList.add('timer-countdown-active');
  timerIcon.textContent = '⚡';
  timerText.textContent = `${data.triggeredBy} locked guess! ${data.seconds}s remaining`;

  showToast(`⚡ ${data.triggeredBy} locked guess! 20-second countdown started!`, 'warning');
});

// Timer Tick
socket.on('timer_tick', (data) => {
  if (data.seconds <= 5) {
    Sound.urgentTick(data.seconds);
    document.body.classList.add('urgent-vignette');
  } else {
    Sound.tick();
  }

  const timerText = document.getElementById('timer-text');
  if (timerText) {
    timerText.textContent = `⚡ Hurry! ${data.seconds}s remaining`;
  }
});

// Player Guessed
socket.on('player_guessed', (data) => {
  const statusEl = document.getElementById('hud-guessed-status');
  if (statusEl) {
    statusEl.textContent = `${data.guessedCount} / ${data.totalPlayers}`;
  }
  if (data.username !== state.myUsername) {
    showToast(`${data.username} locked in their guess (${data.guessedCount}/${data.totalPlayers})`, 'info');
  }
});

// Round Results
socket.on('round_results', (data) => {
  renderRoundResults(data);
});

// Rejoin Match (mid-game reconnection)
socket.on('rejoin_match', (data) => {
  state.myIp = data.ip;
  state.myUsername = data.username;
  state.totalScore = data.totalScore || 0;
  state.currentRound = data.round;
  state.totalRounds = data.totalRounds;
  state.hasGuessed = data.hasGuessed;

  showToast(`Reconnected to Round ${data.round}!`, 'success');

  if (data.status === 'ROUND_ACTIVE' || data.status === 'ROUND_COUNTDOWN') {
    switchView('view-game');
    initGuessMap();

    if (data.panoramaCoords) {
      const iframe = document.getElementById('streetview-frame');
      iframe.src = `https://maps.google.com/maps?q=&layer=c&cbll=${data.panoramaCoords.lat},${data.panoramaCoords.lng}&cbp=11,0,0,0,0&output=svembed`;
    }

    document.getElementById('hud-round-current').textContent = data.round;
    document.getElementById('hud-round-total').textContent = data.totalRounds;
    document.getElementById('hud-guessed-status').textContent = `${data.guessedCount || 0} / ${data.totalPlayers || 1}`;
    document.getElementById('hud-my-score').textContent = data.totalScore;
    updateRoundDots(data.round, data.totalRounds);

    const timerBanner = document.getElementById('timer-banner');
    const timerIcon = document.getElementById('timer-icon');
    const timerText = document.getElementById('timer-text');
    if (data.status === 'ROUND_COUNTDOWN' && data.countdownSeconds !== null) {
      timerBanner.classList.add('timer-countdown-active');
      timerIcon.textContent = '⚡';
      timerText.textContent = `${data.firstGuesserName} locked guess! ${data.countdownSeconds}s remaining`;
      if (data.countdownSeconds <= 5) document.body.classList.add('urgent-vignette');
    } else {
      timerBanner.classList.remove('timer-countdown-active');
      timerIcon.textContent = '⏳';
      timerText.textContent = 'No Time Limit — Waiting for first guess...';
    }

    const btnLock = document.getElementById('btn-lock-guess');
    if (data.hasGuessed && data.lockedGuess) {
      state.currentPin = data.lockedGuess;
      btnLock.disabled = true;
      btnLock.className = 'w-full py-3 px-4 rounded-xl font-black text-sm tracking-wider text-slate-300 bg-slate-800 cursor-not-allowed flex items-center justify-center gap-2 uppercase shadow-inner border border-slate-700/50';
      btnLock.innerHTML = '<span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping mr-1"></span><span>Guess Locked — Waiting for others...</span>';
    } else if (data.currentPin) {
      state.currentPin = data.currentPin;
      btnLock.disabled = false;
      btnLock.className = 'w-full py-3 px-4 rounded-xl font-black text-sm tracking-wider text-white btn-lock-tactical cursor-pointer flex items-center justify-center gap-2 uppercase shadow-xl';
    }

    if (state.currentPin && guessMap) {
      guessMarker = L.marker([state.currentPin.lat, state.currentPin.lng], { icon: createTacticalPinIcon() }).addTo(guessMap);
      guessMap.setView([state.currentPin.lat, state.currentPin.lng], 3);

      if (typeof window.findNearestCity === 'function') {
        const nearest = window.findNearestCity(state.currentPin.lat, state.currentPin.lng);
        if (nearest) {
          const panel = document.getElementById('closest-landmark-panel');
          const nameEl = document.getElementById('closest-landmark-name');
          const distEl = document.getElementById('closest-landmark-dist');
          if (panel) panel.classList.add('active');
          if (nameEl) nameEl.textContent = `${nearest.city}, ${nearest.country}`;
          if (distEl) {
            distEl.textContent = `${nearest.distanceKm.toLocaleString()} km`;
            distEl.classList.remove('hidden');
          }
        }
      }
    }
  } else if (data.status === 'ROUND_RESULTS' && data.lastRoundResults) {
    renderRoundResults(data.lastRoundResults);
  } else if (data.status === 'GAME_OVER' && data.gameOverResults) {
    renderGameOver(data.gameOverResults);
  }
});

// Game Over
socket.on('game_over', (data) => {
  renderGameOver(data);
});

// Return to Lobby
socket.on('return_to_lobby', (data) => {
  state.currentRound = 0;
  state.totalScore = 0;
  state.currentPin = null;
  state.hasGuessed = false;

  const myPlayer = (data.players || []).find((p) => p.ip === state.myIp || p.username === state.myUsername);
  if (myPlayer) {
    state.myUsername = myPlayer.username;
    const nameEl = document.getElementById('lobby-my-name');
    if (nameEl) nameEl.textContent = state.myUsername;
  }

  switchView('view-lobby');
  fetchLanInfo();
  showToast('Match concluded. Lobby reopened for new players!', 'info');
});

// Error Message
socket.on('error_message', (data) => {
  showToast(data.message || 'An error occurred', 'error');
});

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  Sound.updateMuteButtons();
  Confetti.init();
});
