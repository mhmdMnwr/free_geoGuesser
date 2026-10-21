import { useState, useEffect } from "react"
import "./lobby.css"
import { EffectsLayer } from "../../shared/components/EffectsLayer"
import { Icon } from "../../shared/components/Icon"
import { GameButton } from "../../shared/components/GameButton"
import { LeafletMapView } from "../game/components/LeafletMapView"
import { AdmissionQueue } from "./components/AdmissionQueue"
import type { Room, Player, PendingRequest } from "../../types/game"

interface LobbyProps {
  room: Room
  players: Player[]
  isHost: boolean
  hostIp: string | null
  lanAddress: string
  pendingRequests?: PendingRequest[]
  onBack: () => void
  onStart: () => void
  onKickPlayer?: (targetId: string) => void
  onAdmitPlayer?: (clientId: string) => void
  onRejectPlayer?: (clientId: string) => void
  onUpdateSettings: (settings: {
    region?: string
    rounds?: number
    duration?: number
    difficulty?: string
    maxPlayers?: number
  }) => void
}

export function Lobby({
  room,
  players,
  isHost,
  lanAddress,
  onBack,
  onStart,
  onKickPlayer,
  onAdmitPlayer,
  onRejectPlayer,
  onUpdateSettings,
  pendingRequests = [],
}: LobbyProps) {
  const [copied, setCopied] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState(room.selectedRegion || "all")
  const [selectedDuration, setSelectedDuration] = useState(20)
  const [selectedRounds, setSelectedRounds] = useState(room.totalRounds || 5)

  useEffect(() => {
    if (room.selectedRegion) setSelectedRegion(room.selectedRegion)
  }, [room.selectedRegion])

  useEffect(() => {
    if (room.totalRounds) setSelectedRounds(room.totalRounds)
  }, [room.totalRounds])

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

  function handleMaxPlayersChange(maxPlayers: number) {
    if (!isHost) return
    onUpdateSettings({ maxPlayers })
  }

  return (
    <main className="lobby-screen">
      <EffectsLayer />
      <div className="ambient-grid" />
      <header className="lobby-nav">
        <GameButton icon="back" onClick={onBack} variant="ghost" style={{ marginLeft: 0 }}>
          EXIT SQUAD
        </GameButton>
        <div className="logo" style={{ marginLeft: "auto" }}>
          <span className="logo-icon">
            <Icon name="researcher" size={24} />
          </span>
          <span>THEgeoguesser</span>
        </div>
      </header>

      <div className="lobby-content">
        <section className="lobby-hero">
          <div>
            <div className="section-index">/ EXPEDITION ROOM {room.id}</div>
            <div className="lobby-title" data-text={room.name}>{room.name}</div>
            <div className="lobby-subtitle">
              Squad up. Lock in. Discover secret road locations together over LAN.
            </div>
          </div>
          <div className="session-code">
            <div>
              <span>LAN HOST IP</span>
              <strong>{lanAddress || "127.0.0.1:3000"}</strong>
            </div>
            <button
              aria-label="Copy LAN address"
              className="copy-button"
              onClick={copyCode}
              type="button"
            >
              <Icon name={copied ? "check" : "copy"} />
            </button>
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
                const initials = (player.username || "OP").slice(0, 2).toUpperCase()
                const colors = ["lime", "cyan", "violet", "orange"]
                const color = colors[index % colors.length]

                return (
                  <div className="player" key={player.id || player.username}>
                    <span className="player-index">{String(index + 1).padStart(2, "0")}</span>
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
                      <small>{player.isHost ? "SQUAD LEADER // READY" : "OPERATIVE // ARMED"}</small>
                    </span>
                    <span className="player-state player-state--ready flex items-center gap-2">
                      <Icon name="check" size={16} />
                      READY
                      {isHost && !player.isHost && onKickPlayer && (
                        <button
                          aria-label={`Kick ${player.username}`}
                          className="kick-btn ml-1 px-2 py-0.5 text-xs font-mono font-bold text-rose-400 hover:text-white bg-rose-950/70 hover:bg-rose-700 border border-rose-700 rounded transition-all cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (window.confirm(`Kick operative "${player.username}" from the squad?`)) {
                              onKickPlayer(player.id || player.ip)
                            }
                          }}
                          title="Kick Operative"
                          type="button"
                        >
                          ✕ KICK
                        </button>
                      )}
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

          {/* Admission Queue — host only */}
          {isHost && onAdmitPlayer && onRejectPlayer && (
            <AdmissionQueue
              pendingRequests={pendingRequests}
              onAdmit={onAdmitPlayer}
              onReject={onRejectPlayer}
            />
          )}

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
                  <button
                    className={selectedRegion === option.id ? "active" : ""}
                    disabled={!isHost}
                    key={option.id}
                    onClick={() => handleRegionChange(option.id)}
                    type="button"
                  >
                    <span>{option.label}</span>
                    <i>{selectedRegion === option.id ? "ACTIVE" : ""}</i>
                  </button>
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
                  <button
                    className={selectedDuration === option ? "active" : ""}
                    disabled={!isHost}
                    key={option}
                    onClick={() => handleDurationChange(option)}
                    type="button"
                  >
                    {option}s
                  </button>
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
                  <button
                    className={selectedRounds === option ? "active" : ""}
                    disabled={!isHost}
                    key={option}
                    onClick={() => handleRoundsChange(option)}
                    type="button"
                  >
                    {option} RNDS
                  </button>
                ))}
              </div>
            </div>

            <div className="config-block">
              <span className="config-label">
                <Icon name="players" size={17} />
                MAX OPERATIVES
              </span>
              <div className="timer-options">
                {[2, 4, 8, 12, 16].map((option) => (
                  <button
                    className={(room.maxPlayers || 8) === option ? "active" : ""}
                    disabled={!isHost}
                    key={option}
                    onClick={() => handleMaxPlayersChange(option)}
                    type="button"
                  >
                    {option} OPS
                  </button>
                ))}
              </div>
            </div>

            <div className="config-block">
              <span className="config-label">
                <Icon name="map" size={17} />
                TACTICAL THEATER ATLAS
              </span>
              <div
                className="lobby-map-preview rounded-lg overflow-hidden border border-slate-700/60"
                style={{ height: "200px", minHeight: "200px", width: "100%", position: "relative" }}
              >
                <LeafletMapView pin={null} interactive={false} zoom={1} />
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
            <GameButton className="ready-button" icon="arrow" onClick={onStart} variant="primary">
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
