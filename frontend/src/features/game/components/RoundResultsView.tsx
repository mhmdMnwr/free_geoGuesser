import { GameButton } from "../../../shared/components/GameButton"
import { LeafletMapView } from "./LeafletMapView"
import type { Coordinates } from "../../../types/game"
import type { PlayerGuessResult } from "../utils/leafletMarkers"

interface RoundResultsViewProps {
  currentRound: number
  totalRounds: number
  isHost: boolean
  myPin: Coordinates | null
  target: any
  playerGuesses: PlayerGuessResult[]
  myDistanceKm: number | null
  myRoundScore: number
  closestPlayer: any
  currentLeaderboard: any[]
  onNextRound: () => void
  onReturnToLobby?: () => void
}

export function RoundResultsView({
  currentRound,
  totalRounds,
  isHost,
  myPin,
  target,
  playerGuesses,
  myDistanceKm,
  myRoundScore,
  closestPlayer,
  currentLeaderboard,
  onNextRound,
  onReturnToLobby,
}: RoundResultsViewProps) {
  const actualLabel =
    target?.label ||
    (target?.country ? `${target.country}${target.region ? ` (${target.region})` : ""}` : "VERIFIED ROAD")

  return (
    <section className="round-result">
      <div className="result-map">
        <LeafletMapView interactive={true} pin={myPin} playerGuesses={playerGuesses} targetCoords={target} />
      </div>

      <div className="result-details">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="section-index">
              ROUND {String(currentRound).padStart(2, "0")} / {String(totalRounds).padStart(2, "0")} COMPLETE
            </span>
            <span className="text-xs font-mono text-[#c7ff3d] px-2.5 py-0.5 bg-[#c7ff3d]/10 border border-[#c7ff3d]/40 rounded font-bold">
              TARGET REVEALED
            </span>
          </div>

          <div className="result-title">
            {myDistanceKm != null ? `${myDistanceKm.toLocaleString()} KM` : "MISSED GUESS"}
          </div>

          <div className="result-location">
            <span>🎯 ACTUAL: </span>
            <span className="text-slate-200">{actualLabel}</span>
          </div>

          <div className="result-score">
            <span>
              <small>POINTS EARNED</small>
              <strong className="text-[#c7ff3d]">+{myRoundScore.toLocaleString()}</strong>
            </span>
            <span>
              <small>CLOSEST EXPLORER</small>
              <strong className="text-[#43dcff] truncate">
                {closestPlayer?.username ? `👑 ${closestPlayer.username}` : "NONE"}
              </strong>
              {closestPlayer?.distanceKm != null && (
                <span className="text-xs font-mono text-slate-400 mt-0.5">
                  {Math.round(closestPlayer.distanceKm).toLocaleString()} KM
                </span>
              )}
            </span>
          </div>

          <div className="round-leaderboard-container mt-3 mb-3">
            <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2 flex items-center justify-between">
              <span>STANDINGS AFTER ROUND {currentRound}</span>
              <span className="text-slate-500 font-bold">{currentLeaderboard.length} OPERATIVES</span>
            </div>
            <div className="round-leaderboard-list max-h-48 overflow-y-auto pr-1">
              {currentLeaderboard.map((player: any) => (
                <div
                  className={`round-leaderboard-item ${player.isLocal ? "round-leaderboard-item--you" : ""}`}
                  key={player.username}
                >
                  <span className="round-rank font-mono text-xs font-bold text-slate-400">
                    {player.rank === 1 ? "👑 01" : String(player.rank).padStart(2, "0")}
                  </span>
                  <span className="round-player-name truncate font-semibold text-sm">
                    {player.username}
                    {player.isLocal && <span className="you-pill ml-1.5 text-xs font-mono text-sky-400 font-bold">[YOU]</span>}
                    {player.isHost && <span className="host-pill ml-1 text-xs font-mono text-amber-400 font-bold">👑</span>}
                  </span>
                  <span className="round-player-dist font-mono text-xs text-slate-400">
                    {player.distanceKm != null ? `${Math.round(player.distanceKm)} km` : "MISSED"}
                  </span>
                  <span className="round-player-score font-mono text-sm font-bold text-sky-400 text-right">
                    {(player.totalScore || 0).toLocaleString()} PTS
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="result-actions mt-2 flex flex-col sm:flex-row gap-3">
          {isHost ? (
            <>
              <GameButton icon="arrow" onClick={onNextRound} variant="primary">
                {currentRound >= totalRounds ? "FINALIZE EXPEDITION" : "ADVANCE TO NEXT ROUND"}
              </GameButton>
              <GameButton
                onClick={() => {
                  if (window.confirm("Stop the match and return all operatives to the lobby?")) {
                    onReturnToLobby?.()
                  }
                }}
                variant="outline"
              >
                RETURN TO LOBBY
              </GameButton>
            </>
          ) : (
            <div className="w-full py-3 px-4 bg-slate-900/95 border border-slate-700/80 rounded-xl flex items-center justify-center gap-2.5">
              <span className="inline-block w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
              <span className="text-xs font-mono text-amber-300 font-bold uppercase tracking-wider">
                WAITING FOR SQUAD LEADER 👑 TO ADVANCE
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default RoundResultsView
