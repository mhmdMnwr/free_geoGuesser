import React, { useState, useEffect, useRef } from "react"
import { io, Socket } from "socket.io-client"
import L from "leaflet"
import {
  generateClientEcdhKeyPair,
  deriveAesGcmKey,
  encryptPayload,
} from "./crypto-client"

const ButtonElement = "button"

type ConnectionMode = "lan" | "web"
type Screen = "select" | "browser" | "lobby" | "game"

interface Room {
  id: string
  name: string
  hostName: string
  hostIp: string | null
  playerCount: number
  maxPlayers: number
  selectedRegion: string
  difficulty: string
  totalRounds: number
  status: string
  ping: number
}

interface Player {
  ip: string
  username: string
  connected: boolean
  totalScore: number
  isHost: boolean
}

type IconName =
  | "arrow"
  | "back"
  | "check"
  | "clock"
  | "copy"
  | "crown"
  | "globe"
  | "lan"
  | "map"
  | "players"
  | "plus"
  | "radar"
  | "settings"
  | "shield"

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
  crown: (
    <path d="M3 18h18l-2-11-5 5-2-7-2 7-5-5-2 11Z" />
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
      <circle cx="12" cy="5" />
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

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
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
  disabled = false,
  variant = "primary",
}: {
  children: React.ReactNode
  className?: string
  icon?: IconName
  onClick?: () => void
  disabled?: boolean
  variant?: "primary" | "ghost" | "outline"
}) {
  return (
    <ButtonElement
      className={`game-button game-button--${variant} ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      disabled={disabled}
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

// -------------------------------------------------------------
// Interactive Leaflet Map Component with CartoDB Dark Matter
// -------------------------------------------------------------
interface LeafletMapProps {
  pin: { lat: number; lng: number } | null
  onSelectCoords?: (coords: { lat: number; lng: number }) => void
  targetCoords?: { lat: number; lng: number } | null
  otherGuesses?: Array<{ username: string; coords: { lat: number; lng: number } }>
  interactive?: boolean
  zoom?: number
}

function LeafletMapView({
  pin,
  onSelectCoords,
  targetCoords,
  otherGuesses = [],
  interactive = true,
  zoom = 2,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const targetMarkerRef = useRef<L.Marker | null>(null)
  const polylineRef = useRef<L.Polyline | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Prevent duplicate map instances
    if (!mapInstanceRef.current) {
      const map = L.map(containerRef.current, {
        center: [20, 0],
        zoom: zoom,
        zoomControl: interactive,
        attributionControl: false,
        dragging: interactive,
        scrollWheelZoom: interactive,
      })

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
        },
      ).addTo(map)

      if (interactive && onSelectCoords) {
        map.on("click", (e: L.LeafletMouseEvent) => {
          onSelectCoords({
            lat: Math.round(e.latlng.lat * 1000000) / 1000000,
            lng: Math.round(e.latlng.lng * 1000000) / 1000000,
          })
        })
      }

      mapInstanceRef.current = map
    }

    const map = mapInstanceRef.current
    setTimeout(() => {
      map.invalidateSize()
    }, 150)

    return () => {
      // Keep map instance stable during minor re-renders
    }
  }, [interactive, onSelectCoords, zoom])

  // Update Pin Marker
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (pin) {
      const customIcon = L.divIcon({
        className: "custom-recon-pin",
        html: '<div class="custom-recon-pin-inner"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })

      if (markerRef.current) {
        markerRef.current.setLatLng([pin.lat, pin.lng])
      } else {
        markerRef.current = L.marker([pin.lat, pin.lng], { icon: customIcon }).addTo(map)
      }
    } else if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }, [pin])

  // Update Target Marker & Results Geodesic Polyline
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (targetCoords) {
      const targetIcon = L.divIcon({
        className: "custom-recon-pin",
        html: '<div class="custom-target-pin-inner"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      if (targetMarkerRef.current) {
        targetMarkerRef.current.setLatLng([targetCoords.lat, targetCoords.lng])
      } else {
        targetMarkerRef.current = L.marker([targetCoords.lat, targetCoords.lng], {
          icon: targetIcon,
        }).addTo(map)
      }

      if (pin) {
        if (polylineRef.current) {
          polylineRef.current.remove()
        }
        polylineRef.current = L.polyline(
          [
            [pin.lat, pin.lng],
            [targetCoords.lat, targetCoords.lng],
          ],
          {
            color: "#38bdf8",
            weight: 3,
            dashArray: "6, 8",
            opacity: 0.9,
          },
        ).addTo(map)

        map.fitBounds(
          L.latLngBounds([
            [pin.lat, pin.lng],
            [targetCoords.lat, targetCoords.lng],
          ]).pad(0.35),
        )
      }
    } else {
      if (targetMarkerRef.current) {
        targetMarkerRef.current.remove()
        targetMarkerRef.current = null
      }
      if (polylineRef.current) {
        polylineRef.current.remove()
        polylineRef.current = null
      }
    }
  }, [targetCoords, pin])

  return <div className="w-full h-full relative" ref={containerRef} />
}

// -------------------------------------------------------------
// Screen 1: Mode Select (LAN Focused)
// -------------------------------------------------------------
function ModeSelect({
  isLaunching,
  mode,
  setMode,
  onContinue,
  username,
  setUsername,
}: {
  isLaunching: boolean
  mode: ConnectionMode | null
  setMode: (mode: ConnectionMode) => void
  onContinue: () => void
  username: string
  setUsername: (name: string) => void
}) {
  return (
    <main className={`entry-screen ${isLaunching ? "entry-screen--launching" : ""}`}>
      <EffectsLayer />
      <div className="ambient-grid" />
      <div className="entry-header">
        <div className="logo">
          <span className="logo-icon">
            <Icon name="radar" size={26} />
          </span>
          <span>WAYFINDER</span>
        </div>
        <span className="build-label">LAN MULTI-LOBBY 2.0</span>
      </div>

      <section className="entry-content">
        <div className="kicker">
          <span className="live-pulse" />
          LOCAL AREA NETWORK PROTOCOL
        </div>
        <div className="entry-title" data-text="TACTICAL GEO RECON">
          EXPLORE THE WORLD
          <br />
          ON YOUR LAN
        </div>
        <div className="entry-lead">
          Connect with anyone on your local network. Create your own squad room, hold the Crown 👑, or join active LAN expeditions.
        </div>

        {/* Operative Codename Input */}
        <div className="mb-6 max-w-md w-full">
          <label className="block text-xs font-mono uppercase text-sky-400 mb-2 tracking-widest">
            // OPERATIVE CODENAME
          </label>
          <input
            className="w-full bg-slate-900/90 border border-slate-700 focus:border-sky-400 rounded-lg px-4 py-3 text-slate-100 font-mono text-sm tracking-wider uppercase outline-none transition shadow-inner"
            maxLength={18}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ENTER YOUR CODENAME..."
            type="text"
            value={username}
          />
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
              <strong>LOCAL AREA NETWORK</strong>
              <small>
                Host or join match rooms with players on the same Wi-Fi or LAN switch.
              </small>
              <span className="mode-meta">
                <i />
                ULTRA-LOW LATENCY // ZERO CLOUD
              </span>
            </span>
            <span className="mode-select">
              {mode === "lan" && <Icon name="check" size={18} />}
            </span>
          </ButtonElement>

          <ButtonElement
            className={`mode-card ${mode === "web" ? "mode-card--active" : ""}`}
            onClick={() => setMode("lan")}
            type="button"
          >
            <span className="mode-number">02</span>
            <span className="mode-icon">
              <Icon name="globe" size={34} />
            </span>
            <span className="mode-content">
              <strong>LAN DIRECT LINK</strong>
              <small>
                Connect directly via host LAN IP without third-party servers.
              </small>
              <span className="mode-meta">
                <i />
                ISOLATED & PRIVATE
              </span>
            </span>
            <span className="mode-select">
              {mode === "lan" && <Icon name="check" size={18} />}
            </span>
          </ButtonElement>
        </div>

        <GameButton
          className="continue-button"
          disabled={!username.trim()}
          icon="arrow"
          onClick={onContinue}
        >
          {isLaunching
            ? "ESTABLISHING UPLINK..."
            : username.trim()
              ? "ENTER SQUAD BROWSER"
              : "ENTER CODENAME TO PROCEED"}
        </GameButton>
      </section>

      <div className="entry-footer">
        <span>LAN DISCOVERY: ACTIVE</span>
        <span>ENCRYPTED LOCAL PROTOCOL</span>
      </div>
      <div className="connection-warp">
        <span />
        <strong>SYNCING OPERATIVE REGISTRY</strong>
        <i />
      </div>
    </main>
  )
}

// -------------------------------------------------------------
// Screen 2: Room Browser (Multi-Lobby Explorer)
// -------------------------------------------------------------
function RoomBrowser({
  lobbies,
  username,
  onBack,
  onCreate,
  onJoin,
}: {
  lobbies: Room[]
  username: string
  onBack: () => void
  onCreate: () => void
  onJoin: (room: Room) => void
}) {
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
          LAN ACTIVE // OPERATIVE: {username}
        </div>
        <GameButton icon="back" onClick={onBack} variant="ghost">
          CHANGE CODENAME
        </GameButton>
      </header>

      <div className="browser-content">
        <section className="browser-heading">
          <div>
            <div className="section-index">/ LAN EXPEDITION REGISTRY</div>
            <div className="lobby-title browser-title" data-text="ACTIVE SQUADS">
              AVAILABLE SQUADS
            </div>
            <div className="lobby-subtitle">
              {lobbies.length} squads discovered on your local network. Any operative can create their own room and become Squad Leader 👑.
            </div>
          </div>
          <GameButton icon="plus" onClick={onCreate}>
            + CREATE SQUAD ROOM
          </GameButton>
        </section>

        <section className="room-browser panel">
          <div className="room-table-head">
            <span>SQUAD / HOST</span>
            <span>REGION</span>
            <span>OPERATIVES</span>
            <span>DIFFICULTY</span>
            <span />
          </div>
          <div className="room-list">
            {lobbies.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-mono text-sm">
                NO ACTIVE SQUADS FOUND ON LAN. CLICK "+ CREATE SQUAD ROOM" TO HOST!
              </div>
            ) : (
              lobbies.map((room, index) => {
                const occupancy = Math.round((room.playerCount / room.maxPlayers) * 100)
                return (
                  <div className={`room-row room-row--${(index % 4) + 1}`} key={room.id}>
                    <div className="room-name">
                      <span className="room-signal">
                        <Icon name="lan" size={20} />
                      </span>
                      <span>
                        <strong className="flex items-center gap-2">
                          {room.name}
                          <span className="text-amber-400 text-xs font-normal">
                            👑 {room.hostName}
                          </span>
                        </strong>
                        <small>{room.id}</small>
                      </span>
                    </div>
                    <span className="room-map uppercase">{room.selectedRegion || "WORLD"}</span>
                    <div className="room-players">
                      <span>
                        <Icon name="players" size={17} />
                        <strong>{room.playerCount}</strong> / {room.maxPlayers}
                      </span>
                      <i>
                        <b className={`occupancy-${occupancy}`} />
                      </i>
                    </div>
                    <span className="room-ping uppercase font-mono text-xs text-sky-400">
                      {room.difficulty || "ALL"}
                    </span>
                    <GameButton
                      icon="arrow"
                      onClick={() => onJoin(room)}
                      variant="outline"
                    >
                      JOIN SQUAD
                    </GameButton>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <div className="browser-footer">
          <span>
            <i className="live-pulse" />
            LAN DISCOVERY RUNNING
          </span>
          <span>MULTI-LOBBY SYNC ACTIVE</span>
        </div>
      </div>
    </main>
  )
}

// -------------------------------------------------------------
// Screen 3: Match Lobby
// -------------------------------------------------------------
function Lobby({
  room,
  players,
  isHost,
  hostIp,
  lanAddress,
  onBack,
  onStart,
  onUpdateSettings,
}: {
  room: Room
  players: Player[]
  isHost: boolean
  hostIp: string | null
  lanAddress: string
  onBack: () => void
  onStart: () => void
  onUpdateSettings: (settings: {
    region?: string
    rounds?: number
    duration?: number
    difficulty?: string
  }) => void
}) {
  const [copied, setCopied] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState(room.selectedRegion || "all")
  const [selectedDuration, setSelectedDuration] = useState(20)
  const [selectedRounds, setSelectedRounds] = useState(room.totalRounds || 5)

  function copyCode() {
    navigator.clipboard?.writeText(lanAddress || room.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  function handleRegionChange(region: string) {
    if (!isHost) return
    setSelectedRegion(region)
    onUpdateSettings({ region })
  }

  function handleDurationChange(duration: number) {
    if (!isHost) return
    setSelectedDuration(duration)
    onUpdateSettings({ duration })
  }

  function handleRoundsChange(rounds: number) {
    if (!isHost) return
    setSelectedRounds(rounds)
    onUpdateSettings({ rounds })
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
          {isHost ? "SQUAD LEADER 👑" : "OPERATIVE CONNECTED"}
          <span className="ping">ROOM: {room.id}</span>
        </div>
        <GameButton icon="back" onClick={onBack} variant="ghost">
          EXIT SQUAD
        </GameButton>
      </header>

      <div className="lobby-content">
        <section className="lobby-hero">
          <div>
            <div className="section-index">/ EXPEDITION ROOM {room.id}</div>
            <div className="lobby-title" data-text={room.name}>
              {room.name}
            </div>
            <div className="lobby-subtitle">
              Squad up. Lock in. Discover secret road locations together over LAN.
            </div>
          </div>
          <div className="session-code">
            <div>
              <span>LAN HOST IP</span>
              <strong>{lanAddress || "127.0.0.1:3000"}</strong>
            </div>
            <ButtonElement
              aria-label="Copy LAN address"
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
          {/* Operatives Squad Panel */}
          <section className="panel squad-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-label">
                  <Icon name="players" />
                  SQUAD OPERATIVES
                </div>
                <span className="panel-caption">
                  {players.length} / {room.maxPlayers || 8} OPERATIVES READY
                </span>
              </div>
            </div>

            <div className="squad-list">
              {players.map((player, index) => {
                const initials = (player.username || "OP")
                  .slice(0, 2)
                  .toUpperCase()
                const colors = ["lime", "cyan", "violet", "orange"]
                const color = colors[index % colors.length]

                return (
                  <div className="player" key={player.ip + player.username}>
                    <span className="player-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={`avatar avatar--${color}`}>{initials}</span>
                    <span className="player-info">
                      <strong>
                        {player.username}
                        {player.isHost && (
                          <i className="text-amber-400 flex items-center gap-1 font-bold">
                            👑 LEADER
                          </i>
                        )}
                      </strong>
                      <small>EQUIPMENT ONLINE // {player.ip}</small>
                    </span>
                    <span className="player-state player-state--ready">
                      <Icon name="check" size={16} />
                      READY
                    </span>
                  </div>
                )
              })}

              {Array.from(
                { length: Math.max(0, (room.maxPlayers || 8) - players.length) },
                (_, i) => (
                  <div className="empty-slots" key={i}>
                    <span className="empty-icon">
                      <Icon name="plus" />
                    </span>
                    <span>
                      <strong>OPEN POSITION</strong>
                      <small>Waiting for local LAN operative to connect...</small>
                    </span>
                  </div>
                ),
              )}
            </div>
          </section>

          {/* Setup Panel / Host Controls */}
          <aside className="panel setup-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-label">
                  <Icon name="settings" />
                  MATCH CONFIG
                </div>
                <span className="panel-caption">
                  {isHost ? "CONFIGURED BY YOU (SQUAD LEADER)" : "CONFIGURED BY LEADER 👑"}
                </span>
              </div>
              <Icon name="shield" />
            </div>

            <div className="config-block">
              <span className="config-label">
                <Icon name="map" size={17} />
                REGION POOL
              </span>
              <div className="option-stack">
                {[
                  { id: "all", label: "WORLDWIDE" },
                  { id: "north_america", label: "NORTH AMERICA" },
                  { id: "europe", label: "EUROPE" },
                  { id: "asia", label: "ASIA" },
                  { id: "latin_america", label: "LATIN AMERICA" },
                ].map((option) => (
                  <ButtonElement
                    className={selectedRegion === option.id ? "active" : ""}
                    disabled={!isHost}
                    key={option.id}
                    onClick={() => handleRegionChange(option.id)}
                    type="button"
                  >
                    <span>{option.label}</span>
                    <i>{selectedRegion === option.id ? "ACTIVE" : ""}</i>
                  </ButtonElement>
                ))}
              </div>
            </div>

            <div className="config-block">
              <span className="config-label">
                <Icon name="clock" size={17} />
                FIRST GUESS TIMER
              </span>
              <div className="timer-options">
                {[15, 20, 30, 60].map((option) => (
                  <ButtonElement
                    className={selectedDuration === option ? "active" : ""}
                    disabled={!isHost}
                    key={option}
                    onClick={() => handleDurationChange(option)}
                    type="button"
                  >
                    {option}s
                  </ButtonElement>
                ))}
              </div>
            </div>

            <div className="config-block">
              <span className="config-label">
                <Icon name="radar" size={17} />
                ROUND COUNT
              </span>
              <div className="timer-options">
                {[3, 5, 10, 15].map((option) => (
                  <ButtonElement
                    className={selectedRounds === option ? "active" : ""}
                    disabled={!isHost}
                    key={option}
                    onClick={() => handleRoundsChange(option)}
                    type="button"
                  >
                    {option} RNDS
                  </ButtonElement>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* Launch Bar */}
        <section className={`launch-bar ${isHost ? "launch-bar--ready" : ""}`}>
          <div className="launch-status">
            <span className="launch-symbol">
              <Icon name={isHost ? "crown" : "radar"} size={26} />
            </span>
            <span>
              <strong>
                {isHost ? "SQUAD READY FOR EXPEDITION" : "AWAITING SQUAD LEADER"}
              </strong>
              <small>
                {isHost
                  ? "You have the Crown 👑. Launch the match whenever your squad is assembled."
                  : "Standing by. The squad leader will commence the expedition shortly."}
              </small>
            </span>
          </div>
          {isHost ? (
            <GameButton
              className="ready-button"
              icon="arrow"
              onClick={onStart}
              variant="primary"
            >
              COMMENCE EXPEDITION
            </GameButton>
          ) : (
            <div className="text-sm font-mono text-slate-400 uppercase tracking-widest px-4 py-2 bg-slate-900 border border-slate-700 rounded-md">
              WAITING FOR LEADER 👑
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

// -------------------------------------------------------------
// Screen 4: Live Expedition & Reconnaissance (GameScreen)
// -------------------------------------------------------------
function GameScreen({
  room,
  currentRound,
  totalRounds,
  uplinkToken,
  roadToken,
  countdownSeconds,
  isHost,
  myPin,
  hasGuessed,
  totalScore,
  onSelectCoords,
  onLockGuess,
  onNextRound,
  onExit,
  roundResults,
  gameOver,
}: {
  room: Room
  currentRound: number
  totalRounds: number
  uplinkToken: string | null
  roadToken?: string | null
  countdownSeconds: number | null
  isHost: boolean
  myPin: { lat: number; lng: number } | null
  hasGuessed: boolean
  totalScore: number
  onSelectCoords: (coords: { lat: number; lng: number }) => void
  onLockGuess: () => void
  onNextRound: () => void
  onExit: () => void
  roundResults: any
  gameOver: any
}) {
  const [view, setView] = useState<"explore" | "atlas" | "standings">("explore")

  // Auto show results when round ends
  const isResults = Boolean(roundResults)
  const isGameOver = Boolean(gameOver)

  return (
    <main className={`game-screen game-screen--${view}`}>
      {/* Real-time Anti-Spoiler Street View Reconnaissance */}
      <div className="world-view">
        {roadToken ? (
          <img
            src={`/api/media/road/${encodeURIComponent(roadToken)}`}
            alt="Tactical Reconnaissance Panorama"
            className="streetview-frame object-cover w-full h-full"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            className="streetview-frame"
            key={uplinkToken || currentRound}
            src={`/api/streetview/uplink?roomId=${encodeURIComponent(room.id)}`}
            title="Tactical Recon Uplink"
          />
        )}
      </div>
      <div className="game-vignette" />

      {/* Top Tactical HUD */}
      <header className="game-hud-top">
        <div className="game-brand">
          <span className="logo-icon">
            <Icon name="globe" size={22} />
          </span>
          <span>
            <strong>WAYFINDER</strong>
            <small>ROOM: {room.id} // {room.name}</small>
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
                ? "STREET VIEW"
                : item === "atlas"
                  ? "FULL ATLAS"
                  : "STANDINGS"}
            </ButtonElement>
          ))}
        </div>

        <div className="game-meta">
          <span>
            <small>ROUND</small>
            <strong>
              {String(currentRound).padStart(2, "0")} / {String(totalRounds).padStart(2, "0")}
            </strong>
          </span>
          <span className="game-timer">
            <Icon name="clock" size={16} />
            {countdownSeconds !== null ? `00:${String(countdownSeconds).padStart(2, "0")}` : "SCANNING"}
          </span>
          <GameButton icon="back" onClick={onExit} variant="ghost">
            EXIT
          </GameButton>
        </div>
      </header>

      {/* Explore View: Quick Floating Map */}
      {view === "explore" && !isResults && !isGameOver && (
        <>
          <div className="location-prompt">
            <span className="section-index">
              ROUND {String(currentRound).padStart(2, "0")} · {room.selectedRegion || "WORLD"}
            </span>
            <strong>READ THE LANDSCAPE</strong>
            <small>
              Look for architecture, vegetation, sun angle, road markings, and driving side.
            </small>
          </div>

          <div className="score-orbit">
            <span>
              <small>TOTAL SCORE</small>
              <strong>{totalScore.toLocaleString()}</strong>
            </span>
          </div>

          <aside className={`guess-console ${myPin ? "guess-console--active" : ""}`}>
            <div className="guess-heading">
              <span>
                <Icon name="map" />
                TACTICAL ATLAS
              </span>
              <small>{hasGuessed ? "GUESS LOCKED" : myPin ? "PIN PLACED" : "CLICK TO DROP PIN"}</small>
            </div>
            <div className="tactical-map overflow-hidden rounded-lg">
              <LeafletMapView
                interactive={!hasGuessed}
                onSelectCoords={onSelectCoords}
                pin={myPin}
              />
            </div>
            <div className="map-actions">
              <span>
                <small>COORDINATES</small>
                <strong>
                  {myPin ? `${myPin.lat.toFixed(2)}°, ${myPin.lng.toFixed(2)}°` : "NONE"}
                </strong>
              </span>
              {hasGuessed ? (
                <div className="text-xs font-mono text-emerald-400 font-bold px-3 py-2 bg-slate-900 border border-emerald-500/40 rounded">
                  LOCKED IN
                </div>
              ) : (
                <GameButton
                  disabled={!myPin}
                  icon="check"
                  onClick={onLockGuess}
                  variant="primary"
                >
                  CONFIRM GUESS
                </GameButton>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Atlas View: Full Interactive Map Screen */}
      {view === "atlas" && !isResults && !isGameOver && (
        <section className="atlas-view">
          <div className="atlas-copy">
            <span className="section-index">
              GLOBAL PROJECTION · ROUND {String(currentRound).padStart(2, "0")}
            </span>
            <div className="atlas-title">DROP YOUR COORDINATE PIN</div>
            <p>
              Examine the world projection, pan and zoom to pinpoint the location. Your coordinates are hidden until the countdown expires.
            </p>
          </div>
          <div className="atlas-map overflow-hidden rounded-xl border border-slate-700">
            <LeafletMapView
              interactive={!hasGuessed}
              onSelectCoords={onSelectCoords}
              pin={myPin}
              zoom={3}
            />
          </div>
          <div className="atlas-footer">
            <span>
              <small>SELECTED POSITION</small>
              <strong>
                {myPin ? `${myPin.lat.toFixed(3)}° N, ${myPin.lng.toFixed(3)}° E` : "UNSET"}
              </strong>
            </span>
            {hasGuessed ? (
              <div className="text-sm font-mono text-emerald-400 font-bold px-4 py-2 bg-slate-900 border border-emerald-500 rounded">
                COORDINATES LOCKED // WAITING FOR SQUAD
              </div>
            ) : (
              <GameButton
                disabled={!myPin}
                icon="check"
                onClick={onLockGuess}
                variant="primary"
              >
                {myPin ? "LOCK COORDINATES" : "CLICK MAP TO PLACE PIN"}
              </GameButton>
            )}
          </div>
        </section>
      )}

      {/* Standings View */}
      {view === "standings" && !isResults && !isGameOver && (
        <LeaderboardScreen
          leaderboard={roundResults?.leaderboard || gameOver?.leaderboard || []}
        />
      )}

      {/* Round Results Screen */}
      {isResults && !isGameOver && (
        <section className="round-result">
          <div className="result-map overflow-hidden rounded-xl border border-slate-700">
            <LeafletMapView
              interactive={false}
              pin={myPin}
              targetCoords={roundResults.target}
            />
          </div>
          <span className="section-index">ROUND {String(currentRound).padStart(2, "0")} COMPLETE</span>
          <div className="result-title">
            {myPin && roundResults.target
              ? `${(roundResults.results?.find((r: any) => r.guessCoords)?.distanceKm || 0)} KM`
              : "MISSED GUESS"}
          </div>
          <div className="result-location">
            ACTUAL LOCATION: {roundResults.target?.label || "VERIFIED ROAD"}
          </div>
          <div className="result-score">
            <span>
              <small>POINTS EARNED</small>
              <strong>+{roundResults.results?.find((r: any) => r.isHost || r.ip)?.roundScore || 0}</strong>
            </span>
            <span>
              <small>CLOSEST EXPLORER</small>
              <strong>{roundResults.closestPlayer?.username || "NONE"}</strong>
            </span>
          </div>
          <div className="result-actions">
            <GameButton onClick={() => setView("standings")} variant="outline">
              VIEW STANDINGS
            </GameButton>
            {isHost ? (
              <GameButton icon="arrow" onClick={onNextRound} variant="primary">
                {currentRound >= totalRounds ? "FINALIZE EXPEDITION" : "NEXT ROUND"}
              </GameButton>
            ) : (
              <div className="text-xs font-mono text-slate-400 uppercase tracking-widest px-4 py-2 bg-slate-900 border border-slate-700 rounded-md">
                WAITING FOR SQUAD LEADER 👑
              </div>
            )}
          </div>
        </section>
      )}

      {/* Game Over Screen */}
      {isGameOver && (
        <section className="leaderboard-view">
          <div className="leaderboard-heading">
            <span className="section-index">EXPEDITION COMPLETE</span>
            <div className="atlas-title">FINAL STANDINGS</div>
            <p>All rounds completed. Standings based on total distance and speed.</p>
          </div>
          <Podium players={gameOver.leaderboard || []} />
          <div className="standing-list">
            {(gameOver.leaderboard || []).map((player: any, idx: number) => (
              <div className="standing-row" key={player.username}>
                <span className="standing-rank">{String(idx + 1).padStart(2, "0")}</span>
                <span className="avatar avatar--cyan">{player.username.slice(0, 2).toUpperCase()}</span>
                <span className="standing-name">
                  <strong>{player.username}</strong>
                </span>
                <strong className="standing-score">{player.totalScore.toLocaleString()} PTS</strong>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center gap-4">
            {isHost && (
              <GameButton icon="arrow" onClick={onExit} variant="primary">
                RETURN TO SQUAD LOBBY
              </GameButton>
            )}
            <GameButton onClick={onExit} variant="outline">
              EXIT MATCH
            </GameButton>
          </div>
        </section>
      )}
    </main>
  )
}

function Podium({ players }: { players: any[] }) {
  const p1 = players[0]
  const p2 = players[1]
  const p3 = players[2]

  return (
    <div className="podium">
      {p2 && (
        <div className="podium-player podium-player--second">
          <span className="avatar avatar--lime">{p2.username.slice(0, 2).toUpperCase()}</span>
          <strong>{p2.username}</strong>
          <small>{p2.totalScore.toLocaleString()}</small>
          <i>2</i>
        </div>
      )}
      {p1 && (
        <div className="podium-player podium-player--first">
          <span className="avatar avatar--cyan">{p1.username.slice(0, 2).toUpperCase()}</span>
          <strong>{p1.username}</strong>
          <small>{p1.totalScore.toLocaleString()}</small>
          <i>1</i>
        </div>
      )}
      {p3 && (
        <div className="podium-player podium-player--third">
          <span className="avatar avatar--orange">{p3.username.slice(0, 2).toUpperCase()}</span>
          <strong>{p3.username}</strong>
          <small>{p3.totalScore.toLocaleString()}</small>
          <i>3</i>
        </div>
      )}
    </div>
  )
}

function LeaderboardScreen({ leaderboard }: { leaderboard: any[] }) {
  return (
    <section className="leaderboard-view">
      <div className="leaderboard-heading">
        <span className="section-index">LIVE EXPEDITION STANDINGS</span>
        <div className="atlas-title">SQUAD RANKINGS</div>
        <p>Positions update in real time as scores are locked.</p>
      </div>
      <Podium players={leaderboard} />
      <div className="standing-list">
        {leaderboard.map((player: any, idx: number) => (
          <div className="standing-row" key={player.username}>
            <span className="standing-rank">{String(idx + 1).padStart(2, "0")}</span>
            <span className="avatar avatar--cyan">{player.username.slice(0, 2).toUpperCase()}</span>
            <span className="standing-name">
              <strong>{player.username}</strong>
            </span>
            <strong className="standing-score">{(player.totalScore || 0).toLocaleString()} PTS</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// Main App Component & Multi-Lobby Orchestration
// -------------------------------------------------------------
export default function App() {
  const [selectedMode, setSelectedMode] = useState<ConnectionMode | null>("lan")
  const [screen, setScreen] = useState<Screen>("select")
  const [isLaunching, setIsLaunching] = useState(false)
  const [clientId] = useState(() => {
    let id = sessionStorage.getItem("wayfinder_client_id")
    if (!id) {
      id = "op_" + Math.random().toString(36).substring(2, 10)
      sessionStorage.setItem("wayfinder_client_id", id)
    }
    return id
  })
  const [username, setUsername] = useState(
    () => localStorage.getItem("wayfinder_name") || "OPERATIVE-" + Math.floor(10 + Math.random() * 90),
  )
  const [lobbies, setLobbies] = useState<Room[]>([])
  const [activeRoom, setActiveRoom] = useState<Room | null>(null)
  const [roomPlayers, setRoomPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(false)
  const [lanAddress, setLanAddress] = useState("")

  // Game active state
  const [currentRound, setCurrentRound] = useState(1)
  const [totalRounds, setTotalRounds] = useState(5)
  const [uplinkToken, setUplinkToken] = useState<string | null>(null)
  const [roadToken, setRoadToken] = useState<string | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
  const [myPin, setMyPin] = useState<{ lat: number; lng: number } | null>(null)
  const [hasGuessed, setHasGuessed] = useState(false)
  const [totalScore, setTotalScore] = useState(0)
  const [roundResults, setRoundResults] = useState<any>(null)
  const [gameOver, setGameOver] = useState<any>(null)

  // Zero-Trust ECDH & AES State
  const [ecdhKeyPair, setEcdhKeyPair] = useState<CryptoKeyPair | null>(null)
  const [clientPublicKey, setClientPublicKey] = useState<string | null>(null)
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null)

  const ecdhKeyPairRef = useRef<CryptoKeyPair | null>(null)
  const clientPublicKeyRef = useRef<string | null>(null)
  const aesKeyRef = useRef<CryptoKey | null>(null)

  // Create Room Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomRegion, setNewRoomRegion] = useState("all")
  const [newRoomDifficulty, setNewRoomDifficulty] = useState("all")
  const [newRoomRounds, setNewRoomRounds] = useState(5)
  const [newRoomDuration, setNewRoomDuration] = useState(20)

  const socketRef = useRef<Socket | null>(null)

  // Initialize client ECDH keypair on mount
  useEffect(() => {
    generateClientEcdhKeyPair()
      .then(({ keyPair, publicKeyHex }) => {
        setEcdhKeyPair(keyPair)
        setClientPublicKey(publicKeyHex)
        ecdhKeyPairRef.current = keyPair
        clientPublicKeyRef.current = publicKeyHex
      })
      .catch((err) => console.error("Client ECDH generation error:", err))
  }, [])

  // Host heartbeat ping loop (every 2.5s) to sustain the 8s Redis watchdog TTL
  useEffect(() => {
    if (!isHost || !activeRoom) return
    const interval = setInterval(() => {
      if (socketRef.current && activeRoom) {
        socketRef.current.emit("host_heartbeat", { roomId: activeRoom.id })
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [isHost, activeRoom?.id])

  // Fetch LAN info and connect socket
  useEffect(() => {
    localStorage.setItem("wayfinder_name", username)

    fetch("/api/info")
      .then((res) => res.json())
      .then((data) => {
        const hostName = window.location.hostname;
        const isLocal = !hostName || hostName === "localhost" || hostName === "127.0.0.1";
        const ipToUse = !isLocal ? hostName : (data.primaryIp || "localhost");
        const portToUse = window.location.port || data.frontendPort || 3000;
        setLanAddress(`${ipToUse}:${portToUse}`);
      })
      .catch(() => {})

    // Connect to backend via current origin (works behind Nginx proxy)
    const socket = io({
      transports: ["websocket", "polling"],
      query: { clientId, isBrowser: "true" },
    })
    socketRef.current = socket

    socket.on("connect", () => {
      socket.emit("get_lobbies")
    })

    socket.on("lobbies_list", (list: Room[]) => {
      setLobbies(list)
    })

    socket.on("lobby_joined", async (data: any) => {
      setActiveRoom({
        id: data.roomId,
        name: data.roomName,
        hostName: data.hostName,
        hostIp: data.hostIp,
        playerCount: data.players?.length || 1,
        maxPlayers: 8,
        selectedRegion: data.selectedRegion,
        difficulty: data.difficulty,
        totalRounds: data.totalRounds,
        status: data.status,
        ping: 3,
      })
      setIsHost(data.isHost)
      setRoomPlayers(data.players || [])
      setTotalRounds(data.totalRounds || 5)
      setScreen("lobby")

      // Derive in-memory AES-256-GCM session key via ECDH shared secret
      if (data.serverPublicKey && ecdhKeyPairRef.current) {
        try {
          const derived = await deriveAesGcmKey(data.serverPublicKey, ecdhKeyPairRef.current.privateKey)
          setAesKey(derived)
          aesKeyRef.current = derived
        } catch (err) {
          console.error("ECDH key derivation failed:", err)
        }
      }
    })

    socket.on("lobby_update", (data: any) => {
      setRoomPlayers(data.players || [])
      if (data.roomName && activeRoom) {
        setActiveRoom((prev) => (prev ? { ...prev, name: data.roomName } : null))
      }
    })

    socket.on("round_started", (data: any) => {
      setCurrentRound(data.round)
      setTotalRounds(data.totalRounds)
      setUplinkToken(data.uplinkToken)
      setRoadToken(data.roadToken || null)
      setCountdownSeconds(null)
      setMyPin(null)
      setHasGuessed(false)
      setRoundResults(null)
      setGameOver(null)
      setScreen("game")
    })

    socket.on("countdown_started", (data: any) => {
      setCountdownSeconds(data.seconds)
    })

    socket.on("timer_tick", (data: any) => {
      setCountdownSeconds(data.seconds)
    })

    socket.on("round_results", (data: any) => {
      setRoundResults(data)
      const myRes = data.results?.find((r: any) => r.isHost || r.ip)
      if (myRes) {
        setTotalScore(myRes.totalScore)
      }
    })

    socket.on("game_over", (data: any) => {
      setGameOver(data)
    })

    socket.on("return_to_lobby", () => {
      setRoundResults(null)
      setGameOver(null)
      setScreen("lobby")
    })

    socket.on("lobby_terminated", (data: any) => {
      alert(data.message || "Squad leader has disconnected. Expedition disbanded.")
      setActiveRoom(null)
      setAesKey(null)
      aesKeyRef.current = null
      setScreen("browser")
    })

    return () => {
      socket.disconnect()
    }
  }, [username])

  function handleCreateRoomSubmit() {
    if (!socketRef.current) return
    const name = newRoomName.trim() || `${username}'S SQUAD`
    socketRef.current.emit("create_lobby", {
      name,
      username,
      clientPublicKey: clientPublicKeyRef.current || clientPublicKey,
      selectedRegion: newRoomRegion,
      difficulty: newRoomDifficulty,
      totalRounds: newRoomRounds,
      countdownDuration: newRoomDuration,
    })
    setShowCreateModal(false)
  }

  function handleJoinRoom(room: Room) {
    if (!socketRef.current) return
    socketRef.current.emit("join_lobby", {
      roomId: room.id,
      username,
      clientPublicKey: clientPublicKeyRef.current || clientPublicKey,
    })
  }

  function handleLeaveRoom() {
    if (socketRef.current && activeRoom) {
      socketRef.current.emit("leave_lobby", { roomId: activeRoom.id })
    }
    setActiveRoom(null)
    setAesKey(null)
    aesKeyRef.current = null
    setScreen("browser")
  }

  function handleStartMatch() {
    if (socketRef.current && activeRoom) {
      socketRef.current.emit("start_game", { roomId: activeRoom.id })
    }
  }

  async function handleLockGuess() {
    if (!socketRef.current || !myPin || !activeRoom) return
    if (aesKeyRef.current) {
      try {
        const encryptedGuess = await encryptPayload(
          { lat: myPin.lat, lng: myPin.lng, roomId: activeRoom.id },
          aesKeyRef.current,
        )
        socketRef.current.emit("lock_guess", {
          encryptedGuess,
          roomId: activeRoom.id,
        })
      } catch (err) {
        console.error("Failed to encrypt guess, falling back:", err)
        socketRef.current.emit("lock_guess", {
          lat: myPin.lat,
          lng: myPin.lng,
          roomId: activeRoom.id,
        })
      }
    } else {
      socketRef.current.emit("lock_guess", {
        lat: myPin.lat,
        lng: myPin.lng,
        roomId: activeRoom.id,
      })
    }
    setHasGuessed(true)
  }

  function handleNextRound() {
    if (socketRef.current && activeRoom) {
      socketRef.current.emit("next_round", { roomId: activeRoom.id })
    }
  }

  function handleUpdateSettings(settings: any) {
    if (!socketRef.current || !activeRoom) return
    if (settings.region) {
      socketRef.current.emit("set_region", { region: settings.region, roomId: activeRoom.id })
    }
    if (settings.duration) {
      socketRef.current.emit("set_countdown_duration", { duration: settings.duration, roomId: activeRoom.id })
    }
    if (settings.rounds) {
      socketRef.current.emit("set_total_rounds", { rounds: settings.rounds, roomId: activeRoom.id })
    }
    if (settings.difficulty) {
      socketRef.current.emit("set_difficulty", { difficulty: settings.difficulty, roomId: activeRoom.id })
    }
  }

  return (
    <>
      {screen === "select" && (
        <ModeSelect
          isLaunching={isLaunching}
          mode={selectedMode}
          onContinue={() => {
            setIsLaunching(true)
            setTimeout(() => {
              setScreen("browser")
              setIsLaunching(false)
            }, 500)
          }}
          setMode={setSelectedMode}
          setUsername={setUsername}
          username={username}
        />
      )}

      {screen === "browser" && (
        <RoomBrowser
          lobbies={lobbies}
          onBack={() => setScreen("select")}
          onCreate={() => {
            setNewRoomName(`${username}'S SQUAD`)
            setShowCreateModal(true)
          }}
          onJoin={handleJoinRoom}
          username={username}
        />
      )}

      {screen === "lobby" && activeRoom && (
        <Lobby
          hostIp={activeRoom.hostIp}
          isHost={isHost}
          lanAddress={lanAddress}
          onBack={handleLeaveRoom}
          onStart={handleStartMatch}
          onUpdateSettings={handleUpdateSettings}
          players={roomPlayers}
          room={activeRoom}
        />
      )}

      {screen === "game" && activeRoom && (
        <GameScreen
          countdownSeconds={countdownSeconds}
          currentRound={currentRound}
          gameOver={gameOver}
          hasGuessed={hasGuessed}
          isHost={isHost}
          myPin={myPin}
          onExit={handleLeaveRoom}
          onLockGuess={handleLockGuess}
          onNextRound={handleNextRound}
          onSelectCoords={(coords) => setMyPin(coords)}
          room={activeRoom}
          roundResults={roundResults}
          totalRounds={totalRounds}
          totalScore={totalScore}
          uplinkToken={uplinkToken}
          roadToken={roadToken}
        />
      )}

      {/* Modal: Create Squad Room */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-title">
                <Icon name="crown" size={22} />
                CREATE SQUAD EXPEDITION
              </div>
              <ButtonElement
                className="text-slate-400 hover:text-white font-mono text-lg"
                onClick={() => setShowCreateModal(false)}
                type="button"
              >
                ✕
              </ButtonElement>
            </div>

            <div className="modal-field">
              <label className="modal-label">SQUAD CODENAME / ROOM NAME</label>
              <input
                className="modal-input uppercase"
                maxLength={24}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="E.G. TITAN EXPLORERS"
                type="text"
                value={newRoomName}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="modal-field">
                <label className="modal-label">MAP REGION</label>
                <select
                  className="modal-select"
                  onChange={(e) => setNewRoomRegion(e.target.value)}
                  value={newRoomRegion}
                >
                  <option value="all">WORLDWIDE (ALL)</option>
                  <option value="north_america">NORTH AMERICA</option>
                  <option value="europe">EUROPE</option>
                  <option value="asia">ASIA</option>
                  <option value="latin_america">LATIN AMERICA</option>
                </select>
              </div>

              <div className="modal-field">
                <label className="modal-label">DIFFICULTY</label>
                <select
                  className="modal-select"
                  onChange={(e) => setNewRoomDifficulty(e.target.value)}
                  value={newRoomDifficulty}
                >
                  <option value="all">ALL LEVELS</option>
                  <option value="easy">EASY (URBAN / MAJORS)</option>
                  <option value="medium">MEDIUM</option>
                  <option value="hard">HARD (REMOTE ROADS)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="modal-field">
                <label className="modal-label">EXPEDITION ROUNDS</label>
                <select
                  className="modal-select"
                  onChange={(e) => setNewRoomRounds(Number(e.target.value))}
                  value={newRoomRounds}
                >
                  <option value={3}>3 ROUNDS</option>
                  <option value={5}>5 ROUNDS</option>
                  <option value={10}>10 ROUNDS</option>
                </select>
              </div>

              <div className="modal-field">
                <label className="modal-label">COUNTDOWN TIMER</label>
                <select
                  className="modal-select"
                  onChange={(e) => setNewRoomDuration(Number(e.target.value))}
                  value={newRoomDuration}
                >
                  <option value={15}>15 SECONDS</option>
                  <option value={20}>20 SECONDS</option>
                  <option value={30}>30 SECONDS</option>
                  <option value={60}>60 SECONDS</option>
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <GameButton onClick={() => setShowCreateModal(false)} variant="ghost">
                CANCEL
              </GameButton>
              <GameButton icon="crown" onClick={handleCreateRoomSubmit} variant="primary">
                CREATE & TAKE CROWN 👑
              </GameButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
