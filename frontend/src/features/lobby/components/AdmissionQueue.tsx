import { Icon } from "../../../shared/components/Icon"
import type { PendingRequest } from "../../../types/game"

interface AdmissionQueueProps {
  pendingRequests: PendingRequest[]
  onAdmit: (clientId: string) => void
  onReject: (clientId: string) => void
}

export function AdmissionQueue({ pendingRequests, onAdmit, onReject }: AdmissionQueueProps) {
  if (pendingRequests.length === 0) return null

  return (
    <section className="panel" style={{ gridColumn: "1 / -1", marginBottom: 0 }}>
      <div className="panel-heading">
        <div className="panel-label">
          <Icon name="players" />
          PENDING ENTRY REQUESTS ({pendingRequests.length})
        </div>
      </div>
      <div className="squad-list">
        {pendingRequests.map((req) => (
          <div className="player" key={req.clientId} style={{ justifyContent: "space-between" }}>
            <span className="player-index">⏳</span>
            <span className="player-info">
              <strong>{req.username}</strong>
              <small>Requesting entry · {new Date(req.requestedAt).toLocaleTimeString()}</small>
            </span>
            <span className="flex items-center gap-2">
              <button
                className="px-3 py-1 text-xs font-mono font-bold text-emerald-400 border border-emerald-600 rounded hover:bg-emerald-900 transition-all cursor-pointer"
                onClick={() => onAdmit(req.clientId)}
                type="button"
              >
                ✓ ADMIT
              </button>
              <button
                className="px-3 py-1 text-xs font-mono font-bold text-rose-400 border border-rose-700 rounded hover:bg-rose-900 transition-all cursor-pointer"
                onClick={() => onReject(req.clientId)}
                type="button"
              >
                ✕ REJECT
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
