# THEgeogusser

THEgeogusser is an open-source game inspired by GeoGuessr that can be played locally.

Players are placed in real-world street and road panoramas across the globe, inspect environmental clues, and place pins on a world map to guess their location. Scores are calculated in real time based on distance accuracy and speed.

---

## System Design

THEgeogusser is built on a modular microservices architecture running in containerized environments. Services communicate over an internal network with dedicated responsibilities.

```
                                  +-------------------+
                                  |   Web Browsers    |
                                  | (Desktop, Mobile) |
                                  +-------------------+
                                            |
                                  Ports 3000 / 5000
                                            v
+---------------------------------------------------------------------------------------+
|                                        Gateway                                        |
|                       Nginx Reverse Proxy & Static UI Hosting                         |
+---------------------------------------------------------------------------------------+
             |                                 |                                |
             | WebSockets / API                | HTTP Ingress                   | Media Streaming
             v                                 v                                v
+--------------------------+     +--------------------------+     +---------------------+
|       Game Engine        |     |      Lobby Service       |     |     Road Proxy      |
| Match State & WebSockets |     | Room Lifecycle & Auth    |     | Road Stream & Cache |
| Port 5002                |     | Port 5001                |     | Port 5003           |
+--------------------------+     +--------------------------+     +---------------------+
             |                                 |                                |
             +---------------------------------+--------------------------------+
                                               |
                                    Pub/Sub & State Messages
                                               v
+----------------------------------------------+        +-------------------------------+
|                    Redis                     |        |          PostGIS DB           |
|         In-Memory Event Bus & Cache          | <====> |    PostgreSQL 16 + PostGIS    |
|         Port 6379                            |        |    10,000+ Curated Locations  |
+----------------------------------------------+        +-------------------------------+
```

### Services Overview

| Service | Internal Port | Description |
| :--- | :--- | :--- |
| **Gateway** | 3000, 5000 | Entry point reverse proxy (Nginx). Serves the frontend application and routes WebSocket and REST traffic to downstream microservices. |
| **Lobby Service** | 5001 | Manages room creation, joining, player capacity limits, host heartbeats, and room lifecycles. |
| **Game Engine** | 5002 | Real-time game state machine. Handles rounds, timers, coordinate guess evaluations, distance scoring, and live standings. |
| **Road Proxy** | 5003 | Handles road panoramas and street imagery caching to serve clients smoothly without leaking coordinate metadata. |
| **Redis** | 6379 | In-memory message broker for inter-service communication, pub/sub events, and ephemeral session state. |
| **PostGIS DB** | 5432 | Spatial database storing thousands of verified global coordinate points for match generation. |

---

## Quick Start

### Prerequisites
- Docker and Docker Compose installed on your host system.

### Running Locally

1. Clone the repository and navigate into the project directory:
   ```bash
   git clone https://github.com/your-username/free_local_geoguesser.git
   cd free_local_geoguesser
   ```

2. Start all services using Docker Compose:
   ```bash
   docker compose up --build -d
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
   To play with other devices on your local network, replace `localhost` with your machine's local IP address (e.g., `http://192.168.1.50:3000`).

### Stopping the Services

To shut down all containers:
```bash
docker compose down
```

---

## License

This project is open source and available under the [MIT License](LICENSE).
