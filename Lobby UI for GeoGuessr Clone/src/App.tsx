import { useState } from "react"

const ButtonElement = "button"

type ConnectionMode = "lan" | "web"
type Screen = "select" | "browser" | "lobby" | "game"
type Room = {
  id: string
  name: string
  map: string
  players: number
  capacity: number
  ping: number
  locked?: boolean
}
type IconName = "arrow" | "back" | "check" | "clock" | "copy" | "globe" | "lan" | "map" | "players" | "plus" | "radar" | "settings" | "shield"

const iconPaths: Record<IconName, React.ReactNode> = {
  arrow: <path d="m9 18 6-6-6-6" />,
  back: <path d="m15 18-6-6 6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="10" height="10" rx="2" />
      <path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18" />
    </>
  ),
  lan: (
    <>
      <rect x="8" y="3" width="8" height="6" rx="1" />
      <rect x="3" y="15" width="7" height="6" rx="1" />
      <rect x="14" y="15" width="7" height="6" rx="1" />
      <path d="M12 9v3M6.5 15v-3h11v3" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  players: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19v-2.2A4.8 4.8 0 0 1 8.3 12h1.4a4.8 4.8 0 0 1 4.8 4.8V19M16 5.5a3 3 0 0 1 0 5.8M17 13a4.5 4.5 0 0 1 3.5 4.4V19" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  radar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 12 18.5 5.5M12 3v2M21 12h-2M12 21v-2M3 12h2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  shield: (
    <path d="M12 3 4.5 6v5.2c0 4.6 3.2 8.2 7.5 9.8 4.3-1.6 7.5-5.2 7.5-9.8V6L12 3Z" />
  ),
}

function Icon({ name, size = 20 }: { name: IconName size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        {iconPaths[name]}
      </g>
    </svg>
  )
}

function GameButton({
  children,
  className = "",
  icon,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode
  className?: string
  icon?: IconName
  onClick?: () => void
  variant?: "primary" | "ghost" | "outline"
}) {
  return (
    <ButtonElement
      className={`game-button game-button--${variant} ${className}`}
      onClick={onClick}
      type="button"
    >
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </ButtonElement>
  )
}

function EffectsLayer() {
  return (
    <div aria-hidden="true" className="effects-layer">
      <span className="scan-beam" />
      <span className="noise-field" />
      {Array.from({ length: 8 }, (_, index) => (
        <span className={`particle particle--${index + 1}`} key={index} />
      ))}
    </div>
  )
}

const players = [
  { name: "NOVA", tag: "HOST", initials: "NV", color: "lime", ready: true },
  { name: "BYTEWALKER", initials: "BW", color: "cyan", ready: true },
  { name: "ORBIT", initials: "OR", color: "violet", ready: false },
  { name: "GECKO", initials: "GK", color: "orange", ready: true },
]

const roomsByMode: Record<ConnectionMode, Room[]> = {
  lan: [
    {
      id: "LAN-01",
      name: "LIVING ROOM LEAGUE",
      map: "WORLD",
      players: 4,
      capacity: 8,
      ping: 3,
    },
    {
      id: "LAN-02",
      name: "OFFICE EXPLORERS",
      map: "CAPITALS",
      players: 3,
      capacity: 8,
      ping: 5,
    },
    {
      id: "LAN-03",
      name: "NEIGHBORHOOD TOUR",
      map: "LANDMARKS",
      players: 2,
      capacity: 6,
      ping: 8,
    },
  ],
  web: [
    {
      id: "DZ-47X9",
      name: "FRIDAY ATLAS CLUB",
      map: "WORLD",
      players: 4,
      capacity: 8,
      ping: 38,
    },
    {
      id: "DZ-13K2",
      name: "NO MAP NEEDED",
      map: "CAPITALS",
      players: 3,
      capacity: 8,
      ping: 54,
    },
    {
      id: "DZ-88Q1",
      name: "GLOBE RUNNERS",
      map: "LANDMARKS",
      players: 2,
      capacity: 6,
      ping: 71,
      locked: true,
    },
    {
      id: "DZ-29M4",
      name: "FIRST DROP",
      map: "WORLD",
      players: 1,
      capacity: 4,
      ping: 92,
    },
  ],
}

function ModeSelect({
  isLaunching,
  mode,
  setMode,
  onContinue,
}: {
  isLaunching: boolean
  mode: ConnectionMode | null
  setMode: (mode: ConnectionMode) => void
  onContinue: () => void
}) {
  return (
    <main
      className={`entry-screen ${isLaunching ? "entry-screen--launching" : ""}`}
    >
      <EffectsLayer />
      <div className="ambient-grid" />
      <div className="entry-header">
        <div className="logo">
          <span className="logo-icon">
            <Icon name="radar" size={26} />
          </span>
          <span>WAYFINDER</span>
        </div>
        <span className="build-label">BUILD 0.9.47</span>
      </div>

      <section className="entry-content">
        <div className="kicker">
          <span className="live-pulse" />
          CONNECTION PROTOCOL
        </div>
        <div className="entry-title" data-text="HOW DO YOU WANT TO PLAY?">
          HOW DO YOU
          <br />
          WANT TO PLAY?
        </div>
        <div className="entry-lead">
          Choose a network mode. You can switch again before launching the
          match.
        </div>

        <div className="mode-grid">
          <ButtonElement
            className={`mode-card ${mode === "lan" ? "mode-card--active" : ""}`}
            onClick={() => setMode("lan")}
            type="button"
          >
            <span className="mode-number">01</span>
            <span className="mode-icon mode-icon--lan">
              <Icon name="lan" size={34} />
            </span>
            <span className="mode-content">
              <strong>LOCAL NETWORK</strong>
              <small>
                Host or join a match with players on the same Wi-Fi or LAN.
              </small>
              <span className="mode-meta">
                <i />
                LOWEST LATENCY
              </span>
            </span>
            <span className="mode-select">
              {mode === "lan" && <Icon name="check" size={18} />}
            </span>
          </ButtonElement>

          <ButtonElement
            className={`mode-card ${mode === "web" ? "mode-card--active" : ""}`}
            onClick={() => setMode("web")}
            type="button"
          >
            <span className="mode-number">02</span>
            <span className="mode-icon">
              <Icon name="globe" size={34} />
            </span>
            <span className="mode-content">
              <strong>PLAY ONLINE</strong>
              <small>
                Create a private room and challenge players from anywhere.
              </small>
              <span className="mode-meta">
                <i />
                GLOBAL SERVERS
              </span>
            </span>
            <span className="mode-select">
              {mode === "web" && <Icon name="check" size={18} />}
            </span>
          </ButtonElement>
        </div>

        <GameButton
          className="continue-button"
          icon="arrow"
          onClick={onContinue}
        >
          {isLaunching
            ? "ESTABLISHING LINK"
            : mode
              ? "ENTER LOBBY"
              : "SELECT A MODE"}
        </GameButton>
      </section>

      <div className="entry-footer">
        <span>SERVER STATUS: OPERATIONAL</span>
        <span>SECURE CONNECTION</span>
      </div>
      <div className="connection-warp">
        <span />
        <strong>SYNCING SQUAD DATA</strong>
        <i />
      </div>
    </main>
  )
}

function RoomBrowser({
  connectionMode,
  onBack,
  onCreate,
  onJoin,
}: {
  connectionMode: ConnectionMode
  onBack: () => void
  onCreate: () => void
  onJoin: (room: Room) => void
}) {
  const rooms = roomsByMode[connectionMode]
  const isLan = connectionMode === "lan"

  return (
    <main className="browser-screen">
      <EffectsLayer />
      <div className="ambient-grid" />
      <header className="lobby-nav">
        <div className="logo">
          <span className="logo-icon">
            <Icon name="radar" size={24} />
          </span>
          <span>WAYFINDER</span>
        </div>
        <div className="nav-session">
          <span className="live-pulse" />
          {isLan ? "SCANNING LOCAL NETWORK" : "MATCHMAKING ONLINE"}
        </div>
        <GameButton icon="back" onClick={onBack} variant="ghost">
          CHANGE MODE
        </GameButton>
      </header>

      <div className="browser-content">
        <section className="browser-heading">
          <div>
            <div className="section-index">
              / {isLan ? "LOCAL NETWORK" : "GLOBAL NETWORK"}
            </div>
            <div
              className="lobby-title browser-title"
              data-text="AVAILABLE LOBBIES"
            >
              AVAILABLE LOBBIES
            </div>
            <div className="lobby-subtitle">
              {isLan
                ? `${rooms.length} rooms found on your network.`
                : `${rooms.length} active rooms match your region.`}
            </div>
          </div>
          <GameButton icon="plus" onClick={onCreate}>
            CREATE LOBBY
          </GameButton>
        </section>

        <section className="room-browser panel">
          <div className="room-table-head">
            <span>LOBBY</span>
            <span>MAP</span>
            <span>PLAYERS</span>
            <span>LATENCY</span>
            <span />
          </div>
          <div className="room-list">
            {rooms.map((room, index) => {
              const occupancy = Math.round((room.players / room.capacity) * 100)
              return (
                <div
                  className={`room-row room-row--${index + 1}`}
                  key={room.id}
                >
                  <div className="room-name">
                    <span className="room-signal">
                      <Icon
                        name={room.locked ? "shield" : isLan ? "lan" : "globe"}
                        size={20}
                      />
                    </span>
                    <span>
                      <strong>{room.name}</strong>
                      <small>{room.id}</small>
                    </span>
                  </div>
                  <span className="room-map">{room.map}</span>
                  <div className="room-players">
                    <span>
                      <Icon name="players" size={17} />
                      <strong>{room.players}</strong> / {room.capacity}
                    </span>
                    <i>
                      <b className={`occupancy-${occupancy}`} />
                    </i>
                  </div>
                  <span
                    className={`room-ping ${
                      room.ping > 70 ? "room-ping--high" : ""
                    }`}
                  >
                    {room.ping} MS
                  </span>
                  <GameButton
                    icon="arrow"
                    onClick={() => onJoin(room)}
                    variant="outline"
                  >
                    JOIN
                  </GameButton>
                </div>
              )
            })}
          </div>
        </section>

        <div className="browser-footer">
          <span>
            <i className="live-pulse" />
            LIVE DISCOVERY ACTIVE
          </span>
          <span>ROOM LIST AUTO-REFRESHES</span>
        </div>
      </div>
    </main>
  )
}

function Lobby({
  connectionMode,
  onBack,
  onStart,
  room,
}: {
  connectionMode: ConnectionMode
  onBack: () => void
  onStart: () => void
  room: Room
}) {
  const [copied, setCopied] = useState(false)
  const [ready, setReady] = useState(false)
  const [map, setMap] = useState("WORLD")
  const [timer, setTimer] = useState("02:00")
  const isLan = connectionMode === "lan"

  function copyCode() {
    navigator.clipboard?.writeText(isLan ? "192.168.1.44:7777" : room.id)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <main className="lobby-screen">
      <EffectsLayer />
      <div className="ambient-grid" />
      <header className="lobby-nav">
        <div className="logo">
          <span className="logo-icon">
            <Icon name="radar" size={24} />
          </span>
          <span>WAYFINDER</span>
        </div>
        <div className="nav-session">
          <span className="live-pulse" />
          {isLan ? "LOCAL NETWORK" : "ONLINE SERVER"}
          <span className="ping">{room.ping} MS</span>
        </div>
        <GameButton icon="back" onClick={onBack} variant="ghost">
          SWITCH MODE
        </GameButton>
      </header>

      <div className="lobby-content">
        <section className="lobby-hero">
          <div>
            <div className="section-index">/ MATCH LOBBY 07</div>
            <div className="lobby-title" data-text={room.name}>
              {room.name}
            </div>
            <div className="lobby-subtitle">
              Squad up. Lock in. Find the target before anyone else.
            </div>
          </div>
          <div className="session-code">
            <div>
              <span>{isLan ? "HOST ADDRESS" : "SQUAD CODE"}</span>
              <strong>{isLan ? "192.168.1.44:7777" : room.id}</strong>
            </div>
            <ButtonElement
              aria-label="Copy session code"
              className="copy-button"
              onClick={copyCode}
              type="button"
            >
              <Icon name={copied ? "check" : "copy"} />
            </ButtonElement>
            {copied && <span className="copy-feedback">COPIED</span>}
          </div>
        </section>

        <div className="lobby-layout">
          <section className="panel squad-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-label">
                  <Icon name="players" />
                  EXPLORERS
                </div>
                <span className="panel-caption">
                  {room.players} / {room.capacity} PLAYERS CONNECTED
                </span>
              </div>
              <GameButton icon="plus" variant="outline">
                INVITE
              </GameButton>
            </div>

            <div className="squad-list">
              {players.slice(0, room.players).map((player, index) => (
                <div className="player" key={player.name}>
                  <span className="player-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={`avatar avatar--${player.color}`}>
                    {player.initials}
                  </span>
                  <span className="player-info">
                    <strong>
                      {player.name}
                      {player.tag && <i>{player.tag}</i>}
                    </strong>
                    <small>
                      {player.ready ? "LOADOUT CONFIRMED" : "IN LOADOUT"}
                    </small>
                  </span>
                  <span
                    className={`player-state ${
                      player.ready ? "player-state--ready" : ""
                    }`}
                  >
                    {player.ready && <Icon name="check" size={16} />}
                    {player.ready ? "READY" : "WAITING"}
                  </span>
                </div>
              ))}
              <div className="empty-slots">
                <span className="empty-icon">
                  <Icon name="plus" />
                </span>
                <span>
                  <strong>{room.capacity - room.players} OPEN SLOTS</strong>
                  <small>Waiting for more explorers to connect</small>
                </span>
              </div>
            </div>
          </section>

          <aside className="panel setup-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-label">
                  <Icon name="settings" />
                  MATCH CONFIG
                </div>
                <span className="panel-caption">SET BY SQUAD LEADER</span>
              </div>
              <Icon name="shield" />
            </div>

            <div className="config-block">
              <span className="config-label">
                <Icon name="map" size={17} />
                MAP POOL
              </span>
              <div className="option-stack">
                {["WORLD", "CAPITALS", "LANDMARKS"].map((option) => (
                  <ButtonElement
                    className={map === option ? "active" : ""}
                    key={option}
                    onClick={() => setMap(option)}
                    type="button"
                  >
                    <span>{option}</span>
                    <i>{map === option ? "SELECTED" : ""}</i>
                  </ButtonElement>
                ))}
              </div>
            </div>

            <div className="config-block">
              <span className="config-label">
                <Icon name="clock" size={17} />
                ROUND TIMER
              </span>
              <div className="timer-options">
                {["01:00", "02:00", "03:00"].map((option) => (
                  <ButtonElement
                    className={timer === option ? "active" : ""}
                    key={option}
                    onClick={() => setTimer(option)}
                    type="button"
                  >
                    {option}
                  </ButtonElement>
                ))}
              </div>
            </div>

            <div className="match-stats">
              <span>
                <small>ROUNDS</small>
                <strong>05</strong>
              </span>
              <span>
                <small>MOVEMENT</small>
                <strong>ON</strong>
              </span>
              <span>
                <small>ZOOM</small>
                <strong>ON</strong>
              </span>
            </div>
          </aside>
        </div>

        <section className={`launch-bar ${ready ? "launch-bar--ready" : ""}`}>
          <div className="launch-status">
            <span className="launch-symbol">
              <Icon name={ready ? "check" : "radar"} size={26} />
            </span>
            <span>
              <strong>
                {ready ? "LOADOUT LOCKED" : "AWAITING CONFIRMATION"}
              </strong>
              <small>
                {ready
                  ? "You are ready. Waiting for ORBIT."
                  : "Confirm when you are ready to deploy."}
              </small>
            </span>
          </div>
          <GameButton
            className="ready-button"
            icon={ready ? "arrow" : "check"}
            onClick={() => (ready ? onStart() : setReady(true))}
            variant="primary"
          >
            {ready ? "START ROUND" : "I'M READY"}
          </GameButton>
        </section>
      </div>
    </main>
  )
}

function GameScreen({ onExit }: { onExit: () => void }) {
  const [markerPlaced, setMarkerPlaced] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [view, setView] = useState<"explore" | "atlas" | "standings">("explore")

  function nextRound() {
    setSubmitted(false)
    setMarkerPlaced(false)
    setView("explore")
  }

  return (
    <main className={`game-screen game-screen--${view}`}>
      <div className="world-view" />
      <div className="game-vignette" />

      <header className="game-hud-top">
        <div className="game-brand">
          <span className="logo-icon">
            <Icon name="globe" size={22} />
          </span>
          <span>
            <strong>WAYFINDER</strong>
            <small>LIVE EXPEDITION</small>
          </span>
        </div>

        <div className="game-view-switcher">
          {(["explore", "atlas", "standings"] as const).map((item) => (
            <ButtonElement
              className={view === item ? "active" : ""}
              key={item}
              onClick={() => setView(item)}
              type="button"
            >
              {item === "explore"
                ? "EXPLORE"
                : item === "atlas"
                  ? "ATLAS"
                  : "STANDINGS"}
            </ButtonElement>
          ))}
        </div>

        <div className="game-meta">
          <span>
            <small>ROUND</small>
            <strong>02 / 05</strong>
          </span>
          <span className="game-timer">
            <Icon name="clock" size={16} />
            01:38
          </span>
          <GameButton icon="back" onClick={onExit} variant="ghost">
            EXIT
          </GameButton>
        </div>
      </header>

      {view === "explore" && (
        <>
          <div className="compass">
            <span>W</span>
            <span>NW</span>
            <strong>N</strong>
            <span>NE</span>
            <span>E</span>
            <i />
          </div>

          <div className="view-controls">
            <ButtonElement aria-label="Zoom in" type="button">
              <Icon name="plus" />
            </ButtonElement>
            <ButtonElement aria-label="Zoom out" type="button">
              <span>−</span>
            </ButtonElement>
            <ButtonElement aria-label="Reset view" type="button">
              <Icon name="radar" />
            </ButtonElement>
          </div>

          <div className="location-prompt">
            <span className="section-index">ROUND 02 · WORLD</span>
            <strong>READ THE LANDSCAPE</strong>
            <small>
              Architecture, road markings, light and terrain are your clues.
            </small>
          </div>

          <div className="score-orbit">
            <span>
              <small>CURRENT SCORE</small>
              <strong>8,420</strong>
            </span>
            <i />
            <span>
              <small>ROUND STREAK</small>
              <strong>04</strong>
            </span>
          </div>

          <div className="squad-hud">
            <span className="squad-label">LIVE ROOM · 4 EXPLORERS</span>
            {players.slice(0, 4).map((player, index) => (
              <span className="squad-member" key={player.name}>
                <i className={`avatar avatar--${player.color}`}>
                  {player.initials}
                </i>
                <span>
                  <strong>{player.name}</strong>
                  <small>{index === 2 ? "EXPLORING" : "GUESS READY"}</small>
                </span>
                <b className={index === 2 ? "" : "active"} />
              </span>
            ))}
          </div>

          <aside
            className={`guess-console ${
              markerPlaced ? "guess-console--active" : ""
            }`}
          >
            <div className="guess-heading">
              <span>
                <Icon name="map" />
                QUICK ATLAS
              </span>
              <small>
                {markerPlaced ? "PIN PLACED" : "OPEN ATLAS TO EXPAND"}
              </small>
            </div>
            <ButtonElement
              aria-label="Open atlas"
              className="tactical-map"
              onClick={() => setView("atlas")}
              type="button"
            >
              <WorldMap />
              {markerPlaced && (
                <span className="guess-pin">
                  <Icon name="map" size={17} />
                </span>
              )}
              <span className="map-coordinates">64.2° N / 15.4° E</span>
            </ButtonElement>
            <div className="map-actions">
              <span>
                <small>CONFIDENCE</small>
                <strong>{markerPlaced ? "78%" : "—"}</strong>
              </span>
              <GameButton icon="arrow" onClick={() => setView("atlas")}>
                OPEN ATLAS
              </GameButton>
            </div>
          </aside>
          <div className="photo-credit">Photo: K. K. / Unsplash</div>
        </>
      )}

      {view === "atlas" && (
        <section className="atlas-view">
          <div className="atlas-copy">
            <span className="section-index">GLOBAL ATLAS · ROUND 02</span>
            <div className="atlas-title">PLACE YOUR GUESS</div>
            <p>
              Explore the projection, compare terrain zones, and place one final
              pin. Your squad cannot see your choice until the timer ends.
            </p>
            <div className="atlas-legend">
              <span>
                <i className="legend-dot legend-dot--you" />
                YOUR GUESS
              </span>
              <span>
                <i className="legend-dot legend-dot--terrain" />
                TERRAIN SIGNAL
              </span>
            </div>
          </div>
          <ButtonElement
            aria-label="Place a guess on the world map"
            className="atlas-map"
            onClick={() => setMarkerPlaced(true)}
            type="button"
          >
            <WorldMap />
            <span className="atlas-grid" />
            <span className="atlas-route atlas-route--one" />
            <span className="atlas-route atlas-route--two" />
            {markerPlaced && (
              <span className="atlas-pin">
                <span>
                  <Icon name="map" size={20} />
                </span>
                <strong>NORWEGIAN SEA</strong>
                <small>64.2° N / 15.4° E</small>
              </span>
            )}
          </ButtonElement>
          <div className="atlas-footer">
            <span>
              <small>MAP PROJECTION</small>
              <strong>EQUAL EARTH</strong>
            </span>
            <span>
              <small>POSITION</small>
              <strong>{markerPlaced ? "64.2° N / 15.4° E" : "NOT SET"}</strong>
            </span>
            <GameButton
              icon={markerPlaced ? "check" : "map"}
              onClick={() => markerPlaced && setSubmitted(true)}
            >
              {markerPlaced ? "LOCK THIS LOCATION" : "PLACE A PIN"}
            </GameButton>
          </div>
        </section>
      )}

      {view === "standings" && <Leaderboard />}

      {submitted && (
        <section className="round-result">
          <div className="result-map">
            <WorldMap />
            <span className="result-line" />
            <i className="result-point result-point--guess" />
            <i className="result-point result-point--actual" />
          </div>
          <span className="section-index">ROUND 02 COMPLETE</span>
          <div className="result-title">12.4 KM</div>
          <div className="result-location">
            FROM THE CORRECT LOCATION · NORTHERN NORWAY
          </div>
          <div className="result-score">
            <span>
              <small>ROUND SCORE</small>
              <strong>4,720</strong>
            </span>
            <span>
              <small>TIME BONUS</small>
              <strong>+180</strong>
            </span>
            <span>
              <small>NEW POSITION</small>
              <strong>#2 ↑</strong>
            </span>
          </div>
          <div className="result-actions">
            <GameButton
              onClick={() => {
                setSubmitted(false)
                setView("standings")
              }}
              variant="outline"
            >
              VIEW STANDINGS
            </GameButton>
            <GameButton icon="arrow" onClick={nextRound}>
              NEXT ROUND
            </GameButton>
          </div>
        </section>
      )}
    </main>
  )
}

function WorldMap() {
  return (
    <svg aria-hidden="true" className="world-map-svg" viewBox="0 0 1000 520">
      <path d="M76 155 115 94l91-44 96 18 33 48-44 41-73 6-21 49-54-3-30 43-51-25Z" />
      <path d="m266 243 55 18 23 70-31 91-38 49-22-62 15-67-25-48Z" />
      <path d="m448 114 54-56 79 2 31 38-24 31-50-8-25 30-55-7Z" />
      <path d="m480 172 58-28 77 31 39 85-28 91-63 58-47-34 20-66-40-57Z" />
      <path d="m601 117 54-43 116 4 57 46 93 25-21 62-94 23-45-24-63 35-56-26-40 19-32-52Z" />
      <path d="m810 338 46-35 72 22 24 53-52 44-76-8-28-42Z" />
      <path d="m914 256 22-17 23 15-13 25Z" />
    </svg>
  )
}

function Leaderboard() {
  const standings = [
    { rank: 1, name: "BYTEWALKER", score: "13,280", delta: "—", color: "cyan" },
    {
      rank: 2,
      name: "NOVA",
      score: "13,140",
      delta: "↑ 1",
      color: "lime",
      you: true,
    },
    { rank: 3, name: "GECKO", score: "12,760", delta: "↓ 1", color: "orange" },
    { rank: 4, name: "ORBIT", score: "10,920", delta: "—", color: "violet" },
  ]

  return (
    <section className="leaderboard-view">
      <div className="leaderboard-heading">
        <span className="section-index">LIVE AFTER ROUND 02</span>
        <div className="atlas-title">ROOM STANDINGS</div>
        <p>
          Positions update at the end of every round. Distance breaks score
          ties.
        </p>
      </div>
      <div className="podium">
        <div className="podium-player podium-player--second">
          <span className="avatar avatar--lime">NV</span>
          <strong>NOVA</strong>
          <small>13,140</small>
          <i>2</i>
        </div>
        <div className="podium-player podium-player--first">
          <span className="avatar avatar--cyan">BW</span>
          <strong>BYTEWALKER</strong>
          <small>13,280</small>
          <i>1</i>
        </div>
        <div className="podium-player podium-player--third">
          <span className="avatar avatar--orange">GK</span>
          <strong>GECKO</strong>
          <small>12,760</small>
          <i>3</i>
        </div>
      </div>
      <div className="standing-list">
        {standings.map((player) => (
          <div
            className={`standing-row ${player.you ? "standing-row--you" : ""}`}
            key={player.name}
          >
            <span className="standing-rank">
              {String(player.rank).padStart(2, "0")}
            </span>
            <span className={`avatar avatar--${player.color}`}>
              {player.name.slice(0, 2)}
            </span>
            <span className="standing-name">
              <strong>{player.name}</strong>
              <small>
                {player.you ? "YOU · 12.4 KM THIS ROUND" : "ROUND LOCKED"}
              </small>
            </span>
            <span className="standing-delta">{player.delta}</span>
            <strong className="standing-score">{player.score}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const [selectedMode, setSelectedMode] = useState<ConnectionMode | null>(null)
  const [screen, setScreen] = useState<Screen>("select")
  const [isLaunching, setIsLaunching] = useState(false)
  const [activeRoom, setActiveRoom] = useState<Room | null>(null)

  function chooseMode(mode: ConnectionMode) {
    if (isLaunching) return
    setSelectedMode(mode)
    setIsLaunching(true)
    window.setTimeout(() => {
      setScreen("browser")
      setIsLaunching(false)
    }, 900)
  }

  function createRoom() {
    setActiveRoom({
      id: selectedMode === "lan" ? "LAN-HOST" : "DZ-NEW1",
      name: "NOVA'S ATLAS ROOM",
      map: "WORLD",
      players: 1,
      capacity: 8,
      ping: selectedMode === "lan" ? 2 : 31,
    })
    setScreen("lobby")
  }

  if (screen === "select") {
    return (
      <ModeSelect
        isLaunching={isLaunching}
        mode={selectedMode}
        onContinue={() => selectedMode && chooseMode(selectedMode)}
        setMode={chooseMode}
      />
    )
  }

  if (screen === "browser" && selectedMode) {
    return (
      <RoomBrowser
        connectionMode={selectedMode}
        onBack={() => setScreen("select")}
        onCreate={createRoom}
        onJoin={(room) => {
          setActiveRoom(room)
          setScreen("lobby")
        }}
      />
    )
  }

  if (screen === "game") {
    return <GameScreen onExit={() => setScreen("lobby")} />
  }

  return (
    <Lobby
      connectionMode={selectedMode ?? "web"}
      onBack={() => setScreen("browser")}
      onStart={() => setScreen("game")}
      room={activeRoom ?? roomsByMode.web[0]}
    />
  )
}
