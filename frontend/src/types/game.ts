// ─────────────────────────────────────────────────────────────────────────────
// Shared game types
// ─────────────────────────────────────────────────────────────────────────────

export type ConnectionMode = "online" | "local"
export type Screen = "select" | "browser" | "lobby" | "game" | "pending"

export interface Coordinates {
  lat: number
  lng: number
}

export interface Room {
  id: string
  code?: string
  isPrivate?: boolean
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
  hasGuessed?: boolean
}

export interface PendingRequest {
  clientId: string
  username: string
  requestedAt: number
}

export interface CrownDemandNotice {
  roomId: string
  claimantUsername: string
  claimantPublicId: string
  timeoutSeconds: number
}

export interface CrownVoteNotice {
  roomId: string
  claimantUsername: string
  claimantPublicId: string
  currentHostUsername: string
  timeoutSeconds: number
  yesCount: number
  noCount: number
  totalEligible: number
}

export interface CrownElectionResult {
  success: boolean
  newHost: string
  yesCount?: number
  noCount?: number
  totalEligible?: number
  message: string
}
