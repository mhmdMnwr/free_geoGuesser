import { Icon } from "../../../shared/components/Icon"
import { GameButton } from "../../../shared/components/GameButton"
import type { Room } from "../../../types/game"

interface RoomRowProps {
  room: Room
  index: number
  onJoin: (room: Room) => void
}

function renderStatusBadge(room: Room) {
  if (room.status === "ROUND_ACTIVE") {
    return (
      <span className="status-badge status-badge--active">
        ⚔ MATCH {room.currentRound ? `(R${room.currentRound}/${room.totalRounds})` : "ACTIVE"}
      </span>
    )
  }
  if (room.status === "ROUND_COUNTDOWN") {
    return <span className="status-badge status-badge--countdown">⏱ COUNTDOWN</span>
  }
  if (room.status === "ROUND_RESULTS") {
    return <span className="status-badge status-badge--results">📊 SCORING</span>
  }
  if (room.status === "GAME_OVER") {
    return <span className="status-badge status-badge--ended">🏆 FINISHED</span>
  }
  return <span className="status-badge status-badge--lobby">● OPEN LOBBY</span>
}

export function RoomRow({ room, index, onJoin }: RoomRowProps) {
  const occupancy = Math.min(100, Math.round((room.playerCount / room.maxPlayers) * 100))
  const isFull = room.playerCount >= room.maxPlayers

  return (
    <div
      className={`room-row room-row--${(index % 4) + 1} cursor-pointer`}
      onClick={() => {
        if (!isFull) onJoin(room)
      }}
    >
      <div className="room-name">
        <span className="room-signal">
          <Icon name="globe" size={20} />
        </span>
        <span>
          <strong className="flex items-center gap-2">
            {room.name}
            {room.isPrivate && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                🔒 PRIVATE
              </span>
            )}
            <span className="text-amber-400 text-xs font-normal">
              👑 {room.hostName}
            </span>
          </strong>
          <small className="font-mono text-cyan-400">CODE: {room.code || room.id}</small>
        </span>
      </div>

      <div className="room-status-cell">
        {renderStatusBadge(room)}
      </div>

      <div className="room-players">
        <span>
          <Icon name="players" size={17} />
          <strong>{room.playerCount}</strong> / {room.maxPlayers}
        </span>
        <i>
          <b style={{ width: `${occupancy}%` }} />
        </i>
      </div>

      <span className="room-map uppercase font-mono text-xs text-sky-400">
        {room.selectedRegion || "WORLD"} · {room.difficulty || "ALL"}
      </span>

      {isFull ? (
        <button className="btn-full" disabled type="button">
          FULL
        </button>
      ) : (
        <GameButton
          icon="arrow"
          onClick={(e) => {
            e.stopPropagation()
            onJoin(room)
          }}
          variant="outline"
        >
          {room.status === "LOBBY" ? "JOIN SQUAD" : "JOIN MATCH"}
        </GameButton>
      )}
    </div>
  )
}

export default RoomRow
