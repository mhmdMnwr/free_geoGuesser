import { Icon } from "../../../shared/components/Icon"
import { GameButton } from "../../../shared/components/GameButton"
import type { Room } from "../../../types/game"
import type { GameViewMode } from "./GameHudTop"

interface DesktopGameHudProps {
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

export default function DesktopGameHud({
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
}: DesktopGameHudProps) {
  return (
    <>
      <header className="game-hud-top hidden md:grid">
        <div className="game-brand">
          <span className="logo-icon">
            <Icon name="researcher" size={22} />
          </span>
          <span>
            <strong>guessiha</strong>
            <small>ROOM: {room.id} // {room.name}</small>
          </span>
        </div>

        <div className="game-view-switcher">
          {(["explore", "atlas", "standings"] as const).map((item) => (
            <button
              className={view === item ? "active" : ""}
              key={item}
              onClick={() => setView(item)}
              type="button"
            >
              {item === "explore"
                ? "STREET VIEW [G]"
                : item === "atlas"
                  ? "FULL ATLAS [M]"
                  : "STANDINGS [S]"}
            </button>
          ))}
        </div>

        <div className="game-meta">
          <span>
            <small>ROUND</small>
            <strong>
              {String(currentRound).padStart(2, "0")} / {String(totalRounds).padStart(2, "0")}
            </strong>
          </span>
          {!isHost && onDemandCrown && (
            <button
              className="px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300 bg-amber-950/70 hover:bg-amber-900 border border-amber-600/70 rounded transition-all cursor-pointer disabled:opacity-50"
              disabled={crownClaimPending}
              onClick={onDemandCrown}
              title="Demand Squad Leadership"
              type="button"
            >
              👑 {crownClaimPending ? "CHALLENGING..." : "DEMAND CROWN"}
            </button>
          )}
          {isHost ? (
            <GameButton
              icon="back"
              onClick={() => {
                if (window.confirm("Stop the match and return all operatives to the lobby?")) {
                  onReturnToLobby?.()
                }
              }}
              title="Stop Match & Return to Lobby"
              variant="outline"
            >
              RETURN TO LOBBY
            </GameButton>
          ) : (
            <GameButton icon="back" onClick={onExit} variant="ghost">
              EXIT
            </GameButton>
          )}
        </div>
      </header>

      {countdownSeconds !== null && showTimer && (
        <div className={`game-timer hidden md:flex ${countdownSeconds <= 5 ? "game-timer--urgent" : ""}`}>
          <Icon name="clock" size={18} />
          <span>
            {`${String(Math.floor(countdownSeconds / 60)).padStart(2, "0")}:${String(countdownSeconds % 60).padStart(2, "0")}`}
          </span>
        </div>
      )}
    </>
  )
}
