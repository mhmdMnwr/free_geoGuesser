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
  try {
    window.history.pushState(null, "", window.location.href)
  } catch {}

  const handlePopState = (e: PopStateEvent) => {
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
 * Updates URL state silently without creating new browser history entries.
 */
export function navigateTo(screen: Screen, roomId?: string, _replace = true): void {
  try {
    window.history.replaceState({ screen, roomId }, "", window.location.pathname)
  } catch {}
}

export function parseCurrentRoute(): AppRoute {
  try {
    const state = window.history.state as Partial<AppRoute> | null
    if (state && typeof state.screen === "string") {
      return { screen: state.screen as Screen, roomId: state.roomId }
    }
  } catch {}
  return { screen: "select" }
}
