import { useEffect, useState } from "react"
import type { CrownDemandNotice } from "../../types/game"

interface CrownDemandBannerProps {
  demandNotice: CrownDemandNotice
  onRespondDemand: (accept: boolean) => void
}

export default function CrownDemandBanner({
  demandNotice,
  onRespondDemand,
}: CrownDemandBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState(demandNotice.timeoutSeconds || 4)

  useEffect(() => {
    setSecondsLeft(demandNotice.timeoutSeconds || 4)
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
  }, [demandNotice])

  const total = demandNotice.timeoutSeconds || 4
  const pct = Math.max(0, Math.min(100, (secondsLeft / total) * 100))

  return (
    <aside
      aria-live="assertive"
      className="fixed left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-in fade-in slide-in-from-top-4 duration-200"
      style={{ top: "calc(var(--sat, 0px) + 12px)" }}
    >
      <div className="relative overflow-hidden rounded-xl border border-amber-500/80 bg-neutral-950/95 p-4 shadow-2xl shadow-amber-950/50 backdrop-blur-md">
        <div
          className="absolute top-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bounce">👑</span>
            <div>
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-amber-300">
                Host Challenge // Crown Demanded
              </h2>
              <p className="text-xs text-neutral-300">
                Operative <strong className="text-white font-bold">{demandNotice.claimantUsername}</strong> wants the Crown!
              </p>
              <p className="text-[11px] font-mono text-amber-400/80 mt-0.5">
                Refusing or ignoring in: <span className="font-bold text-white">{secondsLeft}s</span> (triggers squad vote)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              className="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider rounded border border-rose-500/80 bg-rose-950/80 hover:bg-rose-900 text-rose-200 hover:text-white transition-all cursor-pointer"
              onClick={() => onRespondDemand(false)}
              type="button"
            >
              Refuse
            </button>
            <button
              className="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider rounded border border-amber-400 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black transition-all cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.4)]"
              onClick={() => onRespondDemand(true)}
              type="button"
            >
              Yield Crown 👑
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
