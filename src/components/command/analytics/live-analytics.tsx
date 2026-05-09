'use client'

import { useMemo } from 'react'
import { useFleetStore } from '@/stores/fleet-store'
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { format, subMinutes } from 'date-fns'

function FleetStatusDonut() {
  const ships = useFleetStore(s => s.ships)

  const data = useMemo(() => {
    const counts = { NORMAL: 0, REROUTING: 0, DISTRESSED: 0, STRANDED: 0 }
    ships.forEach(s => {
      const stat = s.status.toUpperCase() as keyof typeof counts
      if (counts[stat] !== undefined) counts[stat]++
    })
    return [
      { name: 'NORMAL', value: counts.NORMAL, fill: 'hsl(var(--chart-1))' },
      { name: 'REROUTING', value: counts.REROUTING, fill: 'hsl(var(--chart-2))' },
      { name: 'DISTRESSED', value: counts.DISTRESSED, fill: 'hsl(var(--chart-3))' },
      { name: 'STRANDED', value: counts.STRANDED, fill: 'hsl(var(--chart-4))' },
    ].filter(d => d.value > 0)
  }, [ships])

  return (
    <div className="bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 flex flex-col relative h-[200px] transition-all hover:shadow-md">
      <div className="text-[10px] font-mono font-semibold tracking-wider text-slate-400 uppercase mb-2">Fleet Status</div>
      {ships.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">No data available</div>
      ) : (
        <ChartContainer config={{}} className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
      {ships.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-slate-800">{ships.length}</div>
            <div className="text-[9px] text-slate-500 uppercase">Ships</div>
          </div>
        </div>
      )}
    </div>
  )
}

function AlertVolumeChart() {
  const alerts = useFleetStore(s => s.alerts)

  const data = useMemo(() => {
    const now = Date.now()
    const bins = Array.from({ length: 30 }, (_, i) => {
      const d = subMinutes(now, 29 - i)
      return { time: d.getTime(), label: format(d, 'HH:mm'), count: 0 }
    })

    alerts.forEach(a => {
      const idx = bins.findIndex(b => Math.abs(b.time - a.createdAt) < 60000)
      if (idx !== -1) bins[idx].count++
    })

    return bins
  }, [alerts])

  return (
    <div className="bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 flex flex-col h-[200px] transition-all hover:shadow-md">
      <div className="text-[10px] font-mono font-semibold tracking-wider text-slate-400 uppercase mb-2">Alert Volume (30m)</div>
      {alerts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">No data available</div>
      ) : (
        <ChartContainer config={{}} className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="alertGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                fontSize={10} 
                tickMargin={8}
                interval={4} 
                tick={{ fill: '#64748b' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                fontSize={10}
                tickFormatter={(v) => v === 0 ? '' : v}
                tick={{ fill: '#64748b' }}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#alertGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </div>
  )
}

function FuelLevelsChart() {
  const ships = useFleetStore(s => s.ships)

  const data = useMemo(() => {
    return [...ships]
      .sort((a, b) => a.fuelRemaining - b.fuelRemaining)
      .slice(0, 8) // bottom 8
      .map(s => ({
        name: s.name.substring(0, 10),
        fuel: s.fuelRemaining,
        fill: s.fuelRemaining < 20 ? 'hsl(var(--chart-3))' : s.fuelRemaining <= 50 ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-1))'
      }))
  }, [ships])

  return (
    <div className="bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 flex flex-col h-[200px] transition-all hover:shadow-md">
      <div className="text-[10px] font-mono font-semibold tracking-wider text-slate-400 uppercase mb-2">Lowest Fuel Levels</div>
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">No data available</div>
      ) : (
        <ChartContainer config={{}} className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis 
                type="number" 
                domain={[0, 100]} 
                axisLine={false} 
                tickLine={false} 
                fontSize={10}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: '#64748b' }}
              />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                fontSize={10}
                width={60}
                tick={{ fill: '#64748b' }}
              />
              <ChartTooltip cursor={{ fill: 'transparent' }} content={<ChartTooltipContent />} />
              <Bar dataKey="fuel" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </div>
  )
}

function KpiTiles() {
  const ships = useFleetStore(s => s.ships)
  const alerts = useFleetStore(s => s.alerts)
  const zones = useFleetStore(s => s.zones)

  const activeAlerts = alerts.filter(a => !a.acknowledged).length
  const shipsAtRisk = ships.filter(s => s.fuelRemaining < 20).length
  const avgFuel = ships.length > 0 ? Math.round(ships.reduce((acc, s) => acc + s.fuelRemaining, 0) / ships.length) : 0
  const restrictedZones = zones.filter(z => z.active).length

  // Trend for active alerts
  const recentAlerts = alerts.slice(-10)
  const last5 = recentAlerts.slice(-5).filter(a => !a.acknowledged).length
  const prev5 = recentAlerts.slice(0, 5).filter(a => !a.acknowledged).length
  const trend = last5 > prev5 ? 'up' : last5 < prev5 ? 'down' : 'stable'

  return (
    <div className="grid grid-cols-2 gap-4 h-[200px]">
      <div className="bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 flex flex-col justify-center transition-all hover:shadow-md hover:border-red-200">
        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Active Alerts</div>
        <div className="flex items-baseline gap-2">
          <div className="text-4xl font-bold font-mono text-slate-800">{activeAlerts}</div>
          {trend === 'up' && <span className="text-red-500 text-xs font-bold bg-red-50 px-1.5 py-0.5 rounded">↑</span>}
          {trend === 'down' && <span className="text-emerald-500 text-xs font-bold bg-emerald-50 px-1.5 py-0.5 rounded">↓</span>}
        </div>
        <div className="text-[10px] text-slate-400 uppercase mt-1">Unacknowledged</div>
      </div>
      
      <div className="bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 flex flex-col justify-center transition-all hover:shadow-md hover:border-amber-200">
        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Ships at Risk</div>
        <div className="text-4xl font-bold font-mono text-amber-600">{shipsAtRisk}</div>
        <div className="text-[10px] text-slate-400 uppercase mt-1">Fuel &lt; 20%</div>
      </div>

      <div className="bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 flex flex-col justify-center transition-all hover:shadow-md">
        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Avg Fuel</div>
        <div className="text-4xl font-bold font-mono text-slate-800">{avgFuel}%</div>
        <div className="text-[10px] text-slate-400 uppercase mt-1">Fleet average</div>
      </div>

      <div className="bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 flex flex-col justify-center transition-all hover:shadow-md hover:border-blue-200">
        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Zones Active</div>
        <div className="text-4xl font-bold font-mono text-slate-800">{restrictedZones}</div>
        <div className="text-[10px] text-slate-400 uppercase mt-1">Restricted</div>
      </div>
    </div>
  )
}

export function LiveAnalytics() {
  return (
    <section className="p-8 pb-12 border-t border-slate-200/50 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.03)] relative z-20">
      <h2 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        Live Fleet Analytics
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <FleetStatusDonut />
        <AlertVolumeChart />
        <FuelLevelsChart />
        <KpiTiles />
      </div>
    </section>
  )
}
