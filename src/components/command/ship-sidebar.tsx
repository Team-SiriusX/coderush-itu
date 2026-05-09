'use client'

import { useState } from 'react'
import { useFleetStore } from '@/stores/fleet-store'
import type { ShipState, DistressExtraction } from '@/types/fleet'
import * as turf from '@turf/turf'

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
  const setSelected  = useFleetStore((s) => s.setSelectedShip)
  const allAlerts    = useFleetStore((s) => s.alerts)
  const fuelPct      = Math.min(100, Math.round((ship.fuelRemaining / 8500) * 100))
  const fuelColor    = fuelPct > 40 ? 'bg-primary shadow-[0_0_8px_#00ff66]' : fuelPct > 20 ? 'bg-yellow-400' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'

  // Derive latest AI distress extraction for this ship (if distressed)
  const latestDistressAI: DistressExtraction | null = ship.status === 'distressed'
    ? (() => {
        const da   = allAlerts.find((a) => a.shipId === ship.id && a.type === 'DISTRESS_SIGNAL' && !!a.metadata)
        const meta = da?.metadata as Record<string, unknown> | undefined
        return meta && typeof meta.situation === 'string'
          ? (meta as unknown as DistressExtraction)
          : null
      })()
    : null

  // Calculate ETA
  let routeDist = 0
  if (ship.route && ship.route.length > 0) {
    let current = ship.position
    for (const wp of ship.route) {
      routeDist += turf.distance([current.lng, current.lat], [wp.lng, wp.lat], { units: 'kilometers' }) / 1.852
      current = wp
    }
  }
  const hours = ship.speed > 0 ? routeDist / ship.speed : null
  const etaDisplay = hours !== null ? `~${Math.round(hours)} HRS` : 'N/A (STOPPED)'

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
        <Row label="ETA"         value={ship.status === 'arrived' ? 'ARRIVED' : etaDisplay} />
        <Row label="COORDINATES" value={`${ship.position.lat.toFixed(4)}°N / ${ship.position.lng.toFixed(4)}°E`} />
        <Row label="MET_COND"    value={ship.weatherSeverity !== 'LOW' ? `⚠ ${ship.weatherSeverity} (+${ship.weatherSeverity === 'EXTREME' ? '50' : ship.weatherSeverity === 'SEVERE' ? '30' : '15'}% BURN)` : 'STABLE'} />

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

      {/* AI Directive Suggestion — distress ships only */}
      {latestDistressAI && (
        <DistressAISuggestion shipId={ship.id} extraction={latestDistressAI} />
      )}

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

// ─── AI Directive Suggestion ─────────────────────────────────────────────────

const ASSISTANCE_TO_DIRECTIVE: Record<
  DistressExtraction['assistanceRequired'],
  'HOLD' | 'REROUTE' | 'DIVERT' | 'RETURN_TO_PORT'
> = {
  NONE:       'HOLD',
  MEDICAL:    'DIVERT',
  TOWING:     'DIVERT',
  ESCORT:     'REROUTE',
  FUEL:       'DIVERT',
  EVACUATION: 'RETURN_TO_PORT',
}

function DistressAISuggestion({
  shipId,
  extraction,
}: {
  shipId:     string
  extraction: DistressExtraction
}) {
  const [sent, setSent] = useState(false)
  const directive = ASSISTANCE_TO_DIRECTIVE[extraction.assistanceRequired] ?? 'HOLD'

  const issueDirective = async () => {
    setSent(true)
    await fetch('/api/directives', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        shipId,
        type:       directive,
        payload:    { reason: 'AI_DISTRESS_RECOMMENDATION', source: extraction.assistanceRequired },
        issuedById: 'hormuz-ai',
      }),
    })
  }

  return (
    <div className="mx-4 mb-3 rounded border border-red-500/40 bg-red-950/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-red-500/20 bg-red-900/10">
        <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        <span className="text-[10px] font-bold tracking-[0.15em] text-red-400 uppercase">
          HORMUZ-AI Recommendation
        </span>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Situation */}
        <p className="text-[11px] text-slate-300 leading-relaxed">
          {extraction.situation}
        </p>

        {/* Systems affected */}
        {extraction.systemsAffected.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {extraction.systemsAffected.map((sys) => (
              <span
                key={sys}
                className="px-1.5 py-0.5 rounded bg-red-900/40 border border-red-700/40
                  text-red-300 text-[9px] font-mono uppercase"
              >
                {sys}
              </span>
            ))}
          </div>
        )}

        {/* Casualties */}
        {extraction.casualtyCount > 0 && (
          <div className="text-[10px] font-mono font-bold text-red-400 animate-pulse">
            ⚠ CASUALTIES REPORTED: {extraction.casualtyCount}
          </div>
        )}

        {/* Recommended action */}
        <div className="rounded bg-red-950/40 border border-red-800/30 px-2.5 py-2 text-[10px] text-red-200 leading-relaxed">
          <span className="text-red-500 font-bold">ACTION: </span>
          {extraction.recommendedAction}
        </div>

        {/* Pre-populated directive button */}
        <button
          onClick={() => void issueDirective()}
          disabled={sent}
          className="w-full py-2 px-3 rounded border text-[10px] font-mono font-bold
            tracking-widest uppercase transition-all active:scale-95
            border-red-600/50 bg-red-900/20 text-red-400
            hover:bg-red-800/40 hover:border-red-500
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sent
            ? `✓ ${directive.replace(/_/g, ' ')} ISSUED`
            : `Issue ${directive.replace(/_/g, ' ')} · AI Rec`}
        </button>
      </div>
    </div>
  )
}
