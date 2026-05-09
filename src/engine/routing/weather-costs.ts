import type { GridNode } from './types'

/**
 * Placeholder hook for future weather integration.
 * Currently returns 1.0 (normal cost).
 * When weather is implemented, return > 1.0 for bad weather cells.
 */
export function weatherCost(node: GridNode): number {
  return 1.0 // Normal cost
}
