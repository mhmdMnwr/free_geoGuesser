import { useEffect, useRef } from "react"
import L from "leaflet"
import type { Coordinates } from "../../../types/game"
import {
  createReconPinIcon,
  renderRoundResultOverlays,
  type PlayerGuessResult,
} from "../utils/leafletMarkers"

export type { PlayerGuessResult }

export interface LeafletMapProps {
  pin: Coordinates | null
  onSelectCoords?: (coords: Coordinates) => void
  targetCoords?: (Coordinates & { label?: string; country?: string }) | null
  playerGuesses?: PlayerGuessResult[]
  interactive?: boolean
  zoom?: number
}

export function LeafletMapView({
  pin,
  onSelectCoords,
  targetCoords,
  playerGuesses,
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

  useEffect(() => {
    if (!containerRef.current) return

    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom,
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
        onSelectCoordsRef.current?.({
          lat: Math.round(e.latlng.lat * 100000) / 100000,
          lng: Math.round(e.latlng.lng * 100000) / 100000,
        })
      })
    }

    mapInstanceRef.current = map
    map.invalidateSize()
    const timer1 = setTimeout(() => map.invalidateSize(), 150)
    const timer2 = setTimeout(() => map.invalidateSize(), 400)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeObserver = new ResizeObserver(() => map.invalidateSize())
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      resizeObserver?.disconnect()
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      targetMarkerRef.current = null
      polylinesRef.current = []
      otherMarkersRef.current = []
    }
  }, [interactive, zoom])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (pin && !targetCoords) {
      if (markerRef.current) {
        markerRef.current.setLatLng([pin.lat, pin.lng])
      } else {
        markerRef.current = L.marker([pin.lat, pin.lng], {
          icon: createReconPinIcon(),
          interactive: false,
        }).addTo(map)
      }
    } else if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }, [pin, targetCoords])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    targetMarkerRef.current?.remove()
    targetMarkerRef.current = null
    polylinesRef.current.forEach((pl) => pl.remove())
    polylinesRef.current = []
    otherMarkersRef.current.forEach((m) => m.remove())
    otherMarkersRef.current = []

    if (!targetCoords) return

    const overlays = renderRoundResultOverlays(map, targetCoords, playerGuesses, pin)
    targetMarkerRef.current = overlays.targetMarker
    otherMarkersRef.current = overlays.guessMarkers
    polylinesRef.current = overlays.polylines
  }, [targetCoords, playerGuesses, pin])

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

export default LeafletMapView
