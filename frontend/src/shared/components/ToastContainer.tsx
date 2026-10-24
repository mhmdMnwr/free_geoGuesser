import { Icon } from "./Icon"

export interface ToastItem {
  id: string
  message: string
  type?: "info" | "success" | "warning" | "error"
  timestamp?: number
}

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-0 mx-auto w-fit max-w-[min(440px,calc(100vw-32px))] z-[9999] pointer-events-none flex flex-col items-center gap-2 px-3"
      style={{ top: "calc(var(--sat, 0px) + 10px)" }}
    >
      {toasts.map((toast) => {
        const type = toast.type || "info"
        const borderColor =
          type === "success"
            ? "border-emerald-500/80 shadow-[0_4px_20px_rgba(16,185,129,0.25)]"
            : type === "warning"
              ? "border-amber-500/80 shadow-[0_4px_20px_rgba(245,158,11,0.25)]"
              : type === "error"
                ? "border-rose-500/80 shadow-[0_4px_20px_rgba(244,63,94,0.25)]"
                : "border-sky-500/80 shadow-[0_4px_20px_rgba(14,165,233,0.25)]"

        const badgeColor =
          type === "success"
            ? "bg-emerald-500/20 text-emerald-400"
            : type === "warning"
              ? "bg-amber-500/20 text-amber-400"
              : type === "error"
                ? "bg-rose-500/20 text-rose-400"
                : "bg-sky-500/20 text-sky-400"

        const iconName =
          type === "success" ? "check" : type === "warning" ? "clock" : type === "error" ? "radar" : "globe"

        return (
          <div
            className={`pointer-events-auto flex items-center gap-2.5 py-2 px-3.5 bg-slate-950/95 border ${borderColor} rounded-full backdrop-blur-xl transition-all shadow-lg animate-in slide-in-from-top-2 duration-200`}
            key={toast.id}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] ${badgeColor}`}
            >
              <Icon name={iconName} size={12} />
            </span>
            <div className="text-xs font-mono font-medium text-slate-100 tracking-wide truncate max-w-[280px] sm:max-w-[340px]">
              {toast.message}
            </div>
            <button
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-white text-xs font-mono p-1 transition-colors shrink-0 cursor-pointer -mr-1"
              onClick={() => onDismiss(toast.id)}
              type="button"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
