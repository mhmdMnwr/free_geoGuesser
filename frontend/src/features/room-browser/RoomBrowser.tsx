import "./room-browser.css"
import { EffectsLayer } from "../../shared/components/EffectsLayer"
import { Icon } from "../../shared/components/Icon"
import { GameButton } from "../../shared/components/GameButton"
import type { Room } from "../../types/game"

interface RoomBrowserProps {
  lobbies: Room[]
  username: string
  errorMessage?: string | null
  onBack: () => void
  onCreate: () => void
  onJoin: (room: Room) => void
  onUsernameChange?: (name: string) => void
}

function renderStatusBadge(room: Room) {
  if (room.status === "ROUND_ACTIVE") {
    return (
      <span className="status-badge status-badge--active">
        ⚔ MATCH {room.currentRound ? `(R${room.currentRound}/${room.totalRounds})` : "ACTIVE"}
      </span>
    )
  }
  if (room.status === "ROUND_COUNTDOWN") {
    return <span className="status-badge status-badge--countdown">⏱ COUNTDOWN</span>
  }
  if (room.status === "ROUND_RESULTS") {
    return <span className="status-badge status-badge--results">📊 SCORING</span>
  }
  if (room.status === "GAME_OVER") {
    return <span className="status-badge status-badge--ended">🏆 FINISHED</span>
  }
  return <span className="status-badge status-badge--lobby">● OPEN LOBBY</span>
}

export function RoomBrowser({ lobbies, username, errorMessage, onBack, onCreate, onJoin, onUsernameChange }: RoomBrowserProps) {
  return (
    <main className="browser-screen">
      <EffectsLayer />
      <div className="ambient-grid" />
      <header className="lobby-nav">
        <div className="flex items-center gap-3">
          <GameButton icon="back" onClick={onBack} variant="ghost" style={{ marginLeft: 0 }}>
            MAIN MENU
          </GameButton>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border border-slate-700 rounded-lg text-xs font-mono">
            <span className="text-slate-400">CODENAME:</span>
            <input
              type="text"
              maxLength={18}
              value={username}
              onChange={(e) => onUsernameChange?.(e.target.value)}
              className="bg-transparent text-cyan-400 font-bold uppercase tracking-wider outline-none w-36 border-b border-transparent focus:border-cyan-400 transition-colors"
              title="Click to edit your codename"
              placeholder="YOUR CODENAME"
            />
          </div>
        </div>
        <div className="logo" style={{ marginLeft: "auto" }}>
          <span className="logo-icon">
            <Icon name="researcher" size={24} />
          </span>
          <span>THEgeoguesser</span>
        </div>
      </header>

      <div className="browser-content">
        <section className="browser-heading">
          <div>
            <div className="section-index">/ LAN EXPEDITION REGISTRY</div>
            <div className="lobby-title browser-title" data-text="ACTIVE SQUADS">
              AVAILABLE SQUADS
            </div>
            <div className="lobby-subtitle">
              {lobbies.length} squads discovered on your local network. Multiple games can run concurrently. Any operative can host 👑.
            </div>
          </div>
          <GameButton icon="plus" onClick={onCreate}>
            CREATE SQUAD ROOM
          </GameButton>
        </section>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950/90 border border-rose-700 rounded-lg text-rose-300 font-mono text-sm flex items-center gap-3">
            <span className="text-rose-400 font-bold">⚠ ACCESS DENIED:</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <section className="room-browser panel">
          <div className="room-table-head">
            <span>SQUAD / HOST</span>
            <span>STATE</span>
            <span>OPERATIVES</span>
            <span>REGION / DIFF</span>
            <span />
          </div>
          <div className="room-list">
            {lobbies.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-mono text-sm">
                NO ACTIVE SQUADS FOUND. CLICK "CREATE SQUAD ROOM" TO HOST!
              </div>
            ) : (
              lobbies.map((room, index) => {
                const occupancy = Math.round((room.playerCount / room.maxPlayers) * 100)
                const isFull = room.playerCount >= room.maxPlayers

                return (
                  <div
                    className={`room-row room-row--${(index % 4) + 1} cursor-pointer`}
                    key={room.id}
                    onClick={() => {
                      if (!isFull) onJoin(room)
                    }}
                  >
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

                    <div className="room-status-cell">
                      {renderStatusBadge(room)}
                    </div>

                    <div className="room-players">
                      <span>
                        <Icon name="players" size={17} />
                        <strong>{room.playerCount}</strong> / {room.maxPlayers}
                      </span>
                      <i>
                        <b className={`occupancy-${occupancy}`} />
                      </i>
                    </div>

                    <span className="room-map uppercase font-mono text-xs text-sky-400">
                      {room.selectedRegion || "WORLD"} · {room.difficulty || "ALL"}
                    </span>

                    {isFull ? (
                      <button className="btn-full" disabled type="button">
                        FULL
                      </button>
                    ) : (
                      <GameButton
                        icon="arrow"
                        onClick={(e) => {
                          e.stopPropagation()
                          onJoin(room)
                        }}
                        variant="outline"
                      >
                        {room.status === "LOBBY" ? "JOIN SQUAD" : "JOIN MATCH"}
                      </GameButton>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
