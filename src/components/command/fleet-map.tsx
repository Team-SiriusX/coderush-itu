'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import { useFleetStore } from '@/stores/fleet-store'
import type { ShipState } from '@/types/fleet'
import { getPusherClient } from '@/lib/pusher-client'
import { useInterpolationStore } from '@/systems/interpolation/interpolation-store'
import { usePlaybackStore } from '@/systems/playback/playback-store'
import { findFrameAt } from '@/systems/playback/playback-engine'

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
  normal:            '#00ff66', // Neon Green
  rerouting:         '#facc15', // Yellow
  distressed:        '#f97316', // Orange
  stopped:           '#ef4444', // Red
  stranded:          '#dc2626', // Deep Red
  insufficient_fuel: '#fb923c', // Orange-ish
  arrived:           '#3b4a42', // Muted dark green
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
  const routesRef = useRef<Map<string, L.Polyline>>(new Map())
  const indicatorsRef = useRef<Map<string, L.CircleMarker>>(new Map())
  const zonesLayerRef = useRef<L.FeatureGroup | null>(null)
  const weatherLayerRef = useRef<L.LayerGroup | null>(null)
  const [showWeather, setShowWeather] = useState(false)
  const rawShips = useFleetStore(s => s.ships)
  const selectedId = useFleetStore(s => s.selectedShipId)
  const setSelected = useFleetStore(s => s.setSelectedShip)
  const renderShips = useInterpolationStore(s => s.renderShips)
  const playbackMode = usePlaybackStore(s => s.isPlaybackMode)
  const playbackFrames = usePlaybackStore(s => s.frames)
  const playbackTs = usePlaybackStore(s => s.cursorTimestamp)

  const ships: ShipState[] = playbackMode
    ? findFrameAt(playbackFrames, playbackTs)?.ships ?? []
    : rawShips.map((ship) => {
        const render = renderShips[ship.id]
        return render
          ? {
              ...ship,
              position: render.position,
              heading: render.heading,
              speed: render.speed,
            }
          : ship
      })

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

    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)
    zonesLayerRef.current = drawnItems

    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
      },
      draw: {
        polygon: {
          shapeOptions: { color: '#ef4444', weight: 2 },
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
    })
    map.addControl(drawControl)

    map.on(L.Draw.Event.CREATED, async (event: any) => {
      const layer = event.layer
      drawnItems.addLayer(layer)

      // Send to backend
      const geojson = layer.toGeoJSON()
      try {
        const res = await fetch('/api/zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Zone ${Math.floor(Math.random() * 1000)}`,
            geometry: geojson.geometry
          })
        })
        const data = await res.json()
        // Attach ID to layer for deletion later
        ;(layer as any).zoneId = data.id
      } catch (err) {
        console.error('Failed to create zone', err)
      }
    })

    map.on(L.Draw.Event.DELETED, async (event: any) => {
      const layers = event.layers
      layers.eachLayer(async (layer: any) => {
        if (layer.zoneId) {
          try {
            await fetch(`/api/zones/${layer.zoneId}`, { method: 'DELETE' })
          } catch (err) {
            console.error('Failed to delete zone', err)
          }
        }
      })
    })

    mapRef.current = map

    // Fetch initial zones
    fetch('/api/zones')
      .then(r => r.json())
      .then(zones => {
        zones.forEach((z: any) => {
          const latlngs = z.geometry.coordinates[0].map((c: number[]) => [c[1], c[0]])
          const polygon = L.polygon(latlngs, { color: '#ef4444' })
          ;(polygon as any).zoneId = z.id
          drawnItems.addLayer(polygon)
        })
      })

    // Fetch Weather
    weatherLayerRef.current = new L.LayerGroup()
    fetch('/api/weather')
      .then(r => r.json())
      .then(data => {
        if (!data || !data.cells) return
        data.cells.forEach((cell: any) => {
          let color = 'transparent'
          if (cell.severity === 'EXTREME') color = '#dc2626'
          else if (cell.severity === 'SEVERE') color = '#ea580c'
          else if (cell.severity === 'MODERATE') color = '#eab308'
          
          if (color !== 'transparent') {
            const bounds: L.LatLngBoundsExpression = [
              [cell.lat - 0.5, cell.lng - 0.5],
              [cell.lat + 0.5, cell.lng + 0.5]
            ]
            const rect = L.rectangle(bounds, {
              color,
              weight: 0,
              fillColor: color,
              fillOpacity: 0.15
            })
            rect.bindTooltip(`
              <div style="font-family: var(--font-mono); font-size:10px;">
                <strong style="color:${color}">WEATHER: ${cell.severity}</strong><br/>
                Wind: ${cell.windSpeed.toFixed(1)} kts<br/>
                Waves: ${cell.waveHeight.toFixed(1)} m<br/>
                Storm: ${cell.stormScore} / 100
              </div>
            `)
            rect.addTo(weatherLayerRef.current!)
          }
        })
      })
      .catch(console.error)

    // Setup Pusher for zones updates
    const pusherClient = getPusherClient()
    const channel = pusherClient.subscribe('zones')
    channel.bind('zone:update', (zones: any[]) => {
      drawnItems.clearLayers()
      zones.forEach(z => {
        const latlngs = z.geometry.coordinates[0].map((c: number[]) => [c[1], c[0]])
        const polygon = L.polygon(latlngs, { color: '#ef4444' })
        ;(polygon as any).zoneId = z.id
        drawnItems.addLayer(polygon)
      })
    })

    return () => {
      channel.unbind_all()
      pusherClient.unsubscribe('zones')

      const currentMap = mapRef.current
      if (!currentMap) return

      for (const marker of markersRef.current.values()) {
        marker.remove()
      }
      markersRef.current.clear()
      for (const route of routesRef.current.values()) {
        route.remove()
      }
      routesRef.current.clear()
      for (const c of indicatorsRef.current.values()) {
        c.remove()
      }
      indicatorsRef.current.clear()

      const currentContainer = currentMap.getContainer() as HTMLElement & { _leaflet_id?: number }
      currentMap.remove()
      if (currentContainer._leaflet_id != null) {
        delete currentContainer._leaflet_id
      }
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !weatherLayerRef.current) return
    if (showWeather) {
      mapRef.current.addLayer(weatherLayerRef.current)
    } else {
      mapRef.current.removeLayer(weatherLayerRef.current)
    }
  }, [showWeather])

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
          <div style="font-family: var(--font-rajdhani); font-size:11px; line-height:1.4; background: #0b0f14; color: #d6ffe6; border: 1px solid rgba(0, 255, 102, 0.3); padding: 6px; border-radius: 4px;">
            <strong style="font-family: var(--font-orbitron); letter-spacing: 0.05em; color: #00ff66; text-shadow: 0 0 4px #00ff66;">${ship.name}</strong><br/>
            <span style="font-family: var(--font-mono); font-size: 9px; opacity: 0.7;">STATUS :: ${ship.status.toUpperCase()}</span><br/>
            <span style="font-family: var(--font-mono); font-size: 9px; opacity: 0.7;">FUEL_REM :: ${Math.round(ship.fuelRemaining)}T</span><br/>
            <span style="font-family: var(--font-mono); font-size: 9px; opacity: 0.7;">VELOCITY :: ${ship.speed}KTS</span>
          </div>
        `, { permanent: false, direction: 'top', className: 'tactical-tooltip' })
        marker.on('click', () => {
          const currentSelected = useFleetStore.getState().selectedShipId
          setSelected(currentSelected === ship.id ? null : ship.id)
        })
        marker.addTo(map)
        markersRef.current.set(ship.id, marker)
      }

      const routeLatLngs: L.LatLngExpression[] = [
        [ship.position.lat, ship.position.lng],
        ...ship.route.map(p => [p.lat, p.lng] as L.LatLngExpression),
      ]
      const existingRoute = routesRef.current.get(ship.id)
      const routeColor = ship.status === 'rerouting' ? '#facc15' : '#22d3ee'
      if (existingRoute) {
        existingRoute.setLatLngs(routeLatLngs)
        existingRoute.setStyle({ color: routeColor, dashArray: ship.status === 'rerouting' ? '6 6' : '2 6' })
      } else {
        const polyline = L.polyline(routeLatLngs, {
          color: routeColor,
          weight: 1.5,
          opacity: 0.6,
          dashArray: ship.status === 'rerouting' ? '6 6' : '2 6',
        }).addTo(map)
        routesRef.current.set(ship.id, polyline)
      }

      const existingIndicator = indicatorsRef.current.get(ship.id)
      const needsIndicator = ship.status === 'distressed' || ship.status === 'stranded' || ship.status === 'insufficient_fuel'
      if (needsIndicator) {
        const color =
          ship.status === 'stranded' ? '#dc2626' :
          ship.status === 'distressed' ? '#f97316' :
          '#fb923c'
        if (existingIndicator) {
          existingIndicator.setLatLng([ship.position.lat, ship.position.lng])
          existingIndicator.setStyle({ color, fillColor: color, radius: ship.status === 'stranded' ? 10 : 7 })
        } else {
          const c = L.circleMarker([ship.position.lat, ship.position.lng], {
            radius: ship.status === 'stranded' ? 10 : 7,
            color,
            fillColor: color,
            fillOpacity: 0.15,
            weight: 2,
          }).addTo(map)
          indicatorsRef.current.set(ship.id, c)
        }
      } else if (existingIndicator) {
        existingIndicator.remove()
        indicatorsRef.current.delete(ship.id)
      }
    }

    for (const [id, r] of routesRef.current) {
      if (!currentIds.has(id)) {
        r.remove()
        routesRef.current.delete(id)
      }
    }
    for (const [id, c] of indicatorsRef.current) {
      if (!currentIds.has(id)) {
        c.remove()
        indicatorsRef.current.delete(id)
      }
    }
  }, [ships, selectedId, setSelected])

  if (!isMounted) {
    return (
      <div className="h-full w-full bg-slate-900 flex items-center justify-center">
        <div className="text-slate-500 text-sm italic font-sans">Initializing tactical map...</div>
      </div>
    )
  }

  return (
    <div className="h-full w-full relative bg-slate-900">
      <div ref={containerRef} className="h-full w-full bg-slate-900" />
      <button 
        onClick={() => setShowWeather(!showWeather)}
        className={`absolute bottom-6 left-6 z-[1000] px-3 py-1.5 rounded text-[11px] font-mono font-bold tracking-widest border transition-colors ${
          showWeather ? 'bg-cyan-900/50 text-cyan-400 border-cyan-400' : 'bg-slate-900/80 text-slate-500 border-slate-700 hover:text-slate-300'
        }`}
      >
        WEATHER OVERLAY: {showWeather ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}
