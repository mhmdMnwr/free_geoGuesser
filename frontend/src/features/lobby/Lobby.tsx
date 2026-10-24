import { useState, useEffect } from "react"
import "./lobby.css"
import { EffectsLayer } from "../../shared/components/EffectsLayer"
import { Icon } from "../../shared/components/Icon"
import { GameButton } from "../../shared/components/GameButton"
import { AdmissionQueue } from "./components/AdmissionQueue"
import { SquadPanel } from "./components/SquadPanel"
import { MatchConfigPanel } from "./components/MatchConfigPanel"
import type { Room, Player, PendingRequest } from "../../types/game"

export interface LobbySettingsUpdate {
  region?: string
  rounds?: number
  duration?: number
  difficulty?: string
  maxPlayers?: number
}

interface LobbyProps {
  room: Room
  players: Player[]
  isHost: boolean
  pendingRequests?: PendingRequest[]
  onBack: () => void
  onStart: () => void
  onKickPlayer?: (targetId: string) => void
  onAdmitPlayer?: (clientId: string) => void
  onRejectPlayer?: (clientId: string) => void
  onUpdateSettings: (settings: LobbySettingsUpdate) => void
  onDemandCrown?: () => void
  crownClaimPending?: boolean
}

export function Lobby({
  room, players, isHost, onBack, onStart,
  onKickPlayer, onAdmitPlayer, onRejectPlayer, onUpdateSettings,
  onDemandCrown, crownClaimPending, pendingRequests = [],
}: LobbyProps) {
  const [copied, setCopied] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState(room.selectedRegion || "all")
  const [selectedDifficulty, setSelectedDifficulty] = useState(room.difficulty || "all")
  const [selectedDuration, setSelectedDuration] = useState(20)
  const [selectedRounds, setSelectedRounds] = useState(room.totalRounds || 5)
  const roomCode = room.code || room.id

  useEffect(() => { if (room.selectedRegion) setSelectedRegion(room.selectedRegion) }, [room.selectedRegion])
  useEffect(() => { if (room.difficulty) setSelectedDifficulty(room.difficulty) }, [room.difficulty])
  useEffect(() => { if (room.totalRounds) setSelectedRounds(room.totalRounds) }, [room.totalRounds])

  const copyCode = () => {
    navigator.clipboard?.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <main className="lobby-screen">
      <EffectsLayer />
      <div className="ambient-grid" />
      <header className="mobile-native-nav">
        <button
          aria-label="Leave Squad"
          className="mobile-back-btn"
          onClick={onBack}
          type="button"
        >
          <Icon name="back" size={18} />
          <span className="hidden sm:inline">LEAVE</span>
        </button>

        <div className="mobile-room-info">
          <span className="mobile-room-name truncate">{room.name}</span>
          <span className="mobile-room-privacy">{room.isPrivate ? "🔒 PRIVATE" : "🌐 PUBLIC"}</span>
        </div>

        <button
          aria-label="Copy Room Code"
          className="mobile-code-chip"
          onClick={copyCode}
          title="Tap to copy Room Code"
          type="button"
        >
          <span className="mobile-code-label">CODE:</span>
          <strong className="mobile-code-val">{roomCode}</strong>
          <Icon name={copied ? "check" : "copy"} size={14} />
          {copied && <span className="mobile-code-copied">COPIED</span>}
        </button>
      </header>

      <div className="lobby-content">
        <div className="lobby-layout">
          <SquadPanel crownClaimPending={crownClaimPending} isHost={isHost} maxPlayers={room.maxPlayers || 8} onDemandCrown={onDemandCrown} onKickPlayer={onKickPlayer} players={players} />
          {isHost && onAdmitPlayer && onRejectPlayer && (
            <AdmissionQueue onAdmit={onAdmitPlayer} onReject={onRejectPlayer} pendingRequests={pendingRequests} />
          )}
          <MatchConfigPanel
            isHost={isHost} maxPlayers={room.maxPlayers || 8}
            onDifficultyChange={(difficulty) => { if (isHost) { setSelectedDifficulty(difficulty); onUpdateSettings({ difficulty }) } }}
            onDurationChange={(duration) => { if (isHost) { setSelectedDuration(duration); onUpdateSettings({ duration }) } }}
            onMaxPlayersChange={(maxPlayers) => { if (isHost) onUpdateSettings({ maxPlayers }) }}
            onRegionChange={(region) => { if (isHost) { setSelectedRegion(region); onUpdateSettings({ region }) } }}
            onRoundsChange={(rounds) => { if (isHost) { setSelectedRounds(rounds); onUpdateSettings({ rounds }) } }}
            selectedDifficulty={selectedDifficulty} selectedDuration={selectedDuration} selectedRegion={selectedRegion} selectedRounds={selectedRounds}
          />
        </div>

        <section className={`launch-bar ${isHost ? "launch-bar--ready" : ""}`}>
          <div className="launch-status">
            <span className="launch-symbol"><Icon name={isHost ? "crown" : "radar"} size={22} /></span>
            <span>
              <strong>{isHost ? "SQUAD READY" : "AWAITING SQUAD LEADER"}</strong>
              <small>{isHost ? "You have the Crown 👑. Commence when ready." : "Standing by for squad leader to commence expedition."}</small>
            </span>
          </div>
          {isHost ? (
            <GameButton className="ready-button" icon="arrow" onClick={onStart} variant="primary">START EXPEDITION</GameButton>
          ) : (
            <div className="text-xs font-mono text-amber-300 uppercase tracking-widest px-4 py-2.5 bg-slate-900/90 border border-amber-600/50 rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>WAITING FOR LEADER 👑</span>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default Lobby
