import type { LatLng } from '../types'

// ── Grid ───────────────────────────────────────────────────────────────────

export type GridNode = {
  row:      number
  col:      number
  lat:      number   // centre latitude of this cell
  lng:      number   // centre longitude of this cell
  blocked:  boolean  // true if inside restricted zone or outside navigable water
  cost:     number   // base traversal cost (1.0 normal, higher for weather)
}

export type NavigationGrid = {
  rows:      number
  cols:      number
  cellDeg:   number          // grid resolution in degrees
  minLat:    number
  minLng:    number
  nodes:     GridNode[][]    // [row][col]
}

// ── Route ──────────────────────────────────────────────────────────────────

export type RouteSegment = {
  from: LatLng
  to:   LatLng
}

export type RoutePath = {
  waypoints:    LatLng[]   // ordered, smoothed waypoints
  totalNm:      number     // total path length in nautical miles
  segmentCount: number
}

// ── Zones ──────────────────────────────────────────────────────────────────

export type RestrictedPolygon = {
  id:       string
  name:     string
  // GeoJSON ring in [lng, lat] format for turf (already converted)
  ring:     [number, number][]
}

// ── Routing Results ────────────────────────────────────────────────────────

export type RouteFailureReason =
  | 'NO_VALID_PATH'
  | 'DESTINATION_BLOCKED'
  | 'SHIP_INSIDE_ZONE'
  | 'OUTSIDE_NAVIGABLE_WATER'

export type RoutingResult =
  | { success: true;  path: RoutePath }
  | { success: false; reason: RouteFailureReason; detail: string }

// ── A* internals ──────────────────────────────────────────────────────────

export type AStarNode = {
  row:    number
  col:    number
  g:      number   // cost from start
  h:      number   // heuristic to goal
  f:      number   // g + h
  parent: AStarNode | null
}
