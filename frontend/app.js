/**
 * LAN-Guessr: Real-Time LAN Multiplayer Geography Guessing Game
 * Cyber-Tactical Engine: Zero-Key English ESRI World Street Map, Nearest Landmark Telemetry,
 * Custom Needle-Tip Pin Cursor, Canvas Confetti & Sound Effects
 */

// ============================================================
// 1. SOUND & AUDIO SYNTHESIS CONTROLLER (WEB AUDIO API)
// ============================================================
(() => {
  'use strict';

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
    const soundOnSvg = `
      <svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      </svg>
    `;
    const soundMutedSvg = `
      <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <line x1="23" y1="9" x2="17" y2="15"/>
        <line x1="17" y1="9" x2="23" y2="15"/>
      </svg>
    `;
    const svg = this.muted ? soundMutedSvg : soundOnSvg;
    const b1 = document.getElementById('btn-toggle-sound');
    const b2 = document.getElementById('hud-btn-sound');
    if (b1) b1.innerHTML = svg;
    if (b2) b2.innerHTML = svg;
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
// 2. SECURITY & UTILITY HELPERS
// ============================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  toast.appendChild(textSpan);
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
    label: 'Dark Mode',
    isDark: false,
    icon: `<svg class="w-3 h-3 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  },
  // Tactical Dark Mode with zero API key
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    label: 'Light Mode',
    isDark: true,
    icon: `<svg class="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
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
  countdownDuration: 20,
  pendingAdmissionQueue: [],
  currentAdmissionApplicant: null,
  currentPin: null,      // { lat, lng } draft pin
  hasGuessed: false,
  isMapExpanded: false,
  mapTheme: 'street',    // 'street' | 'dark' | 'satellite'
  totalScore: 0,
  serverJoinUrl: '',
  autoAdvanceInterval: null,
  autoAdvanceSeconds: 15,
  isHost: false,
  hostIp: null,
  selectedRegion: 'all',
  difficulty: 'all',     // 'all' | 'easy' | 'medium' | 'hard'
  uplinkToken: null,
  gameStatus: null,
};

// Determine NestJS Backend URL (default: port 5000 on current host)
const BACKEND_URL = window.BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

// Check for mockIp query param for multi-tab testing on 1 PC
const urlParams = new URLSearchParams(window.location.search);
const mockIp = urlParams.get('mockIp');
const socket = io(BACKEND_URL, {
  query: mockIp ? { mockIp } : {},
});

// View Switcher
function switchView(targetViewId) {
  const views = [
    'view-username',
    'view-admission-pending',
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

// Host & Match Management UI Helpers
function evaluateIsHost(data) {
  if (data && typeof data.isHost === 'boolean') {
    return data.isHost;
  }
  if (data?.hostIp && state.myIp) {
    return state.myIp === data.hostIp;
  }
  if (data && data.players && Array.isArray(data.players) && state.myIp) {
    const myPlayer = data.players.find((p) => p.ip === state.myIp);
    if (myPlayer && typeof myPlayer.isHost === 'boolean') return myPlayer.isHost;
    if (data.players.length === 1 && myPlayer) return true;
  }
  return state.isHost;
}

function updateHostUI() {
  const hostBadge = document.getElementById('hud-host-badge');
  if (hostBadge) {
    if (state.isHost) hostBadge.classList.remove('hidden');
    else hostBadge.classList.add('hidden');
  }

  const stopBtnHud = document.getElementById('hud-btn-stop-game');
  if (stopBtnHud) {
    if (state.isHost) stopBtnHud.classList.remove('hidden');
    else stopBtnHud.classList.add('hidden');
  }

  const stopBtnResults = document.getElementById('results-btn-stop-game');
  if (stopBtnResults) {
    if (state.isHost) stopBtnResults.classList.remove('hidden');
    else stopBtnResults.classList.add('hidden');
  }

  const regionSelect = document.getElementById('lobby-region-select');
  if (regionSelect) {
    regionSelect.disabled = !state.isHost;
    if (state.selectedRegion) regionSelect.value = state.selectedRegion;
  }

  const regionDisplay = document.getElementById('lobby-region-display');
  if (regionDisplay && state.selectedRegion) {
    const regionNames = {
      all: 'Worldwide (10,050 Verified Road Corridors & 86 Countries)',
      asia: 'Asia Map (2,052 Road Corridors)',
      africa: 'Africa Map (1,041 Road Corridors)',
      europe: 'Europe Map (2,934 Road Corridors)',
      americas: 'Americas Map (3,655 Road Corridors)',
    };
    regionDisplay.textContent = regionNames[state.selectedRegion] || state.selectedRegion.toUpperCase();
  }

  // Synchronize visual region selector tiles
  const regionTiles = document.querySelectorAll('.region-tile');
  regionTiles.forEach((tile) => {
    const r = tile.getAttribute('data-region');
    if (r === state.selectedRegion) {
      tile.classList.add('active');
    } else {
      tile.classList.remove('active');
    }
    if (state.isHost) {
      tile.removeAttribute('disabled');
      tile.classList.remove('opacity-60', 'cursor-not-allowed');
    } else {
      tile.setAttribute('disabled', 'true');
      tile.classList.add('opacity-60', 'cursor-not-allowed');
    }
  });

  // Match Parameters steppers & presets (Host-only configuration)
  const paramRoundsDec = document.getElementById('btn-param-rounds-dec');
  const paramRoundsInc = document.getElementById('btn-param-rounds-inc');
  const paramTimerDec = document.getElementById('btn-param-timer-dec');
  const paramTimerInc = document.getElementById('btn-param-timer-inc');
  const presetRounds = document.querySelectorAll('.btn-preset-rounds');
  const presetTimers = document.querySelectorAll('.btn-preset-timer');

  [paramRoundsDec, paramRoundsInc, paramTimerDec, paramTimerInc].forEach((btn) => {
    if (btn) {
      if (state.isHost) {
        btn.removeAttribute('disabled');
        btn.classList.remove('opacity-40', 'cursor-not-allowed');
      } else {
        btn.setAttribute('disabled', 'true');
        btn.classList.add('opacity-40', 'cursor-not-allowed');
      }
    }
  });

  presetRounds.forEach((btn) => {
    if (state.isHost) {
      btn.removeAttribute('disabled');
      btn.classList.remove('opacity-40', 'cursor-not-allowed');
    } else {
      btn.setAttribute('disabled', 'true');
      btn.classList.add('opacity-40', 'cursor-not-allowed');
    }
  });

  presetTimers.forEach((btn) => {
    if (state.isHost) {
      btn.removeAttribute('disabled');
      btn.classList.remove('opacity-40', 'cursor-not-allowed');
    } else {
      btn.setAttribute('disabled', 'true');
      btn.classList.add('opacity-40', 'cursor-not-allowed');
    }
  });

  updateParamsUI();
  updateDifficultyUI();

  const btnStart = document.getElementById('btn-start-game');
  if (btnStart) {
    const spanText = btnStart.querySelector('span');
    if (state.isHost) {
      btnStart.disabled = false;
      btnStart.classList.remove('opacity-50', 'cursor-not-allowed');
      if (spanText) spanText.textContent = `Commence ${state.totalRounds || 10}-Round Match`;
    } else {
      btnStart.disabled = true;
      btnStart.classList.add('opacity-50', 'cursor-not-allowed');
      if (spanText) spanText.textContent = 'Waiting for Host to Start...';
    }
  }
}

function updateParamsUI() {
  const roundsVal = document.getElementById('param-rounds-value');
  if (roundsVal) roundsVal.textContent = state.totalRounds || 10;

  const timerVal = document.getElementById('param-timer-value');
  if (timerVal) timerVal.textContent = state.countdownDuration || 20;

  const presetRounds = document.querySelectorAll('.btn-preset-rounds');
  presetRounds.forEach((btn) => {
    const r = parseInt(btn.getAttribute('data-rounds'), 10);
    if (r === (state.totalRounds || 10)) {
      btn.classList.add('bg-cyan-500/20', 'border-cyan-400', 'text-cyan-300', 'font-black');
      btn.classList.remove('bg-slate-900', 'border-slate-700/60', 'text-slate-300');
    } else {
      btn.classList.remove('bg-cyan-500/20', 'border-cyan-400', 'text-cyan-300', 'font-black');
      btn.classList.add('bg-slate-900', 'border-slate-700/60', 'text-slate-300');
    }
  });

  const presetTimers = document.querySelectorAll('.btn-preset-timer');
  presetTimers.forEach((btn) => {
    const t = parseInt(btn.getAttribute('data-timer'), 10);
    if (t === (state.countdownDuration || 20)) {
      btn.classList.add('bg-amber-500/20', 'border-amber-400', 'text-amber-300', 'font-black');
      btn.classList.remove('bg-slate-900', 'border-slate-700/60', 'text-slate-300');
    } else {
      btn.classList.remove('bg-amber-500/20', 'border-amber-400', 'text-amber-300', 'font-black');
      btn.classList.add('bg-slate-900', 'border-slate-700/60', 'text-slate-300');
    }
  });

  const btnStart = document.getElementById('btn-start-game');
  if (btnStart && state.isHost) {
    const spanText = btnStart.querySelector('span');
    if (spanText) spanText.textContent = `Commence ${state.totalRounds || 10}-Round Match`;
  }
}

function updateDifficultyUI() {
  const currentDiff = state.difficulty || 'all';

  // Synchronize difficulty selector tiles
  const diffTiles = document.querySelectorAll('.btn-difficulty-tile');
  diffTiles.forEach((tile) => {
    const d = tile.getAttribute('data-difficulty');
    if (d === currentDiff) {
      tile.classList.add('active');
    } else {
      tile.classList.remove('active');
    }
    if (state.isHost) {
      tile.removeAttribute('disabled');
      tile.classList.remove('opacity-40', 'cursor-not-allowed');
    } else {
      tile.setAttribute('disabled', 'true');
      tile.classList.add('opacity-40', 'cursor-not-allowed');
    }
  });

  // Update status label in Match Parameters card
  const statusEl = document.getElementById('param-difficulty-status');
  if (statusEl) {
    const diffNames = {
      all: 'Balanced All-Terrain (10,050 Roads)',
      easy: 'Cadet / Urban Major (3,578 Roads)',
      medium: 'Explorer / Secondary (3,524 Roads)',
      hard: 'Nomad / Rural Frontier (2,948 Roads)',
    };
    statusEl.textContent = diffNames[currentDiff] || currentDiff.toUpperCase();
  }

  // Update HUD badge
  const hudBadge = document.getElementById('hud-difficulty-badge');
  if (hudBadge) {
    const labels = {
      all: 'ALL',
      easy: 'CADET',
      medium: 'EXPLORER',
      hard: 'NOMAD',
    };
    hudBadge.textContent = labels[currentDiff] || currentDiff.toUpperCase();

    hudBadge.className = 'px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase border ' + (
      currentDiff === 'easy' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
      currentDiff === 'medium' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
      currentDiff === 'hard' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
      'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    );
  }
}

function renderHostAdmissionModal() {
  const modal = document.getElementById('modal-admission');
  if (!modal) return;

  if (!state.isHost || state.pendingAdmissionQueue.length === 0) {
    modal.classList.add('hidden');
    state.currentAdmissionApplicant = null;
    return;
  }

  const applicant = state.pendingAdmissionQueue[0];
  state.currentAdmissionApplicant = applicant;

  const avatar = document.getElementById('admission-popup-avatar');
  const usernameEl = document.getElementById('admission-popup-username');
  const ipEl = document.getElementById('admission-popup-ip');

  if (avatar) avatar.textContent = (applicant.applicantName || '??').substring(0, 2).toUpperCase();
  if (usernameEl) usernameEl.textContent = applicant.applicantName || 'Unknown Operative';
  if (ipEl) ipEl.textContent = applicant.applicantIp || 'LAN IP';

  modal.classList.remove('hidden');
}

function updateLobbyGameStatus(gameStatus) {
  state.gameStatus = gameStatus;
  const card = document.getElementById('lobby-in-progress-card');
  const statusText = document.getElementById('lobby-match-status-text');
  const hostText = document.getElementById('lobby-match-host-text');
  const btnStart = document.getElementById('btn-start-game');

  if (gameStatus && gameStatus.status && gameStatus.status !== 'LOBBY') {
    if (card) card.classList.remove('hidden');
    if (statusText) statusText.textContent = `Round ${gameStatus.currentRound} of ${gameStatus.totalRounds || 10} in Progress`;
    if (hostText) hostText.innerHTML = `<span>Host: ${escapeHtml(gameStatus.hostName || 'Operative')}</span> <svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20v2H2v-2zm1.5-12l4.5 6 4-8 4 8 4.5-6L22 17H2L3.5 7z"/></svg>`;
    if (btnStart) btnStart.classList.add('hidden');
  } else {
    if (card) card.classList.add('hidden');
    if (btnStart) btnStart.classList.remove('hidden');
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

    // Enable lock guess button
    const btnLock = document.getElementById('btn-lock-guess');
    if (btnLock) {
      btnLock.disabled = false;
      btnLock.className = 'btn-3d w-full py-3.5 px-4 font-black text-sm tracking-wider text-white btn-lock-tactical cursor-pointer flex items-center justify-center gap-2 uppercase shadow-xl';
    }

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
    const res = await fetch(`${BACKEND_URL}/api/info`);
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
  if (btn) btn.innerHTML = `${cfg.icon || ''}<span>${cfg.label}</span>`;
}

// Switch English Map Style (Light Street vs Dark Tactical)
document.getElementById('btn-toggle-map-theme')?.addEventListener('click', () => {
  Sound.click();
  const nextTheme = state.mapTheme === 'dark' ? 'street' : 'dark';
  applyMapTheme(nextTheme);
});

// QR Modal Controls
function toggleQrModal(show) {
  const modal = document.getElementById('modal-qr') || document.getElementById('qr-modal');
  if (modal) {
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
  }
}

document.getElementById('btn-show-qr')?.addEventListener('click', () => {
  Sound.click();
  toggleQrModal(true);
});
document.getElementById('btn-close-qr')?.addEventListener('click', () => {
  toggleQrModal(false);
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

// Region Selector in Lobby
document.getElementById('lobby-region-select')?.addEventListener('change', (e) => {
  Sound.click();
  const region = e.target.value;
  state.selectedRegion = region;
  socket.emit('set_region', { region });
  updateHostUI();
});

// Interactive Region Selector Tiles in Lobby
document.querySelectorAll('.region-tile').forEach((tile) => {
  tile.addEventListener('click', () => {
    if (!state.isHost) {
      showToast('Only the host can choose the expedition theater.', 'warning');
      return;
    }
    const region = tile.getAttribute('data-region');
    if (!region) return;
    Sound.click();
    state.selectedRegion = region;
    const regionSelect = document.getElementById('lobby-region-select');
    if (regionSelect) {
      regionSelect.value = region;
    }
    socket.emit('set_region', { region });
    updateHostUI();
  });
});

// Join In-Progress Match Button in Lobby
document.getElementById('btn-join-in-progress')?.addEventListener('click', () => {
  Sound.click();
  state.userLeftToLobby = false;
  socket.emit('join_game');
});

// Host Stop Game Buttons (HUD & Results)
document.getElementById('hud-btn-stop-game')?.addEventListener('click', () => {
  Sound.click();
  socket.emit('stop_game');
  switchView('view-lobby');
  fetchLanInfo();
});
document.getElementById('results-btn-stop-game')?.addEventListener('click', () => {
  Sound.click();
  if (state.autoAdvanceInterval) {
    clearInterval(state.autoAdvanceInterval);
    state.autoAdvanceInterval = null;
  }
  socket.emit('stop_game');
  switchView('view-lobby');
  fetchLanInfo();
});

// Player & Host Return to Lobby Button in Round Results
document.getElementById('results-btn-leave-game')?.addEventListener('click', () => {
  Sound.click();
  if (state.autoAdvanceInterval) {
    clearInterval(state.autoAdvanceInterval);
    state.autoAdvanceInterval = null;
  }
  if (state.isHost) {
    socket.emit('stop_game');
  } else {
    state.userLeftToLobby = true;
    socket.emit('leave_game');
  }
  switchView('view-lobby');
  fetchLanInfo();
});

// Player Leave to Lobby Button (Game HUD)
document.getElementById('hud-btn-leave-game')?.addEventListener('click', () => {
  Sound.click();
  if (state.isHost) {
    socket.emit('stop_game');
  } else {
    state.userLeftToLobby = true;
    socket.emit('leave_game');
  }
  switchView('view-lobby');
  fetchLanInfo();
});

// Fast Refresh / Reload Street View Panorama (via Secure Uplink Gateway)
document.getElementById('hud-btn-reload-view')?.addEventListener('click', () => {
  Sound.click();
  showToast('Re-acquiring Street View uplink...', 'info');
  const loader = document.getElementById('streetview-loader');
  if (loader) {
    loader.classList.remove('hidden', 'opacity-0');
    loader.classList.add('opacity-100');
  }
  const iframe = document.getElementById('streetview-frame');
  if (iframe) {
    iframe.classList.remove('cheat-blackout');
    iframe.src = `${BACKEND_URL}/api/streetview/uplink?r=${state.currentRound || 1}&token=${encodeURIComponent(state.uplinkToken || '')}&t=${Date.now()}`;
    let hidden = false;
    const hide = () => {
      if (hidden) return;
      hidden = true;
      if (loader) {
        loader.classList.remove('opacity-100');
        loader.classList.add('opacity-0');
        setTimeout(() => loader.classList.add('hidden'), 300);
      }
    };
    iframe.onload = hide;
    setTimeout(hide, 3500);
  }
});

// Return to Lobby from Locked Screen
document.getElementById('btn-locked-go-lobby')?.addEventListener('click', () => {
  Sound.click();
  state.userLeftToLobby = false;
  socket.emit('reset_to_lobby');
  switchView('view-lobby');
  fetchLanInfo();
});

// Start Game Button in Lobby
document.getElementById('btn-start-game')?.addEventListener('click', () => {
  if (!state.isHost) {
    showToast('Only the host can commence the match.', 'warning');
    return;
  }
  Sound.fanfare();
  state.userLeftToLobby = false;
  socket.emit('start_game');
});

// Match Parameters Controls (Host Only)
document.getElementById('btn-param-rounds-dec')?.addEventListener('click', () => {
  if (!state.isHost) return;
  Sound.click();
  const nextRounds = Math.max(3, (state.totalRounds || 10) - 1);
  socket.emit('set_total_rounds', { rounds: nextRounds });
});

document.getElementById('btn-param-rounds-inc')?.addEventListener('click', () => {
  if (!state.isHost) return;
  Sound.click();
  const nextRounds = Math.min(20, (state.totalRounds || 10) + 1);
  socket.emit('set_total_rounds', { rounds: nextRounds });
});

document.querySelectorAll('.btn-preset-rounds').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!state.isHost) return;
    Sound.click();
    const r = parseInt(btn.getAttribute('data-rounds'), 10);
    if (!isNaN(r) && r >= 3 && r <= 20) {
      socket.emit('set_total_rounds', { rounds: r });
    }
  });
});

document.getElementById('btn-param-timer-dec')?.addEventListener('click', () => {
  if (!state.isHost) return;
  Sound.click();
  const nextTimer = Math.max(5, (state.countdownDuration || 20) - 5);
  socket.emit('set_countdown_duration', { seconds: nextTimer });
});

document.getElementById('btn-param-timer-inc')?.addEventListener('click', () => {
  if (!state.isHost) return;
  Sound.click();
  const nextTimer = Math.min(120, (state.countdownDuration || 20) + 5);
  socket.emit('set_countdown_duration', { seconds: nextTimer });
});

document.querySelectorAll('.btn-preset-timer').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!state.isHost) return;
    Sound.click();
    const s = parseInt(btn.getAttribute('data-timer'), 10);
    if (!isNaN(s) && s >= 5 && s <= 120) {
      socket.emit('set_countdown_duration', { seconds: s });
    }
  });
});

// Operational Difficulty Selector Tiles (Host Only)
document.querySelectorAll('.btn-difficulty-tile').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!state.isHost) {
      showToast('Only the host can configure match difficulty.', 'warning');
      return;
    }
    const diff = btn.getAttribute('data-difficulty');
    if (!diff) return;
    Sound.click();
    state.difficulty = diff;
    socket.emit('set_difficulty', { difficulty: diff });
    updateDifficultyUI();
  });
});

// Host Admission Approval Modal Actions
document.getElementById('btn-admission-accept')?.addEventListener('click', () => {
  if (!state.currentAdmissionApplicant) return;
  const applicantIp = state.currentAdmissionApplicant.applicantIp;
  Sound.pop();
  socket.emit('decide_admission', { applicantIp, accepted: true });
  showToast(`Security clearance granted to ${state.currentAdmissionApplicant.applicantName || 'Operative'}!`, 'success');
  state.pendingAdmissionQueue.shift();
  renderHostAdmissionModal();
});

document.getElementById('btn-admission-decline')?.addEventListener('click', () => {
  if (!state.currentAdmissionApplicant) return;
  const applicantIp = state.currentAdmissionApplicant.applicantIp;
  Sound.click();
  socket.emit('decide_admission', { applicantIp, accepted: false });
  showToast(`Clearance declined for ${state.currentAdmissionApplicant.applicantName || 'Operative'}.`, 'warning');
  state.pendingAdmissionQueue.shift();
  renderHostAdmissionModal();
});

// Applicant Cancel Clearance Request Action
document.getElementById('btn-cancel-admission')?.addEventListener('click', () => {
  Sound.click();
  socket.emit('cancel_admission');
  switchView('view-username');
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
  if (btn) {
    btn.disabled = true;
    btn.className = 'btn-3d w-full py-3.5 px-4 font-black text-sm tracking-wider text-emerald-300 bg-slate-900 cursor-not-allowed flex items-center justify-center gap-2 uppercase shadow-inner border border-emerald-500/40';
    btn.innerHTML = `
      <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping mr-1"></span>
      <span>Guess Locked — Waiting for others...</span>
    `;
  }

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
    toggleQrModal(false);
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
  state.userLeftToLobby = false;
  socket.emit('reset_to_lobby');
  switchView('view-lobby');
  fetchLanInfo();
});

// ============================================================
// 7. RENDERING FUNCTIONS FOR ROUND RESULTS & GAME OVER
// ============================================================

function renderRoundResults(data) {
  if (!data) return;
  Sound.fanfare();
  state.currentRound = data.round;
  state.totalRounds = data.totalRounds;

  if (data.hostIp) {
    state.hostIp = data.hostIp;
  }
  state.isHost = evaluateIsHost(data);
  updateHostUI();

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

  // Render Closest Guesser Banner
  const closestCard = document.getElementById('closest-guesser-card');
  if (data.closestPlayer && closestCard) {
    closestCard.classList.remove('hidden');
    const uEl = document.getElementById('closest-guesser-username');
    const dEl = document.getElementById('closest-guesser-distance');
    const sEl = document.getElementById('closest-guesser-score');
    if (uEl) uEl.textContent = data.closestPlayer.username;
    if (dEl) dEl.textContent = `${data.closestPlayer.distanceKm.toLocaleString()} km away`;
    if (sEl) sEl.textContent = `+${data.closestPlayer.roundScore.toLocaleString()} pts`;
  } else if (closestCard) {
    closestCard.classList.add('hidden');
  }

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
    const validResults = (data.results || []).filter((r) => r && (r.connected === true || r.connected === undefined) && r.username);
    const maxRoundScore = Math.max(...validResults.map((r) => r.roundScore || 0));

    tableBody.innerHTML = validResults
      .map((r, idx) => {
        const isMe = r.username === state.myUsername || r.ip === state.myIp;
        const isWinner = r.roundScore > 0 && r.roundScore === maxRoundScore;
        const isClosest = data.closestPlayer && r.username === data.closestPlayer.username;

        let ratingBadge = '';
        if (r.distanceKm !== null) {
          if (r.distanceKm < 50) ratingBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black"><svg class="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>Spot On</span>';
          else if (r.distanceKm < 350) ratingBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black"><svg class="w-3 h-3 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="7"/></svg>Close</span>';
          else if (r.distanceKm < 1500) ratingBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold"><svg class="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="12 6 15 12 12 11 9 12 12 6"/></svg>Decent</span>';
          else ratingBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px]"><svg class="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>Far</span>';
        }

        return `
          <tr class="row-3d-hover cursor-pointer transition-all hover:bg-slate-800/60 ${isMe ? 'bg-cyan-950/30 font-semibold' : ''} ${isWinner ? 'bg-amber-950/20' : ''}" data-player-ip="${escapeHtml(r.ip)}">
            <td class="py-3 px-1">
              <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                idx === 0 ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'text-slate-400'
              }">
                ${idx + 1}
              </span>
            </td>
            <td class="py-3 px-2">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-bold text-slate-100">${escapeHtml(r.username)}</span>
                ${isMe ? '<span class="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono border border-cyan-500/30">YOU</span>' : ''}
                ${isClosest ? '<span class="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono border border-amber-500/40 font-black inline-flex items-center gap-1"><svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/></svg>CLOSEST</span>' : ''}
                ${isWinner ? '<span class="inline-flex items-center text-amber-400" title="Round Winner"><svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M2 19h20v2H2v-2zm1.5-12l4.5 6 4-8 4 8 4.5-6L22 17H2L3.5 7z"/></svg></span>' : ''}
              </div>
              <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(r.ip)}</div>
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
          <span class="flex items-center justify-center">
            <svg class="w-5 h-5 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
          </span>
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

    // 2. Add Player Pins & Connecting Dashed Polylines (Connected Players Only)
    const activeResults = (data.results || []).filter((r) => r && (r.connected === true || r.connected === undefined) && r.username);
    activeResults.forEach((player) => {
      if (!player.guessCoords) return;

      const guessLatLng = [player.guessCoords.lat, player.guessCoords.lng];
      bounds.extend(guessLatLng);

      const isMe = player.username === state.myUsername || player.ip === state.myIp;
      const isClosest = data.closestPlayer && player.username === data.closestPlayer.username;

      const guessIcon = L.divIcon({
        className: 'marker-guess',
        html: `
          <div class="marker-guess-pin" style="${
            isClosest
              ? 'background: #f59e0b; transform: scale(1.3); box-shadow: 0 0 20px rgba(245,158,11,0.9);'
              : isMe
              ? 'background: #06b6d4; transform: scale(1.15); box-shadow: 0 0 15px rgba(6,182,212,0.8);'
              : 'background: #64748b;'
          }">
            <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="8"/>
              <circle cx="12" cy="12" r="2" fill="currentColor"/>
            </svg>
          </div>
          <div class="marker-guess-label" style="${
            isClosest
              ? 'border-color: #f59e0b; color: #fde68a; background: #090d16; font-weight: 900;'
              : isMe
              ? 'border-color: #06b6d4; color: #67e8f9; background: #090d16;'
              : ''
          }">
            ${player.username}${isClosest ? ' 🎯' : ''}
          </div>
        `,
        iconSize: isClosest ? [80, 45] : [60, 40],
        iconAnchor: isClosest ? [40, 18] : [30, 16],
      });

      const pMarker = L.marker(guessLatLng, { icon: guessIcon }).addTo(resultsLayerGroup);
      pMarker.bindPopup(`
        <div class="p-1.5 font-sans">
          ${isClosest ? '<div class="text-[10px] uppercase font-black text-amber-400">🎯 Closest Guess of the Round</div>' : ''}
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

  const leaderboard = (data.leaderboard || []).filter((p) => p && (p.connected === true || p.connected === undefined) && p.username);
  const podiumContainer = document.getElementById('podium-container');
  const tableBody = document.getElementById('gameover-table-body');

  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

  if (podiumContainer) {
    podiumContainer.innerHTML = `
      <!-- 2nd Place (Silver) -->
      <div class="order-2 sm:order-1 podium-tier ${!top2 ? 'opacity-30' : ''}">
        <div class="tech-panel podium-silver rounded-3xl p-5 flex flex-col items-center w-full mb-2">
          <div class="medal-3d medal-silver mb-2 flex items-center justify-center">
            <svg class="w-6 h-6 text-slate-800" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="14" r="7" stroke="#0f172a" stroke-width="1.5" fill="none"/>
              <path d="M12 10.5l1 2.5 2.5.5-2 1.8.6 2.7-2.1-1.3-2.1 1.3.6-2.7-2-1.8 2.5-.5z"/>
              <path d="M7 2l3 7M17 2l-3 7" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="font-black text-white text-base">${top2 ? escapeHtml(top2.username) : '---'}</div>
          <div class="text-[11px] text-slate-400 font-mono mb-2">${top2 ? escapeHtml(top2.ip) : ''}</div>
          <div class="font-black text-emerald-400 text-lg font-mono">
            ${top2 ? `${top2.totalScore.toLocaleString()} pts` : ''}
          </div>
        </div>
        <div class="podium-step-block podium-step-2">2</div>
      </div>

      <!-- 1st Place (Gold Champion) -->
      <div class="order-1 sm:order-2 podium-tier relative ${!top1 ? 'opacity-30' : ''}">
        <div class="tech-panel podium-gold rounded-3xl p-6 sm:p-7 flex flex-col items-center w-full mb-2">
          <div class="w-12 h-12 flex items-center justify-center mb-1 animate-bounce">
            <svg class="w-10 h-10 text-amber-400 drop-shadow-[0_0_16px_rgba(251,191,36,0.9)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 19h20v2H2v-2zm1.5-12l4.5 6 4-8 4 8 4.5-6L22 17H2L3.5 7z"/>
            </svg>
          </div>
          <div class="medal-3d medal-gold mb-2 flex items-center justify-center">
            <svg class="w-6 h-6 text-amber-950" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="14" r="7" stroke="#451a03" stroke-width="1.5" fill="none"/>
              <path d="M12 10.5l1 2.5 2.5.5-2 1.8.6 2.7-2.1-1.3-2.1 1.3.6-2.7-2-1.8 2.5-.5z"/>
              <path d="M7 2l3 7M17 2l-3 7" stroke="#451a03" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="font-black text-amber-300 text-xl sm:text-2xl">${top1 ? escapeHtml(top1.username) : '---'}</div>
          <div class="text-xs text-slate-400 font-mono mb-2">${top1 ? escapeHtml(top1.ip) : ''}</div>
          <div class="font-black text-amber-400 text-2xl sm:text-3xl font-mono">
            ${top1 ? `${top1.totalScore.toLocaleString()} pts` : ''}
          </div>
        </div>
        <div class="podium-step-block podium-step-1">1</div>
      </div>

      <!-- 3rd Place (Bronze) -->
      <div class="order-3 podium-tier ${!top3 ? 'opacity-30' : ''}">
        <div class="tech-panel podium-bronze rounded-3xl p-5 flex flex-col items-center w-full mb-2">
          <div class="medal-3d medal-bronze mb-2 flex items-center justify-center">
            <svg class="w-6 h-6 text-amber-950" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="14" r="7" stroke="#270f03" stroke-width="1.5" fill="none"/>
              <path d="M12 10.5l1 2.5 2.5.5-2 1.8.6 2.7-2.1-1.3-2.1 1.3.6-2.7-2-1.8 2.5-.5z"/>
              <path d="M7 2l3 7M17 2l-3 7" stroke="#270f03" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="font-black text-white text-base">${top3 ? escapeHtml(top3.username) : '---'}</div>
          <div class="text-[11px] text-slate-400 font-mono mb-2">${top3 ? escapeHtml(top3.ip) : ''}</div>
          <div class="font-black text-emerald-400 text-lg font-mono">
            ${top3 ? `${top3.totalScore.toLocaleString()} pts` : ''}
          </div>
        </div>
        <div class="podium-step-block podium-step-3">3</div>
      </div>
    `;
  }

  // Full table
  if (tableBody) {
    tableBody.innerHTML = leaderboard
      .map((p, idx) => {
        const isMe = p.username === state.myUsername || p.ip === state.myIp;
        let rankBadge = `<span class="font-mono text-slate-400 font-bold">#${idx + 1}</span>`;
        if (idx === 0) rankBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black inline-flex items-center gap-1">★ #1 CHAMPION</span>';
        else if (idx === 1) rankBadge = '<span class="px-2 py-0.5 rounded-full bg-slate-300/20 text-slate-200 border border-slate-300/40 text-[10px] font-black inline-flex items-center gap-1">✦ #2 RUNNER-UP</span>';
        else if (idx === 2) rankBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-700/20 text-amber-400 border border-amber-700/40 text-[10px] font-black inline-flex items-center gap-1">▲ #3 PODIUM</span>';

        return `
          <tr class="${isMe ? 'bg-cyan-950/40 border-l-4 border-cyan-400 font-semibold' : ''} hover:bg-slate-900/60 transition-colors">
            <td class="py-3 px-3">${rankBadge}</td>
            <td class="py-3 px-3">
              <span class="font-bold text-white">${escapeHtml(p.username)}</span>
              ${isMe ? '<span class="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono border border-cyan-500/30 ml-1.5">YOU</span>' : ''}
            </td>
            <td class="py-3 px-3 font-mono text-xs text-slate-400">${escapeHtml(p.ip)}</td>
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

// Prompt Username on connect
socket.on('prompt_username', (data) => {
  state.myIp = data.ip;
  if (data.hostIp) state.hostIp = data.hostIp;
  state.isHost = evaluateIsHost(data);
  if (data.selectedRegion) state.selectedRegion = data.selectedRegion;
  if (data.difficulty) state.difficulty = data.difficulty;
  if (data.totalRounds) state.totalRounds = data.totalRounds;
  if (data.countdownDuration) state.countdownDuration = data.countdownDuration;
  const badge = document.getElementById('detected-ip-badge');
  if (badge) {
    badge.textContent = mockIp ? `${data.ip} (Mocked)` : data.ip;
  }
  const input = document.getElementById('input-username');
  if (input && !input.value) {
    input.value = getRandomCallsign();
  }
  updateParamsUI();
  updateDifficultyUI();
  updateHostUI();
  if (data.inProgress && data.gameStatus) {
    updateLobbyGameStatus(data.gameStatus);
  }
  switchView('view-username');
});

// Returning player during LOBBY
socket.on('session_restored', (data) => {
  state.myIp = data.ip;
  state.myUsername = data.username;
  state.totalScore = data.totalScore || 0;
  if (data.hostIp) state.hostIp = data.hostIp;
  state.isHost = evaluateIsHost(data);
  if (data.selectedRegion) state.selectedRegion = data.selectedRegion;
  if (data.difficulty) state.difficulty = data.difficulty;
  if (data.totalRounds) state.totalRounds = data.totalRounds;
  if (data.countdownDuration) state.countdownDuration = data.countdownDuration;

  const nameEl = document.getElementById('lobby-my-name');
  if (nameEl) nameEl.textContent = state.myUsername;

  const badge = document.getElementById('detected-ip-badge');
  if (badge) badge.textContent = mockIp ? `${data.ip} (Mocked)` : data.ip;

  updateParamsUI();
  updateDifficultyUI();
  updateHostUI();
  updateLobbyGameStatus(data.gameStatus || null);
  switchView('view-lobby');
  fetchLanInfo();
});

// Confirmation username set
socket.on('username_set', (data) => {
  state.myIp = data.ip;
  state.myUsername = data.username;
  if (data.hostIp) state.hostIp = data.hostIp;
  state.isHost = evaluateIsHost(data);
  if (data.selectedRegion) state.selectedRegion = data.selectedRegion;
  if (data.difficulty) state.difficulty = data.difficulty;
  if (data.totalRounds) state.totalRounds = data.totalRounds;
  if (data.countdownDuration) state.countdownDuration = data.countdownDuration;

  const nameEl = document.getElementById('lobby-my-name');
  if (nameEl) nameEl.textContent = state.myUsername;

  updateParamsUI();
  updateDifficultyUI();
  updateHostUI();
  updateLobbyGameStatus(data.gameStatus || null);
  showToast(`Callsign Confirmed: ${data.username}`, 'success');
  switchView('view-lobby');
  fetchLanInfo();
});

// Admission Pending (Applicant waiting for Host clearance)
socket.on('admission_pending', (data) => {
  switchView('view-admission-pending');
  const hostSpan = document.getElementById('admission-host-name');
  if (hostSpan) hostSpan.textContent = data.hostName || 'Host';

  const myCallsignSpan = document.getElementById('admission-my-callsign');
  if (myCallsignSpan) myCallsignSpan.textContent = data.username || state.myUsername || 'Operative';

  const myIpSpan = document.getElementById('admission-my-ip');
  if (myIpSpan) myIpSpan.textContent = data.ip || state.myIp || '';

  const declinedMsg = document.getElementById('admission-declined-msg');
  if (declinedMsg) declinedMsg.classList.add('hidden');
});

// Admission Accepted (Applicant clearance granted by Host)
socket.on('admission_accepted', () => {
  Sound.fanfare();
  showToast('Security clearance granted by Host! Entering Match Lobby...', 'success');
});

// Admission Declined (Applicant clearance rejected by Host)
socket.on('admission_declined', (data) => {
  Sound.pop();
  const declinedMsg = document.getElementById('admission-declined-msg');
  if (declinedMsg) {
    if (data?.message) declinedMsg.textContent = data.message;
    declinedMsg.classList.remove('hidden');
  }
  showToast(data?.message || 'Admission declined by Host.', 'error');
});

// Admission Requested (Host receives entry clearance request)
socket.on('admission_requested', (data) => {
  if (!state.isHost) return;
  Sound.urgentTick(1);
  const exists = state.pendingAdmissionQueue.some((a) => a.applicantIp === data.applicantIp);
  if (!exists) {
    state.pendingAdmissionQueue.push({
      applicantIp: data.applicantIp,
      applicantName: data.applicantName,
    });
  }
  renderHostAdmissionModal();
  showToast(`Operative ${data.applicantName} (${data.applicantIp}) requested entry clearance.`, 'warning');
});

// Match Parameters Updated Broadcast
socket.on('params_updated', (data) => {
  if (data.totalRounds) state.totalRounds = data.totalRounds;
  if (data.countdownDuration) state.countdownDuration = data.countdownDuration;
  updateParamsUI();
  updateHostUI();
  showToast(`Match Config: ${state.totalRounds} Rounds • ${state.countdownDuration}s Scramble Timer`, 'info');
});

// Region Updated Broadcast
socket.on('region_updated', (data) => {
  state.selectedRegion = data.selectedRegion;
  updateHostUI();
  showToast(`Target Region: ${data.selectedRegion.toUpperCase()}`, 'info');
});

// Difficulty Updated Broadcast
socket.on('difficulty_updated', (data) => {
  if (data.difficulty) {
    state.difficulty = data.difficulty;
    updateDifficultyUI();
    const diffNames = { all: 'ALL-TERRAIN', easy: 'CADET', medium: 'EXPLORER', hard: 'NOMAD' };
    showToast(`Operational Difficulty: ${diffNames[data.difficulty] || data.difficulty.toUpperCase()}`, 'info');
  }
});

// Game Stopped by Host
socket.on('game_stopped', (data) => {
  Sound.pop();
  showToast(data.message || 'Host stopped the game. Returned to Lobby.', 'warning');
  state.userLeftToLobby = false;
  if (state.autoAdvanceInterval) clearInterval(state.autoAdvanceInterval);
  state.autoAdvanceInterval = null;
  if (data.hostIp) {
    state.hostIp = data.hostIp;
  }
  state.isHost = evaluateIsHost(data);
  state.selectedRegion = data.selectedRegion || 'all';
  updateHostUI();
  updateLobbyGameStatus(null);
  switchView('view-lobby');
  fetchLanInfo();
});

// Player Left Match
socket.on('player_left', (data) => {
  showToast(`${data.username} left the match (${data.remainingCount} active)`, 'info');
  if (data.hostIp) {
    state.hostIp = data.hostIp;
  }
  state.isHost = evaluateIsHost(data);
  updateHostUI();

  // 1. Update in-game HUD counter if in active round
  const statusEl = document.getElementById('hud-guessed-status');
  if (statusEl && data.remainingCount !== undefined) {
    const curText = statusEl.textContent || '';
    const parts = curText.split('/');
    const lockedCount = parts.length > 0 ? parseInt(parts[0].trim(), 10) : 0;
    statusEl.textContent = `${Math.min(lockedCount || 0, data.remainingCount)} / ${data.remainingCount}`;
  }

  // 2. Update post-round results screen if active
  if (data.lastRoundResults) {
    renderRoundResults(data.lastRoundResults);
  } else {
    const tableBody = document.getElementById('results-table-body');
    if (tableBody) {
      const row = tableBody.querySelector(`tr[data-player-ip="${data.ip}"]`);
      if (row) row.remove();
      // Re-index remaining rows (1, 2, 3...)
      tableBody.querySelectorAll('tr').forEach((r, idx) => {
        const rankSpan = r.querySelector('td:first-child span');
        if (rankSpan) rankSpan.textContent = idx + 1;
      });
    }
    const closestUsernameEl = document.getElementById('closest-guesser-username');
    if (closestUsernameEl && closestUsernameEl.textContent === data.username) {
      const card = document.getElementById('closest-guesser-card');
      if (card) card.classList.add('hidden');
    }
  }

  // 3. Update game over screen if active
  if (data.gameOverResults) {
    renderGameOver(data.gameOverResults);
  } else {
    const goTableBody = document.getElementById('gameover-table-body');
    if (goTableBody) {
      const rows = goTableBody.querySelectorAll('tr');
      rows.forEach((r) => {
        if (r.textContent.includes(data.username) || r.textContent.includes(data.ip)) {
          r.remove();
        }
      });
    }
  }
});

// Player Joined Match
socket.on('player_joined', (data) => {
  showToast(`⚡ ${data.username} joined the match!`, 'success');
});

// Match Locked (legacy / fallback)
socket.on('match_locked', (data) => {
  const reasonEl = document.getElementById('locked-reason-text');
  if (reasonEl && data.reason) reasonEl.textContent = data.reason;

  const ipEl = document.getElementById('locked-user-ip');
  if (ipEl) ipEl.textContent = mockIp ? `${mockIp} (Dev Mock)` : (state.myIp || 'Local LAN Device');

  switchView('view-locked');
});

// Lobby Player List Broadcast
socket.on('lobby_update', (data) => {
  if (data.hostIp) {
    state.hostIp = data.hostIp;
  }
  state.isHost = evaluateIsHost(data);
  if (data.selectedRegion) {
    state.selectedRegion = data.selectedRegion;
  }
  if (data.difficulty) {
    state.difficulty = data.difficulty;
  }
  if (data.totalRounds) {
    state.totalRounds = data.totalRounds;
  }
  if (data.countdownDuration) {
    state.countdownDuration = data.countdownDuration;
  }
  updateParamsUI();
  updateHostUI();

  if (state.isHost && Array.isArray(data.pendingAdmissions)) {
    const activeIps = new Set(data.pendingAdmissions.map((a) => a.ip));
    state.pendingAdmissionQueue = state.pendingAdmissionQueue.filter((a) => activeIps.has(a.applicantIp));
    data.pendingAdmissions.forEach((a) => {
      if (!state.pendingAdmissionQueue.some((q) => q.applicantIp === a.ip)) {
        state.pendingAdmissionQueue.push({
          applicantIp: a.ip,
          applicantName: a.username,
        });
      }
    });
    renderHostAdmissionModal();
  }

  if (data.gameStatus) {
    updateLobbyGameStatus(data.gameStatus);
  } else {
    updateLobbyGameStatus(null);
  }

  const grid = document.getElementById('lobby-players-grid');
  const countBadge = document.getElementById('player-count-badge');
  if (!grid) return;

  const players = (data.players || []).filter((p) => p && p.connected === true);
  if (countBadge) {
    countBadge.textContent = `${players.length} ${players.length === 1 ? 'Operative' : 'Operatives'} Ready`;
  }

  if (players.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-10 px-4 text-center rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col items-center justify-center shadow-inner">
        <div class="radar-scanner mb-4"></div>
        <div class="text-xs font-bold text-slate-200 uppercase tracking-wider">Awaiting Operative Connections</div>
        <p class="text-[11px] text-slate-400 mt-1 max-w-xs text-center leading-relaxed">Scan the QR code with your phone camera or open the Wi-Fi link to deploy into the staging manifest.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = players
    .map((p) => {
        const isMe = p.username === state.myUsername || p.ip === state.myIp;
        const safeName = escapeHtml(p.username || 'Anonymous');
        const safeIp = escapeHtml(p.ip);
        const avatarInitials = escapeHtml(p.username ? p.username.substring(0, 2).toUpperCase() : '??');
        return `
        <div class="player-card-3d ${isMe ? 'is-me' : ''} flex items-center justify-between p-3.5 rounded-2xl transition-all">
          <div class="flex items-center gap-3">
            <div class="avatar-3d w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex-shrink-0">
              ${avatarInitials}
            </div>
            <div>
              <div class="font-bold text-sm text-white flex items-center gap-1.5 flex-wrap">
                <span>${safeName}</span>
                ${isMe ? '<span class="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono border border-cyan-500/30">YOU</span>' : ''}
                ${p.isHost ? '<span class="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono border border-amber-500/30 font-bold inline-flex items-center gap-1">HOST <svg class="w-2.5 h-2.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20v2H2v-2zm1.5-12l4.5 6 4-8 4 8 4.5-6L22 17H2L3.5 7z"/></svg></span>' : ''}
              </div>
              <div class="font-mono text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <svg class="w-3 h-3 text-cyan-400/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                  <line x1="6" y1="6" x2="6.01" y2="6"/>
                  <line x1="6" y1="18" x2="6.01" y2="18"/>
                </svg>
                <span>${safeIp}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${
              state.isHost && !isMe
                ? `
                <button
                  type="button"
                  class="btn-pass-crown btn-3d btn-3d-mini py-1 px-2.5 rounded-lg text-[10px] font-bold text-amber-300 border border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/60 flex items-center gap-1.5 transition-all shadow-sm"
                  data-target-ip="${safeIp}"
                  data-target-name="${safeName}"
                  title="Give Crown 👑 to ${safeName}"
                >
                  <svg class="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 19h20v2H2v-2zm1.5-12l4.5 6 4-8 4 8 4.5-6L22 17H2L3.5 7z"/>
                  </svg>
                  <span>Give Crown</span>
                </button>
              `
                : ''
            }
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="tech-badge text-[11px] text-emerald-400">
              ONLINE
            </span>
          </div>
        </div>
      `;
    })
    .join('');

  // Wire Crown Transfer Buttons (Host only)
  grid.querySelectorAll('.btn-pass-crown').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetIp = btn.getAttribute('data-target-ip');
      const targetName = btn.getAttribute('data-target-name');
      if (!targetIp) return;
      Sound.click();
      socket.emit('transfer_host', { targetIp });
      showToast(`👑 Giving Crown to ${targetName}...`, 'info');
    });
  });
});

// Host Transferred Broadcast Notification
socket.on('host_transferred', (data) => {
  Sound.fanfare();
  if (data.newHostIp === state.myIp || data.newHost === state.myUsername) {
    showToast(`👑 ${data.previousHost} crowned you the Host! You now control the match!`, 'success');
  } else {
    showToast(`👑 ${data.previousHost} passed the Crown to ${data.newHost}!`, 'info');
  }
});

// Round Started
socket.on('round_started', (data) => {
  Sound.fanfare();
  state.currentRound = data.round;
  state.totalRounds = data.totalRounds || 10;
  state.currentPin = null;
  state.hasGuessed = false;
  state.uplinkToken = data.uplinkToken || null;

  if (data.hostIp) {
    state.hostIp = data.hostIp;
  }
  if (data.difficulty) {
    state.difficulty = data.difficulty;
  }
  state.isHost = evaluateIsHost(data);
  updateHostUI();
  updateDifficultyUI();

  // If a brand new match starts (Round 1), reset userLeftToLobby so all players enter!
  if (data.round === 1) {
    state.userLeftToLobby = false;
  }

  // If the user explicitly returned to the lobby mid-game, remain in the lobby!
  if (state.userLeftToLobby) {
    updateLobbyGameStatus({
      status: 'ROUND_ACTIVE',
      currentRound: data.round,
      totalRounds: state.totalRounds,
    });
    return;
  }

  // Update HUD
  document.getElementById('hud-round-current').textContent = data.round;
  document.getElementById('hud-round-total').textContent = state.totalRounds;
  document.getElementById('hud-guessed-status').textContent = `0 / ${data.totalPlayers || 1}`;
  document.getElementById('hud-my-score').textContent = state.totalScore;
  updateRoundDots(data.round, state.totalRounds);

  // Reset Timer Banner
  const timerBanner = document.getElementById('timer-banner');
  const timerIcon = document.getElementById('timer-icon');
  const timerText = document.getElementById('timer-text');
  timerBanner.classList.remove('timer-countdown-active');
  timerBanner.className = 'py-2.5 px-6 rounded-full font-bold text-sm tracking-wide shadow-2xl backdrop-blur-md border border-slate-700 bg-slate-900/95 text-slate-200 flex items-center gap-3 transition-all';
  timerIcon.innerHTML = '<svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  timerText.textContent = 'No Time Limit — Waiting for first guess...';
  document.body.classList.remove('urgent-vignette');

  // Reset lock guess button
  const btnLock = document.getElementById('btn-lock-guess');
  if (btnLock) {
    btnLock.disabled = true;
    btnLock.className = 'btn-3d w-full py-3.5 px-4 font-black text-sm tracking-wider text-slate-400 bg-slate-800/90 cursor-not-allowed flex items-center justify-center gap-2 uppercase border border-slate-700/60';
    btnLock.innerHTML = '<span>Lock in Guess</span><span class="kbd-badge ml-1 hidden sm:inline">SPACE</span>';
  }

  document.getElementById('pin-coords-text').textContent = 'No pin placed';

  // Load Street View via Secure Uplink Gateway (no coordinates in DOM)
  const loader = document.getElementById('streetview-loader');
  if (loader) {
    loader.classList.remove('hidden', 'opacity-0');
    loader.classList.add('opacity-100');
  }

  const iframe = document.getElementById('streetview-frame');
  if (iframe) {
    iframe.classList.remove('cheat-blackout');
    iframe.src = `${BACKEND_URL}/api/streetview/uplink?r=${data.round || 1}&token=${encodeURIComponent(state.uplinkToken || '')}&t=${Date.now()}`;
  }

  let loaderDone = false;
  const hideLoader = () => {
    if (loaderDone) return;
    loaderDone = true;
    if (loader) {
      loader.classList.remove('opacity-100');
      loader.classList.add('opacity-0');
      setTimeout(() => loader.classList.add('hidden'), 350);
    }
  };
  iframe.onload = hideLoader;
  setTimeout(hideLoader, 3500);

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
  timerIcon.innerHTML = '<svg class="w-4 h-4 text-amber-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
  timerText.textContent = `${data.triggeredBy} locked guess! ${data.seconds}s remaining`;

  showToast(`⚡ ${data.triggeredBy} locked guess! ${data.seconds}-second countdown started!`, 'warning');
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
  state.uplinkToken = data.uplinkToken || null;

  if (data.hostIp) {
    state.hostIp = data.hostIp;
  }
  state.isHost = evaluateIsHost(data);
  updateHostUI();

  showToast(`Reconnected to Round ${data.round}!`, 'success');

  if (data.status === 'ROUND_ACTIVE' || data.status === 'ROUND_COUNTDOWN') {
    switchView('view-game');
    initGuessMap();

    const iframe = document.getElementById('streetview-frame');
    if (iframe) {
      iframe.classList.remove('cheat-blackout');
      iframe.src = `${BACKEND_URL}/api/streetview/uplink?r=${data.round || 1}&token=${encodeURIComponent(state.uplinkToken || '')}&t=${Date.now()}`;
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
      timerIcon.innerHTML = '<svg class="w-4 h-4 text-amber-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
      timerText.textContent = `${data.firstGuesserName} locked guess! ${data.countdownSeconds}s remaining`;
      if (data.countdownSeconds <= 5) document.body.classList.add('urgent-vignette');
    } else {
      timerBanner.classList.remove('timer-countdown-active');
      timerIcon.innerHTML = '<svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
      timerText.textContent = 'No Time Limit — Waiting for first guess...';
    }

    const btnLock = document.getElementById('btn-lock-guess');
    if (btnLock) {
      if (data.hasGuessed && data.lockedGuess) {
        state.currentPin = data.lockedGuess;
        btnLock.disabled = true;
        btnLock.className = 'btn-3d w-full py-3.5 px-4 font-black text-sm tracking-wider text-emerald-300 bg-slate-900 cursor-not-allowed flex items-center justify-center gap-2 uppercase shadow-inner border border-emerald-500/40';
        btnLock.innerHTML = '<span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping mr-1"></span><span>Guess Locked — Waiting for others...</span>';
      } else if (data.currentPin) {
        state.currentPin = data.currentPin;
        btnLock.disabled = false;
        btnLock.className = 'btn-3d w-full py-3.5 px-4 font-black text-sm tracking-wider text-white btn-lock-tactical cursor-pointer flex items-center justify-center gap-2 uppercase shadow-xl';
      }
    }

    if (state.currentPin && guessMap) {
      guessMarker = L.marker([state.currentPin.lat, state.currentPin.lng], { icon: createTacticalPinIcon() }).addTo(guessMap);
      guessMap.setView([state.currentPin.lat, state.currentPin.lng], 3);
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
  state.userLeftToLobby = false;
  state.currentRound = 0;
  state.totalScore = 0;
  state.currentPin = null;
  state.hasGuessed = false;

  if (state.autoAdvanceInterval) clearInterval(state.autoAdvanceInterval);
  state.autoAdvanceInterval = null;

  if (data.hostIp) {
    state.hostIp = data.hostIp;
  }
  state.isHost = evaluateIsHost(data);
  if (data.selectedRegion) {
    state.selectedRegion = data.selectedRegion;
  }
  if (data.difficulty) {
    state.difficulty = data.difficulty;
  }
  if (data.totalRounds) {
    state.totalRounds = data.totalRounds;
  }
  if (data.countdownDuration) {
    state.countdownDuration = data.countdownDuration;
  }
  updateParamsUI();
  updateHostUI();

  if (data.status && data.status !== 'LOBBY') {
    updateLobbyGameStatus({
      status: data.status,
      currentRound: data.currentRound,
      totalRounds: state.totalRounds,
    });
  } else {
    updateLobbyGameStatus(null);
  }

  const myPlayer = (data.players || []).find((p) => p.ip === state.myIp || p.username === state.myUsername);
  if (myPlayer) {
    state.myUsername = myPlayer.username;
    const nameEl = document.getElementById('lobby-my-name');
    if (nameEl) nameEl.textContent = state.myUsername;
  }

  switchView('view-lobby');
  fetchLanInfo();
  showToast('Lobby ready!', 'info');
});

// Error Message
socket.on('error_message', (data) => {
  showToast(data.message || 'An error occurred', 'error');
});

// ============================================================
// 10. ANTI-CHEAT & ANTI-TAMPER SECURITY GUARDIANS
// ============================================================
function initAntiCheatProtection() {
  // 1. Block right-click context menu during active matches to prevent "Inspect Element"
  window.addEventListener('contextmenu', (e) => {
    const gameView = document.getElementById('view-game');
    if (gameView && !gameView.classList.contains('hidden')) {
      e.preventDefault();
      showToast('⚠️ Developer inspection disabled during active round.', 'warning');
      return false;
    }
  });

  // 2. Block common DevTools keyboard shortcuts during active matches
  window.addEventListener('keydown', (e) => {
    const gameView = document.getElementById('view-game');
    if (!gameView || gameView.classList.contains('hidden')) return;

    // F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      showToast('⚠️ Developer shortcut blocked during active round.', 'warning');
      return false;
    }
    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C / Cmd+Opt+I
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)
    ) {
      e.preventDefault();
      showToast('⚠️ Developer tools shortcut blocked.', 'warning');
      return false;
    }
    // Ctrl+U (View Source)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      return false;
    }
  });

  // 3. Tamper-Proof Anti-Spoiler Shield Guardian (MutationObserver)
  const hud = document.getElementById('anti-spoiler-hud');
  const iframe = document.getElementById('streetview-frame');
  if (hud && iframe) {
    const enforceShieldIntegrity = () => {
      // Detect node removal from DOM
      if (!document.body.contains(hud)) {
        iframe.classList.add('cheat-blackout');
        document.body.appendChild(hud);
        showToast('⚠️ Anti-Cheat: Anti-Spoiler HUD tampering detected!', 'error');
        return;
      }
      // Detect style tampering (display: none, opacity: 0, visibility: hidden, etc.)
      const style = window.getComputedStyle(hud);
      const isTampered = (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        parseFloat(style.opacity || '1') < 0.75 ||
        parseFloat(style.width || '0') < 140 ||
        parseFloat(style.height || '0') < 40
      );

      if (isTampered) {
        iframe.classList.add('cheat-blackout');
        hud.style.setProperty('display', 'flex', 'important');
        hud.style.setProperty('visibility', 'visible', 'important');
        hud.style.setProperty('opacity', '1', 'important');
        showToast('⚠️ Anti-Cheat: Anti-Spoiler HUD tampering detected!', 'error');
      } else {
        iframe.classList.remove('cheat-blackout');
      }
    };

    const hudObserver = new MutationObserver(enforceShieldIntegrity);
    hudObserver.observe(hud, { attributes: true, attributeFilter: ['style', 'class'] });

    if (hud.parentElement) {
      const parentObserver = new MutationObserver(enforceShieldIntegrity);
      parentObserver.observe(hud.parentElement, { childList: true });
    }

    setInterval(enforceShieldIntegrity, 1200);
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  Sound.updateMuteButtons();
  Confetti.init();
  updateParamsUI();
  initAntiCheatProtection();
});

})();
