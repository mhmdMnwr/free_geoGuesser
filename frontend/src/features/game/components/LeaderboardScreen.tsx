import { Podium } from "./Podium"
import { Icon } from "../../../shared/components/Icon"

export function LeaderboardScreen({
  leaderboard,
  onClose,
}: {
  leaderboard: any[]
  onClose?: () => void
}) {
  const safeList = Array.isArray(leaderboard) ? leaderboard : []

  return (
    <section className="leaderboard-view">
      {onClose && (
        <div className="mb-4">
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-bold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            onClick={onClose}
            type="button"
          >
            <Icon name="back" size={16} />
            <span>BACK TO STREET VIEW</span>
          </button>
        </div>
      )}
      <div className="leaderboard-heading">
        <span className="section-index">LIVE EXPEDITION STANDINGS</span>
        <div className="atlas-title">SQUAD RANKINGS</div>
        <p>Positions update in real time as scores are locked.</p>
      </div>

      {safeList.length > 0 ? (
        <>
          <Podium players={safeList} />
          <div className="standing-list">
            {safeList.map((player: any, idx: number) => (
              <div className="standing-row" key={player.username || player.id || idx}>
                <span className="standing-rank">{String(idx + 1).padStart(2, "0")}</span>
                <span className="avatar avatar--cyan">{String(player.username || "OP").slice(0, 2).toUpperCase()}</span>
                <span className="standing-name">
                  <strong>
                    {player.username}
                    {player.isLocal && <span className="text-sky-400 text-xs ml-2 font-mono font-bold">[YOU]</span>}
                    {player.isHost && <span className="text-amber-400 text-xs ml-1 font-bold">👑</span>}
                  </strong>
                  {player.hasGuessed != null && (
                    <small className={player.hasGuessed ? "text-emerald-400 font-mono font-bold" : "text-amber-400 font-mono"}>
                      {player.hasGuessed ? "✓ GUESS LOCKED IN" : "⌛ EXPLORING & ESTIMATING"}
                    </small>
                  )}
                </span>
                <strong className="standing-score">{(player.totalScore || 0).toLocaleString()} PTS</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-12 p-8 text-center font-mono text-slate-400 border border-slate-800 rounded-xl bg-slate-900/60">
          WAITING FOR OPERATIVES TO COMMENCE EXPEDITION...
        </div>
      )}
    </section>
  )
}
