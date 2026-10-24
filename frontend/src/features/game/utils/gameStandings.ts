import type { Player } from "../../../types/game"
import type { PlayerGuessResult } from "./leafletMarkers"

interface TelemetryParams {
  roundResults: any
  gameOver: any
  players: Player[]
  username?: string
  clientId?: string
  isHost: boolean
  totalScore: number
  hasGuessed: boolean
}

export function deriveGameTelemetry({
  roundResults,
  gameOver,
  players,
  username,
  clientId,
  isHost,
  totalScore,
  hasGuessed,
}: TelemetryParams) {
  const target = roundResults?.target || roundResults?.targetLocation || null
  const rawResults: any[] = roundResults?.results || []

  const isLocalPlayer = (p: any) =>
    Boolean(
      (username && p.username?.toLowerCase() === username.toLowerCase()) ||
        (clientId && p.id === clientId),
    )

  const playerGuesses: PlayerGuessResult[] = rawResults
    .filter((r) => r && (r.guess || r.guessCoords || r.coords))
    .map((r) => {
      const coords = r.guess || r.guessCoords || r.coords
      const isClosest = Boolean(
        roundResults?.closestPlayer &&
          roundResults.closestPlayer.username?.toLowerCase() === r.username?.toLowerCase(),
      )
      return {
        username: r.username,
        coords: { lat: coords.lat, lng: coords.lng },
        distanceKm: r.distanceKm,
        roundScore: r.roundScore,
        totalScore: r.totalScore,
        isClosest,
        isLocal: isLocalPlayer(r),
        isHost: Boolean(r.isHost),
      }
    })

  const myResult = rawResults.find((r) => isLocalPlayer(r) || (isHost && r.isHost))
  const myDistanceKm: number | null = myResult?.distanceKm ?? null
  const myRoundScore: number = myResult?.roundScore ?? 0

  const currentLeaderboard = (
    roundResults?.leaderboard ||
    [...rawResults].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
  ).map((p: any, idx: number) => ({
    ...p,
    isLocal: isLocalPlayer(p),
    rank: idx + 1,
  }))

  const liveLeaderboard =
    roundResults?.leaderboard ||
    gameOver?.leaderboard ||
    (players.length > 0
      ? [...players]
          .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
          .map((p: any, idx: number) => ({
            id: p.id || p.ip,
            username: p.username,
            totalScore: p.totalScore || 0,
            isHost: p.isHost,
            hasGuessed: Boolean(p.hasGuessed),
            rank: idx + 1,
            isLocal: isLocalPlayer(p),
          }))
      : [
          {
            username: username || "YOU",
            totalScore: totalScore || 0,
            rank: 1,
            isLocal: true,
            isHost,
            hasGuessed,
          },
        ])

  return {
    target,
    playerGuesses,
    myDistanceKm,
    myRoundScore,
    currentLeaderboard,
    liveLeaderboard,
  }
}
