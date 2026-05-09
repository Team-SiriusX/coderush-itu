import * as turf from '@turf/turf'
import type { LatLng, EngineShip, ShipRoute } from './types'

/** Knots → metres per second */
const KNOTS_TO_MPS = 0.514444

/** Maximum heading change per second (degrees/s) — plausible for a large vessel */
const MAX_TURN_RATE_DEG_PER_SEC = 3.0

/** Arrival threshold in nautical miles — considered "docked" */
export const ARRIVAL_THRESHOLD_NM = 1.5

/**
 * Compute the distance in nautical miles travelled in `tickMs` at `speedKnots`.
 * distance (nm) = speed (knots) × time (hours)
 */
export function travelDistanceNm(speedKnots: number, tickMs: number): number {
  const hours = tickMs / 3_600_000
  return speedKnots * hours
}

/**
 * Advance a position by `distanceNm` nautical miles along `bearingDeg`.
 * Uses turf.destination (Vincenty ellipsoidal formula).
 * Returns the new position as LatLng.
 */
export function advancePosition(
  current: LatLng,
  bearingDeg: number,
  distanceNm: number,
): LatLng {
  // turf.destination takes [lng, lat], distance in km, bearing in degrees
  const distanceKm = distanceNm * 1.852
  const point      = turf.destination(
    turf.point([current.lng, current.lat]),
    distanceKm,
    bearingDeg,
    { units: 'kilometers' },
  )
  const [lng, lat] = point.geometry.coordinates
  return { lat, lng }
}

/**
 * Compute the great-circle bearing (degrees) from `from` to `to`.
 * Range: 0–360 (North = 0).
 */
export function bearingTo(from: LatLng, to: LatLng): number {
  const raw = turf.bearing(
    turf.point([from.lng, from.lat]),
    turf.point([to.lng, to.lat]),
  )
  // turf.bearing returns -180 to 180; normalise to 0-360
  return (raw + 360) % 360
}

/**
 * Distance in nautical miles between two positions.
 */
export function distanceNm(from: LatLng, to: LatLng): number {
  const km = turf.distance(
    turf.point([from.lng, from.lat]),
    turf.point([to.lng, to.lat]),
    { units: 'kilometers' },
  )
  return km / 1.852
}

/**
 * Smoothly rotate `currentHeading` toward `targetHeading` respecting max turn rate.
 * Chooses the shortest angular path (handles 359° → 1° correctly).
 */
export function smoothHeading(
  currentHeading: number,
  targetHeading:  number,
  tickMs:         number,
): number {
  const maxTurn = MAX_TURN_RATE_DEG_PER_SEC * (tickMs / 1000)

  let delta = ((targetHeading - currentHeading + 540) % 360) - 180  // −180..+180
  delta = Math.max(-maxTurn, Math.min(maxTurn, delta))

  return (currentHeading + delta + 360) % 360
}

/**
 * Advance the ship's route: if the ship is close to the current waypoint,
 * advance to the next one. Returns the (possibly updated) route.
 */
export function advanceRoute(
  position: LatLng,
  route:    ShipRoute,
): ShipRoute {
  const wp = route.waypoints[route.currentIdx]
  if (!wp) return route

  const dist = distanceNm(position, wp)
  if (dist < ARRIVAL_THRESHOLD_NM && route.currentIdx < route.waypoints.length - 1) {
    return { ...route, currentIdx: route.currentIdx + 1 }
  }
  return route
}

/**
 * Compute the full physics step for one ship in one tick.
 * Pure function — does NOT mutate the input ship.
 *
 * Returns:
 *  - newPosition
 *  - newHeading
 *  - distanceTravelledNm
 *  - updatedRoute
 *  - arrived (boolean)
 */
export function computeMovement(
  ship:   EngineShip,
  tickMs: number,
): {
  newPosition:        LatLng
  newHeading:         number
  distanceTravelledNm: number
  updatedRoute:       ShipRoute | null
  arrived:            boolean
} {
  // Ships that are stopped / out of fuel / arrived don't move
  if (
    ship.status === 'ARRIVED'    ||
    ship.status === 'OUT_OF_FUEL' ||
    ship.status === 'STOPPED'    ||
    ship.status === 'STRANDED'
  ) {
    return {
      newPosition:        ship.position,
      newHeading:         ship.heading,
      distanceTravelledNm: 0,
      updatedRoute:       ship.route,
      arrived:            ship.status === 'ARRIVED',
    }
  }

  // Determine target waypoint
  const route      = ship.route
  const targetPos  = route
    ? (route.waypoints[route.currentIdx] ?? ship.destinationPos)
    : ship.destinationPos

  // Check if already at destination
  const distToDest = distanceNm(ship.position, ship.destinationPos)
  if (distToDest < ARRIVAL_THRESHOLD_NM) {
    return {
      newPosition:        ship.destinationPos,
      newHeading:         ship.heading,
      distanceTravelledNm: 0,
      updatedRoute:       ship.route,
      arrived:            true,
    }
  }

  // Compute target heading toward current waypoint
  const targetHeading = bearingTo(ship.position, targetPos)

  // Smooth turn toward target (capped by max turn rate)
  const newHeading = smoothHeading(ship.heading, targetHeading, tickMs)

  // Travel distance this tick
  const travelNm = travelDistanceNm(ship.speed, tickMs)

  // Advance position along current (smoothed) heading
  const newPosition = advancePosition(ship.position, newHeading, travelNm)

  // Advance route waypoint if applicable
  const updatedRoute = route ? advanceRoute(newPosition, route) : null

  return {
    newPosition,
    newHeading,
    distanceTravelledNm: travelNm,
    updatedRoute,
    arrived: false,
  }
}
