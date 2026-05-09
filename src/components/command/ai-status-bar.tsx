'use client'

import { useEffect, useState } from 'react'
import { useFleetStore } from '@/stores/fleet-store'

export default function AIStatusBar({
  onSelectTab,
}: {
  onSelectTab: (tab: 'SHIP' | 'ALERTS' | 'AI ADVISOR') => void
}) {
  const alerts = useFleetStore((s) => s.alerts)
  const ships = useFleetStore((s) => s.ships)

  const [predictionsCount, setPredictionsCount] = useState(0)
  const [distressCount, setDistressCount] = useState(0)
  const [isProcessingDistress, setIsProcessingDistress] = useState(false)

  // Derive active fleet risk
  const criticalCount = alerts.filter((a) => !a.resolved && a.severity === 'CRITICAL').length
  const highCount = alerts.filter((a) => !a.resolved && a.severity === 'HIGH').length
  const distressedShips = ships.filter((s) => s.status === 'distressed').length

  const riskScore = criticalCount * 3 + highCount * 2 + distressedShips * 5

  let riskLevel = 'LOW'
  if (riskScore > 25) riskLevel = 'HIGH'
  else if (riskScore > 10) riskLevel = 'MODERATE'

  useEffect(() => {
    // Determine if AI is actively processing a distress signal
    // For visual flair, we pretend it's processing whenever there is an unacked distress alert
    // OR we can just listen to a local state if we want real-time, but checking unacked distress is a good proxy.
    const unackedDistress = alerts.filter((a) => a.type === 'DISTRESS_SIGNAL' && !a.acknowledged)
    setIsProcessingDistress(unackedDistress.length > 0)
    setDistressCount(alerts.filter((a) => a.type === 'DISTRESS_SIGNAL').length)
  }, [alerts])

  // Periodic fetch for predictive counts (though local store has them, instructions ask for fetch)
  useEffect(() => {
    const fetchPredictive = async () => {
      try {
        const res = await fetch('/api/alerts?type=predictive')
        if (res.ok) {
          const data = await res.json()
          setPredictionsCount(data.length || 0)
        }
      } catch (e) {
        // Fallback to local store
        setPredictionsCount(alerts.filter((a) => (a.metadata as any)?.isPredictive).length)
      }
    }
    fetchPredictive()
    const id = setInterval(fetchPredictive, 30000)
    return () => clearInterval(id)
  }, [alerts])

  return (
    <div
      className={`h-[36px] border-b flex items-center px-4 gap-4 text-[11px] font-mono font-bold tracking-widest uppercase transition-colors duration-1000 ${
        riskLevel === 'HIGH'
          ? 'bg-red-950/80 border-red-500/50 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)] animate-pulse'
          : 'bg-cyan-950/30 border-cyan-900/50'
      }`}
    >
      {/* 1. System Status Pill */}
      <button
        onClick={() => onSelectTab('AI ADVISOR')}
        className={`px-2 py-1 rounded border flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ${
          isProcessingDistress
            ? 'bg-yellow-900/40 border-yellow-500/50 text-yellow-400'
            : 'bg-cyan-900/20 border-cyan-500/30 text-cyan-400'
        }`}
      >
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            isProcessingDistress ? 'bg-yellow-400 animate-pulse' : 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
          }`}
        />
        {isProcessingDistress ? 'HORMUZ-AI PROCESSING...' : 'HORMUZ-AI ACTIVE'}
      </button>

      {/* 2. Predictions Pill */}
      <button
        onClick={() => onSelectTab('ALERTS')}
        className="px-2 py-1 rounded border bg-black/40 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white transition-all active:scale-95 flex items-center gap-1"
      >
        🧠 {predictionsCount} PREDICTION{predictionsCount !== 1 ? 'S' : ''}
      </button>

      {/* 3. Distress Pill */}
      <button
        onClick={() => onSelectTab('ALERTS')}
        className="px-2 py-1 rounded border bg-black/40 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white transition-all active:scale-95 flex items-center gap-1"
      >
        🆘 {distressCount} DISTRESS PROCESSED
      </button>

      <div className="flex-1" />

      {/* 4. Fleet Risk Pill */}
      <div
        className={`px-2 py-1 rounded border flex items-center gap-2 ${
          riskLevel === 'HIGH'
            ? 'bg-red-900/40 border-red-500 text-red-400'
            : riskLevel === 'MODERATE'
            ? 'bg-yellow-900/20 border-yellow-500/50 text-yellow-500'
            : 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400'
        }`}
      >
        FLEET RISK: {riskLevel}
        <div
          className={`w-1.5 h-1.5 rounded-full animate-pulse ${
            riskLevel === 'HIGH' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : riskLevel === 'MODERATE' ? 'bg-yellow-500' : 'bg-emerald-500'
          }`}
        />
      </div>
    </div>
  )
}
