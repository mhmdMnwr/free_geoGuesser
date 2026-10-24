import { useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { generateClientEcdhKeyPair } from "../crypto-client"
import {
  getStoredActiveRoom,
  getStoredScreen,
  getStoredUsername,
} from "../shared/utils/cookies"
import { parseCurrentRoute } from "../shared/utils/router"
import { bindLobbySocketEvents } from "./useLobbySocketEvents"
import { bindGameplaySocketEvents } from "./useGameplaySocketEvents"
import type { ToastItem } from "../shared/components/ToastContainer"
import type { AppState } from "./useAppState"

export function useGameSocket(
  state: AppState,
  addToast: (message: string, type?: ToastItem["type"]) => void,
) {
  const socketRef = useRef<Socket | null>(null)
  const ecdhKeyPairRef = useRef<CryptoKeyPair | null>(null)
  const clientPublicKeyRef = useRef<string | null>(null)
  const aesKeyRef = useRef<CryptoKey | null>(null)
  const pendingUsernameCheckRef = useRef<((available: boolean) => void) | null>(null)

  useEffect(() => {
    generateClientEcdhKeyPair()
      .then(({ keyPair, publicKeyHex }) => {
        ecdhKeyPairRef.current = keyPair
        clientPublicKeyRef.current = publicKeyHex
      })
      .catch((err) => console.error("Client ECDH generation error:", err))
  }, [])

  useEffect(() => {
    if (!state.isHost || !state.activeRoom) return
    const roomId = state.activeRoom.id
    const interval = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("host_heartbeat", { roomId })
      }
      fetch(`/api/lobbies/${encodeURIComponent(roomId)}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: state.clientId }),
      }).catch(() => {})
    }, 2500)
    return () => clearInterval(interval)
  }, [state.isHost, state.activeRoom?.id, state.clientId])

  useEffect(() => {
    if (state.screen !== "browser" || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview"))) return
    const fetchLobbies = () => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("get_lobbies")
      }
    }
    fetchLobbies()
    const interval = setInterval(fetchLobbies, 2500)
    return () => clearInterval(interval)
  }, [state.screen])

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview")) {
      return
    }
    const initialRoute = parseCurrentRoute()
    const initialStored = getStoredActiveRoom()
    const targetRoomId = initialRoute.roomId || initialStored?.id

    const socket = io({
      transports: ["polling", "websocket"],
      query: { clientId: state.clientId, isBrowser: "true", roomId: targetRoomId || "" },
      reconnectionAttempts: 15,
      timeout: 10000,
    })
    socketRef.current = socket

    socket.on("connect", async () => {
      socket.emit("get_lobbies")
      const roomToRejoin = getStoredActiveRoom()?.id || targetRoomId
      if (roomToRejoin) {
        if (!clientPublicKeyRef.current) {
          try {
            const { keyPair, publicKeyHex } = await generateClientEcdhKeyPair()
            ecdhKeyPairRef.current = keyPair
            clientPublicKeyRef.current = publicKeyHex
          } catch (err) {
            console.error("Client ECDH generation error:", err)
          }
        }
        socket.emit("join_lobby", {
          roomId: roomToRejoin,
          username: getStoredUsername(),
          clientPublicKey: clientPublicKeyRef.current || "",
        })
        if (getStoredScreen() === "game" || initialRoute.screen === "game") {
          socket.emit("join_game", { roomId: roomToRejoin })
        }
      }
    })

    socket.on("connect_error", (err: any) => console.warn("Socket connection error:", err))

    bindLobbySocketEvents({
      socket,
      state,
      ecdhKeyPairRef,
      aesKeyRef,
      pendingUsernameCheckRef,
      addToast,
    })
    bindGameplaySocketEvents({ socket, state, addToast })

    return () => {
      socket.disconnect()
    }
  }, [state.clientId, state.updateScreen])

  return { socketRef, clientPublicKeyRef, aesKeyRef, pendingUsernameCheckRef }
}
