import L from "leaflet"
import type { Coordinates } from "../../../types/game"

export interface PlayerGuessResult {
  username: string
  coords: Coordinates
  distanceKm?: number | null
  roundScore?: number
  totalScore?: number
  isClosest?: boolean
  isLocal?: boolean
  isHost?: boolean
}

export function createReconPinIcon(): L.DivIcon {
  return L.divIcon({
    className: "custom-recon-pin",
    html: '<div class="custom-recon-pin-inner"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export function renderRoundResultOverlays(
  map: L.Map,
  targetCoords: Coordinates & { label?: string; country?: string },
  playerGuesses: PlayerGuessResult[] | undefined,
  pin: Coordinates | null,
): {
  targetMarker: L.Marker
  guessMarkers: L.Marker[]
  polylines: L.Polyline[]
} {
  const boundsPoints: [number, number][] = [[targetCoords.lat, targetCoords.lng]]

  const rawTargetLabel = targetCoords.label || targetCoords.country || "ACTUAL LOCATION"
  const safeTargetLabel = escapeHtml(rawTargetLabel)
  const targetIcon = L.divIcon({
    className: "custom-target-marker",
    html: `
      <div class="target-marker-container">
        <div class="target-radar-ring"></div>
        <div class="target-icon-core">🎯</div>
        <div class="target-label-bubble">ACTUAL: ${safeTargetLabel}</div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })

  const targetMarker = L.marker([targetCoords.lat, targetCoords.lng], {
    icon: targetIcon,
    zIndexOffset: 2000,
    interactive: false,
  }).addTo(map)

  const combinedGuesses: PlayerGuessResult[] = playerGuesses ? [...playerGuesses] : []
  if (pin && !combinedGuesses.some((g) => g.isLocal)) {
    combinedGuesses.push({
      username: "YOU",
      coords: pin,
      isLocal: true,
    })
  }

  const guessMarkers: L.Marker[] = []
  const polylines: L.Polyline[] = []

  combinedGuesses.forEach((guess) => {
    if (!guess.coords || typeof guess.coords.lat !== "number" || typeof guess.coords.lng !== "number") {
      return
    }

    boundsPoints.push([guess.coords.lat, guess.coords.lng])

    const distLabel = guess.distanceKm != null ? `${Math.round(guess.distanceKm)} km` : ""
    const badgeClass = guess.isClosest ? "beacon-closest" : guess.isLocal ? "beacon-local" : "beacon-other"
    const badgeTitle = guess.isClosest
      ? `👑 ${guess.username} ${distLabel ? `(${distLabel})` : ""}`
      : guess.isLocal
        ? `YOU ${distLabel ? `(${distLabel})` : ""}`
        : `${guess.username} ${distLabel ? `(${distLabel})` : ""}`
    const safeBadgeTitle = escapeHtml(badgeTitle)

    const playerIcon = L.divIcon({
      className: `custom-guess-marker ${badgeClass}`,
      html: `
        <div class="guess-marker-container ${badgeClass}">
          <div class="guess-dot"></div>
          <div class="guess-label-bubble">${safeBadgeTitle}</div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })

    const marker = L.marker([guess.coords.lat, guess.coords.lng], {
      icon: playerIcon,
      zIndexOffset: guess.isClosest ? 1500 : guess.isLocal ? 1000 : 500,
      interactive: false,
    }).addTo(map)
    guessMarkers.push(marker)

    const lineColor = guess.isClosest ? "#eab308" : guess.isLocal ? "#38bdf8" : "#94a3b8"
    const polyline = L.polyline(
      [
        [guess.coords.lat, guess.coords.lng],
        [targetCoords.lat, targetCoords.lng],
      ],
      {
        color: lineColor,
        weight: guess.isClosest || guess.isLocal ? 3.5 : 2,
        dashArray: "6, 8",
        opacity: guess.isClosest || guess.isLocal ? 0.95 : 0.75,
      },
    ).addTo(map)
    polylines.push(polyline)
  })

  if (boundsPoints.length > 1) {
    map.fitBounds(L.latLngBounds(boundsPoints).pad(0.3), { maxZoom: 15, animate: false })
  } else {
    map.setView([targetCoords.lat, targetCoords.lng], 6)
  }

  setTimeout(() => map.invalidateSize(), 200)

  return { targetMarker, guessMarkers, polylines }
}
