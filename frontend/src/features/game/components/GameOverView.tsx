import { GameButton } from "../../../shared/components/GameButton"
import { Podium } from "./Podium"

interface GameOverViewProps {
  leaderboard: any[]
  isHost: boolean
  onReturnToLobby?: () => void
  onExit: () => void
}

export function GameOverView({
  leaderboard,
  isHost,
  onReturnToLobby,
  onExit,
}: GameOverViewProps) {
  return (
    <section className="leaderboard-view">
      <div className="leaderboard-heading">
        <span className="section-index">EXPEDITION COMPLETE</span>
        <div className="atlas-title">FINAL STANDINGS</div>
        <p>All rounds completed. Standings based on total distance and speed.</p>
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
      <div className="mt-8 flex justify-center gap-4">
        {isHost ? (
          <GameButton icon="back" onClick={onReturnToLobby || onExit} variant="primary">
            RETURN TO SQUAD LOBBY
          </GameButton>
        ) : (
          <GameButton icon="back" onClick={onExit} variant="outline">
            EXIT MATCH
          </GameButton>
        )}
      </div>
    </section>
  )
}

export default GameOverView
