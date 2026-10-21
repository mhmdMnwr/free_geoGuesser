import { useState, useEffect } from "react"
import { Icon } from "../../../shared/components/Icon"
import { GameButton } from "../../../shared/components/GameButton"

export interface CreateRoomFormValues {
  name: string
  region: string
  difficulty: string
  rounds: number
  duration: number
  maxPlayers: number
}

interface CreateRoomModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (values: CreateRoomFormValues) => void
  defaultName: string
  isCreating: boolean
  error: string | null
}

export function CreateRoomModal({
  isOpen,
  onClose,
  onSubmit,
  defaultName,
  isCreating,
  error,
}: CreateRoomModalProps) {
  const [name, setName] = useState(defaultName)
  const [region, setRegion] = useState("all")
  const [difficulty, setDifficulty] = useState("all")
  const [rounds, setRounds] = useState(5)
  const [duration, setDuration] = useState(20)
  const [maxPlayers, setMaxPlayers] = useState(8)

  useEffect(() => {
    if (isOpen) {
      setName(defaultName)
    }
  }, [isOpen, defaultName])

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  function handleSubmit() {
    onSubmit({
      name: name.trim() || defaultName,
      region,
      difficulty,
      rounds,
      duration,
      maxPlayers,
    })
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <div className="modal-title">
            <Icon name="crown" size={22} />
            CREATE SQUAD EXPEDITION
          </div>
          <button
            className="text-slate-400 hover:text-white font-mono text-lg cursor-pointer bg-transparent border-0"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="modal-field">
          <label className="modal-label">SQUAD CODENAME / ROOM NAME</label>
          <input
            className="modal-input uppercase"
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit()
            }}
            placeholder="E.G. TITAN EXPLORERS"
            type="text"
            value={name}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="modal-field">
            <label className="modal-label">MAP REGION</label>
            <select
              className="modal-select"
              onChange={(e) => setRegion(e.target.value)}
              value={region}
            >
              <option value="all">WORLDWIDE (ALL)</option>
              <option value="north_america">NORTH AMERICA</option>
              <option value="europe">EUROPE</option>
              <option value="asia">ASIA</option>
              <option value="latin_america">LATIN AMERICA</option>
            </select>
          </div>

          <div className="modal-field">
            <label className="modal-label">DIFFICULTY</label>
            <select
              className="modal-select"
              onChange={(e) => setDifficulty(e.target.value)}
              value={difficulty}
            >
              <option value="all">ALL LEVELS</option>
              <option value="easy">EASY (URBAN / MAJORS)</option>
              <option value="medium">MEDIUM</option>
              <option value="hard">HARD (REMOTE ROADS)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="modal-field">
            <label className="modal-label">EXPEDITION ROUNDS</label>
            <select
              className="modal-select"
              onChange={(e) => setRounds(Number(e.target.value))}
              value={rounds}
            >
              <option value={3}>3 ROUNDS</option>
              <option value={5}>5 ROUNDS</option>
              <option value={10}>10 ROUNDS</option>
            </select>
          </div>

          <div className="modal-field">
            <label className="modal-label">COUNTDOWN TIMER</label>
            <select
              className="modal-select"
              onChange={(e) => setDuration(Number(e.target.value))}
              value={duration}
            >
              <option value={15}>15 SECONDS</option>
              <option value={20}>20 SECONDS</option>
              <option value={30}>30 SECONDS</option>
              <option value={60}>60 SECONDS</option>
            </select>
          </div>
        </div>

        <div className="modal-field">
          <label className="modal-label">MAX SQUAD CAPACITY</label>
          <select
            className="modal-select"
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            value={maxPlayers}
          >
            <option value={2}>2 PLAYERS (DUEL)</option>
            <option value={4}>4 PLAYERS (FIRETEAM)</option>
            <option value={8}>8 PLAYERS (SQUAD)</option>
            <option value={12}>12 PLAYERS (PLATOON)</option>
            <option value={16}>16 PLAYERS (MAX)</option>
          </select>
        </div>

        {error && (
          <div className="p-3 my-3 text-xs font-mono text-rose-400 bg-rose-950/70 border border-rose-800 rounded">
            ⚠ {error}
          </div>
        )}

        <div className="modal-actions">
          <GameButton disabled={isCreating} onClick={onClose} variant="ghost">
            CANCEL
          </GameButton>
          <GameButton disabled={isCreating} icon="crown" onClick={handleSubmit} variant="primary">
            {isCreating ? "CREATING EXPEDITION..." : "CREATE & TAKE CROWN 👑"}
          </GameButton>
        </div>
      </div>
    </div>
  )
}
