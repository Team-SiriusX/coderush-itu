import { EngineShip } from '@/engine/types'
import { weatherEngine } from '../weather/weather-engine'

/**
 * Evaluates the risk of a given route based on weather and other factors.
 */
export function evaluateRouteRisk(ship: EngineShip): number {
  if (!ship.route || ship.route.waypoints.length === 0) return 0
  
  let riskScore = 0
  for (const wp of ship.route.waypoints) {
    const severity = weatherEngine.getSeverityAt(wp.lat, wp.lng)
    if (severity === 'EXTREME') riskScore += 50
    else if (severity === 'SEVERE') riskScore += 20
    else if (severity === 'MODERATE') riskScore += 5
  }
  
  return riskScore
}
