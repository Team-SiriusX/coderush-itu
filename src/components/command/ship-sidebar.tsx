'use client'

import { useFleetStore } from '@/stores/fleet-store'
import type { ShipState } from '@/types/fleet'

const PORTS: Record<string, string> = {
  'KWT-1': 'Kuwait City',
  'BUS-1': 'Bushehr',
  'DMM-1': 'Dammam',
  'BAH-1': 'Manama',
  'DOH-1': 'Doha',
  'AUH-1': 'Abu Dhabi',
  'DXB-1': 'Jebel Ali',
  'BND-1': 'Bandar Abbas',
  'SOH-1': 'Sohar',
  'MCT-1': 'Muscat',
}

export default function ShipSidebar({ ship }: { ship: ShipState }) {
  const setSelected = useFleetStore(s => s.setSelectedShip)
  const fuelPct     = Math.min(100, Math.round((ship.fuelRemaining / 8500) * 100))
  const fuelColor   = fuelPct > 40 ? 'bg-emerald-500' : fuelPct > 20 ? 'bg-yellow-400' : 'bg-red-500'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-100">{ship.name}</div>
          <div className="text-xs text-slate-500">{ship.id}</div>
        </div>
        <button
          onClick={() => setSelected(null)}
          className="text-slate-600 hover:text-slate-400 text-xs"
        >
          ✕
        </button>
      </div>

      {/* Status badge */}
      <div className="px-3 pt-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide
          ${ship.status === 'normal'      ? 'bg-emerald-900 text-emerald-400' :
            ship.status === 'rerouting'   ? 'bg-yellow-900 text-yellow-400' :
            ship.status === 'arrived'     ? 'bg-slate-700 text-slate-400' :
            'bg-red-900 text-red-400'}`}>
          {ship.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Info rows */}
      <div className="p-3 space-y-3 text-xs">
        <Row label="Destination" value={PORTS[ship.destinationPortId] ?? ship.destinationPortId} />
        <Row label="Cargo"       value={ship.cargo} />
        <Row label="Speed"       value={`${ship.speed} knots`} />
        <Row label="Heading"     value={`${Math.round(ship.heading)}°`} />
        <Row label="Position"    value={`${ship.position.lat.toFixed(3)}°N ${ship.position.lng.toFixed(3)}°E`} />
        <Row label="Weather"     value={ship.weatherPenalty ? '⚠ Adverse (+30% fuel)' : 'Clear'} />

        {/* Fuel bar */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-slate-500">Fuel</span>
            <span className="text-slate-300">{Math.round(ship.fuelRemaining).toLocaleString()}t ({fuelPct}%)</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${fuelColor}`}
              style={{ width: `${fuelPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Directive buttons */}
      <div className="p-3 border-t border-slate-800 mt-auto space-y-2">
        <div className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-widest">
          Send Directive
        </div>
        {(['HOLD', 'REROUTE', 'DIVERT', 'RETURN_TO_PORT'] as const).map(type => (
          <DirectiveButton key={type} shipId={ship.id} type={type} />
        ))}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300 text-right max-w-[160px] truncate">{value}</span>
    </div>
  )
}

function DirectiveButton({
  shipId, type,
}: {
  shipId: string
  type: 'HOLD' | 'REROUTE' | 'DIVERT' | 'RETURN_TO_PORT'
}) {
  const handleClick = async () => {
    await fetch('/api/directives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipId, type, payload: {} }),
    })
  }

  const labels: Record<string, string> = {
    HOLD:           '⏸ Hold Position',
    REROUTE:        '↗ Reroute',
    DIVERT:         '⤴ Divert',
    RETURN_TO_PORT: '⚓ Return to Port',
  }

  return (
    <button
      onClick={handleClick}
      className="w-full text-left text-xs px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700
        text-slate-300 hover:text-slate-100 transition-colors border border-slate-700"
    >
      {labels[type]}
    </button>
  )
}
