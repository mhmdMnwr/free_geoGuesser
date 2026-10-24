import type { Room, PendingRequest } from "../../../types/game"
import { GamePendingAdmissionPill } from "./GamePendingAdmissionPill"
import DesktopGameHud from "./DesktopGameHud"
import MobileGameHud from "./MobileGameHud"

export type GameViewMode = "explore" | "atlas" | "standings"

interface GameHudTopProps {
  room: Room
  view: GameViewMode
  setView: (view: GameViewMode) => void
  currentRound: number
  totalRounds: number
  isHost: boolean
  countdownSeconds: number | null
  showTimer: boolean
  pendingRequests: PendingRequest[]
  onReturnToLobby?: () => void
  onExit: () => void
  onAdmitPlayer?: (clientId: string) => void
  onRejectPlayer?: (clientId: string) => void
  onDemandCrown?: () => void
  crownClaimPending?: boolean
}

export function GameHudTop({
  room,
  view,
  setView,
  currentRound,
  totalRounds,
  isHost,
  countdownSeconds,
  showTimer,
  pendingRequests,
  onReturnToLobby,
  onExit,
  onAdmitPlayer,
  onRejectPlayer,
  onDemandCrown,
  crownClaimPending,
}: GameHudTopProps) {
  return (
    <>
      <DesktopGameHud
        countdownSeconds={countdownSeconds}
        crownClaimPending={crownClaimPending}
        currentRound={currentRound}
        isHost={isHost}
        onDemandCrown={onDemandCrown}
        onExit={onExit}
        onReturnToLobby={onReturnToLobby}
        room={room}
        setView={setView}
        showTimer={showTimer}
        totalRounds={totalRounds}
        view={view}
      />

      <MobileGameHud
        countdownSeconds={countdownSeconds}
        crownClaimPending={crownClaimPending}
        currentRound={currentRound}
        isHost={isHost}
        onDemandCrown={onDemandCrown}
        onExit={onExit}
        onReturnToLobby={onReturnToLobby}
        room={room}
        setView={setView}
        showTimer={showTimer}
        totalRounds={totalRounds}
        view={view}
      />

      {isHost && (
        <GamePendingAdmissionPill
          onAdmitPlayer={onAdmitPlayer}
          onRejectPlayer={onRejectPlayer}
          pendingRequests={pendingRequests}
        />
      )}
    </>
  )
}

export default GameHudTop
