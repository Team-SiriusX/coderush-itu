import type { EngineShip, SimulationTickResult, PendingAlert } from './types'
import { computeMovement } from './ship-physics'
import { computeFuel } from './fuel-engine'
import { computeStatus } from './status-engine'
import { loadInitialFleet } from './fleet-loader'
import { broadcastFleet, broadcastAlerts } from './realtime-broadcaster'
import { routingEngine } from './routing/routing-engine'
import { zoneEngine } from './routing/zone-engine'
import { weatherEngine } from '@/systems/weather/weather-engine'
import { generatePredictiveAlerts } from '@/systems/prediction/predictive-alerts'
import db from '@/lib/db'

/** Default tick interval in milliseconds */
const DEFAULT_TICK_INTERVAL_MS = 1000

/**
 * SimulationEngine — singleton class managing the live fleet.
 *
 * Architecture:
 *  - Holds all 15 ships in memory (authoritative state)
 *  - Runs a stable setInterval (not recursive setTimeout)
 *  - Each tick: physics → fuel → status → broadcast
 *  - Exposes methods for external state mutation (directives, distress)
 */
class SimulationEngine {
  private ships:      Map<string, EngineShip> = new Map()
  private intervalId: ReturnType<typeof setInterval> | null = null
  private tickMs:     number = DEFAULT_TICK_INTERVAL_MS
  private running:    boolean = false
  private tickCount:  number = 0
  private forceRecomputeRoutes: boolean = false

  constructor() {
    zoneEngine.onZonesChanged(() => {
      this.forceRecomputeRoutes = true
    })
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(tickIntervalMs = DEFAULT_TICK_INTERVAL_MS): void {
    if (this.running) {
      console.log('[engine] Already running — ignoring duplicate start()')
      return
    }

    this.tickMs  = tickIntervalMs
    this.ships   = new Map(loadInitialFleet().map((s) => [s.id, s]))
    this.running = true

    // Load zones from DB and initialize routing
    db.restrictedZone.findMany({ where: { active: true } }).then((zones) => {
      const restrictedPolygons = zones.map(z => {
        const geom = z.geometry as any
        return {
          id: z.id,
          name: z.name,
          ring: geom.coordinates as [number, number][]
        }
      })
      routingEngine.init(restrictedPolygons)
      this.forceRecomputeRoutes = true // initial compute
    }).catch(e => console.error('[engine] Failed to load zones', e))

    weatherEngine.init()

    console.log(`[engine] Starting simulation — ${this.ships.size} ships, tick ${tickIntervalMs}ms`)

    // Stable interval — NOT recursive setTimeout
    this.intervalId = setInterval(() => {
      this.tick().catch((err) => {
        console.error('[engine] Tick error:', err)
      })
    }, this.tickMs)
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    weatherEngine.stop()
    this.running = false
    console.log(`[engine] Stopped after ${this.tickCount} ticks`)
  }

  isRunning(): boolean {
    return this.running
  }

  // ── Core tick ─────────────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    const tickStart = Date.now()
    this.tickCount++

    const allAlerts: PendingAlert[] = []

    for (const [id, ship] of this.ships) {
      const updated = this.processShip(ship)
      this.ships.set(id, updated.ship)
      allAlerts.push(...updated.alerts)
    }

    this.forceRecomputeRoutes = false

    const ships = Array.from(this.ships.values())

    // Broadcast fleet state + alerts in parallel (non-blocking to next tick)
    await Promise.allSettled([
      broadcastFleet(ships),
      broadcastAlerts(allAlerts),
    ])

    const elapsed = Date.now() - tickStart
    if (elapsed > this.tickMs * 0.8) {
      console.warn(`[engine] Tick ${this.tickCount} took ${elapsed}ms (>${this.tickMs * 0.8}ms budget)`)
    }
  }

  // ── Per-ship processing ───────────────────────────────────────────────────

  private processShip(ship: EngineShip): { ship: EngineShip; alerts: PendingAlert[] } {
    const alerts: PendingAlert[] = []
    let currentShip = { ...ship }

    // Check Geofence breach (inside zone)
    const isInsideZone = routingEngine.isInsideZone(currentShip.position)
    if (isInsideZone && currentShip.status !== 'REROUTING' && currentShip.status !== 'STRANDED') {
      currentShip.status = 'REROUTING'
      alerts.push({
        shipId: currentShip.id,
        type: 'DISTRESS_SIGNAL', // Geofence breach
        severity: 'CRITICAL',
        message: `GEOFENCE BREACH: ${currentShip.name} is currently inside a restricted zone!`
      })
      // Force recompute to find escape path
      currentShip.route = null 
    }

    // Check if route is invalid
    let needsRecompute = this.forceRecomputeRoutes || !currentShip.route
    if (!needsRecompute && currentShip.route) {
      const remainingWaypoints = currentShip.route.waypoints.slice(currentShip.route.currentIdx)
      if (routingEngine.isRouteInvalid(remainingWaypoints)) {
        needsRecompute = true
      }
    }

    // Recompute route if needed
    if (needsRecompute && currentShip.status !== 'STRANDED' && currentShip.status !== 'STOPPED' && currentShip.status !== 'ARRIVED' && currentShip.status !== 'OUT_OF_FUEL') {
      const result = routingEngine.computeRoute(currentShip.position, currentShip.destinationPos)
      if (result.success) {
        currentShip.route = { waypoints: result.path.waypoints, currentIdx: 0 }
        if (currentShip.status === 'REROUTING' && !isInsideZone) {
          // If we successfully rerouted and are not inside a zone, we can optionally restore status
          // Or wait for directives, but let's assume successful reroute keeps normal.
          currentShip.status = 'NORMAL'
          currentShip.speed = currentShip.baseSpeed
        }
      } else {
        // Stranded logic
        currentShip.status = 'STRANDED'
        currentShip.speed = 0
        currentShip.route = null
        alerts.push({
          shipId: currentShip.id,
          type: 'DISTRESS_SIGNAL',
          severity: 'CRITICAL',
          message: `STRANDED: ${currentShip.name} cannot find a valid route. Reason: ${result.reason}`
        })
      }
    }

    // 1. Physics — advance position, heading, route
    const movement = computeMovement(currentShip, this.tickMs)

    // Query weather at new position
    const weatherSeverity = weatherEngine.getSeverityAt(movement.newPosition.lat, movement.newPosition.lng)
    const weatherPenalty = weatherSeverity !== 'LOW'

    // 2. Fuel — burn based on distance travelled
    const fuel = computeFuel(
      ship.fuelRemaining,
      ship.speed,
      movement.distanceTravelledNm,
      weatherSeverity,
    )

    // 3. Status — derive new status from fuel & arrival
    const { status, pendingAlerts, lowFuelAlertSent, outOfFuelAlertSent } = computeStatus(
      ship,
      fuel.remaining,
      movement.arrived,
    )

    // 4. Speed adjustment for out-of-fuel or stranded ships
    const speed = (status === 'OUT_OF_FUEL' || status === 'STRANDED') ? 0 : currentShip.speed

    const updatedShip: EngineShip = {
      ...currentShip,
      previousPosition:   currentShip.position,   // snapshot for client interpolation
      position:           movement.newPosition,
      heading:            movement.newHeading,
      speed,
      fuelRemaining:      fuel.remaining,
      status,
      route:              movement.updatedRoute,
      weatherPenalty,
      weatherSeverity,
      arrivedAt:          movement.arrived && !currentShip.arrivedAt ? Date.now() : currentShip.arrivedAt,
      lowFuelAlertSent,
      outOfFuelAlertSent,
      lastUpdated:        Date.now(),
    }

    const predictiveAlerts = generatePredictiveAlerts(updatedShip)

    return { ship: updatedShip, alerts: [...alerts, ...pendingAlerts, ...predictiveAlerts] }
  }

  // ── External mutation (called by API route handlers) ─────────────────────

  /**
   * Apply a directive to a ship. Called by the directives controller.
   */
  applyDirective(
    shipId: string,
    type:   'HOLD' | 'REROUTE' | 'DIVERT' | 'RETURN_TO_PORT',
  ): boolean {
    const ship = this.ships.get(shipId)
    if (!ship) return false

    let updated: EngineShip

    switch (type) {
      case 'HOLD':
        updated = { ...ship, speed: 0, status: 'STOPPED' }
        break

      case 'REROUTE':
      case 'DIVERT':
        updated = { ...ship, status: 'REROUTING', speed: Math.max(6, ship.baseSpeed * 0.6), route: null }
        break

      case 'RETURN_TO_PORT':
        updated = { ...ship, status: 'NORMAL', speed: ship.baseSpeed, route: null }
        break

      default:
        return false
    }

    this.ships.set(shipId, { ...updated, lastUpdated: Date.now() })
    return true
  }

  /**
   * Mark a ship as DISTRESSED. Called when distress message is received.
   */
  markDistressed(shipId: string): boolean {
    const ship = this.ships.get(shipId)
    if (!ship) return false
    this.ships.set(shipId, {
      ...ship,
      status:      'DISTRESSED',
      speed:       Math.max(4, ship.speed * 0.5),
      lastUpdated: Date.now(),
    })
    return true
  }

  /**
   * Get a snapshot of all current ship states (for REST endpoints).
   */
  getShips(): EngineShip[] {
    return Array.from(this.ships.values())
  }

  getShip(id: string): EngineShip | undefined {
    return this.ships.get(id)
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
// Module-level singleton — one instance across the Node.js process lifetime.
// The global guard protects against hot-reload creating duplicate engines.

const GLOBAL_KEY = '__hormuz_simulation_engine__'

type GlobalWithEngine = typeof globalThis & {
  [GLOBAL_KEY]?: SimulationEngine
}

function getEngine(): SimulationEngine {
  const g = globalThis as GlobalWithEngine
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new SimulationEngine()
  }
  return g[GLOBAL_KEY]
}

export const simulationEngine = getEngine()
