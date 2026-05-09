import { EngineShip } from '@/engine/types'
import { distanceNm } from '@/engine/ship-physics'

/**
 * Calculates Estimated Time of Arrival (ETA) in milliseconds from now.
 */
export function calculateETA(ship: EngineShip): number | null {
  if (ship.status === 'ARRIVED') return 0
  if (ship.speed <= 0) return null // Cannot estimate if stopped

  let routeDist = 0
  if (ship.route && ship.route.waypoints.length > 0) {
    let current = ship.position
    for (let i = ship.route.currentIdx; i < ship.route.waypoints.length; i++) {
      const wp = ship.route.waypoints[i]
      routeDist += distanceNm(current, wp)
      current = wp
    }
  } else {
    routeDist = distanceNm(ship.position, ship.destinationPos)
  }

  // routeDist in nautical miles, speed in knots (nm per hour)
  const hours = routeDist / ship.speed
  const ms = hours * 60 * 60 * 1000

  return ms
}
