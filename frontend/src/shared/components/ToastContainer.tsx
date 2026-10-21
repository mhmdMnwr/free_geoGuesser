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
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const type = toast.type || "info"
        const borderColor =
          type === "success"
            ? "border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            : type === "warning"
              ? "border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              : type === "error"
                ? "border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                : "border-sky-500/80 shadow-[0_0_15px_rgba(14,165,233,0.3)]"

        const badgeColor =
          type === "success"
            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
            : type === "warning"
              ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
              : type === "error"
                ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                : "bg-sky-500/20 text-sky-400 border-sky-500/40"

        const iconName =
          type === "success" ? "check" : type === "warning" ? "clock" : type === "error" ? "radar" : "lan"

        return (
          <div
            className={`pointer-events-auto flex items-start gap-3 p-3.5 bg-slate-950/95 border ${borderColor} rounded-xl backdrop-blur-md transition-all animate-in slide-in-from-right duration-200`}
            key={toast.id}
          >
            <span
              className={`p-1.5 rounded-lg border text-xs font-mono font-bold flex items-center justify-center shrink-0 ${badgeColor}`}
            >
              <Icon name={iconName} size={15} />
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-xs font-mono tracking-wider font-semibold text-slate-200 leading-snug">
                {toast.message}
              </div>
            </div>
            <button
              className="text-slate-500 hover:text-slate-200 text-xs font-mono p-1 transition-colors shrink-0 cursor-pointer"
              onClick={() => onDismiss(toast.id)}
              title="Dismiss"
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
