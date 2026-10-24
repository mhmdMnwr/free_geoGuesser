import { useEffect, useState } from "react"
import type { CrownVoteNotice } from "../../types/game"

interface CrownVoteBannerProps {
  voteNotice: CrownVoteNotice
  hasVoted: boolean
  onVote: (vote: "yes" | "no") => void
}

export default function CrownVoteBanner({
  voteNotice,
  hasVoted,
  onVote,
}: CrownVoteBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState(voteNotice.timeoutSeconds || 8)
  const [myVote, setMyVote] = useState<"yes" | "no" | null>(null)

  useEffect(() => {
    setSecondsLeft(voteNotice.timeoutSeconds || 8)
    setMyVote(null)
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [voteNotice])

  useEffect(() => {
    if (!hasVoted) setMyVote(null)
  }, [hasVoted])

  const total = voteNotice.timeoutSeconds || 8
  const pct = Math.max(0, Math.min(100, (secondsLeft / total) * 100))

  return (
    <aside
      aria-live="assertive"
      className="fixed left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-in fade-in slide-in-from-top-4 duration-200"
      style={{ top: "calc(var(--sat, 0px) + 12px)" }}
    >
      <div className="relative overflow-hidden rounded-xl border border-cyan-500/80 bg-neutral-950/95 p-4 shadow-2xl shadow-cyan-950/50 backdrop-blur-md">
        <div
          className="absolute top-0 left-0 h-1 bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🗳️</span>
            <div>
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-cyan-300">
                Squad Referendum // Elect New Leader
              </h2>
              <p className="text-xs text-neutral-300">
                Should operative <strong className="text-white font-bold">{voteNotice.claimantUsername}</strong> take the Crown?
              </p>
              <div className="flex items-center gap-3 text-[11px] font-mono text-neutral-400 mt-1">
                <span>
                  YES: <strong className="text-emerald-400 font-bold">{voteNotice.yesCount}</strong>
                </span>
                <span>
                  NO: <strong className="text-rose-400 font-bold">{voteNotice.noCount}</strong>
                </span>
                <span className="text-neutral-500">
                  (Eligible: {voteNotice.totalEligible})
                </span>
                <span className="text-cyan-400 font-bold ml-1">
                  {secondsLeft}s left
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {hasVoted || myVote ? (
              <div className="px-3 py-1.5 text-xs font-mono font-bold uppercase rounded border border-neutral-700 bg-neutral-900/90 text-neutral-300">
                Vote: <span className={myVote === "yes" ? "text-emerald-400" : "text-rose-400"}>{myVote?.toUpperCase() || "REGISTERED"}</span>
              </div>
            ) : (
              <>
                <button
                  className="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider rounded border border-rose-500/80 bg-rose-950/80 hover:bg-rose-900 text-rose-200 hover:text-white transition-all cursor-pointer"
                  onClick={() => {
                    setMyVote("no")
                    onVote("no")
                  }}
                  type="button"
                >
                  👎 NO
                </button>
                <button
                  className="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider rounded border border-emerald-500 bg-emerald-600 hover:bg-emerald-500 text-white font-black transition-all cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                  onClick={() => {
                    setMyVote("yes")
                    onVote("yes")
                  }}
                  type="button"
                >
                  👍 YES
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
