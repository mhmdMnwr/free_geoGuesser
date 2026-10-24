import { Icon } from "../../../shared/components/Icon"
import { GameButton } from "../../../shared/components/GameButton"

interface RoomSearchBarProps {
  searchQuery: string
  trimmedQuery: string
  isSixDigitCode: boolean
  onSearchChange: (val: string) => void
  onQuickJoin: () => void
}

export function RoomSearchBar({
  searchQuery,
  trimmedQuery,
  isSixDigitCode,
  onSearchChange,
  onQuickJoin,
}: RoomSearchBarProps) {
  return (
    <section className="mb-4 flex flex-wrap items-center gap-3 bg-slate-900/90 border border-slate-700/90 rounded-xl p-3 shadow-lg">
      <div className="flex items-center gap-3 flex-1 min-w-[240px] px-2">
        <span className="text-cyan-400">
          <Icon name="radar" size={20} />
        </span>
        <input
          aria-label="Search squads or enter 6-digit private room code"
          className="w-full bg-transparent text-slate-100 placeholder-slate-500 font-mono text-sm tracking-wider outline-none"
          maxLength={32}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && trimmedQuery) {
              onQuickJoin()
            }
          }}
          placeholder="SEARCH SQUAD NAME OR ENTER 6-DIGIT PRIVATE ROOM CODE (E.G. 482910)..."
          type="text"
          value={searchQuery}
        />
        {searchQuery && (
          <button
            aria-label="Clear search"
            className="text-slate-400 hover:text-white font-mono text-xs px-2 py-1 cursor-pointer bg-transparent border-0"
            onClick={() => onSearchChange("")}
            type="button"
          >
            ✕ CLEAR
          </button>
        )}
      </div>
      {isSixDigitCode && (
        <GameButton icon="arrow" onClick={onQuickJoin} variant="primary">
          JOIN ROOM #{trimmedQuery}
        </GameButton>
      )}
    </section>
  )
}

export default RoomSearchBar
