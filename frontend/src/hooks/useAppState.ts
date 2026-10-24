import { useState, useEffect, useCallback } from "react"
import type {
  ConnectionMode,
  Screen,
  Room,
  Player,
  Coordinates,
  PendingRequest,
  CrownDemandNotice,
  CrownVoteNotice,
  CrownElectionResult,
} from "../types/game"
import {
  setStoredUsername,
  getStoredClientId,
  getStoredActiveRoom,
  setStoredScreen,
} from "../shared/utils/cookies"
import { navigateTo, lockNavigation } from "../shared/utils/router"
import {
  getPreviewParam,
  getInitialScreen,
  getInitialActiveRoom,
  getInitialUsername,
  MOCK_PLAYERS,
  MOCK_BROWSER_LOBBIES,
  MOCK_PIN,
  MOCK_RESULTS,
} from "./previewMockData"

export function useAppState() {
  const preview = getPreviewParam()
  const [selectedMode, setSelectedMode] = useState<ConnectionMode | null>("online")
  const [screen, setScreen] = useState<Screen>(() => getInitialScreen())

  const [isLaunching, setIsLaunching] = useState(false)
  const [clientId] = useState(() => getStoredClientId())
  const [username, setUsername] = useState(() => getInitialUsername())
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [pendingRoomName, setPendingRoomName] = useState<string | null>(null)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)

  const [lobbies, setLobbies] = useState<Room[]>(() => (preview === "browser" ? MOCK_BROWSER_LOBBIES : []))
  const [searchedRoom, setSearchedRoom] = useState<Room | null>(null)
  const [activeRoom, setActiveRoom] = useState<Room | null>(() => getInitialActiveRoom())
  const [roomPlayers, setRoomPlayers] = useState<Player[]>(() => (preview ? MOCK_PLAYERS : []))
  const [isHost, setIsHost] = useState<boolean>(() => (preview ? true : getStoredActiveRoom()?.isHost || false))

  const [currentRound, setCurrentRound] = useState(preview ? 2 : 1)
  const [totalRounds, setTotalRounds] = useState(5)
  const [uplinkToken, setUplinkToken] = useState<string | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(preview === "game" ? 42 : null)
  const [myPin, setMyPin] = useState<Coordinates | null>(preview === "game" || preview === "results" ? MOCK_PIN : null)
  const [hasGuessed, setHasGuessed] = useState(preview === "game" || preview === "results")
  const [totalScore, setTotalScore] = useState(preview ? 4928 : 0)
  const [roundResults, setRoundResults] = useState<any>(preview === "results" ? MOCK_RESULTS : null)
  const [gameOver, setGameOver] = useState<any>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [createRoomError, setCreateRoomError] = useState<string | null>(null)

  const [crownDemandNotice, setCrownDemandNotice] = useState<CrownDemandNotice | null>(null)
  const [crownVoteNotice, setCrownVoteNotice] = useState<CrownVoteNotice | null>(null)
  const [hasVotedCrown, setHasVotedCrown] = useState(false)
  const [crownElectionResult, setCrownElectionResult] = useState<CrownElectionResult | null>(null)
  const [crownClaimPending, setCrownClaimPending] = useState(false)

  const updateScreen = useCallback((newScreen: Screen, roomId?: string, replace = false) => {
    setScreen(newScreen)
    if (newScreen !== "pending") setStoredScreen(newScreen)
    navigateTo(newScreen, roomId, replace)
  }, [])

  useEffect(() => lockNavigation(), [screen])

  useEffect(() => {
    setStoredUsername(username)
    setUsernameError(null)
  }, [username])

  return {
    selectedMode, setSelectedMode,
    screen, setScreen, updateScreen,
    isLaunching, setIsLaunching,
    clientId,
    username, setUsername,
    usernameError, setUsernameError,
    pendingRoomName, setPendingRoomName,
    pendingRequests, setPendingRequests,
    isCheckingUsername, setIsCheckingUsername,
    lobbies, setLobbies,
    searchedRoom, setSearchedRoom,
    activeRoom, setActiveRoom,
    roomPlayers, setRoomPlayers,
    isHost, setIsHost,
    currentRound, setCurrentRound,
    totalRounds, setTotalRounds,
    uplinkToken, setUplinkToken,
    countdownSeconds, setCountdownSeconds,
    myPin, setMyPin,
    hasGuessed, setHasGuessed,
    totalScore, setTotalScore,
    roundResults, setRoundResults,
    gameOver, setGameOver,
    showCreateModal, setShowCreateModal,
    isCreatingRoom, setIsCreatingRoom,
    createRoomError, setCreateRoomError,
    crownDemandNotice, setCrownDemandNotice,
    crownVoteNotice, setCrownVoteNotice,
    hasVotedCrown, setHasVotedCrown,
    crownElectionResult, setCrownElectionResult,
    crownClaimPending, setCrownClaimPending,
  }
}

export type AppState = ReturnType<typeof useAppState>
