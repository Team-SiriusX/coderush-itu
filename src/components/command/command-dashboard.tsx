'use client'

import dynamic from 'next/dynamic'
import { useFleetSync } from '@/hooks/use-fleet-sync'
import { useFleetStore } from '@/stores/fleet-store'
import AlertPanel from '@/components/command/alert-panel'
import ShipSidebar from '@/components/command/ship-sidebar'

// Leaflet must be loaded client-side only (no SSR)
const FleetMap = dynamic(() => import('@/components/command/fleet-map'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-slate-900 flex items-center justify-center">
      <div className="text-slate-500 text-sm">Loading map...</div>
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

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* Left sidebar — ship list */}
      <div className="w-64 flex flex-col border-r border-slate-800 bg-slate-900">
        <div className="p-3 border-b border-slate-800">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Hormuz Command
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {ships.filter(s => s.status !== 'arrived').length} / 15 active
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

        {/* Alert badge */}
        {unackedAlerts.length > 0 && (
          <div className="absolute top-3 right-3 z-[1000] bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
            {unackedAlerts.length} ALERT{unackedAlerts.length > 1 ? 'S' : ''}
          </div>
        )}
      </div>

      {/* Right panel — selected ship OR alert panel */}
      <div className="w-72 flex flex-col border-l border-slate-800 bg-slate-900">
        {selectedShip ? (
          <ShipSidebar ship={selectedShip} />
        ) : (
          <AlertPanel alerts={unackedAlerts} />
        )}
      </div>

    </div>
  )
}

// Ship list row
function ShipListItem({
  ship, selected,
}: {
  ship: import('@/types/fleet').ShipState
  selected: boolean
}) {
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
      className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800 transition-colors
        ${selected ? 'bg-slate-800 border-l-2 border-blue-500' : 'border-l-2 border-transparent'}`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor}`} />
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-200 truncate">{ship.name}</div>
        <div className="text-xs text-slate-500 truncate">
          {Math.round(ship.fuelRemaining)}t · {ship.cargo}
        </div>
      </div>
    </button>
  )
}
