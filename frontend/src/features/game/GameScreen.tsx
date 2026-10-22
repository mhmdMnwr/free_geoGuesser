import { useState, useEffect } from "react"
import "./game.css"
import { Icon } from "../../shared/components/Icon"
import { GameButton } from "../../shared/components/GameButton"
import { LeafletMapView } from "./components/LeafletMapView"
import { Podium } from "./components/Podium"
import { LeaderboardScreen } from "./components/LeaderboardScreen"
import type { Room, Coordinates, PendingRequest, Player } from "../../types/game"

export interface GameScreenProps {
  room: Room
  currentRound: number
  totalRounds: number
  uplinkToken: string | null
  roadToken?: string | null
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
}

function LiveStandingsWidget({
  leaderboard,
  currentRound,
  totalRounds,
  totalScore,
  className = "",
}: {
  leaderboard: any[]
  currentRound: number
  totalRounds: number
  totalScore: number
  className?: string
}) {
  const guessedCount = leaderboard.filter((p) => p.hasGuessed).length
  return (
    <aside className={`live-standings-widget ${className}`}>
      <div className="live-standings-header">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-200 uppercase">
            LIVE STANDINGS
          </span>
        </div>
        <span className="font-mono text-[10px] text-sky-400 font-bold">
          {guessedCount}/{leaderboard.length} GUESSED
        </span>
      </div>

      <div className="live-standings-sub">
        <span>R{String(currentRound).padStart(2, "0")}/{String(totalRounds).padStart(2, "0")}</span>
        <span className="text-emerald-400 font-bold">{totalScore.toLocaleString()} PTS</span>
      </div>

      <div className="live-standings-list">
        {leaderboard.map((p) => (
          <div
            key={p.username || p.id}
            className={`live-standings-row ${p.isLocal ? "live-standings-row--you" : ""}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="live-rank font-mono text-xs font-bold text-slate-400">
                {p.rank === 1 ? "👑" : `#${p.rank}`}
              </span>
              <span className="live-name truncate text-xs font-semibold text-slate-200">
                {p.username}
                {p.isLocal && (
                  <span className="text-[10px] text-sky-400 ml-1 font-mono font-bold">[YOU]</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`live-guess-pill font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  p.hasGuessed
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse"
                }`}
              >
                {p.hasGuessed ? "✓ LOCKED" : "⌛ THINKING"}
              </span>
              <span className="live-score font-mono text-xs font-bold text-sky-400">
                {(p.totalScore || 0).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

export function GameScreen({
  room,
  currentRound,
  totalRounds,
  uplinkToken,
  roadToken,
  countdownSeconds,
  isHost,
  myPin,
  hasGuessed,
  totalScore,
  onSelectCoords,
  onLockGuess,
  onNextRound,
  onExit,
  onReturnToLobby,
  roundResults,
  gameOver,
  username,
  clientId,
  pendingRequests = [],
  onAdmitPlayer,
  onRejectPlayer,
  players = [],
}: GameScreenProps) {
  const [view, setView] = useState<"explore" | "atlas" | "standings">("explore")

  // Keyboard navigation during active gameplay:
  // "m" -> Map (Atlas), "s" -> Standings, "g" -> Street View (Explore)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key.toLowerCase()
      if (key === "m") {
        e.preventDefault()
        setView("atlas")
      } else if (key === "s") {
        e.preventDefault()
        setView("standings")
      } else if (key === "g") {
        e.preventDefault()
        setView("explore")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Auto show results when round ends
  const isResults = Boolean(roundResults)
  const isGameOver = Boolean(gameOver)

  // Extract Target Location
  const target = roundResults?.target || roundResults?.targetLocation || null
  const rawResults: any[] = roundResults?.results || []

  // Map each player's result with coordinates, badges, and distances
  const playerGuesses = rawResults
    .filter((r) => r && (r.guess || r.guessCoords || r.coords))
    .map((r) => {
      const coords = r.guess || r.guessCoords || r.coords
      const isLocal = Boolean(
        (username && r.username?.toLowerCase() === username.toLowerCase()) ||
        (clientId && r.id === clientId)
      )
      const isClosest = Boolean(
        roundResults?.closestPlayer &&
        roundResults.closestPlayer.username?.toLowerCase() === r.username?.toLowerCase()
      )
      return {
        username: r.username,
        coords: { lat: coords.lat, lng: coords.lng },
        distanceKm: r.distanceKm,
        roundScore: r.roundScore,
        totalScore: r.totalScore,
        isClosest,
        isLocal,
        isHost: Boolean(r.isHost),
      }
    })

  // Find local player's specific round telemetry
  const myResult = rawResults.find(
    (r) =>
      (username && r.username?.toLowerCase() === username.toLowerCase()) ||
      (clientId && r.id === clientId) ||
      (isHost && r.isHost)
  )

  const myDistanceKm = myResult?.distanceKm ?? null
  const myRoundScore = myResult?.roundScore ?? 0

  // Sorted leaderboard for the round
  const currentLeaderboard = (
    roundResults?.leaderboard ||
    [...rawResults].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
  ).map((p: any, idx: number) => {
    const isLocal = Boolean(
      (username && p.username?.toLowerCase() === username.toLowerCase()) ||
      (clientId && p.id === clientId)
    )
    return { ...p, isLocal, rank: idx + 1 }
  })

  // Live Leaderboard: dynamic standings across all rounds, updated in real time as players score or guess
  const liveLeaderboard = (
    roundResults?.leaderboard ||
    gameOver?.leaderboard ||
    (players && players.length > 0
      ? [...players]
          .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
          .map((p: any, idx: number) => ({
            id: p.id || p.ip,
            username: p.username,
            totalScore: p.totalScore || 0,
            isHost: p.isHost,
            hasGuessed: Boolean(p.hasGuessed),
            rank: idx + 1,
            isLocal: Boolean(
              (username && p.username?.toLowerCase() === username.toLowerCase()) ||
              (clientId && p.id === clientId)
            ),
          }))
      : [
          {
            username: username || "YOU",
            totalScore: totalScore || 0,
            rank: 1,
            isLocal: true,
            isHost: isHost,
            hasGuessed: hasGuessed,
          },
        ])
  )

  return (
    <main className={`game-screen game-screen--${view}`}>
      {/* Real-time Anti-Spoiler Street View Reconnaissance */}
      <div className="world-view">
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="streetview-frame"
          key={uplinkToken || currentRound}
          src={`/api/streetview/uplink?roomId=${encodeURIComponent(room.id)}&token=${encodeURIComponent(uplinkToken || '')}`}
          title="Tactical Recon Uplink"
        />
      </div>
      <div className="game-vignette" />

      {/* Top Tactical HUD */}
      <header className="game-hud-top">
        <div className="game-brand">
          <span className="logo-icon">
            <Icon name="researcher" size={22} />
          </span>
          <span>
            <strong>THEgeoguesser</strong>
            <small>ROOM: {room.id} // {room.name}</small>
          </span>
        </div>

        <div className="game-view-switcher">
          {(["explore", "atlas", "standings"] as const).map((item) => (
            <button
              className={view === item ? "active" : ""}
              key={item}
              onClick={() => setView(item)}
              type="button"
            >
              {item === "explore"
                ? "STREET VIEW [G]"
                : item === "atlas"
                  ? "FULL ATLAS [M]"
                  : "STANDINGS [S]"}
            </button>
          ))}
        </div>

        <div className="game-meta">
          <span>
            <small>ROUND</small>
            <strong>
              {String(currentRound).padStart(2, "0")} / {String(totalRounds).padStart(2, "0")}
            </strong>
          </span>
          {isHost ? (
            <GameButton
              icon="back"
              onClick={() => {
                if (window.confirm("Stop the match and return all operatives to the lobby?")) {
                  onReturnToLobby?.()
                }
              }}
              variant="outline"
              title="Stop Match & Return to Lobby"
            >
              RETURN TO LOBBY
            </GameButton>
          ) : (
            <GameButton icon="back" onClick={onExit} variant="ghost">
              EXIT
            </GameButton>
          )}
        </div>
      </header>

      {/* Center-top countdown timer below the nav bar when the timer starts */}
      {countdownSeconds !== null && !isResults && !isGameOver && (
        <div
          className={`game-timer ${countdownSeconds <= 5 ? "game-timer--urgent" : ""}`}
        >
          <Icon name="clock" size={18} />
          <span>
            {`${String(Math.floor(countdownSeconds / 60)).padStart(2, "0")}:${String(countdownSeconds % 60).padStart(2, "0")}`}
          </span>
        </div>
      )}

      {/* Floating Admission Request Notification Bar for Host Mid-Game */}
      {isHost && pendingRequests && pendingRequests.length > 0 && (
        <aside className="game-pending-admission-pill">
          <div className="game-pending-header">
            <span className="game-pending-pulse" />
            <span className="game-pending-title">
              ENTRY REQUESTS ({pendingRequests.length})
            </span>
          </div>
          <div className="game-pending-items">
            {pendingRequests.map((req) => (
              <div key={req.clientId} className="game-pending-row">
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
      )}

      {/* Explore View: Quick Floating Map */}
      {view === "explore" && !isResults && !isGameOver && (
        <>
          <div className="location-prompt">
            <span className="section-index">
              ROUND {String(currentRound).padStart(2, "0")} · {room.selectedRegion || "WORLD"}
            </span>
            <strong>READ THE LANDSCAPE</strong>
            <small>
              Look for architecture, vegetation, sun angle, road markings, and driving side.
            </small>
          </div>

          {/* Live Standings Panel during Explore / Recon */}
          <LiveStandingsWidget
            currentRound={currentRound}
            leaderboard={liveLeaderboard}
            totalRounds={totalRounds}
            totalScore={totalScore}
          />

          <aside className={`guess-console ${myPin ? "guess-console--active" : ""}`}>
            <div className="guess-heading">
              <span>
                <Icon name="map" />
                TACTICAL ATLAS
              </span>
              <small>{hasGuessed ? "GUESS LOCKED" : myPin ? "PIN PLACED" : "CLICK TO DROP PIN"}</small>
            </div>
            <div className="tactical-map overflow-hidden rounded-lg">
              <LeafletMapView
                interactive={!hasGuessed}
                onSelectCoords={onSelectCoords}
                pin={myPin}
              />
            </div>
            <div className="map-actions">
              <span>
                <small>STATUS</small>
                <strong>
                  {hasGuessed ? "LOCKED IN" : myPin ? "PIN PLACED" : "NO PIN"}
                </strong>
              </span>
              {hasGuessed ? (
                <div className="text-xs font-mono text-emerald-400 font-bold px-3 py-2 bg-slate-900 border border-emerald-500/40 rounded">
                  LOCKED IN
                </div>
              ) : (
                <GameButton
                  disabled={!myPin}
                  icon="check"
                  onClick={onLockGuess}
                  variant="primary"
                >
                  CONFIRM GUESS
                </GameButton>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Atlas View: Full Interactive Map Screen - Map Only, No Text, No Coordinates */}
      {view === "atlas" && !isResults && !isGameOver && (
        <section className="atlas-view">
          <div className="atlas-map overflow-hidden">
            <LeafletMapView
              interactive={!hasGuessed}
              onSelectCoords={onSelectCoords}
              pin={myPin}
              zoom={3}
            />
            {/* Live Standings Panel during Atlas View */}
            <LiveStandingsWidget
              className="live-standings-widget--atlas"
              currentRound={currentRound}
              leaderboard={liveLeaderboard}
              totalRounds={totalRounds}
              totalScore={totalScore}
            />
            <div className="atlas-footer">
              {hasGuessed ? (
                <div className="text-sm font-mono text-emerald-400 font-bold px-5 py-2.5 bg-slate-900/90 border border-emerald-500/60 rounded-xl shadow-lg backdrop-blur-md">
                  GUESS LOCKED // WAITING FOR SQUAD
                </div>
              ) : (
                <GameButton
                  disabled={!myPin}
                  icon="check"
                  onClick={onLockGuess}
                  variant="primary"
                >
                  {myPin ? "LOCK IN GUESS" : "CLICK MAP TO PLACE PIN"}
                </GameButton>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Standings View */}
      {view === "standings" && !isResults && !isGameOver && (
        <LeaderboardScreen
          leaderboard={liveLeaderboard}
        />
      )}

      {/* Round Results Screen */}
      {isResults && !isGameOver && (
        <section className="round-result">
          <div className="result-map">
            <LeafletMapView
              interactive={true}
              pin={myPin}
              playerGuesses={playerGuesses}
              targetCoords={target}
            />
          </div>

          <div className="result-details">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="section-index text-xs font-mono uppercase tracking-widest text-sky-400">
                  ROUND {String(currentRound).padStart(2, "0")} / {String(totalRounds).padStart(2, "0")} COMPLETE
                </span>
                <span className="text-xs font-mono text-emerald-400 px-2.5 py-0.5 bg-emerald-950/60 border border-emerald-500/30 rounded font-bold">
                  TARGET REVEALED
                </span>
              </div>

              <div className="result-title">
                {myDistanceKm != null ? `${myDistanceKm.toLocaleString()} KM` : "MISSED GUESS"}
              </div>

              <div className="result-location">
                <span>🎯 ACTUAL: </span>
                <span className="text-slate-200">
                  {target?.label || (target?.country ? `${target.country}${target.region ? ` (${target.region})` : ''}` : "VERIFIED ROAD")}
                </span>
              </div>

              <div className="result-score">
                <span>
                  <small>POINTS EARNED</small>
                  <strong className="text-emerald-400">+{myRoundScore.toLocaleString()}</strong>
                </span>
                <span>
                  <small>CLOSEST EXPLORER</small>
                  <strong className="text-amber-400 truncate">
                    {roundResults.closestPlayer?.username ? `👑 ${roundResults.closestPlayer.username}` : "NONE"}
                  </strong>
                  {roundResults.closestPlayer?.distanceKm != null && (
                    <span className="text-xs font-mono text-slate-400 mt-0.5">
                      {Math.round(roundResults.closestPlayer.distanceKm).toLocaleString()} KM
                    </span>
                  )}
                </span>
              </div>

              {/* Real-time Standings for All Squad Operatives */}
              <div className="round-leaderboard-container mt-3 mb-3">
                <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2 flex items-center justify-between">
                  <span>STANDINGS AFTER ROUND {currentRound}</span>
                  <span className="text-slate-500 font-bold">{currentLeaderboard.length} OPERATIVES</span>
                </div>
                <div className="round-leaderboard-list max-h-48 overflow-y-auto pr-1">
                  {currentLeaderboard.map((player: any) => (
                    <div
                      className={`round-leaderboard-item ${player.isLocal ? "round-leaderboard-item--you" : ""}`}
                      key={player.username}
                    >
                      <span className="round-rank font-mono text-xs font-bold text-slate-400">
                        {player.rank === 1 ? "👑 01" : String(player.rank).padStart(2, "0")}
                      </span>
                      <span className="round-player-name truncate font-semibold text-sm">
                        {player.username}
                        {player.isLocal && <span className="you-pill ml-1.5 text-xs font-mono text-sky-400 font-bold">[YOU]</span>}
                        {player.isHost && <span className="host-pill ml-1 text-xs font-mono text-amber-400 font-bold">👑</span>}
                      </span>
                      <span className="round-player-dist font-mono text-xs text-slate-400">
                        {player.distanceKm != null ? `${Math.round(player.distanceKm)} km` : "MISSED"}
                      </span>
                      <span className="round-player-score font-mono text-sm font-bold text-sky-400 text-right">
                        {(player.totalScore || 0).toLocaleString()} PTS
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Advance Bar: Host Only advances, Guests see waiting prompt */}
            <div className="result-actions mt-2 flex flex-col sm:flex-row gap-3">
              {isHost ? (
                <>
                  <GameButton icon="arrow" onClick={onNextRound} variant="primary">
                    {currentRound >= totalRounds ? "FINALIZE EXPEDITION 🏆" : "ADVANCE TO NEXT ROUND ➔"}
                  </GameButton>
                  <GameButton
                    onClick={() => {
                      if (window.confirm("Stop the match and return all operatives to the lobby?")) {
                        onReturnToLobby?.()
                      }
                    }}
                    variant="outline"
                  >
                    RETURN TO LOBBY
                  </GameButton>
                </>
              ) : (
                <div className="w-full py-3 px-4 bg-slate-900/95 border border-slate-700/80 rounded-xl flex items-center justify-center gap-2.5">
                  <span className="inline-block w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
                  <span className="text-xs font-mono text-amber-300 font-bold uppercase tracking-wider">
                    WAITING FOR SQUAD LEADER 👑 TO ADVANCE
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Game Over Screen */}
      {isGameOver && (
        <section className="leaderboard-view">
          <div className="leaderboard-heading">
            <span className="section-index">EXPEDITION COMPLETE</span>
            <div className="atlas-title">FINAL STANDINGS</div>
            <p>All rounds completed. Standings based on total distance and speed.</p>
          </div>
          <Podium players={gameOver.leaderboard || []} />
          <div className="standing-list">
            {(gameOver.leaderboard || []).map((player: any, idx: number) => (
              <div className="standing-row" key={player.username}>
                <span className="standing-rank">{String(idx + 1).padStart(2, "0")}</span>
                <span className="avatar avatar--cyan">{player.username.slice(0, 2).toUpperCase()}</span>
                <span className="standing-name">
                  <strong>{player.username}</strong>
                </span>
                <strong className="standing-score">{(player.totalScore || 0).toLocaleString()} PTS</strong>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center gap-4">
            {isHost ? (
              <GameButton icon="arrow" onClick={onReturnToLobby || onExit} variant="primary">
                RETURN TO SQUAD LOBBY
              </GameButton>
            ) : (
              <GameButton onClick={onExit} variant="outline">
                EXIT MATCH
              </GameButton>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
