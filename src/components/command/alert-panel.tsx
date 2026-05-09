'use client'

import { useState } from 'react'
import { useFleetStore } from '@/stores/fleet-store'
import type { FleetAlert, DistressExtraction } from '@/types/fleet'

// ─── Styles ───────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'border-red-500/50 bg-red-900/10 text-red-400',
  HIGH:     'border-orange-500/50 bg-orange-900/10 text-orange-400',
  MEDIUM:   'border-yellow-500/50 bg-yellow-900/10 text-yellow-400',
  LOW:      'border-primary/30 bg-primary/5 text-primary/70',
}

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH:     'bg-orange-500 text-white',
  MEDIUM:   'bg-yellow-500 text-black',
  LOW:      'bg-emerald-700 text-white',
}

const ASSISTANCE_ICON: Record<string, string> = {
  NONE:       '✓',
  MEDICAL:    '🩺',
  TOWING:     '⛵',
  ESCORT:     '🚢',
  FUEL:       '⛽',
  EVACUATION: '🆘',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely cast alert metadata to DistressExtraction if it has the right shape */
function asDistressExtraction(meta: Record<string, unknown> | undefined): DistressExtraction | null {
  if (!meta || typeof meta.situation !== 'string') return null
  return meta as unknown as DistressExtraction
}

// Infer a directive type from assistanceRequired
function recommendedDirectiveType(
  ar: DistressExtraction['assistanceRequired'],
): 'HOLD' | 'REROUTE' | 'DIVERT' | 'RETURN_TO_PORT' {
  switch (ar) {
    case 'TOWING':
    case 'FUEL':    return 'DIVERT'
    case 'ESCORT':  return 'REROUTE'
    default:        return 'HOLD'
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertPanel({ alerts }: { alerts: FleetAlert[] }) {
  const updateAlert = useFleetStore((s) => s.updateAlert)

  const acknowledge = async (id: string) => {
    await fetch(`/api/alerts/${id}/acknowledge`, { method: 'PATCH' })
    updateAlert(id, { acknowledged: true } as Partial<FleetAlert>)
  }

  return (
    <div className="flex flex-col h-full bg-card/40 font-sans">
      <div className="p-4 border-b border-primary/20 bg-primary/5">
        <div className="text-[10px] font-heading font-bold text-primary radar-glow uppercase tracking-widest flex items-center gap-2">
          Tactical Alert Log
          {alerts.length > 0 && (
            <span className="bg-red-500/20 border border-red-500/50 text-red-400 rounded px-1.5 py-0.5 text-[9px] font-mono animate-pulse">
              {alerts.length}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 opacity-30">
            <div className="w-12 h-12 border border-primary/20 rounded-full flex items-center justify-center mb-2">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
            </div>
            <div className="text-[10px] font-mono uppercase tracking-tighter">
              All systems nominal
            </div>
          </div>
        ) : (
          alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onAck={() => acknowledge(alert.id)} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({ alert, onAck }: { alert: FleetAlert; onAck: () => void }) {
  const distress = alert.type === 'DISTRESS_SIGNAL'
    ? asDistressExtraction(alert.metadata)
    : null

  return (
    <div className={`rounded border text-[11px] transition-all hover:bg-white/5 overflow-hidden
      ${SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.LOW}`}>

      {/* Standard header row */}
      <div className="p-3 pb-2">
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <div className="font-heading font-bold tracking-wider uppercase text-[10px]">
            {alert.type.replace(/_/g, ' ')}
          </div>
          <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${SEVERITY_BADGE[alert.severity] ?? ''}`}>
            {alert.severity}
          </span>
        </div>
        <div className="font-sans opacity-90 leading-relaxed">{alert.message}</div>
      </div>

      {/* AI Assessment — distress only */}
      {distress && (
        <AIAssessmentCard distress={distress} shipId={alert.shipId} />
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 pb-3 pt-1">
        <span className="text-[9px] font-mono opacity-40">
          {new Date(alert.createdAt).toLocaleTimeString([], { hour12: false })} · {alert.shipId}
        </span>
        <button
          onClick={onAck}
          className="text-[9px] font-mono font-bold px-2 py-1 rounded
            bg-background border border-primary/30 text-primary/60
            hover:bg-primary hover:text-background hover:shadow-glow transition-all active:scale-95"
        >
          ACK
        </button>
      </div>
    </div>
  )
}

// ─── AI Assessment Card ───────────────────────────────────────────────────────

function AIAssessmentCard({ distress, shipId }: { distress: DistressExtraction; shipId: string }) {
  const [directiveSent, setDirectiveSent] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  const directiveType = recommendedDirectiveType(distress.assistanceRequired)

  const issueDirective = async () => {
    setDirectiveSent(true)
    await fetch('/api/directives', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        shipId,
        type:        directiveType,
        payload:     { reason: 'AI_DISTRESS_RECOMMENDATION', assistanceRequired: distress.assistanceRequired },
        issuedById:  'hormuz-ai',
      }),
    })
  }

  return (
    <div className="mx-3 mb-3 rounded border border-red-500/30 bg-black/40 overflow-hidden">

      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left
          hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
          <span className="text-[10px] font-bold tracking-[0.15em] text-cyan-400 uppercase">
            AI Assessment
          </span>
        </div>
        <span className="text-[10px] text-slate-600">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">

          {/* Situation summary */}
          <p className="text-xs text-slate-300 leading-relaxed">
            {distress.situation}
          </p>

          {/* Systems affected chips */}
          {distress.systemsAffected.length > 0 && (
            <div>
              <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1.5">
                Systems affected
              </div>
              <div className="flex flex-wrap gap-1">
                {distress.systemsAffected.map((sys) => (
                  <span
                    key={sys}
                    className="px-1.5 py-0.5 rounded bg-red-900/30 border border-red-700/40
                      text-red-300 text-[9px] font-mono uppercase tracking-wide"
                  >
                    {sys}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Data grid */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {distress.casualtyCount > 0 && (
              <DataChip
                label="Casualties"
                value={String(distress.casualtyCount)}
                urgent
              />
            )}
            <DataChip
              label="Assistance"
              value={`${ASSISTANCE_ICON[distress.assistanceRequired] ?? ''} ${distress.assistanceRequired}`}
            />
            <DataChip
              label="Can continue"
              value={distress.canContinue ? 'YES' : 'NO'}
              urgent={!distress.canContinue}
            />
            {distress.estimatedTimeToFailure !== null && (
              <DataChip
                label="Time to failure"
                value={`${distress.estimatedTimeToFailure} MIN`}
                urgent
              />
            )}
          </div>

          {/* Recommended action */}
          <div className="rounded bg-cyan-950/30 border border-cyan-800/30 p-2.5">
            <div className="text-[9px] text-cyan-600 tracking-widest uppercase mb-1">
              Recommended action
            </div>
            <p className="text-xs text-cyan-200 leading-relaxed">
              {distress.recommendedAction}
            </p>
          </div>

          {/* Issue directive button */}
          <button
            onClick={() => void issueDirective()}
            disabled={directiveSent}
            className="w-full py-2 px-3 rounded border text-[10px] font-mono font-bold
              tracking-widest uppercase transition-all active:scale-95
              border-cyan-600/50 bg-cyan-900/20 text-cyan-400
              hover:bg-cyan-800/40 hover:border-cyan-500
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {directiveSent
              ? `✓ ${directiveType.replace(/_/g, ' ')} ISSUED`
              : `Issue ${directiveType.replace(/_/g, ' ')} Directive`}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Data chip ────────────────────────────────────────────────────────────────

function DataChip({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <div>
      <div className="text-[8px] text-slate-600 uppercase tracking-widest mb-0.5">{label}</div>
      <div className={`text-[10px] font-mono font-bold ${urgent ? 'text-red-400 animate-pulse' : 'text-slate-300'}`}>
        {value}
      </div>
    </div>
  )
}
