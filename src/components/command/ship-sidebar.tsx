'use client'

import { useState } from 'react'
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
  const fuelColor   = fuelPct > 40 ? 'bg-primary shadow-[0_0_8px_#00ff66]' : fuelPct > 20 ? 'bg-yellow-400' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'

  return (
    <div className="flex flex-col h-full bg-card/40 font-sans">
      {/* Header */}
      <div className="p-4 border-b border-primary/20 flex items-center justify-between bg-primary/5">
        <div>
          <div className="text-sm font-heading font-bold text-primary radar-glow tracking-widest uppercase">
            {ship.name}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
            VESSEL_ID: {ship.id}
          </div>
        </div>
        <button
          onClick={() => setSelected(null)}
          className="text-muted-foreground hover:text-primary transition-colors p-1"
        >
          ✕
        </button>
      </div>

      {/* Status badge */}
      <div className="px-4 pt-4">
        <div className={`text-[10px] font-mono font-bold px-2 py-1 rounded border inline-block tracking-tighter
          ${ship.status === 'normal'      ? 'border-primary/50 bg-primary/10 text-primary radar-glow' :
            ship.status === 'rerouting'   ? 'border-yellow-500/50 bg-yellow-900/20 text-yellow-400' :
            ship.status === 'arrived'     ? 'border-muted-foreground/50 bg-muted/10 text-muted-foreground' :
            'border-red-500/50 bg-red-900/20 text-red-400'}`}>
          STATUS :: {ship.status.replace(/_/g, ' ').toUpperCase()}
        </div>
      </div>

      {/* Info rows */}
      <div className="p-4 space-y-4">
        <Row label="DESTINATION" value={PORTS[ship.destinationPortId] ?? ship.destinationPortId} />
        <Row label="CARGO_TYPE"  value={ship.cargo.toUpperCase()} />
        <Row label="VELOCITY"    value={`${ship.speed} KTS`} />
        <Row label="BEARING"     value={`${Math.round(ship.heading)}°`} />
        <Row label="COORDINATES" value={`${ship.position.lat.toFixed(4)}°N / ${ship.position.lng.toFixed(4)}°E`} />
        <Row label="MET_COND"    value={ship.weatherPenalty ? '⚠ ADVERSE (+30% BURN)' : 'STABLE'} />

        {/* Fuel bar */}
        <div className="pt-2">
          <div className="flex justify-between mb-1.5 text-[10px] font-mono">
            <span className="text-muted-foreground">FUEL_RESERVES</span>
            <span className={fuelPct < 20 ? 'text-red-400 animate-pulse' : 'text-primary'}>
              {Math.round(ship.fuelRemaining).toLocaleString()}T [{fuelPct}%]
            </span>
          </div>
          <div className="h-1 bg-background rounded-full overflow-hidden border border-primary/10">
            <div
              className={`h-full transition-all duration-1000 ${fuelColor}`}
              style={{ width: `${fuelPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Directive buttons */}
      <div className="p-4 border-t border-primary/20 mt-auto space-y-2 bg-primary/5">
        <div className="text-[10px] font-heading font-semibold text-muted-foreground mb-3 tracking-widest uppercase opacity-70">
          Command Directives
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['HOLD', 'REROUTE', 'DIVERT', 'RETURN_TO_PORT'] as const).map(type => (
            <DirectiveButton key={type} shipId={ship.id} type={type} issuedById="command" />
          ))}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-mono text-muted-foreground tracking-tighter uppercase">{label}</span>
      <span className="text-xs font-medium text-foreground tracking-wide">{value}</span>
    </div>
  )
}

function DirectiveButton({
  shipId, type, issuedById,
}: {
  shipId: string
  type: 'HOLD' | 'REROUTE' | 'DIVERT' | 'RETURN_TO_PORT'
  issuedById: string
}) {
  const [sent, setSent] = useState(false)

  const handleClick = async () => {
    setSent(true)
    await fetch('/api/directives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipId, type, payload: {}, issuedById }),
    })
    setTimeout(() => setSent(false), 2000)
  }

  const labels: Record<string, string> = {
    HOLD:           'HOLD_POS',
    REROUTE:        'REROUTE',
    DIVERT:         'DIVERT',
    RETURN_TO_PORT: 'RTB',
  }

  return (
    <button
      onClick={handleClick}
      disabled={sent}
      className="text-center text-[10px] font-mono font-bold px-2 py-2 rounded 
        bg-background border border-primary/30 text-primary/80 
        hover:bg-primary hover:text-background hover:shadow-glow 
        transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {sent ? '✓ SENT' : labels[type]}
    </button>
  )
}
