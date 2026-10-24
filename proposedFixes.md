# free_geoGuesser: Security and Logic Fix List

**Repo:** `mhmdMnwr/free_geoGuesser` (NestJS 11 + Socket.IO backend, React 19/Vite frontend, nginx gateway, Redis, PostGIS)
**Audience:** a coding agent that will edit the repo.
**Scope:** code and config in the repo only. Hosting and cloud deployment are out of scope.
**Date of review:** 2026-10-22

The repo was written for a trusted LAN. Its identity model, trust in client input and "no external dependencies" assumptions do not hold for a game that strangers can reach. This file lists what to change so the code has no known security holes and the game logic is correct.

**How each finding is labelled**

- **Verified** means the behaviour was reproduced by running code.
- **From code** means it was read in the source but not run. Reproduce it before fixing and say so in the commit.

---

## 0. How to work

1. Work on a branch. Do not push to `main` without the owner's approval.
2. Make one commit per numbered item (A1, A2, B1, ...). Keep diffs minimal and do not reformat unrelated code.
3. Before starting, run the build in `backend/` and `frontend/` (`npm run build`) and note which scripts in `backend/test/` pass. After each item, run them again. Many existing tests rely on the insecure behaviour described here (IP identity, the legacy single room, the unauthenticated internal endpoint). When a test must change, change it and explain why in the commit message.
4. Never commit secrets or `.env` files. Do not commit `package-lock.json` changes that come only from running `npm install`.
5. Items marked **DECISION** need an answer from the owner. Ask. Do not guess.
6. Suggested order: A1, A2, A3 together (they share one new identity model), then A4 to A8, then B1 to B6, then B7 and the rest.

**Dependency scan:** `npm audit --omit=dev` reports 0 vulnerabilities in both `backend/` and `frontend/` as of this review. Re-run it at the end.

## Priority overview

| ID | Area | Severity | One-line summary |
| --- | --- | --- | --- |
| A1 | Security | Critical | Player identity is chosen by the client, so anyone can impersonate the host |
| A2 | Security | Critical | Several socket events have no authorization, and the room is taken from client input |
| A3 | Security | High | IP address is used as identity, comes from spoofable headers, and is shown to other players |
| A4 | Security | High | Internal ports published, unused internal endpoint, info endpoints leak internals |
| A5 | Security | High | Secrets committed in the repo, insecure fallback secret |
| A6 | Security | High | No limits on rooms, players, input sizes or request rates |
| A7 | Security | Medium | CORS allows every origin with credentials |
| A8 | Security | Medium | Host-supplied image URLs and the Google iframe leak data or help cheating |
| B1 | Logic | Critical | Guess encryption keys differ between browser and server, so encrypted guesses cannot be decrypted |
| B2 | Logic | High | Looking up a room that does not exist silently returns the default room |
| B3 | Logic | High | The UI marks a guess as locked before the server confirms it |
| B4 | Logic | High | A short network drop deletes a player and their score; the host rule is fragile |
| B5 | Logic | Medium | A round where nobody guesses never ends |
| B6 | Logic | Medium | Round-end logic is not safe to run twice; async errors are not handled |
| B7 | Logic | Medium | Two parallel join/create paths and a legacy single-room mode |
| B8 | Logic | Medium | Room rules are incomplete (player cap, duplicate names, joining mid-match) |
| B9 | Logic | Low | Location pool silently widens, and locations can repeat |
| B10 | Logic | Critical | Rounds appear to show a generated placeholder instead of real imagery (DECISION) |
| B11 | Logic | Low | The anti-cheat check is meaningless as written |
| C | Hygiene | Low | Docker, lockfile, assets, README |
| D | Tests | n/a | Tests to add and a final acceptance checklist |

---

# Part A: Security

## A1. Player identity is chosen by the client (session hijack). Critical

**Problem (from code)**

- `backend/src/game/game.helpers.ts`, `getClientId()` returns whatever `clientId`, `sessionToken` or `mockIp` the client puts in the Socket.IO query or auth. There is no check that the caller owns that ID.
- The frontend creates the ID itself: `frontend/src/App.tsx` around line 1233 builds `op_` plus 8 random characters and stores it in `sessionStorage`.
- `GameService.getLobbyPlayers()` sends every player's `id` to everyone in the room, so any player can read the host's ID and connect with it. `handleConnection` then rebinds that player (and the host role) to the attacker's socket.
- `mockIp` is accepted as an identity in `getClientId()` with no `NODE_ENV` check at all.

**Fix**

1. Give every player two values, created on the server when they create or join a room:
   - `id`: a public random identifier (for example 16 hex characters). It may appear in broadcasts.
   - `secret`: a private random token from `crypto.randomBytes(24).toString('hex')`. It is returned only to that player, only once, and never appears in any broadcast, log line or list.
2. Store the `secret` on the server player record (the `Player.sessionToken` field in `game.types.ts` can be reused or renamed).
3. The client connects to Socket.IO anonymously first (it may list lobbies). `create_lobby` and `join_lobby` return `{ playerId, secret }` to that socket. The client keeps them in `sessionStorage` and sends them in the Socket.IO `auth` object on every later connection.
4. Replace `getClientId()` with an `authenticate(socket)` step in `handleConnection`. It compares the secret with `crypto.timingSafeEqual`. On success it sets `socket.data.playerId`. On failure the socket stays anonymous and cannot use any in-room event.
5. Every handler gets its player from `socket.data.playerId`, never from `data`, the query string or the IP.
6. Remove the `mockIp` identity branch. If tests need a fake identity, create real players through the normal flow.
7. Stop generating `op_...` IDs in `App.tsx`, and store what the server returns.

**Done when:** a second socket that connects with the host's public `id` but without the host's `secret` cannot start, stop or change anything, and does not replace the host's socket.

## A2. Missing authorization on socket events. Critical

**Problem (from code)**

- `GameGateway.resolveRoom(socket, data)` returns the room named in `data.roomId` first, with no check that the caller is in that room.
- `next_round` (`handleNextRound`) and `reset_to_lobby` (`handleResetToLobby`) have no host check at all. Any client can send `{ roomId: "<any room>" }` to advance rounds or wipe a match for everyone.
- `POST /api/lobbies/:id/heartbeat` in `info.controller.ts` accepts `hostId` from the request body. `recordHostHeartbeat` also accepts `room.hostIp === hostId`, and the host IP is public (see A3), so anyone can keep a room alive forever.

**Fix**

1. `resolveRoom` must use only the room the authenticated player is in (store `roomId` on the player or keep a `Map<playerId, roomId>`). Ignore `data.roomId`, or reject it if it differs.
2. Host-only events: `start_game`, `stop_game`, `next_round`, `reset_to_lobby`, `set_*`, `transfer_host`, `host_share_image` (if kept). Check `player.id === room.hostId`.
3. Member-only events: `lock_guess`, `update_pin`, `leave_*`, `join_game`.
4. Delete the REST heartbeat endpoint and the `host_heartbeat` socket event as part of B4. If anything keeps it, require the player's secret.
5. Add one helper such as `requireHost(socket)` and `requireMember(socket)` so the checks are not copy-pasted ten times.

**Done when:** a player in room X cannot affect room Y, and a non-host cannot call `next_round`, `reset_to_lobby` or any `set_*` event in their own room.

## A3. IP address is used as identity, is spoofable, and is exposed. High

**Problem (from code)**

- `getClientIp()` and `getReqClientIp()` in `game.helpers.ts` trust `cf-connecting-ip`, then the first entry of `x-forwarded-for`, from any client. Both headers can be forged.
- Many host checks accept `ip === room.hostIp` on its own: `handleHostShareImage`, `handleTransferHost`, `handleLeaveGame`, `handleJoinGame` in `game.gateway.ts`, and `startGame` and `stopGame` in `game.service.ts`.
- Players behind one NAT or mobile carrier share an IP. `findRoomByPlayer(ip)` and `room.players[ip]` then mix different people up.
- IP addresses are sent to every player: `getLobbyPlayers()` returns `ip`, round results include `ip`, `player_guessed` includes `ip`, and `lobby_update` includes `pendingAdmissions` with each applicant's `ip` and `socketId`. `hostIp` is public in `GET /api/lobbies`.

**Fix**

1. Remove every `ip === room.hostIp`, `senderId === targetRoom.hostIp` and `players[ip]` lookup. Authorization uses player `id` from A1 only.
2. Remove `ip` and `hostIp` from every payload sent to clients (lobby list, lobby update, results, leaderboards, player events). Update `App.tsx` to use `hostId` and the `isHost` flag instead of comparing IPs.
3. Keep the client IP only for logging and rate limiting. Configure Express with `trust proxy` set to the exact number of proxy hops in front of the backend, and read `req.ip`. Stop reading `cf-connecting-ip` unless the app really sits behind Cloudflare.
4. In `frontend/nginx.conf`, replace `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` with `proxy_set_header X-Forwarded-For $remote_addr;` in both the `/api/` and `/socket.io/` blocks, so a client cannot append to or choose the value.

**Done when:** a request carrying a forged `X-Forwarded-For` or `cf-connecting-ip` header does not change who the server thinks the caller is, and a search of the repo finds no `hostIp` or player `ip` in any payload sent to clients.

## A4. Published ports, an unused internal endpoint, and information endpoints. High

**Problem (from code)**

- `docker-compose.yml` publishes `5000:5000` (backend) and `5432:5432` (Postgres) to the host. Neither needs to be reachable from outside.
- `POST /internal/cache-road` (`road-proxy.controller.ts`) is protected by an HMAC signature, but nothing calls it. `GameService.startRound()` calls `RoadProxyService.cacheRoadForTarget()` directly, in process. The only caller found in the repo is a test that checks it returns 401.
- `GET /api/info` returns the container's network addresses and a `joinUrl`. `GET /api/status` returns `hostIp`, room counts and game state. The UI does not need either on a public site.

**Fix**

1. Remove the `ports:` entries for `backend` and `geo-db` in `docker-compose.yml`. Only the gateway should have a published port.
2. Delete the `/internal/cache-road` endpoint, `InternalAuthGuard`, `signInternalRequest` and `verifyInternalRequest`, the `INTERNAL_CLUSTER_SECRET` variable, and update `test-zero-trust-e2e.js` (it asserts the 401). This removes an attack surface and a secret.
3. `GET /api/info`: remove it, or return only static, non-sensitive values. In `App.tsx` (around lines 1340-1347) show `window.location.host` instead of `primaryIp`.
4. `GET /api/status`: remove it, or limit it to `{ ok: true }`.
5. In `nginx.conf`, add `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Frame-Options: SAMEORIGIN` for the UI (the uplink iframe is same-origin; see A8).

**Done when:** `docker compose config` shows host ports only for the gateway, and `/internal/cache-road`, `/api/info` and `/api/status` no longer expose internals.

## A5. Secrets committed to the repo. High

**Problem (from code)**

- `docker-compose.yml` contains `POSTGRES_PASSWORD: geopassword`, the same password inside `DATABASE_URL`, and `INTERNAL_CLUSTER_SECRET: lan_guessr_cluster_secret_e9f3b8a1`.
- `internal-auth.guard.ts` falls back to `lan_cluster_default_secret_2026` when the variable is missing.
- Everything in git history is public, so these values are compromised and must be rotated, not just moved.

**Fix**

1. After A4 removes the internal endpoint, the cluster secret disappears. For the database, read the password from the environment: `${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}` in compose (the `:?` form makes compose fail fast when it is missing).
2. Add `.env.example` with placeholder values and put `.env` in `.gitignore`.
3. Generate a new password (`openssl rand -hex 32`) and do not reuse the old one anywhere.
4. **Gotcha:** `POSTGRES_PASSWORD` only takes effect when the data volume is first created. For an existing volume, run `ALTER USER geoguessr PASSWORD '...'` or recreate the volume (the data is rebuilt from `docker/init-geo-db.sql`).
5. Search the whole repo, including tests, for `geopassword` and the old secret strings.

**Done when:** a repo-wide search finds none of the old secrets, and compose refuses to start without `.env`.

## A6. No limits on rooms, players, input or request rate. High

**Problem (from code)**

- The `rooms` Map in `GameService` has no size limit, and `POST /api/lobbies` and the socket events have no throttling.
- `maxPlayers` (8) is stored on each room but not enforced in `joinLobbyRest` or `handleJoinLobby`.
- Room creation (`createLobbyRest`, `handleCreateLobby`) accepts `rounds`, `duration`, `region` and `difficulty` without validation. Only the later `set_*` handlers check ranges. Room names and usernames are length-limited only in the legacy `set_username` handler.
- Socket.IO uses its default message size limit.

**Fix**

1. Cap the number of rooms (configurable, default 100) and reject creation beyond it.
2. Enforce `maxPlayers` in every join path.
3. Validate on every entry point, using one shared validation function: username and room name (trim, 2 to 18 characters for names, strip tags and control characters), `rounds` (3 to 20), `duration` (5 to 120), `difficulty` (`all`, `easy`, `medium`, `hard`) and `region` (a whitelist built from the dataset).
4. Add rate limiting: `@nestjs/throttler` for REST, and a small per-socket event limiter for Socket.IO (for example 20 events per second per socket, configurable). Consider a per-IP connection cap, but note that players behind one NAT share an IP, so make it generous.
5. Set `maxHttpBufferSize` on the Socket.IO server to a small value (16 KB is enough for all current events if `host_share_image` is removed or restricted; see A8).
6. Note: the database queries in `geo-database.service.ts` already use parameters, which is correct. Keep it that way.

**Done when:** creating rooms past the cap, joining a full room, or sending out-of-range or oversized values is rejected with a clear error, and repeated rapid requests are throttled.

## A7. CORS allows every origin with credentials. Medium

**Problem (from code):** `backend/src/main.ts` uses `origin: '*'` with `credentials: true`, and `game.gateway.ts` uses `cors: { origin: '*' }`.

**Fix:** The UI and API share one origin through nginx, and the Vite dev server proxies the same way, so cross-origin access is not needed. Set `origin: false` (or remove CORS) in both places. If a separate origin is ever needed, read an explicit allow-list from an environment variable.

**Done when:** a request from another origin gets no CORS headers, and the app still works in development and in the container setup.

## A8. Host-supplied images and the Google iframe. Medium

**Problem (from code)**

- `host_share_image` accepts any `http(s)` URL or a `data:image/` string, up to 7 MB, and broadcasts it to the room. If the frontend renders it, every player's browser contacts a URL chosen by the host, which leaks their IP address. (The size check is also above the default Socket.IO buffer, so large payloads are already rejected, but the code suggests otherwise.)
- `streetview.controller.ts` builds a Google Maps embed URL containing the target coordinates, hides it with an XOR key that is sent in the same page, and decides who may load it by (spoofable) IP. Any player can recover the coordinates and cheat.

**Fix**

1. Check whether the frontend uses `shared_image_updated`. If not, delete `host_share_image`. If yes, allow only `data:image/png`, `jpeg` or `webp` up to a small size (for example 200 KB) and never remote URLs.
2. The iframe path is only reached when no road token exists, which does not happen in normal play (see B10). Whatever the owner decides in B10, remove the XOR obfuscation and never send target coordinates to the client before the round results.

**Done when:** no payload sent before `round_results` contains the target latitude or longitude, and no player-controlled URL is loaded by other players' browsers.

---

# Part B: Logic

## B1. Guess encryption keys differ between browser and server. Critical (Verified)

**Problem**

- Server (`crypto.service.ts`, `deriveSharedKey`) computes the ECDH secret and then hashes it with SHA-256 to get the AES key.
- Browser (`frontend/src/crypto-client.ts`, `deriveAesGcmKey`) uses WebCrypto `deriveKey` directly, which uses the raw shared secret with no hashing.
- **Verified:** a Node script that runs the browser-style WebCrypto code and the real backend `CryptoService` produced two different 256-bit keys, and the server failed to decrypt the browser's ciphertext (`Unsupported state or unable to authenticate data`).
- **From code:** when the browser has WebCrypto (HTTPS, and also `localhost`), `handleLockGuess` in `App.tsx` encrypts the guess. The server fails to decrypt it, sends `Decryption failed: integrity compromised`, and returns without locking the guess. When WebCrypto is not available (plain HTTP on a LAN address), the code silently falls back to plain coordinates, which is why this may not have been noticed. Reproduce it in a real browser on `localhost`.
- The existing end-to-end test does not catch this because it does not use browser-style WebCrypto on the client side.

**Fix. DECISION between two options (the owner should pick; option 1 is recommended)**

1. **Remove the application-level encryption** (recommended). ECDH here is unauthenticated, so it cannot stop an active attacker, and TLS already protects traffic. Delete `crypto-client.ts`, the ECDH and AES methods in `CryptoService`, `performEcdhHandshake`, the `aesKey`, `serverPrivateKey` and related fields on `Player`, the `encryptedGuess` branch in `lock_guess`, and the ECDH parts of the tests. Send `{ lat, lng }` plainly and validate it on the server. Correct the README, which currently promises that raw coordinates never cross the network.
2. **Keep it and fix the mismatch.** Make both sides derive the same key, for example by having the server use the raw 32-byte `computeSecret` result as the AES key (no SHA-256), or by having the client run `deriveBits` and hash the result with SHA-256 before `importKey`. Add a test that uses Node's `globalThis.crypto.subtle` to behave like the browser against the real `CryptoService`, so this cannot regress. If this option is chosen, the fallback to plaintext must also be removed or the feature gives a false sense of security.

**Done when:** a guess locked from a real browser on `localhost` and over HTTPS is accepted and scored, and a test covers the browser/server round trip (option 2) or the encryption code is gone (option 1).

## B2. `getRoom()` falls back to the default room. High

**Problem (from code):** `GameService.getRoom(roomId)` returns `this.state` (the default `LAN-01` room) when the ID is unknown. Callers that check `if (!room)` never see a missing room: `joinLobbyRest` and `handleJoinLobby` ("Lobby not found" can never trigger), `handleLeaveLobby`, and `StreetViewController`. Joining a room that was just disbanded puts the player into `LAN-01`.

**Fix:** Make `getRoom()` return `undefined` for unknown IDs. Add a separate explicit accessor if the default room is still needed (see B7). Update every caller to handle the missing case with a clear error (`Expedition room not found`).

**Done when:** joining, leaving or looking up a room that does not exist returns a "not found" error and never touches another room.

## B3. The UI locks the guess before the server confirms. High

**Problem (from code):** `handleLockGuess` in `App.tsx` emits `lock_guess` and then immediately runs `setHasGuessed(true)`. If the server rejects the guess (decryption failure, round over, validation), the user only sees an alert while the UI still shows "guessed" and the pin can no longer be changed.

**Fix:** Use a Socket.IO acknowledgement. The server's `lock_guess` handler returns `{ ok: true }` or `{ ok: false, error }`. The client sets `hasGuessed` only on `ok: true`, and on failure shows the error and lets the player try again. Replace the blocking `alert()` calls with an inline message.

**Done when:** a rejected guess leaves the UI in the "not guessed" state and the player can retry.

## B4. Disconnect handling and the host rule. High

**Problem (from code)**

- `handleDisconnect` in `game.gateway.ts` deletes a non-host player immediately through `finalizePlayerDisconnect`, so a one-second network drop on a phone erases their score. Only the host gets a grace period.
- A host disconnect longer than 8 seconds disbands the whole room. Host liveness is also tracked by a heartbeat timer in the browser (every 2.5 seconds, 8-second Redis TTL, checked by a 2-second watchdog). Browsers throttle timers in background tabs, and phones suspend pages when the user switches apps, so a host who leaves the tab for a moment can lose the room. Socket.IO already has its own ping (`pingInterval: 5000`, `pingTimeout: 7000`), which makes the extra heartbeat redundant.

**Fix**

1. Apply one grace window to all players (for example 30 seconds, configurable): on disconnect, mark the player as disconnected and keep their score; remove them only if they do not reconnect in time. Use a timer map keyed by player `id`.
2. Remove the client heartbeat (`host_heartbeat`, the REST heartbeat and the `App.tsx` interval) and the Redis host-heartbeat key and watchdog. Use the socket connection state instead.
3. **DECISION (small):** when the host is gone past the grace window, promote another connected player (the existing `ensureActiveHost` already does this) instead of disbanding. Disband only when the room is empty. The README currently promises "disband the room"; update it to match whichever behaviour the owner chooses.

**Done when:** a player who drops and reconnects within the grace window keeps their score, and a host who briefly backgrounds the tab does not destroy the room.

## B5. A round where nobody guesses never ends. Medium

**Problem (from code):** The round goes from `ROUND_ACTIVE` to `ROUND_COUNTDOWN` only when the first player locks a guess. If nobody does, there is no timer, and `next_round` works only from `ROUND_RESULTS`, so the room is stuck until the host stops the whole game.

**Fix:** Add a maximum round time (for example 120 seconds by default, host-configurable from 30 to 300, or 0 for no limit). Start a timer in `startRound` and call `endRound` when it expires. Clear it in `endRound`, `stopGame`, `resetToLobby` and `deleteRoom`. Optionally add a host "end round now" action.

**Done when:** a round with no guesses ends by itself, and players without a locked pin get zero points.

## B6. Round-end logic can run twice; async errors are dropped. Medium

**Problem (from code)**

- `endRound` does not check the room status. If it runs a second time (countdown expiry racing with all players guessing, or future timers from B5), every player's `totalScore` is added twice.
- `startGame` and `nextRound` call the async `startRound` without `await` or error handling, so a failure becomes an unhandled promise rejection and `startGame` reports success regardless.
- If the selected location list is shorter than `totalRounds`, a later `roundTarget` can be `undefined`, and `endRound` returns early after already setting the status to `ROUND_RESULTS`, leaving the room stuck.

**Fix**

1. Guard `endRound`: return immediately unless the status is `ROUND_ACTIVE` or `ROUND_COUNTDOWN`, and set the status before doing anything else.
2. `await` `startRound` in `startGame` and `nextRound`, and catch and report errors to the room.
3. In `startGame`, if fewer locations than rounds are available, lower `totalRounds` to what exists and tell the host, instead of failing mid-match. When `roundTarget` is missing, finish the game cleanly.

**Done when:** calling `endRound` twice scores once, and a failure in `startRound` produces an error message and not a stuck room.

## B7. Two parallel code paths and a legacy single-room mode. Medium (do this late)

**Problem (from code)**

- Rooms are created and joined through both REST (`POST /api/lobbies`, `POST /api/lobbies/join` in `info.controller.ts`) and Socket.IO (`create_lobby`, `join_lobby`). The REST handlers create players with server-made IDs such as `client_...`, while sockets use the ID the browser sends, so the same person can end up with two identities. Check how `App.tsx` reconciles them (around lines 1493 and 1564).
- A legacy single-room mode is still active: the default `LAN-01` room, `set_username`, `decide_admission`, `cancel_admission`, `pendingAdmissions`, and many handlers that fall back to `gameService.state`. Players are looked up by `clientId`, `ip`, `socketId` and `sessionToken` interchangeably, and `findRoomByPlayer` scans every room and player on each event.

**Fix**

1. Pick Socket.IO as the single way to create and join rooms and remove the REST create, join and heartbeat endpoints. Keep `GET /api/lobbies` as a read-only list (with the fields trimmed per A3).
2. Remove the legacy `LAN-01` default room, the `state` getter fallback, `set_username`, the admission flow and `pendingAdmissions`, and the code that keys players by IP.
3. Index players by their `id` with a `Map<playerId, roomId>` so lookups are direct.
4. Rewrite the tests in `backend/test/` that depend on the legacy flow.

**Done when:** there is exactly one way into a room, each person has exactly one identity, and no handler falls back to a default room.

## B8. Room rules are incomplete. Medium

**Problem (from code)**

- `handleJoinLobby` and `joinLobbyRest` have no status check, so a player can join a running round with `inGame: true`. They then count toward `checkAllGuessed`, which can hold up everyone.
- Duplicate usernames are only rejected in the legacy `set_username` flow.
- `maxPlayers` is not enforced (also in A6).
- `GET /api/lobbies` lists every room, including full and in-progress ones. Room IDs are `LAN-` plus 2 or 3 digits, which is easy to guess.

**Fix**

1. **DECISION:** either block joining once a match has started, or let late joiners in as spectators (`inGame: false`) until the next round. Block is simpler.
2. Reject duplicate usernames within a room, case-insensitively.
3. Enforce `maxPlayers`.
4. In the lobby list, show only rooms that are joinable, or mark full and in-progress rooms clearly.
5. Optional: add private rooms with a longer random code that are not listed.

**Done when:** a full or running room cannot be joined, and two players cannot share a name in one room.

## B9. The location pool silently widens, and locations can repeat. Low

**Problem (from code):** In `startGame`, if the region and difficulty selection has too few locations, the code quietly falls back to all difficulties and then to all regions, so the host's settings are ignored without a message. Locations can also repeat across consecutive matches in the same room. The same 10,050 locations exist twice (`backend/data/locations.json` and `docker/init-geo-db.sql`) and can drift apart.

**Fix:** Tell the host when the pool was widened (or reduce the rounds). Remember recently used locations per room and avoid them. Keep one source of truth: generate the SQL from the JSON in a script, or drop one of them (see Part C).

## B10. Rounds appear to show a generated placeholder, not real imagery. Critical (DECISION)

**Problem (from code)**

- `GameService.startRound()` always calls `RoadProxyService.cacheRoadForTarget()`, which stores an SVG and returns a road token.
- `generateTacticalRoadSvg(lat, lng, label)` uses the coordinates only to choose one of five colour palettes. The picture is otherwise the same every time.
- `App.tsx` (around lines 905-920) shows `/api/media/road/<token>` whenever a token exists, and only uses the Google iframe when it does not. In normal operation the token always exists.
- The README promises "high-resolution road panoramas".
- **Reproduce first:** run the game locally with two browser tabs, start a match, and record what is shown in rounds 1 to 3.

**Options. DECISION for the owner**

| Option | Pros | Cons |
| --- | --- | --- |
| A. Google Maps Embed or Street View with an API key | Real panoramas; official | Needs an API key and billing; coordinates sit in the iframe URL where players can read them |
| B. Mapillary images fetched on the server and served through the existing `/api/media/road` proxy | Fits the current design; coordinates never reach clients | Needs a free token; coverage differs from the current 10,050 locations, so each must be re-validated |
| C. Keep the placeholder | Nothing to build | It is not a geography game; demo only |

**If A or B:** replace the SVG generator with a real image fetch, store the bytes in Redis under the same token, set the correct `Content-Type` (it is hard-coded to `image/svg+xml`), handle fetch failures by choosing another location, and remove `streetview.controller.ts`. **If C:** change the README wording and call it a demo mode.

## B11. The anti-cheat check is meaningless as written. Low

**Problem (from code):** `handleLockGuess` penalises a guess that is within 0.0000001 degrees of the target by adding a random offset. A real player will almost never hit that, and a cheater who knew the target would simply add a small error.

**Fix:** The real protection is never sending the target before the results (see A8). Replace this check with an automated test that every payload sent before `round_results` (including `rejoin_match` and `round_started`) contains no target coordinates, then remove the random-offset code.

---

# Part C: Hygiene

- **Docker builds:** use `npm ci` instead of `npm install` in `backend/Dockerfile` and `frontend/Dockerfile`. Run the final backend image as the non-root `node` user.
- **`.dockerignore`:** the file at the repo root does not apply to the `./frontend` and `./backend` build contexts (compose uses those folders as contexts). Add one inside each folder with `node_modules`, `dist`, `.env` and `npm-debug.log`.
- **Lockfiles:** `frontend/` has both `package-lock.json` and `pnpm-lock.yaml` but the Dockerfile uses npm. Keep one and delete the other.
- **Dependencies:** `@types/ioredis` in `backend/package.json` is probably obsolete (ioredis ships its own types). Check and remove it if the build still passes. Re-run `npm audit --omit=dev` at the end.
- **External assets:** the UI loads Google Fonts (`frontend/src/index.css` line 1), two Unsplash background images (lines 1325 and 2703), and CARTO map tiles (`App.tsx` line 233). Self-host the fonts and images so the page works without third parties, and check the map tile provider's terms for public use (keep the attribution).
- **Package metadata:** `frontend/package.json` is named `internship-researcher`, and the frontend folder contains Figma Make scaffolding (`.figma/`, `AGENTS.md`, `CLAUDE.md`). The production build already excludes the dev-only plugins. Rename the package, and remove the scaffolding only if the owner agrees.
- **Optional simplification:** PostGIS only runs a filtered `SELECT`, and the backend falls back to `locations.json` when the database is unreachable. Redis also has an in-memory fallback. Once B4 removes the Redis heartbeat, consider dropping both services to reduce moving parts. This was not tested; do it last and run the full test suite and a manual game afterwards.
- **README:** make it match reality. Remove the claims that no raw coordinates cross the network and that there are no external dependencies, describe the real imagery source (B10), the real host-leaves behaviour (B4), and how to run the project with a `.env` file.

---

# Part D: Tests and acceptance

## Tests to add or update

1. **Identity (A1):** a second socket using the host's public `id` without the `secret` is rejected and cannot use any in-room event.
2. **Authorization (A2):** a non-host calling `next_round`, `reset_to_lobby`, `start_game`, `stop_game` or any `set_*` event gets an error and nothing changes. A player in room X cannot affect room Y by passing its ID.
3. **Header spoofing (A3):** forged `X-Forwarded-For` and `cf-connecting-ip` headers do not change the caller's identity. No payload to clients contains a player `ip` or `hostIp`.
4. **Limits (A6):** creating rooms past the cap, joining a full room, invalid or oversized fields, and rapid repeated requests are all rejected.
5. **No target leak (A8, B11):** every payload before `round_results` has no target latitude or longitude.
6. **Crypto (B1):** a browser-style client (Node `globalThis.crypto.subtle`) and the backend agree, or the encryption code is removed.
7. **Rooms (B2, B8):** unknown room IDs return "not found"; duplicate names, full rooms and joining mid-match are rejected.
8. **Rounds (B5, B6):** a round with no guesses ends on the timer, and `endRound` called twice scores once.
9. **Reconnect (B4):** a player who reconnects within the grace window keeps their score.

## Final acceptance checklist

- [ ] `npm run build` passes in `backend/` and `frontend/`, and `npm audit --omit=dev` reports no high or critical issues.
- [ ] Every test in `backend/test/` passes, or has a documented and justified update.
- [ ] A repo-wide search finds none of: `geopassword`, `lan_guessr_cluster_secret_e9f3b8a1`, `lan_cluster_default_secret_2026`, `mockIp` (outside of removed code), `hostIp` in any client payload, `ip === room.hostIp`.
- [ ] `docker compose config` shows no published ports except the gateway, and compose refuses to start without `.env`.
- [ ] A full two-player match works end to end from two real browsers, including guesses locked on `localhost`.
- [ ] The owner answered each DECISION (B1, B4 host rule, B8 late joiners, B10 imagery) and the code and README match the answers.
- [ ] No `.env` file and no unintended lockfile changes in the commits.

**Final report from the agent:** list each item (A1 to D) with its commit, anything skipped and why, and every open DECISION.