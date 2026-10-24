import type { MutableRefObject } from "react"
import type { Socket } from "socket.io-client"
import { encryptPayload } from "../crypto-client"
import { setStoredActiveRoom } from "../shared/utils/cookies"
import type { Room } from "../types/game"
import type { CreateRoomFormValues } from "../features/room-browser"
import type { LobbySettingsUpdate } from "../features/lobby"
import type { ToastItem } from "../shared/components/ToastContainer"
import type { AppState } from "./useAppState"

interface UseGameActionsParams {
  state: AppState
  socketRef: MutableRefObject<Socket | null>
  clientPublicKeyRef: MutableRefObject<string | null>
  aesKeyRef: MutableRefObject<CryptoKey | null>
  pendingUsernameCheckRef: MutableRefObject<((available: boolean) => void) | null>
  addToast: (message: string, type?: ToastItem["type"]) => void
}

export function useGameActions({
  state, socketRef, clientPublicKeyRef, aesKeyRef, pendingUsernameCheckRef, addToast,
}: UseGameActionsParams) {
  function handleContinueFromModeSelect() {
    if (!state.username.trim()) return
    state.setUsernameError(null)
    state.setIsCheckingUsername(true)

    const launchToBrowser = () => {
      state.setIsCheckingUsername(false)
      state.setIsLaunching(true)
      setTimeout(() => { state.updateScreen("browser"); state.setIsLaunching(false) }, 350)
    }

    if (socketRef.current?.connected) {
      const fallbackTimer = setTimeout(() => {
        pendingUsernameCheckRef.current?.(true)
        pendingUsernameCheckRef.current = null
      }, 1500)
      pendingUsernameCheckRef.current = (available: boolean) => {
        clearTimeout(fallbackTimer)
        if (available) launchToBrowser()
        else state.setIsCheckingUsername(false)
      }
      socketRef.current.emit("check_username", { username: state.username.trim() })
    } else {
      launchToBrowser()
    }
  }

  function handleCreateRoomSubmit(values: CreateRoomFormValues) {
    const name = values.name.trim() || `${state.username}'S SQUAD`
    state.setIsCreatingRoom(true)
    state.setCreateRoomError(null)

    if (socketRef.current?.connected) {
      socketRef.current.emit("create_lobby", {
        name, username: state.username, clientPublicKey: clientPublicKeyRef.current || "",
        selectedRegion: values.region, difficulty: values.difficulty, totalRounds: values.rounds,
        countdownDuration: values.duration, maxPlayers: values.maxPlayers, isPrivate: Boolean(values.isPrivate),
        rounds: values.rounds, duration: values.duration, region: values.region,
      })
    } else {
      state.setIsCreatingRoom(false)
      state.setCreateRoomError("Not connected to game network. Reconnecting...")
    }
  }

  function handleLeaveRoom() {
    if (state.screen === "game" && state.isHost) {
      if (socketRef.current && state.activeRoom) socketRef.current.emit("reset_to_lobby", { roomId: state.activeRoom.id })
      return
    }
    if (socketRef.current && state.activeRoom) {
      socketRef.current.emit("leave_lobby", { roomId: state.activeRoom.id, isHost: state.isHost })
      socketRef.current.emit("leave_game", { roomId: state.activeRoom.id, isHost: state.isHost })
    }
    state.setActiveRoom(null)
    setStoredActiveRoom(null)
    aesKeyRef.current = null
    state.updateScreen("browser", undefined, true)
  }

  async function handleLockGuess() {
    if (!socketRef.current || !state.myPin || !state.activeRoom) return
    const roomId = state.activeRoom.id
    const onAck = (res?: { ok?: boolean; error?: string }) => {
      if (res && res.ok === false) {
        state.setHasGuessed(false)
        addToast(res.error || "Failed to lock guess. Please try again.", "error")
      } else {
        state.setHasGuessed(true)
      }
    }
    const plainPayload = { lat: state.myPin.lat, lng: state.myPin.lng, roomId }
    if (aesKeyRef.current) {
      try {
        const encryptedGuess = await encryptPayload(plainPayload, aesKeyRef.current)
        socketRef.current.emit("lock_guess", { encryptedGuess, roomId }, onAck)
        return
      } catch (err) {
        console.error("Failed to encrypt guess, falling back:", err)
      }
    }
    socketRef.current.emit("lock_guess", plainPayload, onAck)
  }

  function handleUpdateSettings(s: LobbySettingsUpdate) {
    if (!socketRef.current || !state.activeRoom) return
    const roomId = state.activeRoom.id
    if (s.region) socketRef.current.emit("set_region", { region: s.region, roomId })
    if (s.duration) socketRef.current.emit("set_countdown_duration", { duration: s.duration, roomId })
    if (s.rounds) socketRef.current.emit("set_total_rounds", { rounds: s.rounds, roomId })
    if (s.difficulty) socketRef.current.emit("set_difficulty", { difficulty: s.difficulty, roomId })
    if (s.maxPlayers) socketRef.current.emit("set_max_players", { maxPlayers: s.maxPlayers, roomId })
  }

  return {
    handleContinueFromModeSelect, handleCreateRoomSubmit, handleLeaveRoom, handleLockGuess, handleUpdateSettings,
    handleReturnToLobby: () => state.activeRoom && socketRef.current?.emit("reset_to_lobby", { roomId: state.activeRoom.id }),
    handleAdmitPlayer: (id: string) => { socketRef.current?.emit("admit_player", { roomId: state.activeRoom?.id, targetClientId: id }); state.setPendingRequests((p) => p.filter((r) => r.clientId !== id)) },
    handleRejectPlayer: (id: string) => { socketRef.current?.emit("reject_player", { roomId: state.activeRoom?.id, targetClientId: id }); state.setPendingRequests((p) => p.filter((r) => r.clientId !== id)) },
    handleSearchRoomByCode: (code: string) => code.trim().length >= 6 ? socketRef.current?.emit("find_room_by_code", { code: code.trim() }) : state.setSearchedRoom(null),
    handleJoinByCode: (code: string) => socketRef.current?.emit("join_lobby", { roomId: code.trim(), username: state.username, clientPublicKey: clientPublicKeyRef.current || "" }),
    handleDemandCrown: () => { state.setCrownClaimPending(true); socketRef.current?.emit("demand_crown", { roomId: state.activeRoom?.id }) },
    handleRespondCrownDemand: (accept: boolean) => { socketRef.current?.emit("respond_crown_demand", { roomId: state.activeRoom?.id, accept }); state.setCrownDemandNotice(null) },
    handleVoteCrown: (vote: "yes" | "no") => { if (!state.hasVotedCrown) { socketRef.current?.emit("vote_crown", { roomId: state.activeRoom?.id, vote }); state.setHasVotedCrown(true) } },
    handleJoinRoom: (room: Room) => socketRef.current?.emit("join_lobby", { roomId: room.id, username: state.username, clientPublicKey: clientPublicKeyRef.current || "" }),
    handleCancelPending: () => { state.setPendingRoomName(null); state.updateScreen("browser", undefined, true) },
    handleStartMatch: () => state.activeRoom && socketRef.current?.emit("start_game", { roomId: state.activeRoom.id }),
    handleNextRound: () => state.activeRoom && socketRef.current?.emit("next_round", { roomId: state.activeRoom.id }),
    handleKickPlayer: (targetId: string) => state.activeRoom && socketRef.current?.emit("kick_player", { roomId: state.activeRoom.id, targetId }),
  }
}
