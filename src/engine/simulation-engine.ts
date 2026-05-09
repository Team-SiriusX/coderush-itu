import type { EngineShip, SimulationTickResult, PendingAlert } from './types'
import { computeMovement } from './ship-physics'
import { computeFuel } from './fuel-engine'
import { computeStatus } from './status-engine'
import { loadInitialFleet } from './fleet-loader'
import { broadcastFleet, broadcastAlerts } from './realtime-broadcaster'

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

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(tickIntervalMs = DEFAULT_TICK_INTERVAL_MS): void {
    if (this.running) {
      console.log('[engine] Already running — ignoring duplicate start()')
      return
    }

    this.tickMs  = tickIntervalMs
    this.ships   = new Map(loadInitialFleet().map((s) => [s.id, s]))
    this.running = true

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
    // 1. Physics — advance position, heading, route
    const movement = computeMovement(ship, this.tickMs)

    // 2. Fuel — burn based on distance travelled
    const fuel = computeFuel(
      ship.fuelRemaining,
      ship.speed,
      movement.distanceTravelledNm,
      ship.weatherPenalty,
    )

    // 3. Status — derive new status from fuel & arrival
    const { status, pendingAlerts, lowFuelAlertSent, outOfFuelAlertSent } = computeStatus(
      ship,
      fuel.remaining,
      movement.arrived,
    )

    // 4. Speed adjustment for out-of-fuel ships
    const speed = status === 'OUT_OF_FUEL' ? 0 : ship.speed

    const updatedShip: EngineShip = {
      ...ship,
      previousPosition:   ship.position,   // snapshot for client interpolation
      position:           movement.newPosition,
      heading:            movement.newHeading,
      speed,
      fuelRemaining:      fuel.remaining,
      status,
      route:              movement.updatedRoute,
      arrivedAt:          movement.arrived && !ship.arrivedAt ? Date.now() : ship.arrivedAt,
      lowFuelAlertSent,
      outOfFuelAlertSent,
      lastUpdated:        Date.now(),
    }

    return { ship: updatedShip, alerts: pendingAlerts }
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
        // Mark for rerouting — in a full implementation, new waypoints would be injected here
        updated = { ...ship, status: 'REROUTING', speed: Math.max(6, ship.baseSpeed * 0.6) }
        break

      case 'RETURN_TO_PORT':
        // Resume normal speed, status back to normal (destination unchanged)
        updated = { ...ship, status: 'NORMAL', speed: ship.baseSpeed }
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
