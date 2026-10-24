import type { PendingRequest } from "../../../types/game"

interface GamePendingAdmissionPillProps {
  pendingRequests: PendingRequest[]
  onAdmitPlayer?: (clientId: string) => void
  onRejectPlayer?: (clientId: string) => void
}

export function GamePendingAdmissionPill({
  pendingRequests,
  onAdmitPlayer,
  onRejectPlayer,
}: GamePendingAdmissionPillProps) {
  if (pendingRequests.length === 0) return null

  return (
    <aside className="game-pending-admission-pill">
      <div className="game-pending-header">
        <span className="game-pending-pulse" />
        <span className="game-pending-title">ENTRY REQUESTS ({pendingRequests.length})</span>
      </div>
      <div className="game-pending-items">
        {pendingRequests.map((req) => (
          <div className="game-pending-row" key={req.clientId}>
            <div className="game-pending-info">
              <span className="game-pending-username">{req.username}</span>
              <span className="game-pending-sub">mid-game join request</span>
            </div>
            <div className="game-pending-actions">
              <button
                className="game-admission-admit-btn"
                onClick={() => onAdmitPlayer?.(req.clientId)}
                title="Admit operative into game"
                type="button"
              >
                ✓ ADMIT
              </button>
              <button
                className="game-admission-reject-btn"
                onClick={() => onRejectPlayer?.(req.clientId)}
                title="Reject request"
                type="button"
              >
                ✕ REJECT
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

export default GamePendingAdmissionPill
