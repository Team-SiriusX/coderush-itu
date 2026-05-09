'use client'

import dynamic from 'next/dynamic'
import { useFleetSync } from '@/hooks/use-fleet-sync'
import { useFleetStore } from '@/stores/fleet-store'
import AlertPanel from '@/components/command/alert-panel'
import ShipSidebar from '@/components/command/ship-sidebar'
import { GlobeCdn } from '@/components/ui/cobe-globe-cdn'

// Leaflet must be loaded client-side only (no SSR)
const FleetMap = dynamic(() => import('@/components/command/fleet-map'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-slate-950 flex items-center justify-center">
      <div className="text-slate-500 text-sm">Initializing tactical map...</div>
    </div>
  ),
})

export default function CommandDashboard() {
  useFleetSync()  // subscribes to Pusher, syncs Zustand store

  const ships        = useFleetStore(s => s.ships)
  const alerts       = useFleetStore(s => s.alerts)
  const selectedShipId = useFleetStore(s => s.selectedShipId)
  const selectedShip = ships.find(s => s.id === selectedShipId) ?? null

  const unackedAlerts = alerts.filter(a => !a.acknowledged)

  const liveShips = ships.filter(s => s.status !== 'arrived')
  const cdnMarkers = buildGlobeMarkers(liveShips)

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden select-none">

      {/* Left sidebar — ship list */}
      <div className="w-72 flex flex-col border-r border-slate-800 bg-slate-900">
        <div className="p-4 border-b border-slate-800">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-[0.16em]">
            Hormuz Command
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {liveShips.length} / 15 active contacts
          </div>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              Global Tracking
            </div>
            <div className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              {liveShips.length} LIVE
            </div>
          </div>
          <div className="mx-auto w-52 h-52 overflow-visible bg-transparent">
            <GlobeCdn
              speed={0.003}
              arcs={[]}
              markers={cdnMarkers}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {ships.map(ship => (
            <ShipListItem key={ship.id} ship={ship} selected={ship.id === selectedShipId} />
          ))}
        </div>
      </div>

      {/* Main map */}
      <div className="flex-1 relative">
        <FleetMap />
        {unackedAlerts.length > 0 && (
          <div className="absolute top-3 right-3 z-[1000] bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
            {unackedAlerts.length} ALERT{unackedAlerts.length > 1 ? 'S' : ''}
          </div>
        )}
      </div>

      {/* Right panel — ship analysis or alert log */}
      <div className="w-80 flex flex-col border-l border-slate-800 bg-slate-900">
        {selectedShip ? (
          <ShipSidebar ship={selectedShip} />
        ) : (
          <AlertPanel alerts={unackedAlerts} />
        )}
      </div>

    </div>
  )
}

function buildGlobeMarkers(ships: import('@/types/fleet').ShipState[]) {
  const groups = new Map<string, import('@/types/fleet').ShipState[]>()

  for (const ship of ships) {
    // Bucket very close positions so ships spawning at same port can be visually separated.
    const key = `${ship.position.lat.toFixed(2)}:${ship.position.lng.toFixed(2)}`
    const list = groups.get(key) ?? []
    list.push(ship)
    groups.set(key, list)
  }

  const result: Array<{ id: string; location: [number, number]; region: string }> = []

  for (const group of groups.values()) {
    group.forEach((ship, index) => {
      const count = group.length
      const angle = (Math.PI * 2 * index) / Math.max(count, 1)
      const radius = count > 1 ? 0.22 + 0.03 * Math.floor(index / 6) : 0
      const latOffset = radius * Math.cos(angle)
      const lngOffset = radius * Math.sin(angle)

      result.push({
        id: ship.id,
        location: [ship.position.lat + latOffset, ship.position.lng + lngOffset],
        region: ship.name,
      })
    })
  }

  return result
}

function ShipListItem({ ship, selected }: { ship: import('@/types/fleet').ShipState, selected: boolean }) {
  const setSelected = useFleetStore(s => s.setSelectedShip)
  const statusColor = {
    normal:             'bg-emerald-500',
    rerouting:          'bg-yellow-400',
    distressed:         'bg-orange-500',
    stopped:            'bg-red-600',
    stranded:           'bg-red-700',
    insufficient_fuel:  'bg-orange-400',
    arrived:            'bg-slate-600',
  }[ship.status] ?? 'bg-slate-500'

  return (
    <button
      onClick={() => setSelected(selected ? null : ship.id)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2
        ${selected
          ? 'bg-slate-800 border-cyan-400'
          : 'bg-transparent border-transparent hover:bg-slate-800/70'}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`} />
      <div className="min-w-0 flex-1">
        <div className={`text-[11px] font-medium tracking-wide uppercase ${selected ? 'text-slate-100' : 'text-slate-200'}`}>
          {ship.name}
        </div>
        <div className="flex justify-between items-center mt-1">
          <div className="text-[10px] text-slate-500 uppercase">
            {ship.id}
          </div>
          <div className="text-[10px] text-slate-400">
            {Math.round(ship.fuelRemaining)}T
          </div>
        </div>
      </div>
    </button>
  )
}
