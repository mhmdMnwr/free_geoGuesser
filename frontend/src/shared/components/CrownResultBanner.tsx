import type { CrownElectionResult } from "../../types/game"

interface CrownResultBannerProps {
  electionResult: CrownElectionResult
  onDismissResult?: () => void
}

export default function CrownResultBanner({
  electionResult,
  onDismissResult,
}: CrownResultBannerProps) {
  const isSuccess = electionResult.success

  return (
    <aside
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-in fade-in slide-in-from-top-4 duration-200"
      style={{ top: "calc(var(--sat, 0px) + 12px)" }}
    >
      <div
        className={`relative overflow-hidden rounded-xl border p-4 shadow-2xl backdrop-blur-md ${
          isSuccess
            ? "border-amber-400/80 bg-neutral-950/95 shadow-amber-950/50"
            : "border-neutral-700 bg-neutral-950/95 shadow-neutral-950/50"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{isSuccess ? "👑" : "⚖️"}</span>
            <div>
              <h2
                className={`text-xs font-mono font-bold uppercase tracking-wider ${
                  isSuccess ? "text-amber-300" : "text-neutral-400"
                }`}
              >
                {isSuccess ? "New Squad Leader Crowned" : "Squad Vote Concluded"}
              </h2>
              <p className="text-xs text-white mt-0.5">{electionResult.message}</p>
            </div>
          </div>

          {onDismissResult && (
            <button
              className="text-neutral-400 hover:text-white p-1 text-sm font-mono cursor-pointer bg-transparent border-0"
              onClick={onDismissResult}
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
