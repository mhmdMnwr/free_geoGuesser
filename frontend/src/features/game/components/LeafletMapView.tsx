import React, { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
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

export interface LeafletMapProps {
  pin: Coordinates | null
  onSelectCoords?: (coords: Coordinates) => void
  targetCoords?: (Coordinates & { label?: string; country?: string }) | null
  playerGuesses?: PlayerGuessResult[]
  otherGuesses?: any[]
  interactive?: boolean
  zoom?: number
}

export function LeafletMapView({
  pin,
  onSelectCoords,
  targetCoords,
  playerGuesses,
  otherGuesses,
  interactive = true,
  zoom = 2,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const targetMarkerRef = useRef<L.Marker | null>(null)
  const polylinesRef = useRef<L.Polyline[]>([])
  const otherMarkersRef = useRef<L.Marker[]>([])
  const onSelectCoordsRef = useRef(onSelectCoords)
  onSelectCoordsRef.current = onSelectCoords

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return

    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: zoom,
      minZoom: 1,
      maxZoom: 18,
      zoomControl: interactive,
      attributionControl: false,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
    })

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 },
    ).addTo(map)

    if (interactive) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        if (onSelectCoordsRef.current) {
          onSelectCoordsRef.current({
            lat: Math.round(e.latlng.lat * 100000) / 100000,
            lng: Math.round(e.latlng.lng * 100000) / 100000,
          })
        }
      })
    }

    mapInstanceRef.current = map

    map.invalidateSize()
    const timer1 = setTimeout(() => map.invalidateSize(), 150)
    const timer2 = setTimeout(() => map.invalidateSize(), 400)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize()
      })
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      if (resizeObserver) resizeObserver.disconnect()
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      targetMarkerRef.current = null
      polylinesRef.current = []
      otherMarkersRef.current = []
    }
  }, [interactive, zoom])

  // Single Guessing Pin Marker
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (pin && !targetCoords) {
      const customIcon = L.divIcon({
        className: "custom-recon-pin",
        html: '<div class="custom-recon-pin-inner"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })

      if (markerRef.current) {
        markerRef.current.setLatLng([pin.lat, pin.lng])
      } else {
        markerRef.current = L.marker([pin.lat, pin.lng], { icon: customIcon, interactive: false }).addTo(map)
      }
    } else if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }, [pin, targetCoords])

  // Render Target Marker, All Player Guesses, and Connecting Polylines
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clear previous round results markers and lines
    if (targetMarkerRef.current) {
      targetMarkerRef.current.remove()
      targetMarkerRef.current = null
    }
    polylinesRef.current.forEach((pl) => pl.remove())
    polylinesRef.current = []
    otherMarkersRef.current.forEach((m) => m.remove())
    otherMarkersRef.current = []

    if (!targetCoords) return

    const boundsPoints: [number, number][] = [[targetCoords.lat, targetCoords.lng]]

    // 1. Target Location Beacon
    const targetLabel = targetCoords.label || targetCoords.country || "ACTUAL LOCATION"
    const targetIcon = L.divIcon({
      className: "custom-target-marker",
      html: `
        <div class="target-marker-container">
          <div class="target-radar-ring"></div>
          <div class="target-icon-core">🎯</div>
          <div class="target-label-bubble">ACTUAL: ${targetLabel}</div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    })

    targetMarkerRef.current = L.marker([targetCoords.lat, targetCoords.lng], {
      icon: targetIcon,
      zIndexOffset: 2000,
      interactive: false,
    }).addTo(map)

    // Normalize guesses list
    const combinedGuesses: PlayerGuessResult[] = playerGuesses && playerGuesses.length > 0
      ? playerGuesses
      : (otherGuesses || []).map((og: any) => ({
          username: og.username || "Operative",
          coords: og.coords || og.guess || og.guessCoords,
          distanceKm: og.distanceKm,
          roundScore: og.roundScore,
          isClosest: Boolean(og.isClosest),
          isLocal: Boolean(og.isLocal),
        }))

    // If local pin exists but isn't in playerGuesses list yet, synthesize it
    if (pin && !combinedGuesses.some((g) => g.isLocal)) {
      combinedGuesses.push({
        username: "YOU",
        coords: pin,
        isLocal: true,
      })
    }

    // 2. Render Each Player's Guess with Custom Badge & Polyline to Target
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

      const playerIcon = L.divIcon({
        className: `custom-guess-marker ${badgeClass}`,
        html: `
          <div class="guess-marker-container ${badgeClass}">
            <div class="guess-dot"></div>
            <div class="guess-label-bubble">${badgeTitle}</div>
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
      otherMarkersRef.current.push(marker)

      const lineColor = guess.isClosest ? "#eab308" : guess.isLocal ? "#38bdf8" : "#94a3b8"
      const lineWeight = guess.isClosest || guess.isLocal ? 3.5 : 2
      const lineOpacity = guess.isClosest || guess.isLocal ? 0.95 : 0.75

      const polyline = L.polyline(
        [
          [guess.coords.lat, guess.coords.lng],
          [targetCoords.lat, targetCoords.lng],
        ],
        {
          color: lineColor,
          weight: lineWeight,
          dashArray: "6, 8",
          opacity: lineOpacity,
        },
      ).addTo(map)
      polylinesRef.current.push(polyline)
    })

    // 3. Auto-fit Map to show Target and All Guesses
    if (boundsPoints.length > 1) {
      map.fitBounds(L.latLngBounds(boundsPoints).pad(0.3), { maxZoom: 15, animate: false })
    } else {
      map.setView([targetCoords.lat, targetCoords.lng], 6)
    }

    setTimeout(() => map.invalidateSize(), 200)
  }, [targetCoords, playerGuesses, otherGuesses, pin])

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "200px",
        position: "relative",
        display: "block",
        zIndex: 1,
      }}
    />
  )
}
