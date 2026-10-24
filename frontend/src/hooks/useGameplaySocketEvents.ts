import type { Socket } from "socket.io-client"
import { getStoredActiveRoom, getStoredUsername } from "../shared/utils/cookies"
import type { ToastItem } from "../shared/components/ToastContainer"
import type { AppState } from "./useAppState"

export interface GameplaySocketContext {
  socket: Socket
  state: AppState
  addToast: (message: string, type?: ToastItem["type"]) => void
}

export function bindGameplaySocketEvents({ socket, state, addToast }: GameplaySocketContext) {
  socket.on("round_started", (data: any) => {
    state.setCurrentRound(data.round)
    state.setTotalRounds(data.totalRounds)
    state.setUplinkToken(data.uplinkToken)
    state.setCountdownSeconds(data.countdownSeconds ?? null)
    state.setMyPin(data.myPin || null)
    state.setHasGuessed(Boolean(data.hasGuessed))
    if (typeof data.totalScore === "number") {
      state.setTotalScore(data.totalScore)
    }
    state.setRoundResults(null)
    state.setGameOver(null)
    if (data.players) {
      state.setRoomPlayers(data.players)
    }
    state.updateScreen("game", data.roomId || getStoredActiveRoom()?.id)
  })

  socket.on("player_guessed", (data: any) => {
    if (data.players) {
      state.setRoomPlayers(data.players)
    } else if (data.username) {
      state.setRoomPlayers((prev) =>
        prev.map((p) => (p.username === data.username ? { ...p, hasGuessed: true } : p)),
      )
    }
    if (data.username && data.username.toLowerCase() === getStoredUsername().toLowerCase()) {
      state.setHasGuessed(true)
    }
    addToast(`Operative "${data.username}" locked in their guess!`, "info")
  })

  socket.on("countdown_started", (data: any) => state.setCountdownSeconds(data.seconds))
  socket.on("timer_tick", (data: any) => state.setCountdownSeconds(data.seconds))

  socket.on("round_results", (data: any) => {
    state.setRoundResults(data)
    if (data.leaderboard) {
      state.setRoomPlayers(
        data.leaderboard.map((lb: any) => ({
          id: lb.id,
          ip: lb.ip,
          username: lb.username,
          connected: true,
          totalScore: lb.totalScore || 0,
          isHost: Boolean(lb.isHost),
          hasGuessed: true,
        })),
      )
    }
    const storedName = getStoredUsername().toLowerCase()
    const myRes = data.results?.find(
      (r: any) => r.id === state.clientId || r.username?.toLowerCase() === storedName,
    )
    if (myRes && typeof myRes.totalScore === "number") {
      state.setTotalScore(myRes.totalScore)
    }
  })

  socket.on("game_over", (data: any) => state.setGameOver(data))

  socket.on("return_to_lobby", (data: any) => {
    addToast("Squad Leader returned match to lobby.", "info")
    state.setRoundResults(null)
    state.setGameOver(null)
    state.setCurrentRound(1)
    state.setHasGuessed(false)
    state.setMyPin(null)
    state.setCountdownSeconds(null)
    state.setTotalScore(0)
    if (data?.players) {
      state.setRoomPlayers(data.players)
    }
    state.updateScreen("lobby", data?.roomId || getStoredActiveRoom()?.id)
  })
}
