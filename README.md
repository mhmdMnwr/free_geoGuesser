# 🌍 WAYFINDER | Pure LAN Zero-Trust Tactical Geo-Battle

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Security-Zero--Trust%20ECDH%20P--256-blueviolet.svg" alt="Zero-Trust ECDH">
  <img src="https://img.shields.io/badge/Encryption-AES--256--GCM-success.svg" alt="AES-256-GCM">
  <img src="https://img.shields.io/badge/Redis-7%20In--Memory%20Backbone-dc382d.svg" alt="Redis 7">
  <img src="https://img.shields.io/badge/NestJS-v11-ea2845.svg" alt="NestJS">
  <img src="https://img.shields.io/badge/React-18%20%2B%20Vite-61dafb.svg" alt="React 18">
  <img src="https://img.shields.io/badge/PostgreSQL-16%20%2B%20PostGIS-336791.svg" alt="PostGIS">
  <img src="https://img.shields.io/badge/Docker-Microservices%20Cluster-2496ed.svg" alt="Docker">
</p>

**WAYFINDER** (formerly LAN-Guessr) is a 100% free, self-hosted, pure LAN real-time multiplayer geography battle game designed for local area networks (LAN parties, Wi-Fi gatherings, office games, and classrooms).

Drop into high-resolution, interactive reconnaissance roads across 86+ countries, scan your surroundings, pinpoint your guess on an English tactical atlas, and race against friends as the scramble timer ticks down. **No API keys, no Google billing, no external cloud dependencies, and zero Wireshark eavesdropping risk.**

---

## 🛡️ Pure LAN Zero-Trust Security Architecture

1. **Wireshark Eavesdropping Defense (ECDH P-256)**:
   - Neither client nor server ever transmits the symmetric key over the LAN.
   - Client and server exchange only public curve points (`04...`).
   - Each peer independently derives an identical 256-bit AES-GCM session key in device RAM. Wireshark packets reveal only uncrackable ciphertext.
2. **Encrypted Guess Submissions**:
   - Player guesses are encrypted with **AES-256-GCM** before touching the wire. Raw `{ lat, lng }` coordinates are never transmitted across the LAN.
3. **Strict Host Invariant & Watchdog Termination**:
   - The lobby creator holds the immutable Crown 👑.
   - Host emits an active heartbeat every 2.5s to maintain an 8-second Redis TTL.
   - If the host closes their browser or leaves, the watchdog instantly disbands the room for all players—preventing host hijacking or state corruption.
4. **Centralized Media & Road Proxy**:
   - The backend server fetches or renders road panoramas directly into a binary Redis cache.
   - Phones query the local Edge Gateway (`/api/media/road/:roadToken`) over the LAN.
   - Eliminates Wi-Fi bandwidth saturation and strips all Google coordinates, tracking cookies, and metadata.
5. **Microservice Network Isolation**:
   - Services run in an isolated Docker bridge network (`172.28.0.0/16`).
   - Internal inter-service requests are signed and verified with HMAC-SHA256 (`X-Internal-Service-Auth`).

---

## 🌟 Key Features

- **🏰 Multi-Lobby Squad Orchestration**: Any player can create their own squad room, select custom regions, choose round counts, and configure first-guess timers. Other players can browse all active squad expeditions in real time.
- **🚗 High-Resolution Tactical Reconnaissance**: Interactive road panoramas served securely from local cache with zero external WAN calls from mobile devices.
- **🗺️ 10,050+ Curated Global Coordinates**: Curated locations across Europe, Asia, Africa, North America, South America, and Oceania, backed by PostGIS spatial queries.
- **⚡ Zero API Keys & 100% Free**: Pure English cartographic tiles (no watermark, no rate limits) and zero-cost interactive embeds.
- **🎮 Real-Time Low-Latency LAN Multiplayer**: Built on Socket.IO WebSockets and Redis 7 Pub/Sub. Operatives join via browser on phones, tablets, and PCs.
- **⏱️ Dynamic Scramble Timer**: When the first operative locks in a guess, a scramble countdown starts for all remaining squad members.
- **🏆 Olympic Podium & Leaderboard**: Real-time score decay calculation ($0 - 5000$ points based on Haversine distance), closest-guesser badges, and podium celebrations.

---

## 🏗️ Docker Microservices Topology

```
+-----------------------------------------------------------------------------------+
|                            LAN / Wi-Fi Operatives                                  |
|         Host & Guest Browsers (ECDH P-256 Keypair, In-Memory AES-GCM Key)         |
+-----------------------------------------------------------------------------------+
                                        │
                             Port 3000 / Port 5000
                                        ▼
+-----------------------------------------------------------------------------------+
|  lan-guessr-gateway (Edge Gateway & Reverse Proxy, Nginx)                         |
|  IP: 172.28.0.10 | Host Ports: 3000 (UI), 5000 (API & WebSockets)                 |
+-----------------------------------------------------------------------------------+
       │                                     │                              │
       │ /api/ & WebSockets                  │ Road Cache Stream            │ Shielded
       ▼                                     ▼                              ▼
+-----------------------+          +--------------------+        +------------------+
|  lan-guessr-backend   |          |  lan-guessr-redis  |        | lan-guessr-geo-db|
|  (Core Engine & Host) | <======> |  (Redis 7 Backbone)| <====> | (PostGIS 16)     |
|  IP: 172.28.0.11      |          |  IP: 172.28.0.15   |        | IP: 172.28.0.14  |
+-----------------------+          +--------------------+        +------------------+
```

| Service Name | Container Name | Internal IP | Exposed Host Port | Function |
| :--- | :--- | :--- | :--- | :--- |
| **`gateway`** | `lan-guessr-gateway` | `172.28.0.10` | `3000`, `5000` | Edge reverse proxy, UI static hosting, WebSocket ingress |
| **`backend`** | `lan-guessr-backend` | `172.28.0.11` | None | Game Engine, ECDH handshake, AES decryption, Lobby manager |
| **`redis-bus`** | `lan-guessr-redis` | `172.28.0.15` | None | Ephemeral lobby state, 8s host watchdog TTL, road image cache |
| **`geo-db`** | `lan-guessr-geo-db` | `172.28.0.14` | `5432` | PostGIS 16 preloaded with 10,050 curated global locations |

---

## 🚀 Quick Start (Docker Compose)

Make sure you have [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/) installed:

```bash
docker compose up --build -d
```

Services boot up automatically within seconds:
- **Game UI & Tactical Atlas**: `http://localhost:3000` or `http://<LAN_IP>:3000`
- **Edge API & WebSockets**: `http://localhost:5000` or `http://<LAN_IP>:5000`
- **PostGIS Spatial Database**: `localhost:5432` (10,050 locations ready)
- **Redis 7 In-Memory Backbone**: Internal cluster network (`172.28.0.15:6379`)

---

## 📱 How to Play on LAN

1. Launch the stack on the host machine (`docker compose up -d`).
2. Open `http://<HOST_LAN_IP>:3000` in any web browser.
3. Click **Create Squad Expedition** to generate a squad room and receive the host **Crown** 👑.
4. Friends on the same Wi-Fi network open `http://<HOST_LAN_IP>:3000`, browse the room list, and join.
5. In-memory ECDH key exchange establishes secure end-to-end encryption without transmitting symmetric keys.
6. The host configures match parameters (region, round count, scramble timer) and clicks **Commence Expedition**.

---

## 🧪 Zero-Trust Automated Verification Suite

Run the end-to-end security test suite to verify all cryptographic and zero-trust safeguards:

```bash
node backend/test/test-zero-trust-e2e.js
```

### Verified Security Guarantees:
- [x] **ECDH Key Exchange**: Zero symmetric keys transmitted across the wire.
- [x] **AES-256-GCM Ciphertext**: Guess coordinates strictly encrypted; zero plaintext coordinates in network frames.
- [x] **Centralized Media Proxy**: Images served from Redis; zero Google URLs or coordinate leaks.
- [x] **Host Heartbeat Watchdog**: Redis 8s TTL terminates rooms on host disconnect with zero room inheritance.
- [x] **Edge Gateway Ingress Isolation**: Direct access to internal microservice endpoints blocked.

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
