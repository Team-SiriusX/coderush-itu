'use client'

import type { FleetAlert } from '@/types/fleet'

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'border-red-500/50 bg-red-900/10 text-red-400 radar-glow-red',
  HIGH:     'border-orange-500/50 bg-orange-900/10 text-orange-400',
  MEDIUM:   'border-yellow-500/50 bg-yellow-900/10 text-yellow-400',
  LOW:      'border-primary/30 bg-primary/5 text-primary/70',
}

export default function AlertPanel({ alerts }: { alerts: FleetAlert[] }) {
  return (
    <div className="flex flex-col h-full bg-card/40 font-sans">
      <div className="p-4 border-b border-primary/20 bg-primary/5">
        <div className="text-[10px] font-heading font-bold text-primary radar-glow uppercase tracking-widest">
          Tactical Alert Log
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
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
              <div className="flex justify-between items-start mb-1">
                <div className="font-heading font-bold tracking-wider uppercase">{alert.type.replace(/_/g, ' ')}</div>
                <div className="font-mono opacity-50 text-[9px]">
                  {new Date(alert.createdAt).toLocaleTimeString([], { hour12: false })}
                </div>
              </div>
              <div className="font-sans opacity-90 leading-relaxed">{alert.message}</div>
              <div className="mt-2 flex items-center gap-2">
                <div className={`w-1 h-1 rounded-full ${alert.severity === 'CRITICAL' ? 'bg-red-500 animate-pulse' : 'bg-current'}`} />
                <span className="text-[9px] font-mono uppercase opacity-50">Priority: {alert.severity}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
