import { INITIAL_SHIPS, PORTS, getPort } from '@/simulation/fleet-data'
import type { EngineShip, LatLng, ShipRoute } from './types'

// Fuel capacity is set to the initial fuel for each ship (it serves as max)
// We don't reset fuel — this is the starting value from the dataset
function buildRoute(destinationPos: LatLng): ShipRoute {
  // Direct route: no intermediate waypoints for now.
  // The physics engine steers the ship toward the destination directly.
  return {
    waypoints:  [destinationPos],
    currentIdx: 0,
  }
}

/**
 * Load and normalize the canonical 15-ship fleet from fleet-data.ts.
 * Returns an array of EngineShip objects ready for the simulation loop.
 * The backend never fetches state from the frontend — this is the authority.
 */
export function loadInitialFleet(): EngineShip[] {
  return INITIAL_SHIPS.map((ship) => {
    const port = getPort(ship.destinationPortId)
    if (!port) {
      throw new Error(`[fleet-loader] Unknown destination port: ${ship.destinationPortId}`)
    }

    const destinationPos: LatLng = { lat: port.position.lat, lng: port.position.lng }
    const position: LatLng       = { lat: ship.position.lat, lng: ship.position.lng }

    return {
      id:                ship.id,
      name:              ship.name,
      position,
      previousPosition:  { ...position },       // starts at same as current
      heading:           ship.heading,
      speed:             ship.speed,
      baseSpeed:         ship.speed,
      destinationPortId: ship.destinationPortId,
      destinationPos,
      fuelRemaining:     ship.fuelRemaining,
      fuelCapacity:      Math.max(ship.fuelRemaining, 8500), // at least 8500t capacity
      cargo:             ship.cargo,
      status:            'NORMAL' as const,
      route:             buildRoute(destinationPos),
      weatherPenalty:    ship.weatherPenalty,
      arrivedAt:         null,
      lowFuelAlertSent:  false,
      outOfFuelAlertSent: false,
      lastUpdated:       Date.now(),
    } satisfies EngineShip
  })
}

/**
 * Get all known ports as a lookup map for fast access.
 */
export function buildPortLookup(): Map<string, LatLng> {
  const map = new Map<string, LatLng>()
  for (const port of PORTS) {
    map.set(port.id, { lat: port.position.lat, lng: port.position.lng })
  }
  return map
}
