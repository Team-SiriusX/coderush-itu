'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useFleetSync } from '@/hooks/use-fleet-sync'
import { useFleetStore } from '@/stores/fleet-store'
import { authClient } from '@/lib/auth-client'
import AlertPanel from '@/components/command/alert-panel'
import ShipSidebar from '@/components/command/ship-sidebar'
import { GlobeCdn } from '@/components/ui/cobe-globe-cdn'
import { useInterpolationStore } from '@/systems/interpolation/interpolation-store'
import { usePlaybackStore } from '@/systems/playback/playback-store'
import { findFrameAt } from '@/systems/playback/playback-engine'
import { PlaybackRecorder } from '@/systems/playback/playback-recorder'
import { ProximityEngine } from '@/systems/proximity/proximity-engine'
import type { FleetRecommendation } from '@/systems/advisor/advisor-types'
import AIChatPanel from '@/components/command/ai-chat-panel'
import AIStatusBar from '@/components/command/ai-status-bar'

type RightTab = 'ship' | 'alerts' | 'ai'

// Leaflet must be loaded client-side only (no SSR)
const FleetMap = dynamic(() => import('@/components/command/fleet-map'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-slate-950 flex items-center justify-center">
      <div className="text-slate-500 text-sm">Initializing tactical map...</div>
    </div>
  ),
})

export default function CommandDashboard() {
  const router = useRouter();
  useFleetSync()  // subscribes to Pusher, syncs Zustand store

  const handleLogout = async () => {
    await authClient.signOut();
    router.push('/auth/sign-in');
  };

  const liveShipsRaw = useFleetStore(s => s.ships)
  const alerts = useFleetStore(s => s.alerts)
  const zones = useFleetStore(s => s.zones)
  const directives = useFleetStore(s => s.directives)
  const selectedShipId = useFleetStore(s => s.selectedShipId)
  const setPlaybackFlag = useFleetStore(s => s.setPlayback)

  const ingestServerShips = useInterpolationStore(s => s.ingestServerShips)
  const tickRender = useInterpolationStore(s => s.tickRender)
  const renderShips = useInterpolationStore(s => s.renderShips)

  const playbackMode = usePlaybackStore(s => s.isPlaybackMode)
  const playbackFrames = usePlaybackStore(s => s.frames)
  const playbackCursor = usePlaybackStore(s => s.cursorTimestamp)
  const setPlaybackFrames = usePlaybackStore(s => s.setFrames)
  const recorderRef = useRef(new PlaybackRecorder())
  const proximityRef = useRef(new ProximityEngine())

  const [recommendations, setRecommendations] = useState<FleetRecommendation[]>([])
  const [rightTab, setRightTab] = useState<RightTab>('alerts')

  useEffect(() => {
    const fetchRecs = async () => {
      if (playbackMode) return
      try {
        const res = await fetch('/api/advisor/recommendations')
        if (res.ok) {
          const data = await res.json()
          setRecommendations(data)
        }
      } catch (err) {}
    }
    fetchRecs()
    const id = setInterval(fetchRecs, 5000)
    return () => clearInterval(id)
  }, [playbackMode])

  useEffect(() => {
    ingestServerShips(liveShipsRaw)
  }, [liveShipsRaw, ingestServerShips])

  useEffect(() => {
    let raf = 0
    const loop = (now: number) => {
      tickRender(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [tickRender])

  useEffect(() => {
    void fetch('/api/playback')
      .then((r) => r.json())
      .then((frames) => {
        const normalized = (frames as Array<{ timestamp: number | string; ships: unknown; alerts: unknown; zones: unknown }>)
          .map((f) => ({
            timestamp: typeof f.timestamp === 'string' ? new Date(f.timestamp).getTime() : f.timestamp,
            ships: Array.isArray(f.ships) ? (f.ships as import('@/types/fleet').ShipState[]) : [],
            alerts: Array.isArray(f.alerts) ? (f.alerts as import('@/types/fleet').FleetAlert[]) : [],
            zones: Array.isArray(f.zones) ? (f.zones as import('@/types/fleet').RestrictedZone[]) : [],
            directives: [],
          }))
        if (normalized.length > 0) setPlaybackFrames(normalized)
      })
      .catch(() => undefined)
  }, [setPlaybackFrames])

  useEffect(() => {
    recorderRef.current.pushSnapshot({
      ships: liveShipsRaw,
      alerts,
      zones,
      directives,
    })
    setPlaybackFrames(recorderRef.current.getFrames())
  }, [liveShipsRaw, alerts, zones, directives, setPlaybackFrames])

  useEffect(() => {
    if (playbackMode) return
    const generated = proximityRef.current.scan(liveShipsRaw)
    for (const a of generated) {
      void fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: a.type,
          severity: a.severity,
          shipId: a.shipId,
          message: a.message,
          metadata: a.metadata,
        }),
      })
    }
  }, [liveShipsRaw, playbackMode])

  useEffect(() => {
    setPlaybackFlag(playbackMode, playbackCursor ?? undefined)
  }, [playbackMode, playbackCursor, setPlaybackFlag])

  const ships = useMemo(() => {
    if (playbackMode) {
      return findFrameAt(playbackFrames, playbackCursor)?.ships ?? []
    }
    return liveShipsRaw.map((ship) => {
      const render = renderShips[ship.id]
      if (!render) return ship
      return {
        ...ship,
        position: render.position,
        heading: render.heading,
        speed: render.speed,
      }
    })
  }, [liveShipsRaw, playbackMode, playbackFrames, playbackCursor, renderShips])

  const selectedShip = ships.find(s => s.id === selectedShipId) ?? null

  const unackedAlerts = alerts.filter(a => !a.acknowledged)

  const liveShips = ships.filter(s => s.status !== 'arrived')
  const cdnMarkers = buildGlobeMarkers(liveShips)

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      
      <AIStatusBar onSelectTab={(tab) => {
        if (tab === 'SHIP') setRightTab('ship')
        else if (tab === 'ALERTS') setRightTab('alerts')
        else if (tab === 'AI ADVISOR') setRightTab('ai')
      }} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — ship list */}
        <div className="w-72 flex flex-col border-r border-slate-800 bg-slate-900">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-[0.16em]">
              Hormuz Command
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {liveShips.length} / 15 active contacts
            </div>
          </div>
          <button
            onClick={handleLogout}
            className='rounded bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700'
          >
            Logout
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              Global Tracking
            </div>
            <div className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              {liveShips.length} LIVE
            </div>
          </div>
          <div className="mx-auto w-52 h-52 overflow-visible bg-transparent">
            <GlobeCdn
              speed={0.003}
              arcs={[]}
              markers={cdnMarkers}
            />
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
        <PlaybackToolbar />
        <FleetMap />
        {unackedAlerts.length > 0 && (
          <div className="absolute top-3 right-3 z-[1000] bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
            {unackedAlerts.length} ALERT{unackedAlerts.length > 1 ? 'S' : ''}
          </div>
        )}
      </div>

      {/* Right panel — tabbed: Ship / Alerts / AI Advisor */}
      <RightPanel
        selectedShip={selectedShip}
        unackedAlerts={unackedAlerts}
        recommendations={recommendations}
        tab={rightTab}
        setTab={setRightTab}
      />

      </div>
    </div>
  )
}

function PlaybackToolbar() {
  const {
    isPlaybackMode,
    isPlaying,
    cursorTimestamp,
    liveNowTimestamp,
    frames,
    enterPlayback,
    exitPlayback,
    setPlaying,
    scrubTo,
  } = usePlaybackStore()

  const min = frames[0]?.timestamp ?? 0
  const max = frames.at(-1)?.timestamp ?? 0

  useEffect(() => {
    if (!isPlaybackMode || !isPlaying) return
    const id = setInterval(() => {
      const cur = usePlaybackStore.getState().cursorTimestamp ?? min
      const next = Math.min(cur + 1000, max)
      usePlaybackStore.getState().scrubTo(next)
      if (next >= max) usePlaybackStore.getState().setPlaying(false)
    }, 1000)
    return () => clearInterval(id)
  }, [isPlaybackMode, isPlaying, min, max])

  return (
    <div className="absolute left-3 right-3 top-3 z-[1001] rounded border border-slate-700 bg-slate-950/90 p-2">
      <div className="flex items-center gap-2 text-xs text-slate-300">
        {!isPlaybackMode ? (
          <button onClick={() => enterPlayback()} className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700">Replay</button>
        ) : (
          <>
            <button onClick={() => setPlaying(!isPlaying)} className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700">
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button onClick={() => exitPlayback()} className="rounded bg-emerald-900/50 px-2 py-1 hover:bg-emerald-800/60">Live</button>
          </>
        )}
        <span className="text-slate-500">
          {isPlaybackMode
            ? `Replay: ${cursorTimestamp ? new Date(cursorTimestamp).toLocaleTimeString() : '--'}`
            : `Live: ${liveNowTimestamp ? new Date(liveNowTimestamp).toLocaleTimeString() : '--'}`}
        </span>
      </div>
      {isPlaybackMode && (
        <input
          type="range"
          min={min}
          max={max}
          value={cursorTimestamp ?? max}
          onChange={(e) => scrubTo(Number(e.target.value))}
          className="mt-2 w-full"
        />
      )}
    </div>
  )
}

function buildGlobeMarkers(ships: import('@/types/fleet').ShipState[]) {
  const groups = new Map<string, import('@/types/fleet').ShipState[]>()

  for (const ship of ships) {
    // Bucket very close positions so ships spawning at same port can be visually separated.
    const key = `${ship.position.lat.toFixed(2)}:${ship.position.lng.toFixed(2)}`
    const list = groups.get(key) ?? []
    list.push(ship)
    groups.set(key, list)
  }

  const result: Array<{ id: string; location: [number, number]; region: string }> = []

  for (const group of groups.values()) {
    group.forEach((ship, index) => {
      const count = group.length
      const angle = (Math.PI * 2 * index) / Math.max(count, 1)
      const radius = count > 1 ? 0.22 + 0.03 * Math.floor(index / 6) : 0
      const latOffset = radius * Math.cos(angle)
      const lngOffset = radius * Math.sin(angle)

      result.push({
        id: ship.id,
        location: [ship.position.lat + latOffset, ship.position.lng + lngOffset],
        region: ship.name,
      })
    })
  }

  return result
}

function ShipListItem({ ship, selected }: { ship: import('@/types/fleet').ShipState, selected: boolean }) {
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
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2
        ${selected
          ? 'bg-slate-800 border-cyan-400'
          : 'bg-transparent border-transparent hover:bg-slate-800/70'}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`} />
      <div className="min-w-0 flex-1">
        <div className={`text-[11px] font-medium tracking-wide uppercase ${selected ? 'text-slate-100' : 'text-slate-200'}`}>
          {ship.name}
        </div>
        <div className="flex justify-between items-center mt-1">
          <div className="text-[10px] text-slate-500 uppercase">
            {ship.id}
          </div>
          <div className="text-[10px] text-slate-400">
            {Math.round(ship.fuelRemaining)}T
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Tabbed right panel ───────────────────────────────────────────────────────

function RightPanel({
  selectedShip,
  unackedAlerts,
  recommendations,
  tab,
  setTab,
}: {
  selectedShip: import('@/types/fleet').ShipState | null
  unackedAlerts: import('@/types/fleet').FleetAlert[]
  recommendations: FleetRecommendation[]
  tab: RightTab
  setTab: (t: RightTab) => void
}) {
  // Auto-switch to ship tab when a ship is selected
  useEffect(() => {
    if (selectedShip) setTab('ship')
  }, [selectedShip?.id])   // eslint-disable-line react-hooks/exhaustive-deps

  const tabBtn = (id: RightTab, label: string, badge?: number) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 py-2 text-[10px] font-bold tracking-[0.12em] uppercase transition-colors border-b-2
        ${tab === id
          ? 'border-cyan-400 text-cyan-400 bg-slate-900'
          : 'border-transparent text-slate-500 hover:text-slate-300 bg-slate-950/60'}`}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-1 px-1 py-0.5 rounded-full bg-red-600 text-[8px] text-white font-bold align-middle">
          {badge}
        </span>
      )}
    </button>
  )

  return (
    <div className="w-80 flex flex-col border-l border-slate-800 bg-slate-900 overflow-hidden">
      {/* Tab bar */}
      <div className="flex flex-shrink-0 border-b border-slate-800 bg-slate-950/80">
        {tabBtn('ship',   'SHIP',    undefined)}
        {tabBtn('alerts', 'ALERTS',  unackedAlerts.length || undefined)}
        {tabBtn('ai',     'AI ADVISOR', undefined)}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'ship' && (
          selectedShip
            ? <ShipSidebar ship={selectedShip} />
            : (
              <div className="flex h-full items-center justify-center text-slate-600 text-xs tracking-wide">
                Select a vessel on the map
              </div>
            )
        )}

        {tab === 'alerts' && (
          <div className="flex flex-col h-full overflow-y-auto">
            <div className="flex-1">
              <AlertPanel alerts={unackedAlerts} />
            </div>
            {recommendations.length > 0 && (
              <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex-shrink-0">
                <div className="text-[10px] font-semibold text-cyan-400 mb-3 tracking-[0.16em] uppercase flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  System Recommendations
                </div>
                <div className="space-y-3">
                  {recommendations.map(r => (
                    <div key={r.id} className="border border-cyan-900/50 bg-cyan-950/20 p-3 rounded">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono font-bold text-cyan-300 text-[11px]">{r.shipId}</span>
                        <span className="font-mono text-cyan-500 text-[9px]">{r.confidenceScore}% CONF</span>
                      </div>
                      <div className="text-slate-200 text-xs leading-relaxed mb-2">{r.rationale}</div>
                      <div className="text-[10px] text-cyan-400/80 uppercase tracking-wide">
                        ▸ {r.type.replace(/_/g, ' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'ai' && <AIChatPanel />}
      </div>
    </div>
  )
}
