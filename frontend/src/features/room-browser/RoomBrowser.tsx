import { useState } from "react"
import "./room-browser.css"
import { EffectsLayer } from "../../shared/components/EffectsLayer"
import { Icon } from "../../shared/components/Icon"
import { GameButton } from "../../shared/components/GameButton"
import { RoomRow } from "./components/RoomRow"
import { RoomSearchBar } from "./components/RoomSearchBar"
import BrowserHeader from "./components/BrowserHeader"
import type { Room } from "../../types/game"

interface RoomBrowserProps {
  lobbies: Room[]
  searchedRoom?: Room | null
  username: string
  errorMessage?: string | null
  onBack: () => void
  onCreate: () => void
  onJoin: (room: Room) => void
  onSearchCode?: (code: string) => void
  onJoinByCode?: (code: string) => void
  onUsernameChange?: (name: string) => void
}

export function RoomBrowser({
  lobbies,
  searchedRoom,
  username,
  errorMessage,
  onBack,
  onCreate,
  onJoin,
  onSearchCode,
  onJoinByCode,
  onUsernameChange,
}: RoomBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    onSearchCode?.(val.trim())
  }

  const trimmedQuery = searchQuery.trim()
  const isSixDigitCode = /^\d{6}$/.test(trimmedQuery)

  const filteredLobbies = lobbies.filter((room) => {
    if (!trimmedQuery) return true
    const q = trimmedQuery.toLowerCase()
    return room.name.toLowerCase().includes(q) || (room.hostName || "").toLowerCase().includes(q) || (room.code || room.id || "").toLowerCase().includes(q)
  })

  const displayedRooms = [...filteredLobbies]
  if (searchedRoom && !displayedRooms.some((r) => r.id === searchedRoom.id)) displayedRooms.unshift(searchedRoom)

  const handleQuickJoinCode = () => {
    if (!trimmedQuery) return
    if (searchedRoom) onJoin(searchedRoom)
    else if (displayedRooms.length === 1) onJoin(displayedRooms[0])
    else onJoinByCode?.(trimmedQuery)
  }

  return (
    <main className="browser-screen">
      <EffectsLayer />
      <div className="ambient-grid" />
      <BrowserHeader onBack={onBack} onUsernameChange={onUsernameChange} username={username} />

      <div className="browser-content">
        <section className="browser-heading">
          <div>
            <div className="lobby-title browser-title" data-text="ACTIVE SQUADS">AVAILABLE SQUADS</div>
            <div className="lobby-subtitle">
              {lobbies.length} squads available. Search or enter a 6-digit room code below to jump in.
            </div>
          </div>
          <div className="hidden sm:block">
            <GameButton icon="plus" onClick={onCreate}>CREATE SQUAD</GameButton>
          </div>
        </section>

        <RoomSearchBar
          isSixDigitCode={isSixDigitCode} onQuickJoin={handleQuickJoinCode}
          onSearchChange={handleSearchChange} searchQuery={searchQuery} trimmedQuery={trimmedQuery}
        />

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950/90 border border-rose-700 rounded-lg text-rose-300 font-mono text-sm flex items-center gap-3">
            <span className="text-rose-400 font-bold">⚠ ACCESS DENIED:</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <section className="room-browser panel">
          <div className="room-table-head">
            <span>SQUAD / HOST</span>
            <span>STATE</span>
            <span>OPERATIVES</span>
            <span>REGION / DIFF</span>
            <span />
          </div>
          <div className="room-list">
            {displayedRooms.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-mono text-sm">
                {trimmedQuery
                  ? isSixDigitCode
                    ? `NO ACTIVE ROOM FOUND WITH 6-DIGIT CODE "${trimmedQuery}". CHECK THE CODE OR CLICK "JOIN ROOM #${trimmedQuery}".`
                    : `NO SQUADS MATCHING "${trimmedQuery}". ENTER A 6-DIGIT CODE TO UNLOCK A PRIVATE SQUAD.`
                  : "NO ACTIVE PUBLIC SQUADS FOUND. ENTER A 6-DIGIT CODE ABOVE OR TAP \"CREATE SQUAD\" TO HOST!"}
              </div>
            ) : (
              displayedRooms.map((room, index) => (
                <RoomRow index={index} key={room.id} onJoin={onJoin} room={room} />
              ))
            )}
          </div>
        </section>
      </div>

      <div className="mobile-floating-action sm:hidden">
        <button className="mobile-fab-btn" onClick={onCreate} type="button">
          <Icon name="plus" size={18} />
          <span>CREATE SQUAD</span>
        </button>
      </div>
    </main>
  )
}

export default RoomBrowser
