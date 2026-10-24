import type { Room, Player, Coordinates, Screen } from "../types/game"
import { getStoredUsername, getStoredActiveRoom, getStoredScreen } from "../shared/utils/cookies"

export function getPreviewParam(): string | null {
  try {
    if (typeof window === "undefined") return null
    return new URLSearchParams(window.location.search).get("preview")
  } catch {
    return null
  }
}

export const MOCK_PLAYERS: Player[] = [
  { id: "1", clientId: "c1", username: "MNWR", name: "MNWR", isHost: true, ping: 4, isReady: true, score: 4892 },
  { id: "2", clientId: "c2", username: "VIPER", name: "VIPER", isHost: false, ping: 12, isReady: true, score: 4520 },
  { id: "3", clientId: "c3", username: "GHOST", name: "GHOST", isHost: false, ping: 8, isReady: true, score: 4180 },
  { id: "4", clientId: "c4", username: "VALKYRIE", name: "VALKYRIE", isHost: false, ping: 15, isReady: true, score: 3950 },
  { id: "5", clientId: "c5", username: "SHADOW", name: "SHADOW", isHost: false, ping: 19, isReady: true, score: 3410 },
  { id: "6", clientId: "c6", username: "NEON", name: "NEON", isHost: false, ping: 22, isReady: false, score: 2980 },
]

export const MOCK_ROOM: Room = {
  id: "884192",
  code: "884192",
  name: "TACTICAL SQUAD // ALPHA",
  hostName: "MNWR",
  hostIp: "192.168.1.100",
  playerCount: 6,
  maxPlayers: 8,
  selectedRegion: "WORLD",
  difficulty: "BALANCED",
  totalRounds: 5,
  countdownDuration: 60,
  status: "LOBBY",
  ping: 4,
}

export const MOCK_BROWSER_LOBBIES: Room[] = [
  { ...MOCK_ROOM, name: "ALPHA PROTOCOL // TACTICAL", hostName: "MNWR", playerCount: 6, status: "LOBBY" },
  { id: "492018", code: "492018", name: "DESERT RECON // EXTREME", hostName: "VIPER", playerCount: 4, maxPlayers: 6, selectedRegion: "AFRICA", difficulty: "HARD", totalRounds: 5, status: "ROUND_ACTIVE", ping: 11 },
  { id: "731920", code: "731920", name: "URBAN DRIFT // CASUAL", hostName: "GHOST", playerCount: 3, maxPlayers: 8, selectedRegion: "EUROPE", difficulty: "BALANCED", totalRounds: 5, status: "LOBBY", ping: 8 },
  { id: "105829", code: "105829", name: "PACIFIC ATLAS // HARDCORE", hostName: "VALKYRIE", playerCount: 5, maxPlayers: 8, selectedRegion: "ASIA", difficulty: "EXPERT", totalRounds: 7, status: "ROUND_ACTIVE", ping: 14 },
]

export const MOCK_PIN: Coordinates = { lat: 48.8584, lng: 2.2945 }

export const MOCK_RESULTS = {
  round: 2,
  target: { lat: 48.8584, lng: 2.2945, label: "Eiffel Tower, Paris, France" },
  closestPlayer: { username: "MNWR", distanceKm: 14.2 },
  results: [
    { username: "MNWR", distanceKm: 14.2, roundScore: 4928, totalScore: 9820, isHost: true, guess: { lat: 48.865, lng: 2.31 } },
    { username: "VIPER", distanceKm: 42.8, roundScore: 4710, totalScore: 9230, isHost: false, guess: { lat: 48.95, lng: 2.45 } },
    { username: "GHOST", distanceKm: 118.5, roundScore: 4250, totalScore: 8430, isHost: false, guess: { lat: 49.4, lng: 1.8 } },
    { username: "VALKYRIE", distanceKm: 340.1, roundScore: 3820, totalScore: 7770, isHost: false, guess: { lat: 46.2, lng: 3.1 } },
    { username: "SHADOW", distanceKm: 890.4, roundScore: 2950, totalScore: 6360, isHost: false, guess: { lat: 42.1, lng: 1.5 } },
    { username: "NEON", distanceKm: 1420.0, roundScore: 1820, totalScore: 4800, isHost: false, guess: { lat: 38.5, lng: -4.0 } },
  ],
}

export function getInitialScreen(): Screen {
  const preview = getPreviewParam()
  if (preview === "browser") return "browser"
  if (preview === "lobby") return "lobby"
  if (preview === "game" || preview === "results") return "game"
  const active = getStoredActiveRoom()
  const storedScreen = getStoredScreen()
  return active && (storedScreen === "lobby" || storedScreen === "game") ? storedScreen : "select"
}

export function getInitialActiveRoom(): Room | null {
  const preview = getPreviewParam()
  if (preview === "lobby") return MOCK_ROOM
  if (preview === "game" || preview === "results") return { ...MOCK_ROOM, status: "ROUND_ACTIVE" }
  const active = getStoredActiveRoom()
  const storedScreen = getStoredScreen()
  if (active?.id && (storedScreen === "lobby" || storedScreen === "game")) {
    return {
      id: active.id,
      code: active.id,
      name: `Squad ${active.id}`,
      hostName: "",
      hostIp: null,
      playerCount: 1,
      maxPlayers: 8,
      selectedRegion: "all",
      difficulty: "all",
      totalRounds: 5,
      status: storedScreen === "game" ? "ROUND_ACTIVE" : "LOBBY",
      ping: 3,
    }
  }
  return null
}

export function getInitialUsername(): string {
  const preview = getPreviewParam()
  if (preview) return "MNWR"
  return getStoredUsername()
}
