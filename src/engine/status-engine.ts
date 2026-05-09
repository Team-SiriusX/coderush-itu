import type { EngineShip, EngineShipStatus, PendingAlert } from './types'
import { distanceNm } from './ship-physics'
import { estimatedRangeNm } from './fuel-engine'

/** Fuel % at which a LOW_FUEL alert is triggered */
const LOW_FUEL_THRESHOLD_PCT = 0.20

/**
 * Compute the authoritative operational status for a ship after a tick.
 * Pure function — does NOT mutate.
 *
 * Also produces any PendingAlerts that should be fired this tick.
 */
export function computeStatus(
  ship:           EngineShip,
  fuelRemaining:  number,
  arrived:        boolean,
): {
  status:         EngineShipStatus
  pendingAlerts:  PendingAlert[]
  lowFuelAlertSent:  boolean
  outOfFuelAlertSent: boolean
} {
  const alerts: PendingAlert[] = []
  let { lowFuelAlertSent, outOfFuelAlertSent } = ship

  // ── Priority 1: ARRIVED ──────────────────────────────────────────────────
  if (arrived || ship.status === 'ARRIVED') {
    if (ship.status !== 'ARRIVED') {
      alerts.push({
        shipId:   ship.id,
        type:     'ARRIVED',
        severity: 'LOW',
        message:  `${ship.name} has arrived at destination port.`,
      })
    }
    return { status: 'ARRIVED', pendingAlerts: alerts, lowFuelAlertSent, outOfFuelAlertSent }
  }

  // ── Priority 2: OUT_OF_FUEL ──────────────────────────────────────────────
  if (fuelRemaining <= 0) {
    if (!outOfFuelAlertSent) {
      alerts.push({
        shipId:   ship.id,
        type:     'OUT_OF_FUEL',
        severity: 'CRITICAL',
        message:  `MAYDAY — ${ship.name} has run out of fuel at ${ship.position.lat.toFixed(3)}°N ${ship.position.lng.toFixed(3)}°E`,
      })
      outOfFuelAlertSent = true
    }
    return { status: 'OUT_OF_FUEL', pendingAlerts: alerts, lowFuelAlertSent, outOfFuelAlertSent }
  }

  // ── Priority 3: DISTRESSED (preserve externally set status) ─────────────
  if (ship.status === 'DISTRESSED' || ship.status === 'STRANDED' || ship.status === 'STOPPED') {
    // These statuses are set externally (by directives/distress API).
    // Engine preserves them and does not auto-clear.
    return { status: ship.status, pendingAlerts: alerts, lowFuelAlertSent, outOfFuelAlertSent }
  }

  // ── Priority 4: LOW FUEL WARNING ────────────────────────────────────────
  const fuelPct = fuelRemaining / ship.fuelCapacity
  if (fuelPct < LOW_FUEL_THRESHOLD_PCT && !lowFuelAlertSent) {
    // Check if ship can make it on remaining fuel
    const rangePct    = estimatedRangeNm(fuelRemaining, ship.speed, ship.weatherPenalty)
    const distToDest  = distanceNm(ship.position, ship.destinationPos)
    const willMakeIt  = rangePct >= distToDest

    alerts.push({
      shipId:   ship.id,
      type:     'LOW_FUEL',
      severity: willMakeIt ? 'MEDIUM' : 'HIGH',
      message:  willMakeIt
        ? `${ship.name} fuel low (${Math.round(fuelPct * 100)}%) but estimated to reach destination.`
        : `${ship.name} fuel critically low (${Math.round(fuelPct * 100)}%) — MAY NOT REACH DESTINATION. Range: ${Math.round(rangePct)}nm, distance: ${Math.round(distToDest)}nm.`,
    })
    lowFuelAlertSent = true

    // Mark insufficient_fuel in engine status (maps to frontend 'insufficient_fuel')
    return {
      status:     'REROUTING',  // Trigger rerouting consideration
      pendingAlerts: alerts,
      lowFuelAlertSent,
      outOfFuelAlertSent,
    }
  }

  // ── Default: NORMAL or REROUTING (preserve if already set externally) ────
  const status: EngineShipStatus = ship.status === 'REROUTING' ? 'REROUTING' : 'NORMAL'
  return { status, pendingAlerts: alerts, lowFuelAlertSent, outOfFuelAlertSent }
}

/**
 * Map engine status to the lowercase frontend ShipStatus strings.
 * The frontend type uses lowercase snake_case.
 */
export function mapStatusToFrontend(status: EngineShipStatus): string {
  const map: Record<EngineShipStatus, string> = {
    NORMAL:      'normal',
    REROUTING:   'rerouting',
    DISTRESSED:  'distressed',
    STOPPED:     'stopped',
    STRANDED:    'stranded',
    OUT_OF_FUEL: 'insufficient_fuel',
    ARRIVED:     'arrived',
  }
  return map[status]
}
