import * as turf from '@turf/turf'
import type { LatLng, RestrictedPolygon } from './types'
import { NAVIGABLE_WATER_TURF } from '../../simulation/fleet-data'

/**
 * Checks if a point is inside the navigable water polygon.
 */
export function isInsideNavigableWater(point: LatLng): boolean {
  const pt = turf.point([point.lng, point.lat])
  const poly = turf.polygon([NAVIGABLE_WATER_TURF])
  return turf.booleanPointInPolygon(pt, poly)
}

/**
 * Checks if a point is inside any restricted zone.
 */
export function isInsideAnyZone(point: LatLng, zones: RestrictedPolygon[]): boolean {
  const pt = turf.point([point.lng, point.lat])
  for (const zone of zones) {
    // A turf polygon ring must have identical first and last coordinates
    let ring = [...zone.ring]
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push([...ring[0]])
    }
    const poly = turf.polygon([ring])
    if (turf.booleanPointInPolygon(pt, poly)) return true
  }
  return false
}

/**
 * Checks if a line segment intersects any restricted zone or goes outside navigable water.
 */
export function isLineSegmentValid(
  p1: LatLng,
  p2: LatLng,
  zones: RestrictedPolygon[]
): boolean {
  const line = turf.lineString([
    [p1.lng, p1.lat],
    [p2.lng, p2.lat]
  ])

  // Check intersection with zones
  for (const zone of zones) {
    let ring = [...zone.ring]
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push([...ring[0]])
    }
    const poly = turf.polygon([ring])
    
    // Check if line crosses the boundary or is fully inside
    if (turf.booleanIntersects(line, poly)) return false
  }

  // Check if line exits navigable water
  const navPoly = turf.polygon([NAVIGABLE_WATER_TURF])
  // turf.booleanWithin checks if line is completely inside the polygon
  // But due to floating point and edges, sometimes it's better to check if it crosses the boundary and the midpoint is inside.
  if (!turf.booleanWithin(line, navPoly)) {
     // fallback check if within is too strict on edges:
     const mid = turf.midpoint(turf.point([p1.lng, p1.lat]), turf.point([p2.lng, p2.lat]))
     if (!turf.booleanPointInPolygon(mid, navPoly)) return false
  }

  return true
}

/**
 * Checks if a route (list of waypoints) intersects any restricted zone.
 */
export function doesRouteIntersectZones(route: LatLng[], zones: RestrictedPolygon[]): boolean {
  if (route.length < 2) return false
  
  for (let i = 0; i < route.length - 1; i++) {
    if (!isLineSegmentValid(route[i], route[i+1], zones)) {
      return true
    }
  }
  return false
}
