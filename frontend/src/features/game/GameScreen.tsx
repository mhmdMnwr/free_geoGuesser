import { useState, useEffect } from "react"
import "./game.css"
import { LeaderboardScreen } from "./components/LeaderboardScreen"
import { GameHudTop, type GameViewMode } from "./components/GameHudTop"
import ExploreView from "./components/ExploreView"
import AtlasView from "./components/AtlasView"
import { RoundResultsView } from "./components/RoundResultsView"
import { GameOverView } from "./components/GameOverView"
import { deriveGameTelemetry } from "./utils/gameStandings"
import type { Room, Coordinates, PendingRequest, Player } from "../../types/game"

export interface GameScreenProps {
  room: Room
  currentRound: number
  totalRounds: number
  uplinkToken: string | null
  countdownSeconds: number | null
  isHost: boolean
  myPin: Coordinates | null
  hasGuessed: boolean
  totalScore: number
  onSelectCoords: (coords: Coordinates) => void
  onLockGuess: () => void
  onNextRound: () => void
  onExit: () => void
  onReturnToLobby?: () => void
  roundResults: any
  gameOver: any
  username?: string
  clientId?: string
  pendingRequests?: PendingRequest[]
  onAdmitPlayer?: (clientId: string) => void
  onRejectPlayer?: (clientId: string) => void
  players?: Player[]
  onDemandCrown?: () => void
  crownClaimPending?: boolean
}

export function GameScreen(props: GameScreenProps) {
  const {
    room, currentRound, totalRounds, uplinkToken, countdownSeconds, isHost,
    myPin, hasGuessed, totalScore, onSelectCoords, onLockGuess, onNextRound,
    onExit, onReturnToLobby, roundResults, gameOver, username, clientId,
    pendingRequests = [], onAdmitPlayer, onRejectPlayer, players = [],
    onDemandCrown, crownClaimPending,
  } = props

  const [view, setView] = useState<GameViewMode>("explore")

  // Keyboard navigation: "m" -> toggle Atlas/Explore, "s" -> toggle Standings/Explore, "Escape" -> Explore
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === "m") {
        e.preventDefault()
        setView((prev) => (prev === "atlas" ? "explore" : "atlas"))
      } else if (key === "s") {
        e.preventDefault()
        setView((prev) => (prev === "standings" ? "explore" : "standings"))
      } else if (key === "g" || key === "escape") {
        e.preventDefault()
        setView("explore")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const isResults = Boolean(roundResults)
  const isGameOver = Boolean(gameOver)
  const telemetry = deriveGameTelemetry({ roundResults, gameOver, players, username, clientId, isHost, totalScore, hasGuessed })
  const activePlayProps = {
    room, currentRound, totalRounds, totalScore,
    liveLeaderboard: telemetry.liveLeaderboard,
    myPin, hasGuessed, onSelectCoords, onLockGuess,
  }

  return (
    <main className={`game-screen game-screen--${view}`}>
      <div className="world-view">
        {Boolean(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview")) ? (
          <img alt="Panorama" className="streetview-frame object-cover w-full h-full" src="/mock-pano.jpg" />
        ) : (
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            className="streetview-frame"
            key={uplinkToken || currentRound}
            src={`/api/streetview/uplink?roomId=${encodeURIComponent(room.id)}&token=${encodeURIComponent(uplinkToken || "")}`}
            title="Street View Uplink"
          />
        )}
      </div>
      <div className="game-vignette" />

      <GameHudTop
        countdownSeconds={countdownSeconds} crownClaimPending={crownClaimPending}
        currentRound={currentRound} isHost={isHost} onAdmitPlayer={onAdmitPlayer}
        onDemandCrown={onDemandCrown} onExit={onExit} onRejectPlayer={onRejectPlayer}
        onReturnToLobby={onReturnToLobby} pendingRequests={pendingRequests}
        room={room} setView={setView} showTimer={!isResults && !isGameOver}
        totalRounds={totalRounds} view={view}
      />

      {view === "explore" && !isResults && !isGameOver && (
        <ExploreView
          {...activePlayProps}
          onOpenAtlas={() => setView("atlas")}
        />
      )}
      {view === "atlas" && !isResults && !isGameOver && (
        <AtlasView
          {...activePlayProps}
          onCloseAtlas={() => setView("explore")}
        />
      )}
      {view === "standings" && !isResults && !isGameOver && (
        <LeaderboardScreen
          leaderboard={telemetry.liveLeaderboard}
          onClose={() => setView("explore")}
        />
      )}

      {isResults && !isGameOver && (
        <RoundResultsView
          closestPlayer={roundResults.closestPlayer} currentLeaderboard={telemetry.currentLeaderboard}
          currentRound={currentRound} isHost={isHost} myDistanceKm={telemetry.myDistanceKm}
          myPin={myPin} myRoundScore={telemetry.myRoundScore} onNextRound={onNextRound}
          onReturnToLobby={onReturnToLobby} playerGuesses={telemetry.playerGuesses}
          target={telemetry.target} totalRounds={totalRounds}
        />
      )}

      {isGameOver && (
        <GameOverView
          isHost={isHost} leaderboard={gameOver.leaderboard || []}
          onExit={onExit} onReturnToLobby={onReturnToLobby}
        />
      )}
    </main>
  )
}

export default GameScreen
