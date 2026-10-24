import { Icon } from "../../../shared/components/Icon"
import type { Room } from "../../../types/game"
import type { GameViewMode } from "./GameHudTop"

interface MobileGameHudProps {
  room: Room
  view: GameViewMode
  setView: (view: GameViewMode) => void
  currentRound: number
  totalRounds: number
  isHost: boolean
  countdownSeconds: number | null
  showTimer: boolean
  onReturnToLobby?: () => void
  onExit: () => void
  onDemandCrown?: () => void
  crownClaimPending?: boolean
}

export default function MobileGameHud({
  room,
  view,
  setView,
  currentRound,
  totalRounds,
  isHost,
  countdownSeconds,
  showTimer,
  onReturnToLobby,
  onExit,
  onDemandCrown,
  crownClaimPending,
}: MobileGameHudProps) {
  const isUrgent = countdownSeconds !== null && countdownSeconds <= 10

  const handleExit = () => {
    if (isHost) {
      if (window.confirm("Stop the match and return all operatives to the squad lobby?")) {
        onReturnToLobby?.()
      }
    } else {
      if (window.confirm("Leave this match and return to the main menu?")) {
        onExit()
      }
    }
  }

  return (
    <header className="game-hud-compact md:hidden">
      <div className="hud-left">
        <button
          aria-label={isHost ? "Return to Lobby" : "Exit Match"}
          className="hud-icon-btn"
          onClick={handleExit}
          title={isHost ? "Return Squad to Lobby" : "Exit Match"}
          type="button"
        >
          <Icon name="back" size={18} />
        </button>
        <span className="hud-room-tag">
          {room.code || room.id}
        </span>
      </div>

      <div className="hud-center">
        <div className={`hud-status-pill ${isUrgent ? "hud-status-pill--urgent" : ""}`}>
          <span className="hud-round-badge">
            R{currentRound}/{totalRounds}
          </span>
          {countdownSeconds !== null && showTimer && (
            <>
              <span className="hud-pill-divider" />
              <span className="hud-timer-badge">
                ⏱ {String(Math.floor(countdownSeconds / 60)).padStart(2, "0")}:{String(countdownSeconds % 60).padStart(2, "0")}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="hud-right">
        {!isHost && onDemandCrown && (
          <button
            aria-label="Demand Crown"
            className="hud-crown-btn"
            disabled={crownClaimPending}
            onClick={onDemandCrown}
            title="Demand Squad Leadership"
            type="button"
          >
            👑
          </button>
        )}

        <button
          aria-label="View Standings"
          className={`hud-icon-btn ${view === "standings" ? "hud-icon-btn--active" : ""}`}
          onClick={() => setView(view === "standings" ? "explore" : "standings")}
          title="Live Standings"
          type="button"
        >
          <Icon name="chart" size={18} />
        </button>
      </div>
    </header>
  )
}
