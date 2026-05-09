import type { GridNode } from './types'
import { weatherEngine } from '@/systems/weather/weather-engine'

/**
 * Returns traversal cost multiplier for a node based on weather.
 * Used by A* routing algorithm.
 */
export function weatherCost(node: GridNode): number {
  const severity = weatherEngine.getSeverityAt(node.lat, node.lng)
  switch (severity) {
    case 'EXTREME': return 5.0
    case 'SEVERE': return 3.0
    case 'MODERATE': return 1.5
    default: return 1.0
  }
}
