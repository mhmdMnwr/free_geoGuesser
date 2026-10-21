import type { Screen } from "../../types/game"

export interface AppRoute {
  screen: Screen
  roomId?: string
}

/**
 * Locked Navigation Controller
 * Prevents the browser's Back and Forward buttons from changing pages or screens.
 * The application state is purely driven by game flow and WebSocket coordination.
 */
export function lockNavigation(): () => void {
  // Push an initial anchor state to prevent backward history traversal
  try {
    window.history.pushState(null, "", window.location.href)
  } catch {}

  const handlePopState = (e: PopStateEvent) => {
    // Force history forward to remain on current application screen
    try {
      window.history.pushState(null, "", window.location.href)
    } catch {}
    e.preventDefault?.()
  }

  window.addEventListener("popstate", handlePopState)

  return () => {
    window.removeEventListener("popstate", handlePopState)
  }
}

/**
 * Updates URL silently without creating new browser history entries.
 * Never creates entries that would allow a user to use Back/Forward buttons.
 */
export function navigateTo(screen: Screen, roomId?: string, _replace = true): void {
  try {
    // Always use replaceState so no history entries are added
    window.history.replaceState({ screen, roomId }, "", window.location.pathname)
  } catch {}
}

export function parseCurrentRoute(): AppRoute {
  return { screen: "select" }
}
