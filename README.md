# 🌍 LAN-Guessr | Free Tactical Local Multiplayer Geo-Battle

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/NestJS-v11-ea2845.svg" alt="NestJS">
  <img src="https://img.shields.io/badge/React-18-61dafb.svg" alt="React 18">
  <img src="https://img.shields.io/badge/PostgreSQL-16%20%2B%20PostGIS-336791.svg" alt="PostGIS">
  <img src="https://img.shields.io/badge/Socket.IO-v4-010101.svg" alt="Socket.IO">
  <img src="https://img.shields.io/badge/Docker-Compose%20Ready-2496ed.svg" alt="Docker">
  <img src="https://img.shields.io/badge/Coverage-100%25%20Verified%20Tests-brightgreen.svg" alt="Tests">
</p>

**LAN-Guessr** is a 100% free, self-hosted, real-time multiplayer geography battle game designed for local area networks (LAN parties, office games, classrooms, and friends). 

Drop into high-resolution, interactive Street View roads across 86+ countries, scan your surroundings, pinpoint your guess on an English interactive tactical map, and race against friends as the scramble timer ticks down. **No API keys, no Google billing, and no sign-ups required.**

---

## 🌟 Key Features

- **🚗 True Official Street View Road Coverage**: High-definition Google Street View with full road traversal (arrow-key and click driving), compass rotation, tilt, and zoom. Photospheres, indoor venues, and dead-end beaches are filtered out.
- **🗺️ 10,050+ Curated Global Coordinates**: Curated locations across Europe, Asia, Africa, North America, South America, and Oceania, backed by PostGIS spatial queries.
- **⚡ Zero API Keys & 100% Free**: Uses ESRI World Street Map for pure English cartographic tiles (no watermark, no rate limits) and zero-cost interactive Street View embeds.
- **🎮 Real-Time Low-Latency LAN Multiplayer**: Built on Socket.IO WebSockets. Operatives join instantly via browser on phones, tablets, and laptops by scanning the on-screen QR code or navigating to your LAN IP.
- **👑 Host Gatekeeper & Match Administration**:
  - **Admission Clearance**: Host accepts or declines incoming operatives with a live radar popup.
  - **Match Parameters**: Configure total rounds (3–20) and dynamic first-guess scramble timer (5s–120s).
  - **Region Selector**: Target specific continents (`All`, `Europe`, `Asia`, `Africa`, `Americas`, `Oceania`).
  - **Operational Difficulty**: Filter by `Easy` (major capitals & iconic landmarks), `Medium` (cities & national highways), or `Hard` (remote rural outposts).
  - **Emergency Stop & Match Return**: Host can stop or reset to lobby at any point.
- **🛡️ Anti-Cheat & Coordinate Shielding**: Coordinates are stripped from round payloads and protected via server-side XOR-ciphered uplink tokens (`/api/streetview/uplink`), preventing DevTools inspection.
- **⏱️ Dynamic Scramble Timer**: When the first operative locks in a guess, a scramble timer is triggered for all remaining players. Incomplete guesses automatically score from draft pins when the clock expires.
- **🏆 3D Olympic Podium & Leaderboard**: Real-time score decay calculation ($0 - 5000$ points based on Haversine distance), closest-guesser badges, and 3D medal podium celebrations.

---

## 🏗️ Architecture & Service Isolation

The application is architected into **two fully decoupled, independent services**:

```
free_local_geoguesser/
├── backend/                         # Standalone NestJS v11 Backend (Port 5000)
│   ├── src/
│   │   ├── game/                    # GameGateway (WebSockets), GameService, GameHelpers
│   │   ├── geo-database/            # GeoDatabaseService (PostgreSQL + In-Memory Fallback)
│   │   ├── info/                    # InfoController (/api/info, /api/status)
│   │   └── streetview/              # StreetViewController (/api/streetview/uplink)
│   ├── data/
│   │   └── locations.json           # 10,050 curated global coordinates
│   ├── test/                        # 6 automated E2E verification test suites (147 tests)
│   ├── Dockerfile                   # Multi-stage production build
│   └── package.json                 # Isolated backend dependencies & scripts
│
├── frontend/                        # Standalone Web Frontend (Port 3000)
│   ├── index.html                   # Cyber-Tactical UI, React 18, Leaflet, QR Modal
│   ├── app.js                       # SPA client pointing dynamically to backend (:5000)
│   ├── style.css                    # 3D UI, tactical buttons, and glassmorphism styling
│   ├── socket.io.min.js             # Offline-bundled Socket.IO client
│   ├── Dockerfile                   # Standalone Nginx container
│   ├── nginx.conf                   # Nginx web server reverse-proxy configuration
│   └── package.json                 # Isolated frontend dependencies (http-server)
│
├── docker/
│   └── init-geo-db.sql              # PostgreSQL 16 + PostGIS spatial seed database
└── docker-compose.yml               # Multi-container orchestration (geo-db, backend, frontend)
```

---

## 🚀 Quick Start

### Option A: One-Command Docker Compose (Recommended)

Make sure you have [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/) installed:

```bash
docker compose up --build
```

Services will boot up automatically:
- **Web Frontend**: `http://localhost:3000`
- **NestJS Backend**: `http://localhost:5000`
- **PostGIS Geo Database**: `localhost:5432`

---

### Option B: Local Node.js Development

#### Prerequisites
- Node.js >= 20.x
- npm >= 9.x
- *(Optional)* Docker for PostgreSQL/PostGIS (an in-memory JSON dataset of 10,050 locations will automatically be used if PostgreSQL is not running).

#### 1. Start the Backend Server (Port 5000)
```bash
cd backend
npm install
npm run build
npm run start:prod
# Or development watch mode:
# npm run start:dev
```

#### 2. Start the Frontend Server (Port 3000)
In a separate terminal window:
```bash
cd frontend
npm install
npm start
```

---

## 📱 How to Play on LAN

1. Start both services on the host machine.
2. Open your browser and navigate to `http://localhost:3000` (or `http://<HOST_IP>:3000`).
3. The first connected player becomes the **Lobby Host** 👑.
4. Other players on the same Wi-Fi/Ethernet network can join by:
   - Scanning the **QR code** on the host's screen using their phone or tablet camera.
   - Navigating to `http://<HOST_IP>:3000` directly in any web browser.
5. The Host admits operatives, chooses the region & difficulty, configures round parameters, and clicks **Commence Operation**.

---

## 🧪 Automated Test Verification

The backend includes a comprehensive, automated test suite covering 147 edge cases, security validations, and gameplay mechanics.

Run tests directly from the `backend/` directory:

```bash
cd backend

# Run core gameplay test suite
npm test

# Run individual test suites
npm run test:lobby       # Lobby return buttons & lifecycle
npm run test:params      # Admission gatekeeper & round parameter validation
npm run test:db          # Difficulty filters & PostGIS spatial queries
npm run test:security    # Crown hijacking & coordinate anti-leak protection
npm run test:edge        # Exhaustive HTTP routes & gameplay edge cases

# Run all suites sequentially (147 tests)
npm run test:all
```

| Verification Suite | Target | Status |
| :--- | :--- | :---: |
| **Core Gameplay** | Dynamic countdown timers, host controls, closest guesser | ✅ 22/22 Passed |
| **Lobby Navigation** | Solo & multiplayer reset idempotency, match rejoin | ✅ 12/12 Passed |
| **Admissions & Parameters** | Accept/decline flows, round clamping (3–20), timer clamping (5–120s) | ✅ 29/29 Passed |
| **Geo DB & Difficulty** | PostGIS database queries, easy/medium/hard classification | ✅ 10/10 Passed |
| **Security & Hijack** | Crown hijacking prevention, callsign spoofing, coordinate cipher | ✅ 29/29 Passed |
| **Exhaustive Edge Cases** | Reconnection, draft pin scoring, podium rankings | ✅ 45/45 Passed |
| **Total** | | **✅ 147/147 Passed (100%)** |

---

## 📐 Scoring Formula

Scores are calculated server-side based on the Haversine great-circle distance between the operative's locked pin and the target coordinates:

$$\text{Score} = \text{round}\left(5000 \times e^{-\frac{\text{distance (km)}}{2000}}\right)$$

- **Exact guess (0 km)**: 5,000 pts
- **Within ~25 km**: ~4,938 pts
- **Within ~200 km**: ~4,524 pts
- **Within ~1,000 km**: ~3,033 pts
- **Across the globe (>10,000 km)**: ~34 pts

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
