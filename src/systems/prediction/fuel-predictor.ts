import { EngineShip } from '@/engine/types'
import { distanceNm } from '@/engine/ship-physics'
import { weatherEngine } from '@/systems/weather/weather-engine'

export function predictFuelAtDestination(ship: EngineShip): {
  fuelRemainingAtDest: number
  willRunOut: boolean
  fuelDeficit: number
} {
  if (ship.status === 'ARRIVED') {
    return { fuelRemainingAtDest: ship.fuelRemaining, willRunOut: false, fuelDeficit: 0 }
  }

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

  const baseBurnRate = 0.417
  const speed = ship.speed > 0 ? ship.speed : ship.baseSpeed
  const base = 12
  const excess = Math.max(0, speed - base)
  const speedMult = 1 + excess * 0.05
  
  // Use current severity as an approximation for the journey
  const currentSeverity = weatherEngine.getSeverityAt(ship.position.lat, ship.position.lng)
  let penalty = 1.0
  if (currentSeverity === 'MODERATE') penalty = 1.15
  else if (currentSeverity === 'SEVERE') penalty = 1.30
  else if (currentSeverity === 'EXTREME') penalty = 1.50

  const burnRate = baseBurnRate * speedMult * penalty
  
  const consumed = burnRate * routeDist
  const remaining = ship.fuelRemaining - consumed

  return {
    fuelRemainingAtDest: Math.max(0, remaining),
    willRunOut: remaining <= 0,
    fuelDeficit: remaining < 0 ? Math.abs(remaining) : 0
  }
}
