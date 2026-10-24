<div align="center">

# 🌍 GUESSIHA

**High-Stakes Real-Time Multiplayer Geography Battle & Exploration Engine**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg?style=for-the-badge)](LICENSE)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20Tailwind-cyan.svg?style=for-the-badge&logo=react)](frontend)
[![Backend](https://img.shields.io/badge/Backend-NestJS%20%7C%20Microservices-rose.svg?style=for-the-badge&logo=nestjs)](backend)
[![Realtime](https://img.shields.io/badge/Realtime-WebSockets%20%7C%20Redis-violet.svg?style=for-the-badge&logo=redis)](backend/game-engine)
[![Spatial](https://img.shields.io/badge/Spatial-PostgreSQL%20%7C%20PostGIS-emerald.svg?style=for-the-badge&logo=postgresql)](docker/init-geo-db.sql)

<br /><br />

<a href="#-tactical-interface-gallery">
  <img src="docs/screenshots/04-gameplay-recon.png" alt="Guessiha In-Game Recon" width="100%" style="border-radius: 10px;" />
</a>

<br /><br />

### 🎮 PLAY LIVE IN BROWSER
**Official Web Deployment**:
👉 **`[ LIVE WEBSITE LINK - WILL BE UPDATED HERE ]`** 👈

*Free. Zero-trust. No subscriptions, no ads, no installations required.*

---

</div>

## 🧭 The Mission

**Guessiha** drops operatives into high-resolution, 360° panoramic road environments across the globe. Inspect environmental cues—architecture, flora, sun angle, road markings, and driving side—to lock your coordinates on the tactical map before time runs out.

Built from the ground up for competitive multiplayer featuring zero-trust anti-cheat, democratic squad crowns, and sub-millimeter PostGIS spatial scoring.

---

## 📸 Tactical Interface Gallery

| Squad Briefing Lobby | Post-Round Precision Scoring |
| :---: | :---: |
| [![Squad Lobby](docs/screenshots/03-squad-lobby.png)](docs/screenshots/03-squad-lobby.png) | [![Round Standings](docs/screenshots/05-leaderboard-standings.png)](docs/screenshots/05-leaderboard-standings.png) |
| *Multiplayer staging with live operative readiness & crown leadership* | *PostGIS spatial distance evaluation, target reveal & live point distribution* |

| Main Operations Menu | Live Squad Browser |
| :---: | :---: |
| [![Main Menu](docs/screenshots/01-landing-screen.png)](docs/screenshots/01-landing-screen.png) | [![Squad Browser](docs/screenshots/02-squad-browser.png)](docs/screenshots/02-squad-browser.png) |
| *Fast dispatch terminal with quick play, feedback & creator links* | *Real-time room finder with 6-digit access codes & regional pools* |

---

## 🏛️ System Architecture

Guessiha is built as a distributed, event-driven microservices ecosystem orchestrated via containerized services:

```
                                  +-------------------+
                                  |   Web Browsers    |
                                  | (Desktop, Mobile) |
                                  +-------------------+
                                            |
                                    HTTP / WebSockets
                                            v
+---------------------------------------------------------------------------------------+
|                                  API Gateway Proxy                                    |
|                      Reverse Proxy, Ingress & Feedback Dispatcher                     |
+---------------------------------------------------------------------------------------+
             |                                 |                                |
             | WebSockets / Live Rounds        | REST / Room Lifecycle          | Panoramas & Imagery
             v                                 v                                v
+--------------------------+     +--------------------------+     +---------------------+
|       Game Engine        |     |      Lobby Service       |     |     Road Proxy      |
| Match State, Scoring &   |     | Room Creation, Join,     |     | Panorama Caching &  |
| Anti-Cheat Evaluation    |     | Heartbeats & Capacity    |     | Metadata Stripping  |
+--------------------------+     +--------------------------+     +---------------------+
             |                                 |                                |
             +---------------------------------+--------------------------------+
                                               |
                                    Internal Pub/Sub Events
                                               v
+----------------------------------------------+        +-------------------------------+
|                    Redis                     |        |          PostGIS DB           |
|         In-Memory Event Bus & Cache          | <====> |    PostgreSQL 16 + PostGIS    |
|         State Coordination Engine            |        |    10,000+ Curated Locations  |
+----------------------------------------------+        +-------------------------------+
```

### Microservices Specifications

| Service | Technology | Role |
| :--- | :--- | :--- |
| **API Gateway** | NestJS / Reverse Proxy | Edge entry point routing HTTP requests, WebSocket connections, and external Telegram feedback webhooks. |
| **Lobby Service** | NestJS / TypeScript | Room registry managing room codes, player capacities, password protection, and host status. |
| **Game Engine** | NestJS / WebSockets | Authoritative game state machine evaluating guesses, managing timers, calculating distances, and broadcasting scores. |
| **Road Proxy** | NestJS / Image Stream | Media proxy and tile caching layer that strips GPS metadata from imagery to guarantee zero-leak gameplay. |
| **Redis** | Redis 7 | In-memory message broker for inter-service communication and transient room state. |
| **Spatial DB** | PostgreSQL 16 + PostGIS | Geodatabase storing curated global coordinates and spatial features for procedural round generation. |

---

## 🛠️ Technology Stack

- **Client Application**: React 19, TypeScript, Tailwind CSS v4, Leaflet Map Engine, Vite
- **Backend Services**: NestJS, WebSockets, RxJS, Node.js
- **Database & Messaging**: PostgreSQL with PostGIS extension, Redis In-Memory Bus
- **Security & Integrity**: HMAC token validation, Zero-Trust GPS metadata isolation
- **Infrastructure**: Docker Compose, Multi-stage builds, Nginx reverse proxy

---

## 🚀 Quick Start / Cloud Deployment

Deploy Guessiha on any Linux server, VPS (AWS EC2, Lightsail, Hetzner, Oracle), or local machine using Docker:

### 1. Clone & Configure
```bash
git clone https://github.com/mhmdMnwr/free_local_geoguesser.git
cd free_local_geoguesser
cp .env.example .env
```

*(Edit `.env` to set your desired passwords and secrets, or use defaults for local play).*

### 2. Launch Services
```bash
docker compose up -d
```

### 3. Play
Open your browser and navigate to:
- **Production / Cloud**: `http://YOUR_SERVER_IP/`
- **Local Development**: `http://localhost:3000/`

---

## 👨‍💻 Creator & Developer

Created and maintained by **Mohammed Menouer Ameur**.

- **GitHub**: [@mhmdMnwr](https://github.com/mhmdMnwr)
- **LinkedIn**: [Mohammed Menouer Ameur](https://www.linkedin.com/in/mohammed-menouer-ameur-a0448a334)
- **Telegram**: [@MnwrAmeur](https://t.me/MnwrAmeur)

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** — see the [LICENSE](LICENSE) file for complete details.

Copyright © 2026 **Mohammed Menouer Ameur**. All rights reserved.
