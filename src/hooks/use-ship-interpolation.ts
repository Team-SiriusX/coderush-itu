import { useEffect, useRef } from 'react'
import type { ShipState } from '@/types/fleet'

export function useShipInterpolation(
  ships: ShipState[],
  markersRef: React.MutableRefObject<Map<string, L.Marker>>
) {
  const prevShipsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map())
  const lastUpdateRef = useRef<number>(Date.now())

  useEffect(() => {
    const now = Date.now()
    
    // Set up targets
    const map = new Map<string, { lat: number; lng: number }>()
    ships.forEach((s) => {
      // If we don't have a previous position, start from the current target
      if (!prevShipsRef.current.has(s.id)) {
        prevShipsRef.current.set(s.id, { lat: s.position.lat, lng: s.position.lng })
      }
      map.set(s.id, { lat: s.position.lat, lng: s.position.lng })
    })

    const newPrevMap = new Map<string, { lat: number; lng: number }>()
    
    // Save current interpolated positions as the NEW previous positions
    // so we lerp smoothly from where we actually are, not where we were.
    markersRef.current.forEach((marker, id) => {
      const latLng = marker.getLatLng()
      newPrevMap.set(id, { lat: latLng.lat, lng: latLng.lng })
    })

    prevShipsRef.current = newPrevMap
    lastUpdateRef.current = now

    let rafId: number
    const animate = () => {
      const elapsed = Date.now() - lastUpdateRef.current
      const progress = Math.min(elapsed / 1000, 1)

      ships.forEach((ship) => {
        const marker = markersRef.current.get(ship.id)
        if (!marker) return

        const prev = prevShipsRef.current.get(ship.id)
        const target = { lat: ship.position.lat, lng: ship.position.lng }

        if (prev && target) {
          const lat = prev.lat + (target.lat - prev.lat) * progress
          const lng = prev.lng + (target.lng - prev.lng) * progress
          marker.setLatLng([lat, lng])
        }
      })

      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }

    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [ships, markersRef])
}
