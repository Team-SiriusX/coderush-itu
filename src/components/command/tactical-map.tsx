'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Tooltip, useMap } from 'react-leaflet'
import { useFleetStore } from '@/stores/fleet-store'
import type { ShipState, RestrictedZone } from '@/types/fleet'
import { useShipInterpolation } from '@/hooks/use-ship-interpolation'

// Status colors mapping
const STATUS_COLORS: Record<string, string> = {
  normal: '#2563eb', // blue
  rerouting: '#f59e0b', // amber
  distressed: '#ef4444', // red
  stranded: '#6b7280', // gray
  stopped: '#6b7280', // gray
}

// Function to create standard div icons
function createShipIcon(ship: ShipState) {
  const color = STATUS_COLORS[ship.status.toLowerCase()] ?? '#6b7280'
  const size = 16
  const isDistressed = ship.status === 'DISTRESS' || ship.status === 'distressed'
  const animationClass = isDistressed ? 'animate-pulse' : ''
  const border = isDistressed ? `stroke="#fff" stroke-width="2"` : ''

  return L.divIcon({
    className: 'bg-transparent border-none',
    iconSize: [size * 2, size * 2 + 15],
    iconAnchor: [size, size],
    html: `
      <div class="flex flex-col items-center justify-center pointer-events-none w-[60px] -ml-[14px]">
        <div style="transform: rotate(${ship.heading}deg); width:${size*2}px; height:${size*2}px; display:flex; align-items:center; justify-content:center;" class="${animationClass}">
          <svg width="${size*2}" height="${size*2}" viewBox="-10 -10 20 20">
            <polygon points="0,-8 5,6 0,3 -5,6" fill="${color}" ${border} />
          </svg>
        </div>
        <div class="text-[10px] font-mono font-bold text-slate-800 bg-white/80 px-1 rounded whitespace-nowrap mt-1 leading-none shadow-sm">
          ${ship.name} ${ship.id.slice(0, 4)}
        </div>
      </div>
    `,
  })
}

// Draw Tool implementation component
function MapController({ onReset }: { onReset: () => void }) {
  const map = useMap()
  
  // Expose a way to reset view
  useEffect(() => {
    map.on('reset-view', () => {
      map.setView([26.0, 54.0], 6)
    })
  }, [map])

  return null
}

function ZoneDrawingManager({ isDrawing, setIsDrawing }: { isDrawing: boolean; setIsDrawing: (b: boolean) => void }) {
  const map = useMap()
  const [points, setPoints] = useState<L.LatLng[]>([])
  const drawingRef = useRef(isDrawing)
  drawingRef.current = isDrawing

  useEffect(() => {
    if (isDrawing) {
      L.DomUtil.addClass(map.getContainer(), 'cursor-crosshair')
    } else {
      L.DomUtil.removeClass(map.getContainer(), 'cursor-crosshair')
      setPoints([])
    }
  }, [isDrawing, map])

  useEffect(() => {
    const onClick = (e: L.LeafletMouseEvent) => {
      if (!drawingRef.current) return
      setPoints(prev => [...prev, e.latlng])
    }

    const onDblClick = async (e: L.LeafletMouseEvent) => {
      if (!drawingRef.current) return
      e.originalEvent.preventDefault()
      const newPoints = [...points, e.latlng]
      if (newPoints.length >= 3) {
        // Close polygon and send
        const coords = newPoints.map(p => [p.lat, p.lng] as [number, number])
        try {
          await fetch('/api/zones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: `Z-${Date.now().toString().slice(-4)}`,
              name: `New Zone`,
              type: 'RESTRICTED',
              coordinates: coords,
            }),
          })
        } catch (err) {}
      }
      setIsDrawing(false)
      setPoints([])
    }

    map.on('click', onClick)
    map.on('dblclick', onDblClick)
    
    return () => {
      map.off('click', onClick)
      map.off('dblclick', onDblClick)
    }
  }, [map, points, setIsDrawing])

  if (!isDrawing || points.length === 0) return null

  return (
    <>
      <Polyline positions={points} pathOptions={{ color: '#ef4444', dashArray: '4 4' }} />
      {points.map((p, i) => (
        <Marker 
          key={i} 
          position={p} 
          icon={L.divIcon({ className: 'bg-red-500 w-2 h-2 rounded-full border border-white' })} 
        />
      ))}
    </>
  )
}

export default function TacticalMap({ onShipSelect }: { onShipSelect: (id: string) => void }) {
  const ships = useFleetStore(s => s.ships)
  const zones = useFleetStore(s => s.zones)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  
  // Activate interpolation
  useShipInterpolation(ships, markersRef)

  const [isDrawing, setIsDrawing] = useState(false)
  const [showWeather, setShowWeather] = useState(false)
  const [weatherGrid, setWeatherGrid] = useState<any[]>([])

  useEffect(() => {
    if (showWeather) {
      fetch('/api/weather/grid')
        .then(res => res.json())
        .then(data => setWeatherGrid(data))
        .catch(() => setWeatherGrid([]))
    } else {
      setWeatherGrid([])
    }
  }, [showWeather])

  // Fix for React 18 Strict Mode + Fast Refresh "Map container is already initialized"
  useEffect(() => {
    return () => {
      const container = document.getElementById('tactical-map-container')
      if (container && (container as any)._leaflet_id) {
        ;(container as any)._leaflet_id = null
      }
    }
  }, [])

  const mapCenter: [number, number] = [26.0, 54.0]
  const mapBounds: L.LatLngBoundsExpression = [
    [22.0, 47.5], // SW
    [30.5, 60.0], // NE
  ]

  // Event handlers
  const handleReset = () => {
    // We dispatch a custom event to map container
    const event = new Event('reset-view')
    document.querySelector('.leaflet-container')?.dispatchEvent(event)
  }

  return (
    <div className="relative w-full h-full bg-slate-100">
      <MapContainer
        id="tactical-map-container"
        center={mapCenter}
        zoom={6}
        maxBounds={mapBounds}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        className="w-full h-full"
        doubleClickZoom={!isDrawing}
      >
        <MapController onReset={handleReset} />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
        />

        {/* WEATHER GRID OVERLAY */}
        {weatherGrid.map((cell, i) => {
          const { lat, lng, severity } = cell
          const bounds: L.LatLngBoundsExpression = [
            [lat - 0.25, lng - 0.25],
            [lat + 0.25, lng + 0.25]
          ]
          let color = 'rgba(59,130,246,0.15)'
          if (severity > 0.6) color = 'rgba(239,68,68,0.30)'
          else if (severity > 0.3) color = 'rgba(234,179,8,0.25)'

          return (
            <Polygon 
              key={i} 
              positions={bounds} 
              pathOptions={{ fillColor: color, fillOpacity: 1, stroke: false }} 
            />
          )
        })}

        {/* RESTRICTED ZONES */}
        {zones.map(zone => (
          <Polygon
            key={zone.id}
            positions={zone.geometry.coordinates[0].map((p: number[]) => [p[1], p[0]] as [number, number])}
            pathOptions={{
              fillColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              weight: 2,
              dashArray: '6 4'
            }}
          >
            <Tooltip>{zone.name}</Tooltip>
          </Polygon>
        ))}

        {/* ROUTES */}
        {ships.map(ship => {
          if (!ship.route || ship.route.length === 0) return null
          
          let color = '#2563eb'
          let weight = 1.5
          let opacity = 0.5
          let dashArray = '5 5'
          let className = ''

          if (ship.status === 'REROUTING' || ship.status === 'rerouting') {
            color = '#f59e0b'
            weight = 2
            opacity = 0.8
            dashArray = ''
          } else if (ship.status === 'DISTRESS' || ship.status === 'distressed') {
            color = '#ef4444'
            weight = 2.5
            opacity = 0.8
            dashArray = '10 10'
            className = 'animate-[dash_1s_linear_infinite]'
          }

          return (
            <Polyline
              key={`route-${ship.id}`}
              positions={ship.route.map(p => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color, weight, opacity, dashArray, className }}
            />
          )
        })}

        {/* SHIPS */}
        {ships.map(ship => (
          <Marker
            key={ship.id}
            position={[ship.position.lat, ship.position.lng] as [number, number]}
            icon={createShipIcon(ship)}
            ref={(r) => {
              if (r) markersRef.current.set(ship.id, r)
            }}
            eventHandlers={{
              click: () => onShipSelect(ship.id)
            }}
          />
        ))}

        {/* DRAW TOOL */}
        <ZoneDrawingManager isDrawing={isDrawing} setIsDrawing={setIsDrawing} />
      </MapContainer>

      {/* CONTROLS */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => {
            const mapNode = document.querySelector('.leaflet-container')
            if (mapNode) {
              const evt = new CustomEvent('zoomIn')
              mapNode.dispatchEvent(evt)
            }
          }}
          className="w-8 h-8 bg-white border border-slate-200 rounded shadow-sm flex items-center justify-center hover:bg-slate-50 text-slate-700"
        >
          +
        </button>
        <button
          onClick={() => {
            const mapNode = document.querySelector('.leaflet-container')
            if (mapNode) {
              const evt = new CustomEvent('zoomOut')
              mapNode.dispatchEvent(evt)
            }
          }}
          className="w-8 h-8 bg-white border border-slate-200 rounded shadow-sm flex items-center justify-center hover:bg-slate-50 text-slate-700"
        >
          -
        </button>
        
        <div className="h-2" />

        <button
          onClick={() => setIsDrawing(!isDrawing)}
          className={`w-8 h-8 border rounded shadow-sm flex items-center justify-center transition-colors ${
            isDrawing ? 'bg-red-100 border-red-500 text-red-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
          title="Draw Zone"
        >
          ⊕
        </button>
        
        <button
          onClick={() => setShowWeather(!showWeather)}
          className={`w-8 h-8 border rounded shadow-sm flex items-center justify-center transition-colors ${
            showWeather ? 'bg-blue-100 border-blue-500 text-blue-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
          title="Weather Overlay"
        >
          ☁
        </button>

        <button
          onClick={handleReset}
          className="w-8 h-8 bg-white border border-slate-200 rounded shadow-sm flex items-center justify-center hover:bg-slate-50 text-slate-700 mt-2"
          title="Reset View"
        >
          ⟳
        </button>
      </div>

      {isDrawing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-600 text-white px-3 py-1 text-xs font-bold rounded animate-pulse shadow-md border border-red-800">
          DRAWING MODE: ON
        </div>
      )}

      {showWeather && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 border border-slate-200 p-2 rounded shadow-sm text-[10px] font-mono flex flex-col gap-1">
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500/30 border border-blue-500" /> CALM</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-500/40 border border-yellow-500" /> MODERATE</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500/50 border border-red-500" /> SEVERE</div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
      `}} />
    </div>
  )
}
