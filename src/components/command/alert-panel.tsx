'use client'

import { useFleetStore } from '@/stores/fleet-store'
import type { FleetAlert } from '@/types/fleet'

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'border-red-500/50 bg-red-900/10 text-red-400',
  HIGH:     'border-orange-500/50 bg-orange-900/10 text-orange-400',
  MEDIUM:   'border-yellow-500/50 bg-yellow-900/10 text-yellow-400',
  LOW:      'border-primary/30 bg-primary/5 text-primary/70',
}

export default function AlertPanel({ alerts }: { alerts: FleetAlert[] }) {
  const updateAlert = useFleetStore(s => s.updateAlert)

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
          alerts.map(alert => (
            <div
              key={alert.id}
              className={`p-3 rounded border text-[11px] transition-all hover:bg-white/5 ${SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.LOW}`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <div className="font-heading font-bold tracking-wider uppercase text-[10px]">
                  {alert.type.replace(/_/g, ' ')}
                </div>
                <span className="text-[9px] font-mono opacity-50 shrink-0">{alert.severity}</span>
              </div>

              <div className="font-sans opacity-90 leading-relaxed mb-2">{alert.message}</div>

              {/* Distress expanded metadata — shown when type is DISTRESS_SIGNAL */}
              {alert.type === 'DISTRESS_SIGNAL' && alert.metadata && (
                <div className="mt-2 p-2 rounded bg-black/30 border border-red-500/20 space-y-1 text-[10px] font-mono">
                  {(alert.metadata as Record<string, unknown>).systemsAffected &&
                    ((alert.metadata as Record<string, unknown>).systemsAffected as string[]).length > 0 && (
                    <div className="text-muted-foreground">
                      SYS: {((alert.metadata as Record<string, unknown>).systemsAffected as string[]).join(' / ')}
                    </div>
                  )}
                  {(alert.metadata as Record<string, unknown>).injuriesReported && (
                    <div className="text-red-400 font-bold animate-pulse">
                      ⚠ CASUALTIES: {String((alert.metadata as Record<string, unknown>).injuryCount ?? 'unknown')}
                    </div>
                  )}
                  {(alert.metadata as Record<string, unknown>).assistanceRequired && (
                    <div className="text-primary/80">
                      REQ: {String((alert.metadata as Record<string, unknown>).assistanceRequired)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <span className="text-[9px] font-mono opacity-40">
                  {new Date(alert.createdAt).toLocaleTimeString([], { hour12: false })} · {alert.shipId}
                </span>
                <button
                  onClick={() => acknowledge(alert.id)}
                  className="text-[9px] font-mono font-bold px-2 py-1 rounded 
                    bg-background border border-primary/30 text-primary/60 
                    hover:bg-primary hover:text-background hover:shadow-glow transition-all"
                >
                  ACK
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
