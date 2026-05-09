import type { RestrictedPolygon, RoutingResult, LatLng } from './types'
import { GridManager } from './navigation-grid'
import { findPath } from './astar'
import { isInsideAnyZone, doesRouteIntersectZones } from './route-validator'

class RoutingEngine {
  private gridManager = new GridManager()

  public init(zones: RestrictedPolygon[]) {
    this.gridManager.buildGrid(zones)
  }

  public updateZones(zones: RestrictedPolygon[]) {
    this.gridManager.updateZones(zones)
  }

  public getZones(): RestrictedPolygon[] {
    return this.gridManager.getZones()
  }

  /**
   * Computes a route from start to destination.
   */
  public computeRoute(start: LatLng, dest: LatLng): RoutingResult {
    const grid = this.gridManager.getGrid()
    const zones = this.gridManager.getZones()

    return findPath(
      start,
      dest,
      grid,
      (pos) => this.gridManager.getClosestNode(pos),
      zones
    )
  }

  /**
   * Checks if an existing route intersects current zones.
   */
  public isRouteInvalid(route: LatLng[]): boolean {
    return doesRouteIntersectZones(route, this.gridManager.getZones())
  }

  /**
   * Checks if a point is inside any zone.
   */
  public isInsideZone(pos: LatLng): boolean {
    return isInsideAnyZone(pos, this.gridManager.getZones())
  }
}

export const routingEngine = new RoutingEngine()
