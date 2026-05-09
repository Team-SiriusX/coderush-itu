'use client'

import type { FleetAlert } from '@/types/fleet'

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'border-red-600 bg-red-950 text-red-300',
  HIGH:     'border-orange-500 bg-orange-950 text-orange-300',
  MEDIUM:   'border-yellow-500 bg-yellow-950 text-yellow-300',
  LOW:      'border-slate-600 bg-slate-800 text-slate-300',
}

export default function AlertPanel({ alerts }: { alerts: FleetAlert[] }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-slate-800">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Active Alerts
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {alerts.length === 0 ? (
          <div className="text-xs text-slate-600 text-center mt-8">
            No active alerts
          </div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.id}
              className={`p-2 rounded border text-xs ${SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.LOW}`}
            >
              <div className="font-semibold">{alert.type.replace(/_/g, ' ')}</div>
              <div className="opacity-80 mt-0.5">{alert.message}</div>
              <div className="opacity-50 mt-1">
                {new Date(alert.createdAt).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
