'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useFleetStore } from '@/stores/fleet-store'
import type { ShipState } from '@/types/fleet'

// Fix Leaflet default marker icon paths (Next.js build issue)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

// Status color map
const STATUS_COLORS: Record<string, string> = {
  normal:            '#10b981',
  rerouting:         '#facc15',
  distressed:        '#f97316',
  stopped:           '#ef4444',
  stranded:          '#dc2626',
  insufficient_fuel: '#fb923c',
  arrived:           '#64748b',
}

// Create SVG ship icon with heading rotation
function createShipIcon(ship: ShipState, selected: boolean): L.DivIcon {
  const color  = STATUS_COLORS[ship.status] ?? '#94a3b8'
  const size   = selected ? 18 : 14
  const border = selected ? `stroke="#fff" stroke-width="2"` : ''

  return L.divIcon({
    className: '',
    iconSize:  [size * 2, size * 2],
    iconAnchor:[size, size],
    html: `
      <div style="transform: rotate(${ship.heading}deg); width:${size*2}px; height:${size*2}px; display:flex; align-items:center; justify-content:center;">
        <svg width="${size*2}" height="${size*2}" viewBox="-10 -10 20 20">
          <polygon points="0,-8 5,6 0,3 -5,6" fill="${color}" ${border} />
        </svg>
      </div>
    `,
  })
}

export default function FleetMap() {
  const [isMounted, setIsMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const ships = useFleetStore(s => s.ships)
  const selectedId = useFleetStore(s => s.selectedShipId)
  const setSelected = useFleetStore(s => s.setSelectedShip)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    // Guard against strict-mode and fast-refresh reusing a previously initialized DOM node.
    if ((container as HTMLElement & { _leaflet_id?: number })._leaflet_id != null) {
      delete (container as HTMLElement & { _leaflet_id?: number })._leaflet_id
    }

    const map = L.map(container, {
      center: [26.0, 54.0],
      zoom: 7,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    return () => {
      const currentMap = mapRef.current
      if (!currentMap) return

      for (const marker of markersRef.current.values()) {
        marker.remove()
      }
      markersRef.current.clear()

      const currentContainer = currentMap.getContainer() as HTMLElement & { _leaflet_id?: number }
      currentMap.remove()
      if (currentContainer._leaflet_id != null) {
        delete currentContainer._leaflet_id
      }
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentIds = new Set(ships.map(ship => ship.id))

    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }

    for (const ship of ships) {
      const existing = markersRef.current.get(ship.id)
      const icon = createShipIcon(ship, ship.id === selectedId)
      const latlng: L.LatLngExpression = [ship.position.lat, ship.position.lng]

      if (existing) {
        existing.setLatLng(latlng)
        existing.setIcon(icon)
      } else {
        const marker = L.marker(latlng, { icon })
        marker.bindTooltip(`
          <div style="font-size:11px;line-height:1.4">
            <strong>${ship.name}</strong><br/>
            ${ship.status.toUpperCase()}<br/>
            Fuel: ${Math.round(ship.fuelRemaining)}t<br/>
            Speed: ${ship.speed}kts
          </div>
        `, { permanent: false, direction: 'top' })
        marker.on('click', () => {
          const currentSelected = useFleetStore.getState().selectedShipId
          setSelected(currentSelected === ship.id ? null : ship.id)
        })
        marker.addTo(map)
        markersRef.current.set(ship.id, marker)
      }
    }
  }, [ships, selectedId, setSelected])

  if (!isMounted) {
    return (
      <div className="h-full w-full bg-slate-900 flex items-center justify-center">
        <div className="text-slate-500 text-sm italic">Initializing tactical map...</div>
      </div>
    )
  }

  return (
    <div className="h-full w-full relative bg-slate-900">
      <div ref={containerRef} className="h-full w-full bg-slate-900" />
    </div>
  )
}
