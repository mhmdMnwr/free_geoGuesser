// ─────────────────────────────────────────────────────────────────────────────
// Shared game types
// ─────────────────────────────────────────────────────────────────────────────

export type ConnectionMode = "lan" | "web"
export type Screen = "select" | "browser" | "lobby" | "game" | "pending"

export interface Coordinates {
  lat: number
  lng: number
}

export interface Room {
  id: string
  name: string
  hostName: string
  hostIp: string | null
  playerCount: number
  maxPlayers: number
  selectedRegion: string
  difficulty: string
  totalRounds: number
  currentRound?: number
  status: string
  ping: number
}

export interface Player {
  id?: string
  ip: string
  username: string
  connected: boolean
  totalScore: number
  isHost: boolean
}

export interface PendingRequest {
  clientId: string
  username: string
  requestedAt: number
}
