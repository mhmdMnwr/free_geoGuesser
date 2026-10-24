import { useState, useEffect } from "react"
import { Icon } from "../../../shared/components/Icon"
import { GameButton } from "../../../shared/components/GameButton"
import {
  REGION_OPTIONS,
  DIFFICULTY_OPTIONS,
  ROUND_OPTIONS,
  DURATION_OPTIONS,
  CAPACITY_OPTIONS,
} from "./createRoomOptions"

export interface CreateRoomFormValues {
  name: string
  region: string
  difficulty: string
  rounds: number
  duration: number
  maxPlayers: number
  isPrivate: boolean
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
  isOpen, onClose, onSubmit, defaultName, isCreating, error,
}: CreateRoomModalProps) {
  const [name, setName] = useState(defaultName)
  const [region, setRegion] = useState("all")
  const [difficulty, setDifficulty] = useState("all")
  const [rounds, setRounds] = useState(5)
  const [duration, setDuration] = useState(20)
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [isPrivate, setIsPrivate] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setName(defaultName)
      setIsPrivate(false)
    }
  }, [isOpen, defaultName])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = () => {
    onSubmit({ name: name.trim() || defaultName, region, difficulty, rounds, duration, maxPlayers, isPrivate })
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog">
        <div className="modal-header">
          <div className="modal-title"><Icon name="crown" size={22} /> CREATE SQUAD EXPEDITION</div>
          <button className="text-slate-400 hover:text-white font-mono text-lg cursor-pointer bg-transparent border-0" onClick={onClose} type="button">✕</button>
        </div>

        <div className="modal-field">
          <label className="modal-label">SQUAD CODENAME / ROOM NAME</label>
          <input
            className="modal-input uppercase"
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="E.G. TITAN EXPLORERS"
            type="text"
            value={name}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="modal-field">
            <label className="modal-label">MAP REGION</label>
            <select className="modal-select" onChange={(e) => setRegion(e.target.value)} value={region}>
              {REGION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label className="modal-label">DIFFICULTY</label>
            <select className="modal-select" onChange={(e) => setDifficulty(e.target.value)} value={difficulty}>
              {DIFFICULTY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="modal-field">
            <label className="modal-label">EXPEDITION ROUNDS</label>
            <select className="modal-select" onChange={(e) => setRounds(Number(e.target.value))} value={rounds}>
              {ROUND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label className="modal-label">COUNTDOWN TIMER</label>
            <select className="modal-select" onChange={(e) => setDuration(Number(e.target.value))} value={duration}>
              {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="modal-field">
            <label className="modal-label">MAX SQUAD CAPACITY</label>
            <select className="modal-select" onChange={(e) => setMaxPlayers(Number(e.target.value))} value={maxPlayers}>
              {CAPACITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label className="modal-label">ROOM VISIBILITY</label>
            <select className="modal-select" onChange={(e) => setIsPrivate(e.target.value === "private")} value={isPrivate ? "private" : "public"}>
              <option value="public">🌐 PUBLIC</option>
              <option value="private">🔒 PRIVATE</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="modal-error p-3 my-3 text-xs font-mono text-rose-400 bg-rose-950/70 border border-rose-800 rounded">
            ⚠ {error}
          </div>
        )}

        <div className="modal-actions">
          <GameButton disabled={isCreating} onClick={onClose} variant="ghost">CANCEL</GameButton>
          <GameButton disabled={isCreating} icon="crown" onClick={handleSubmit} variant="primary">
            {isCreating ? "CREATING EXPEDITION..." : "CREATE & TAKE CROWN 👑"}
          </GameButton>
        </div>
      </div>
    </div>
  )
}

export default CreateRoomModal
