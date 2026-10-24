import type { MutableRefObject } from "react"
import type { Socket } from "socket.io-client"
import { deriveAesGcmKey } from "../crypto-client"
import { setStoredActiveRoom } from "../shared/utils/cookies"
import type { Room } from "../types/game"
import type { ToastItem } from "../shared/components/ToastContainer"
import type { AppState } from "./useAppState"
import { bindCrownSocketEvents } from "./useCrownSocketEvents"

export interface LobbySocketContext {
  socket: Socket
  state: AppState
  ecdhKeyPairRef: MutableRefObject<CryptoKeyPair | null>
  aesKeyRef: MutableRefObject<CryptoKey | null>
  pendingUsernameCheckRef: MutableRefObject<((available: boolean) => void) | null>
  addToast: (message: string, type?: ToastItem["type"]) => void
}

export function bindLobbySocketEvents(ctx: LobbySocketContext) {
  const { socket, state } = ctx

  const clearSessionToBrowser = () => {
    state.setActiveRoom(null)
    setStoredActiveRoom(null)
    ctx.aesKeyRef.current = null
    state.updateScreen("browser", undefined, true)
  }

  socket.on("error_message", (data: any) => {
    state.setIsCreatingRoom(false)
    state.setIsCheckingUsername(false)
    const msg = data.message || "Squad protocol error."
    if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("lobby not found")) return clearSessionToBrowser()
    if (msg.toLowerCase().includes("codename") || msg.toLowerCase().includes("username")) {
      state.setUsernameError(msg)
    } else {
      alert(msg)
    }
  })

  socket.on("username_check_result", (data: any) => {
    state.setIsCheckingUsername(false)
    ctx.pendingUsernameCheckRef.current?.(data.available)
    ctx.pendingUsernameCheckRef.current = null
    state.setUsernameError(data.available ? null : `Codename "${data.username}" is already taken by another operative.`)
  })

  socket.on("lobbies_list", (list: Room[]) => state.setLobbies(list || []))
  socket.on("room_code_lookup_result", (data: any) => state.setSearchedRoom(data?.room || null))

  socket.on("lobby_joined", async (data: any) => {
    state.setActiveRoom({
      id: data.roomId,
      code: data.code || data.roomId,
      isPrivate: Boolean(data.isPrivate),
      name: data.roomName,
      hostName: data.hostName,
      hostIp: data.hostIp,
      playerCount: data.players?.length || 1,
      maxPlayers: data.maxPlayers || 8,
      selectedRegion: data.selectedRegion || "all",
      difficulty: data.difficulty || "all",
      totalRounds: data.totalRounds || 5,
      status: data.status || "LOBBY",
      ping: 3,
    })
    state.setIsHost(Boolean(data.isHost))
    state.setRoomPlayers(data.players || [])
    state.setTotalRounds(data.totalRounds || 5)
    state.setIsCreatingRoom(false)
    state.setShowCreateModal(false)
    state.setPendingRoomName(null)
    state.setSearchedRoom(null)

    setStoredActiveRoom(data.roomId, Boolean(data.isHost))
    state.updateScreen(data.status === "LOBBY" ? "lobby" : "game", data.roomId)

    if (data.status && data.status !== "LOBBY") socket.emit("join_game", { roomId: data.roomId })
    if (data.serverPublicKey && ctx.ecdhKeyPairRef.current) {
      try {
        ctx.aesKeyRef.current = await deriveAesGcmKey(data.serverPublicKey, ctx.ecdhKeyPairRef.current.privateKey)
      } catch (err) {
        console.error("ECDH key derivation failed:", err)
      }
    }
  })

  socket.on("lobby_update", (data: any) => {
    state.setRoomPlayers(data.players || [])
    state.setActiveRoom((prev) =>
      prev ? {
        ...prev,
        code: data.code || prev.code || prev.id,
        isPrivate: data.isPrivate !== undefined ? Boolean(data.isPrivate) : prev.isPrivate,
        name: data.roomName || prev.name, hostName: data.hostName || prev.hostName,
        maxPlayers: data.maxPlayers || prev.maxPlayers, selectedRegion: data.selectedRegion || prev.selectedRegion,
        difficulty: data.difficulty || prev.difficulty, totalRounds: data.totalRounds || prev.totalRounds,
        status: data.gameStatus?.status || prev.status,
      } : null,
    )
  })

  socket.on("region_updated", (d: any) => state.setActiveRoom((p) => (p ? { ...p, selectedRegion: d.selectedRegion } : null)))
  socket.on("difficulty_updated", (d: any) => state.setActiveRoom((p) => (p ? { ...p, difficulty: d.difficulty } : null)))
  socket.on("params_updated", (d: any) => {
    if (d.totalRounds) state.setTotalRounds(d.totalRounds)
    state.setActiveRoom((p) => (p ? { ...p, totalRounds: d.totalRounds } : null))
  })

  socket.on("kicked_from_lobby", (data: any) => {
    alert(data?.message || "You have been kicked from the squad by the leader.")
    clearSessionToBrowser()
  })

  socket.on("admission_pending", (data: any) => {
    state.setPendingRoomName(data?.roomName || "the squad")
    state.updateScreen("pending")
  })

  socket.on("admission_rejected", (data: any) => {
    state.setPendingRoomName(null)
    alert(data?.message || "Your request to join was rejected by the Squad Leader.")
    state.updateScreen("browser", undefined, true)
  })

  socket.on("admission_request", (data: any) => {
    state.setPendingRequests((prev) =>
      prev.some((r) => r.clientId === data.clientId)
        ? prev
        : [...prev, { clientId: data.clientId, username: data.username, requestedAt: data.requestedAt }],
    )
    ctx.addToast(`Operative "${data.username}" requested entry to squad`, "warning")
  })

  socket.on("player_entered_lobby", (d: any) => ctx.addToast(`Operative "${d.username}" entered the squad!`, "success"))
  socket.on("player_joined", (d: any) => ctx.addToast(`Operative "${d.username}" joined the match!`, "info"))
  socket.on("player_left", (d: any) => ctx.addToast(`Operative "${d.username || "An operative"}" left the squad.`, "info"))
  socket.on("lobby_terminated", (data: any) => {
    alert(data?.message || data?.reason || "Squad leader has disconnected. Expedition disbanded.")
    clearSessionToBrowser()
  })

  bindCrownSocketEvents(ctx)
}

export default bindLobbySocketEvents
