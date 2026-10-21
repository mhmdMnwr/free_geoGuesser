import { useState, useEffect, useRef, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import {
  generateClientEcdhKeyPair,
  deriveAesGcmKey,
  encryptPayload,
} from "./crypto-client"
import type { ConnectionMode, Screen, Room, Player, Coordinates, PendingRequest } from "./types/game"
import { ModeSelect } from "./features/mode-select"
import { RoomBrowser, CreateRoomModal, type CreateRoomFormValues } from "./features/room-browser"
import { Lobby } from "./features/lobby"
import { GameScreen } from "./features/game"
import { ToastContainer, type ToastItem } from "./shared/components/ToastContainer"
import {
  getStoredUsername,
  setStoredUsername,
  getStoredClientId,
  getStoredActiveRoom,
  setStoredActiveRoom,
  getStoredScreen,
  setStoredScreen,
} from "./shared/utils/cookies"
import {
  parseCurrentRoute,
  navigateTo,
  lockNavigation,
} from "./shared/utils/router"

export default function App() {
  const [selectedMode, setSelectedMode] = useState<ConnectionMode | null>("lan")
  const [screen, setScreen] = useState<Screen>(() => {
    const active = getStoredActiveRoom()
    const storedScreen = getStoredScreen()
    if (active && (storedScreen === "lobby" || storedScreen === "game")) {
      return storedScreen
    }
    return "select"
  })
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((message: string, type: ToastItem["type"] = "info") => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const [isLaunching, setIsLaunching] = useState(false)
  const [clientId] = useState(() => getStoredClientId())
  const [username, setUsername] = useState(() => getStoredUsername())
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [pendingRoomName, setPendingRoomName] = useState<string | null>(null)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)

  const [lobbies, setLobbies] = useState<Room[]>([])
  const [activeRoom, setActiveRoom] = useState<Room | null>(null)
  const [roomPlayers, setRoomPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState<boolean>(false)
  const [lanAddress, setLanAddress] = useState("")

  // Game active state
  const [currentRound, setCurrentRound] = useState(1)
  const [totalRounds, setTotalRounds] = useState(5)
  const [uplinkToken, setUplinkToken] = useState<string | null>(null)
  const [roadToken, setRoadToken] = useState<string | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
  const [myPin, setMyPin] = useState<Coordinates | null>(null)
  const [hasGuessed, setHasGuessed] = useState(false)
  const [totalScore, setTotalScore] = useState(0)
  const [roundResults, setRoundResults] = useState<any>(null)
  const [gameOver, setGameOver] = useState<any>(null)

  // Zero-Trust ECDH & AES State
  const [ecdhKeyPair, setEcdhKeyPair] = useState<CryptoKeyPair | null>(null)
  const [clientPublicKey, setClientPublicKey] = useState<string | null>(null)
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null)

  const ecdhKeyPairRef = useRef<CryptoKeyPair | null>(null)
  const clientPublicKeyRef = useRef<string | null>(null)
  const aesKeyRef = useRef<CryptoKey | null>(null)

  // Create Room Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [createRoomError, setCreateRoomError] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const pendingUsernameCheckRef = useRef<((available: boolean) => void) | null>(null)

  // Synchronize screen state changes with URL routing and Cookie storage
  const updateScreen = useCallback((newScreen: Screen, roomId?: string, replace = false) => {
    setScreen(newScreen)
    if (newScreen !== "pending") {
      setStoredScreen(newScreen)
    }
    navigateTo(newScreen, roomId, replace)
  }, [])

  // Lock navigation to prevent browser back/forward buttons from changing pages
  useEffect(() => {
    const unlock = lockNavigation()
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (screen === "lobby" || screen === "game") {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      unlock()
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [screen])

  // Initialize client ECDH keypair on mount
  useEffect(() => {
    generateClientEcdhKeyPair()
      .then(({ keyPair, publicKeyHex }) => {
        setEcdhKeyPair(keyPair)
        setClientPublicKey(publicKeyHex)
        ecdhKeyPairRef.current = keyPair
        clientPublicKeyRef.current = publicKeyHex
      })
      .catch((err) => console.error("Client ECDH generation error:", err))
  }, [])

  // Persist username changes to Cookies and LocalStorage
  useEffect(() => {
    setStoredUsername(username)
    setUsernameError(null)
  }, [username])

  // Host heartbeat ping loop (every 2.5s) to sustain the watchdog TTL
  useEffect(() => {
    if (!isHost || !activeRoom) return
    const interval = setInterval(() => {
      if (socketRef.current && socketRef.current.connected && activeRoom) {
        socketRef.current.emit("host_heartbeat", { roomId: activeRoom.id })
      }
      fetch(`/api/lobbies/${encodeURIComponent(activeRoom.id)}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: clientId }),
      }).catch(() => {})
    }, 2500)
    return () => clearInterval(interval)
  }, [isHost, activeRoom?.id, clientId])

  // Refresh lobbies list when browser screen is active
  useEffect(() => {
    if (screen !== "browser") return
    const fetchLobbies = () => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("get_lobbies")
      }
    }
    fetchLobbies()
    const interval = setInterval(fetchLobbies, 2500)
    return () => clearInterval(interval)
  }, [screen])

  // Connect socket on mount (passes roomId and clientId for seamless reconnect upon refresh)
  useEffect(() => {
    fetch("/api/info")
      .then((res) => res.json())
      .then((data) => {
        const hostName = window.location.hostname
        const isLocal = !hostName || hostName === "localhost" || hostName === "127.0.0.1"
        const ipToUse = !isLocal ? hostName : (data.primaryIp || "localhost")
        const portToUse = window.location.port || data.frontendPort || 3000
        setLanAddress(`${ipToUse}:${portToUse}`)
      })
      .catch(() => {})

    const initialRoute = parseCurrentRoute()
    const initialStored = getStoredActiveRoom()
    const targetRoomId = initialRoute.roomId || initialStored?.id

    const socket = io({
      transports: ["polling", "websocket"],
      query: {
        clientId,
        isBrowser: "true",
        roomId: targetRoomId || "",
      },
      reconnectionAttempts: 15,
      timeout: 10000,
    })
    socketRef.current = socket

    socket.on("connect", () => {
      socket.emit("get_lobbies")

      // If user refreshed while in a room, automatically re-join with their codename
      if (targetRoomId) {
        socket.emit("join_lobby", {
          roomId: targetRoomId,
          username: getStoredUsername(),
          clientPublicKey: clientPublicKeyRef.current || clientPublicKey,
        })
        if (initialRoute.screen === "game") {
          socket.emit("join_game", { roomId: targetRoomId })
        }
      }
    })

    socket.on("connect_error", (err: any) => {
      console.warn("Socket connection error:", err)
    })

    socket.on("error_message", (data: any) => {
      console.error("Server error message:", data)
      setIsCreatingRoom(false)
      setIsCheckingUsername(false)
      const msg = data.message || "Squad protocol error."
      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("lobby not found")) {
        setActiveRoom(null)
        setStoredActiveRoom(null)
        updateScreen("browser")
        return
      }
      if (msg.toLowerCase().includes("codename") || msg.toLowerCase().includes("username")) {
        setUsernameError(msg)
      } else {
        alert(msg)
      }
    })

    socket.on("username_check_result", (data: any) => {
      setIsCheckingUsername(false)
      if (pendingUsernameCheckRef.current) {
        pendingUsernameCheckRef.current(data.available)
        pendingUsernameCheckRef.current = null
      }
      if (!data.available) {
        setUsernameError(`Codename "${data.username}" is already taken by another operative.`)
      } else {
        setUsernameError(null)
      }
    })

    socket.on("lobbies_list", (list: Room[]) => {
      setLobbies(list || [])
    })

    socket.on("lobby_joined", async (data: any) => {
      const room: Room = {
        id: data.roomId,
        name: data.roomName,
        hostName: data.hostName,
        hostIp: data.hostIp,
        playerCount: data.players?.length || 1,
        maxPlayers: 8,
        selectedRegion: data.selectedRegion || "all",
        difficulty: data.difficulty || "all",
        totalRounds: data.totalRounds || 5,
        status: data.status || "LOBBY",
        ping: 3,
      }
      setActiveRoom(room)
      setIsHost(Boolean(data.isHost))
      setRoomPlayers(data.players || [])
      setTotalRounds(data.totalRounds || 5)
      setIsCreatingRoom(false)
      setShowCreateModal(false)
      setPendingRoomName(null)  // clear pending state if we were waiting

      setStoredActiveRoom(data.roomId, Boolean(data.isHost))
      updateScreen(data.status === "LOBBY" ? "lobby" : "game", data.roomId)

      // If rejoining an active match upon refresh, request immediate round state restoration
      if (data.status && data.status !== "LOBBY") {
        socket.emit("join_game", { roomId: data.roomId })
      }

      // Derive in-memory AES-256-GCM session key via ECDH shared secret
      if (data.serverPublicKey && ecdhKeyPairRef.current) {
        try {
          const derived = await deriveAesGcmKey(data.serverPublicKey, ecdhKeyPairRef.current.privateKey)
          setAesKey(derived)
          aesKeyRef.current = derived
        } catch (err) {
          console.error("ECDH key derivation failed:", err)
        }
      }
    })

    socket.on("lobby_update", (data: any) => {
      setRoomPlayers(data.players || [])
      setActiveRoom((prev) => (prev ? {
        ...prev,
        name: data.roomName || prev.name,
        hostName: data.hostName || prev.hostName,
        maxPlayers: data.maxPlayers || prev.maxPlayers,
        selectedRegion: data.selectedRegion || prev.selectedRegion,
        difficulty: data.difficulty || prev.difficulty,
        totalRounds: data.totalRounds || prev.totalRounds,
        status: data.gameStatus?.status || prev.status,
      } : null))
    })

    socket.on("region_updated", (data: any) => {
      setActiveRoom((prev) => (prev ? { ...prev, selectedRegion: data.selectedRegion } : null))
    })

    socket.on("difficulty_updated", (data: any) => {
      setActiveRoom((prev) => (prev ? { ...prev, difficulty: data.difficulty } : null))
    })

    socket.on("params_updated", (data: any) => {
      if (data.totalRounds) setTotalRounds(data.totalRounds)
      setActiveRoom((prev) => (prev ? { ...prev, totalRounds: data.totalRounds } : null))
    })

    socket.on("kicked_from_lobby", (data: any) => {
      alert(data?.message || "You have been kicked from the squad by the leader.")
      setActiveRoom(null)
      setStoredActiveRoom(null)
      setAesKey(null)
      aesKeyRef.current = null
      updateScreen("browser", undefined, true)
    })

    socket.on("admission_pending", (data: any) => {
      setPendingRoomName(data?.roomName || "the squad")
      updateScreen("pending")
    })

    socket.on("admission_rejected", (data: any) => {
      setPendingRoomName(null)
      alert(data?.message || "Your request to join was rejected by the Squad Leader.")
      updateScreen("browser", undefined, true)
    })

    socket.on("admission_request", (data: any) => {
      setPendingRequests((prev) => {
        const exists = prev.find((r) => r.clientId === data.clientId)
        if (exists) return prev
        return [...prev, { clientId: data.clientId, username: data.username, requestedAt: data.requestedAt }]
      })
      addToast(`Operative "${data.username}" requested entry to squad`, "warning")
    })

    socket.on("player_entered_lobby", (data: any) => {
      addToast(`Operative "${data.username}" entered the squad!`, "success")
    })

    socket.on("player_joined", (data: any) => {
      addToast(`Operative "${data.username}" joined the match!`, "info")
    })

    socket.on("player_left", (data: any) => {
      addToast(`Operative "${data.username || "An operative"}" left the squad.`, "info")
    })

    socket.on("round_started", (data: any) => {
      setCurrentRound(data.round)
      setTotalRounds(data.totalRounds)
      setUplinkToken(data.uplinkToken)
      setRoadToken(data.roadToken || null)
      setCountdownSeconds(null)
      setMyPin(null)
      setHasGuessed(false)
      setRoundResults(null)
      setGameOver(null)
      if (data.players) {
        setRoomPlayers(data.players)
      }
      updateScreen("game", data.roomId || activeRoom?.id)
    })

    socket.on("player_guessed", (data: any) => {
      if (data.players) {
        setRoomPlayers(data.players)
      } else if (data.username) {
        setRoomPlayers((prev) =>
          prev.map((p) =>
            p.username === data.username ? { ...p, hasGuessed: true } : p
          )
        )
      }
      addToast(`Operative "${data.username}" locked in their guess!`, "info")
    })

    socket.on("countdown_started", (data: any) => {
      setCountdownSeconds(data.seconds)
    })

    socket.on("timer_tick", (data: any) => {
      setCountdownSeconds(data.seconds)
    })

    socket.on("round_results", (data: any) => {
      setRoundResults(data)
      if (data.leaderboard) {
        setRoomPlayers(
          data.leaderboard.map((lb: any) => ({
            id: lb.id,
            ip: lb.ip,
            username: lb.username,
            connected: true,
            totalScore: lb.totalScore || 0,
            isHost: Boolean(lb.isHost),
            hasGuessed: true,
          }))
        )
      }
      const myRes = data.results?.find((r: any) => r.isHost || r.ip)
      if (myRes) {
        setTotalScore(myRes.totalScore)
      }
    })

    socket.on("game_over", (data: any) => {
      setGameOver(data)
    })

    socket.on("return_to_lobby", () => {
      addToast("Squad Leader returned match to lobby.", "info")
      setRoundResults(null)
      setGameOver(null)
      setCurrentRound(1)
      setHasGuessed(false)
      setMyPin(null)
      setCountdownSeconds(null)
      setTotalScore(0)
      updateScreen("lobby", activeRoom?.id)
    })

    socket.on("lobby_terminated", (data: any) => {
      alert(data?.message || data?.reason || "Squad leader has disconnected. Expedition disbanded.")
      setActiveRoom(null)
      setStoredActiveRoom(null)
      setAesKey(null)
      aesKeyRef.current = null
      updateScreen("browser", undefined, true)
    })

    return () => {
      socket.disconnect()
    }
  }, [clientId, updateScreen])

  // Validate username uniqueness before advancing to browser
  function handleContinueFromModeSelect() {
    if (!username.trim()) return

    setUsernameError(null)
    setIsCheckingUsername(true)

    if (socketRef.current && socketRef.current.connected) {
      const fallbackTimer = setTimeout(() => {
        if (pendingUsernameCheckRef.current) {
          pendingUsernameCheckRef.current(true)
          pendingUsernameCheckRef.current = null
        }
      }, 1500)

      pendingUsernameCheckRef.current = (available: boolean) => {
        clearTimeout(fallbackTimer)
        setIsCheckingUsername(false)
        if (available) {
          setIsLaunching(true)
          setTimeout(() => {
            updateScreen("browser")
            setIsLaunching(false)
          }, 350)
        }
      }
      socketRef.current.emit("check_username", { username: username.trim() })
    } else {
      // Offline fallback
      setIsCheckingUsername(false)
      setIsLaunching(true)
      setTimeout(() => {
        updateScreen("browser")
        setIsLaunching(false)
      }, 350)
    }
  }

  // Create room via WebSocket exclusively (prevents replicate rooms and ensures host crown)
  function handleCreateRoomSubmit(values: CreateRoomFormValues) {
    const name = values.name.trim() || `${username}'S SQUAD`
    setIsCreatingRoom(true)
    setCreateRoomError(null)

    const payload = {
      name,
      username,
      clientPublicKey: clientPublicKeyRef.current || clientPublicKey || "",
      selectedRegion: values.region,
      difficulty: values.difficulty,
      totalRounds: values.rounds,
      countdownDuration: values.duration,
      maxPlayers: values.maxPlayers,
      rounds: values.rounds,
      duration: values.duration,
      region: values.region,
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("create_lobby", payload)
    } else {
      setIsCreatingRoom(false)
      setCreateRoomError("Not connected to game network. Reconnecting...")
    }
  }

  function handleJoinRoom(room: Room) {
    if (socketRef.current) {
      socketRef.current.emit("join_lobby", {
        roomId: room.id,
        username,
        clientPublicKey: clientPublicKeyRef.current || clientPublicKey,
      })
    }
  }

  function handleCancelPending() {
    setPendingRoomName(null)
    updateScreen("browser", undefined, true)
  }

  function handleAdmitPlayer(targetClientId: string) {
    if (!socketRef.current || !activeRoom) return
    socketRef.current.emit("admit_player", { roomId: activeRoom.id, targetClientId })
    setPendingRequests((prev) => prev.filter((r) => r.clientId !== targetClientId))
  }

  function handleRejectPlayer(targetClientId: string) {
    if (!socketRef.current || !activeRoom) return
    socketRef.current.emit("reject_player", { roomId: activeRoom.id, targetClientId })
    setPendingRequests((prev) => prev.filter((r) => r.clientId !== targetClientId))
  }

  function handleLeaveRoom() {
    if (socketRef.current && activeRoom) {
      socketRef.current.emit("leave_lobby", { roomId: activeRoom.id, isHost })
      socketRef.current.emit("leave_game", { roomId: activeRoom.id, isHost })
    }
    setActiveRoom(null)
    setStoredActiveRoom(null)
    setAesKey(null)
    aesKeyRef.current = null
    updateScreen("browser", undefined, true)
  }

  function handleReturnToLobby() {
    if (socketRef.current && activeRoom) {
      socketRef.current.emit("reset_to_lobby", { roomId: activeRoom.id })
    }
  }

  function handleStartMatch() {
    if (socketRef.current && activeRoom) {
      socketRef.current.emit("start_game", { roomId: activeRoom.id })
    }
  }

  async function handleLockGuess() {
    if (!socketRef.current || !myPin || !activeRoom) return
    if (aesKeyRef.current) {
      try {
        const encryptedGuess = await encryptPayload(
          { lat: myPin.lat, lng: myPin.lng, roomId: activeRoom.id },
          aesKeyRef.current,
        )
        socketRef.current.emit("lock_guess", {
          encryptedGuess,
          roomId: activeRoom.id,
        })
      } catch (err) {
        console.error("Failed to encrypt guess, falling back:", err)
        socketRef.current.emit("lock_guess", {
          lat: myPin.lat,
          lng: myPin.lng,
          roomId: activeRoom.id,
        })
      }
    } else {
      socketRef.current.emit("lock_guess", {
        lat: myPin.lat,
        lng: myPin.lng,
        roomId: activeRoom.id,
      })
    }
    setHasGuessed(true)
  }

  function handleNextRound() {
    if (socketRef.current && activeRoom) {
      socketRef.current.emit("next_round", { roomId: activeRoom.id })
    }
  }

  function handleUpdateSettings(settings: any) {
    if (!socketRef.current || !activeRoom) return
    if (settings.region) {
      socketRef.current.emit("set_region", { region: settings.region, roomId: activeRoom.id })
    }
    if (settings.duration) {
      socketRef.current.emit("set_countdown_duration", { duration: settings.duration, roomId: activeRoom.id })
    }
    if (settings.rounds) {
      socketRef.current.emit("set_total_rounds", { rounds: settings.rounds, roomId: activeRoom.id })
    }
    if (settings.difficulty) {
      socketRef.current.emit("set_difficulty", { difficulty: settings.difficulty, roomId: activeRoom.id })
    }
    if (settings.maxPlayers) {
      socketRef.current.emit("set_max_players", { maxPlayers: settings.maxPlayers, roomId: activeRoom.id })
    }
  }

  function handleKickPlayer(targetId: string) {
    if (!socketRef.current || !activeRoom) return
    socketRef.current.emit("kick_player", { roomId: activeRoom.id, targetId })
  }

  return (
    <>
      {screen === "select" && (
        <ModeSelect
          isCheckingUsername={isCheckingUsername}
          isLaunching={isLaunching}
          mode={selectedMode}
          onContinue={handleContinueFromModeSelect}
          setMode={setSelectedMode}
          setUsername={setUsername}
          username={username}
          usernameError={usernameError}
        />
      )}

      {screen === "browser" && (
        <>
          <RoomBrowser
            lobbies={lobbies}
            onBack={() => updateScreen("select")}
            onCreate={() => {
              setCreateRoomError(null)
              setShowCreateModal(true)
            }}
            onJoin={handleJoinRoom}
            username={username}
            onUsernameChange={setUsername}
            errorMessage={usernameError}
          />
          <CreateRoomModal
            defaultName={`${username}'S SQUAD`}
            error={createRoomError}
            isCreating={isCreatingRoom}
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateRoomSubmit}
          />
        </>
      )}

      {screen === "lobby" && activeRoom && (
        <Lobby
          hostIp={activeRoom.hostIp}
          isHost={isHost}
          lanAddress={lanAddress}
          onBack={handleLeaveRoom}
          onKickPlayer={handleKickPlayer}
          onStart={handleStartMatch}
          onUpdateSettings={handleUpdateSettings}
          players={roomPlayers}
          room={activeRoom}
          pendingRequests={pendingRequests}
          onAdmitPlayer={handleAdmitPlayer}
          onRejectPlayer={handleRejectPlayer}
          players={roomPlayers}
        />
      )}

      {screen === "pending" && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 z-50 gap-6">
          <div className="text-amber-400 text-5xl animate-spin">⏳</div>
          <div className="text-white font-mono text-xl tracking-widest uppercase text-center">
            Waiting for Squad Leader to approve...
          </div>
          <div className="text-slate-400 font-mono text-sm">
            Requesting entry to: <strong className="text-cyan-400">{pendingRoomName}</strong>
          </div>
          <button
            className="mt-4 px-6 py-2 font-mono text-sm text-rose-400 border border-rose-700 rounded hover:bg-rose-900 transition-all"
            onClick={handleCancelPending}
          >
            ✕ CANCEL REQUEST
          </button>
        </div>
      )}

      {screen === "game" && activeRoom && (
        <GameScreen
          countdownSeconds={countdownSeconds}
          currentRound={currentRound}
          gameOver={gameOver}
          hasGuessed={hasGuessed}
          isHost={isHost}
          myPin={myPin}
          onExit={handleLeaveRoom}
          onReturnToLobby={handleReturnToLobby}
          onLockGuess={handleLockGuess}
          onNextRound={handleNextRound}
          onSelectCoords={(coords) => setMyPin(coords)}
          room={activeRoom}
          roundResults={roundResults}
          totalRounds={totalRounds}
          totalScore={totalScore}
          uplinkToken={uplinkToken}
          roadToken={roadToken}
          username={username}
          clientId={clientId}
          pendingRequests={pendingRequests}
          onAdmitPlayer={handleAdmitPlayer}
          onRejectPlayer={handleRejectPlayer}
          players={roomPlayers}
        />
      )}

      <ToastContainer onDismiss={removeToast} toasts={toasts} />
    </>
  )
}
