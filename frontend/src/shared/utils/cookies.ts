import type { Screen } from "../../types/game"

/**
 * Universal Cookie & Storage Persistence Engine for WAYFINDER
 * Stores vital session attributes in both document.cookie and localStorage
 * to ensure state persistence across hard reloads, tab switches, and LAN re-identifications.
 */

export function setCookie(name: string, value: string, days = 30): void {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString()
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
    localStorage.setItem(name, value)
  } catch {
    // Fallback if cookies disabled
  }
}

export function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp("(?:^|;\\s*)" + encodeURIComponent(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"))
    if (match && match[1]) {
      return decodeURIComponent(match[1])
    }
    return localStorage.getItem(name)
  } catch {
    return null
  }
}

export function deleteCookie(name: string): void {
  try {
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    localStorage.removeItem(name)
    sessionStorage.removeItem(name)
  } catch {
    // Ignore
  }
}

const USERNAME_KEY = "wayfinder_username"
const CLIENT_ID_KEY = "wayfinder_client_id"
const ACTIVE_ROOM_KEY = "wayfinder_room_id"
const IS_HOST_KEY = "wayfinder_is_host"
const CURRENT_SCREEN_KEY = "wayfinder_screen"

export function getStoredUsername(): string {
  const saved = getCookie(USERNAME_KEY) || getCookie("wayfinder_name")
  if (saved && saved.trim()) return saved.trim()
  const generated = "OPERATIVE-" + Math.floor(10 + Math.random() * 90)
  setStoredUsername(generated)
  return generated
}

export function setStoredUsername(name: string): void {
  if (name && name.trim()) {
    setCookie(USERNAME_KEY, name.trim(), 30)
    setCookie("wayfinder_name", name.trim(), 30)
  }
}

export function getStoredClientId(): string {
  let id = getCookie(CLIENT_ID_KEY)
  if (!id) {
    try {
      id = sessionStorage.getItem(CLIENT_ID_KEY)
    } catch {}
  }
  if (!id) {
    id = "op_" + Math.random().toString(36).substring(2, 10)
    setCookie(CLIENT_ID_KEY, id, 30)
    try {
      sessionStorage.setItem(CLIENT_ID_KEY, id)
    } catch {}
  }
  return id
}

export function getStoredActiveRoom(): { id: string; isHost: boolean } | null {
  const id = getCookie(ACTIVE_ROOM_KEY)
  if (!id) return null
  const isHost = getCookie(IS_HOST_KEY) === "true"
  return { id, isHost }
}

export function setStoredActiveRoom(roomId: string | null, isHost = false): void {
  if (roomId) {
    setCookie(ACTIVE_ROOM_KEY, roomId, 7)
    setCookie(IS_HOST_KEY, isHost ? "true" : "false", 7)
  } else {
    deleteCookie(ACTIVE_ROOM_KEY)
    deleteCookie(IS_HOST_KEY)
  }
}

export function getStoredScreen(): Screen | null {
  return (getCookie(CURRENT_SCREEN_KEY) as Screen) || null
}

export function setStoredScreen(screen: Screen | null): void {
  if (screen) {
    setCookie(CURRENT_SCREEN_KEY, screen, 7)
  } else {
    deleteCookie(CURRENT_SCREEN_KEY)
  }
}
