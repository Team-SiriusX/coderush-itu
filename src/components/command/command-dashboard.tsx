'use client'

import dynamic from 'next/dynamic'
import { useFleetSync } from '@/hooks/use-fleet-sync'
import { useFleetStore } from '@/stores/fleet-store'
import AlertPanel from '@/components/command/alert-panel'
import ShipSidebar from '@/components/command/ship-sidebar'
import { GlobeLive } from '@/components/ui/cobe-globe-live'

// Leaflet must be loaded client-side only (no SSR)
const FleetMap = dynamic(() => import('@/components/command/fleet-map'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-background flex items-center justify-center">
      <div className="text-muted-foreground text-sm font-sans radar-glow">INITIALIZING TACTICAL OVERLAY...</div>
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
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans select-none">

      {/* Left sidebar — ship list */}
      <div className="w-64 flex flex-col border-r border-primary/20 bg-card/80 backdrop-blur-md">
        <div className="p-3 border-b border-primary/10">
          <div className="text-[10px] font-heading font-semibold text-primary radar-glow uppercase tracking-widest">
            Hormuz Command
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
            {ships.filter(s => s.status !== 'arrived').length} / 15 ACTIVE_CONTACTS
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {ships.map(ship => (
            <ShipListItem key={ship.id} ship={ship} selected={ship.id === selectedShipId} />
          ))}
        </div>
      </div>

      {/* Main map area */}
      <div className="flex-1 relative">
        <FleetMap />

        {/* Tactical HUD Overlay (Mini-Map) */}
        <div className="absolute bottom-6 left-6 z-[1000] pointer-events-none">
          <div className="rounded-2xl hud-border bg-card/90 p-3 shadow-glow backdrop-blur-lg pointer-events-auto">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-primary radar-glow">
                Global Projection
              </div>
              <div className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-mono font-bold text-primary animate-pulse">
                LIVE
              </div>
            </div>

            <div className="w-48 h-48 rounded-full border border-primary/30 shadow-[inset_0_0_20px_rgba(0,255,102,0.1)] overflow-hidden bg-background/40">
              <GlobeLive 
                speed={0.0035}
                markers={ships.filter(s => s.status !== 'arrived').map(s => ({ 
                  id: s.id, 
                  location: [s.position.lat, s.position.lng]
                }))} 
              />
            </div>
          </div>
        </div>

        {/* Alert Summary Overlay */}
        {unackedAlerts.length > 0 && (
          <div className="absolute top-4 right-4 z-[1000] bg-red-950/90 border border-red-500/50 text-red-400 text-[10px] font-bold px-3 py-1.5 rounded shadow-lg shadow-red-900/20 radar-glow-red animate-pulse pointer-events-none">
            {unackedAlerts.length} CRITICAL_ALERTS_PENDING
          </div>
        )}
      </div>

      {/* Right panel — ship analysis or alert log */}
      <div className="w-80 flex flex-col border-l border-primary/20 bg-card/80 backdrop-blur-md shadow-2xl">
        {selectedShip ? (
          <ShipSidebar ship={selectedShip} />
        ) : (
          <AlertPanel alerts={unackedAlerts} />
        )}
      </div>

    </div>
  )
}

function ShipListItem({ ship, selected }: { ship: import('@/types/fleet').ShipState, selected: boolean }) {
  const setSelected = useFleetStore(s => s.setSelectedShip)
  const statusColor = {
    normal:             'bg-primary shadow-[0_0_8px_#00ff66]',
    rerouting:          'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]',
    distressed:         'bg-orange-500 animate-pulse',
    stopped:            'bg-red-600',
    stranded:           'bg-red-700',
    insufficient_fuel:  'bg-orange-400',
    arrived:            'bg-muted-foreground/30',
  }[ship.status] ?? 'bg-slate-500'

  return (
    <button
      onClick={() => setSelected(selected ? null : ship.id)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 border-l-2
        ${selected 
          ? 'bg-primary/10 border-primary shadow-[inset_4px_0_15px_rgba(0,255,102,0.05)]' 
          : 'bg-transparent border-transparent hover:bg-primary/5 hover:border-primary/30'}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`} />
      <div className="min-w-0 flex-1">
        <div className={`text-[11px] font-heading font-medium tracking-wide uppercase ${selected ? 'text-primary radar-glow' : 'text-foreground/80'}`}>
          {ship.name}
        </div>
        <div className="flex justify-between items-center mt-1">
          <div className="text-[9px] font-mono text-muted-foreground uppercase">
            {ship.id}
          </div>
          <div className="text-[9px] font-mono text-primary/60">
            {Math.round(ship.fuelRemaining)}T
          </div>
        </div>
      </div>
    </button>
  )
}
