'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
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

// Inner component — manages markers imperatively (Leaflet is not React-idiomatic)
function ShipLayer() {
  const map          = useMap()
  const ships        = useFleetStore(s => s.ships)
  const selectedId   = useFleetStore(s => s.selectedShipId)
  const setSelected  = useFleetStore(s => s.setSelectedShip)
  const markersRef   = useRef<Map<string, L.Marker>>(new Map())

  useEffect(() => {
    const currentIds = new Set(ships.map(s => s.id))

    // Remove markers for ships no longer in state
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }

    // Update or create markers
    for (const ship of ships) {
      const existing = markersRef.current.get(ship.id)
      const icon     = createShipIcon(ship, ship.id === selectedId)
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
        marker.on('click', () => setSelected(ship.id === selectedId ? null : ship.id))
        marker.addTo(map)
        markersRef.current.set(ship.id, marker)
      }
    }
  }, [ships, selectedId, map, setSelected])

  return null
}

export default function FleetMap() {
  const [isMounted, setIsMounted] = useState(false)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    setIsMounted(true)
    return () => {
      const map = mapRef.current
      if (map) {
        const container = map.getContainer() as HTMLElement & { _leaflet_id?: number }
        map.remove()
        // Ensure Leaflet container can be re-initialized after fast refresh.
        if (container._leaflet_id != null) {
          delete container._leaflet_id
        }
        mapRef.current = null
      }
    }
  }, [])

  if (!isMounted) {
    return (
      <div className="h-full w-full bg-slate-900 flex items-center justify-center">
        <div className="text-slate-500 text-sm italic">Initializing tactical map...</div>
      </div>
    )
  }

  return (
    <div className="h-full w-full relative bg-slate-900">
      <MapContainer
        key="hormuz-fleet-map-v1"
        center={[26.0, 54.0]}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        className="bg-slate-900"
        whenCreated={(map) => {
          mapRef.current = map
        }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          maxZoom={19}
        />
        <ShipLayer />
      </MapContainer>
    </div>
  )
}
