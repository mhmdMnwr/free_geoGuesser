interface LiveStandingsWidgetProps {
  leaderboard: any[]
  currentRound: number
  totalRounds: number
  totalScore: number
  className?: string
}

export function LiveStandingsWidget({
  leaderboard,
  currentRound,
  totalRounds,
  totalScore,
  className = "",
}: LiveStandingsWidgetProps) {
  const guessedCount = leaderboard.filter((p) => p.hasGuessed).length

  return (
    <aside className={`live-standings-widget ${className}`}>
      <div className="live-standings-header">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-200 uppercase">
            LIVE STANDINGS
          </span>
        </div>
        <span className="font-mono text-[10px] text-[#43dcff] font-bold">
          {guessedCount}/{leaderboard.length} GUESSED
        </span>
      </div>

      <div className="live-standings-sub">
        <span>R{String(currentRound).padStart(2, "0")}/{String(totalRounds).padStart(2, "0")}</span>
        <span className="text-[#c7ff3d] font-bold">{totalScore.toLocaleString()} PTS</span>
      </div>

      <div className="live-standings-list">
        {leaderboard.map((p) => (
          <div
            className={`live-standings-row ${p.isLocal ? "live-standings-row--you" : ""}`}
            key={p.username || p.id}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="live-rank font-mono text-xs font-bold text-slate-400">
                {p.rank === 1 ? "👑" : `#${p.rank}`}
              </span>
              <span className="live-name truncate text-xs font-semibold text-slate-200">
                {p.username}
                {p.isLocal && (
                  <span className="text-[10px] text-[#c7ff3d] ml-1 font-mono font-bold">[YOU]</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`live-guess-pill font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  p.hasGuessed
                    ? "bg-[#c7ff3d]/15 text-[#c7ff3d] border border-[#c7ff3d]/40"
                    : "bg-[#43dcff]/10 text-[#43dcff] border border-[#43dcff]/30 animate-pulse"
                }`}
              >
                {p.hasGuessed ? "✓ LOCKED" : "⌛ THINKING"}
              </span>
              <span className="live-score font-mono text-xs font-bold text-[#43dcff]">
                {(p.totalScore || 0).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

export default LiveStandingsWidget
