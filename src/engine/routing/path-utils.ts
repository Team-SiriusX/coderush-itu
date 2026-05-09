import * as turf from '@turf/turf'
import type { LatLng, RoutePath } from './types'

export function distanceNm(from: LatLng, to: LatLng): number {
  const km = turf.distance(
    turf.point([from.lng, from.lat]),
    turf.point([to.lng, to.lat]),
    { units: 'kilometers' }
  )
  return km / 1.852
}

/**
 * Validates if there's a clear line of sight between two points without hitting blocked nodes/zones.
 * Actually we can just use routeValidator line intersecting zones/navigable bounds, but here
 * we'll assume a provided check function `hasLineOfSight(from, to)`.
 */
export function smoothPath(
  path: LatLng[],
  hasLineOfSight: (p1: LatLng, p2: LatLng) => boolean
): LatLng[] {
  if (path.length <= 2) return path

  const smoothed: LatLng[] = [path[0]]
  let currentIdx = 0

  while (currentIdx < path.length - 1) {
    let furthestReachable = currentIdx + 1

    for (let i = currentIdx + 2; i < path.length; i++) {
      if (hasLineOfSight(path[currentIdx], path[i])) {
        furthestReachable = i
      }
    }

    smoothed.push(path[furthestReachable])
    currentIdx = furthestReachable
  }

  return smoothed
}

export function buildRoutePath(waypoints: LatLng[]): RoutePath {
  let totalNm = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalNm += distanceNm(waypoints[i], waypoints[i + 1])
  }
  return {
    waypoints,
    totalNm,
    segmentCount: Math.max(0, waypoints.length - 1)
  }
}
