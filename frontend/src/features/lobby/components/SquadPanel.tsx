import { Icon } from "../../../shared/components/Icon"
import type { Player } from "../../../types/game"

interface SquadPanelProps {
  players: Player[]
  maxPlayers: number
  isHost: boolean
  onKickPlayer?: (targetId: string) => void
  onDemandCrown?: () => void
  crownClaimPending?: boolean
}

const AVATAR_COLORS = ["lime", "cyan", "violet", "orange"] as const

export function SquadPanel({
  players,
  maxPlayers,
  isHost,
  onKickPlayer,
  onDemandCrown,
  crownClaimPending,
}: SquadPanelProps) {
  const effectiveMax = maxPlayers || 8
  const emptyCount = Math.max(0, effectiveMax - players.length)

  return (
    <section className="panel squad-panel">
      <div className="panel-heading flex items-center justify-between">
        <div>
          <div className="panel-label">
            <Icon name="players" />
            SQUAD OPERATIVES
          </div>
          <span className="panel-caption">
            {players.length} / {effectiveMax} OPERATIVES READY
          </span>
        </div>

        {!isHost && onDemandCrown && (
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider text-amber-300 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/60 rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(245,158,11,0.2)]"
            disabled={crownClaimPending}
            onClick={onDemandCrown}
            title="Challenge Squad Leadership"
            type="button"
          >
            👑 {crownClaimPending ? "CHALLENGING..." : "DEMAND CROWN"}
          </button>
        )}
      </div>

      <div className="squad-list">
        {players.map((player, index) => {
          const initials = (player.username || "OP").slice(0, 2).toUpperCase()
          const color = AVATAR_COLORS[index % AVATAR_COLORS.length]

          return (
            <div className="player" key={player.id || player.username}>
              <span className="player-index">{String(index + 1).padStart(2, "0")}</span>
              <span className={`avatar avatar--${color}`}>{initials}</span>
              <span className="player-info">
                <strong>
                  {player.username}
                  {player.isHost && (
                    <i className="inline-flex items-center gap-1 font-bold">
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

        {Array.from({ length: emptyCount }, (_, i) => (
          <div className="empty-slots" key={i}>
            <span className="empty-icon">
              <Icon name="plus" />
            </span>
            <span>
              <strong>OPEN POSITION</strong>
              <small>Waiting for operative to connect...</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default SquadPanel
