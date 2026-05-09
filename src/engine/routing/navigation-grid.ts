import { BOUNDING_BOX } from '../../simulation/fleet-data'
import { GRID_CELL_SIZE_DEG } from './constants'
import type { GridNode, NavigationGrid, RestrictedPolygon, LatLng } from './types'
import { isInsideNavigableWater, isInsideAnyZone } from './route-validator'

export class GridManager {
  private grid: NavigationGrid | null = null
  private zones: RestrictedPolygon[] = []

  /**
   * Initializes the base grid within the bounding box.
   */
  public buildGrid(zones: RestrictedPolygon[]): void {
    this.zones = zones
    const minLat = BOUNDING_BOX.south
    const maxLat = BOUNDING_BOX.north
    const minLng = BOUNDING_BOX.west
    const maxLng = BOUNDING_BOX.east

    const rows = Math.ceil((maxLat - minLat) / GRID_CELL_SIZE_DEG)
    const cols = Math.ceil((maxLng - minLng) / GRID_CELL_SIZE_DEG)

    const nodes: GridNode[][] = []

    for (let r = 0; r < rows; r++) {
      const rowNodes: GridNode[] = []
      const lat = minLat + r * GRID_CELL_SIZE_DEG + GRID_CELL_SIZE_DEG / 2
      
      for (let c = 0; c < cols; c++) {
        const lng = minLng + c * GRID_CELL_SIZE_DEG + GRID_CELL_SIZE_DEG / 2
        
        const pt: LatLng = { lat, lng }
        const inNavigable = isInsideNavigableWater(pt)
        const inZone = isInsideAnyZone(pt, zones)

        rowNodes.push({
          row: r,
          col: c,
          lat,
          lng,
          blocked: !inNavigable || inZone,
          cost: 1.0 // will be updated by weather if needed
        })
      }
      nodes.push(rowNodes)
    }

    this.grid = {
      rows,
      cols,
      cellDeg: GRID_CELL_SIZE_DEG,
      minLat,
      minLng,
      nodes
    }
  }

  public getGrid(): NavigationGrid {
    if (!this.grid) {
      this.buildGrid([]) // empty zones if not built
    }
    return this.grid!
  }

  public getZones(): RestrictedPolygon[] {
    return this.zones
  }

  /**
   * Maps a LatLng coordinate to the closest grid node.
   */
  public getClosestNode(pos: LatLng): GridNode | null {
    if (!this.grid) return null
    
    const r = Math.floor((pos.lat - this.grid.minLat) / this.grid.cellDeg)
    const c = Math.floor((pos.lng - this.grid.minLng) / this.grid.cellDeg)

    if (r >= 0 && r < this.grid.rows && c >= 0 && c < this.grid.cols) {
      return this.grid.nodes[r][c]
    }
    
    // Fallback: clamp to bounds if slightly outside
    const clampedR = Math.max(0, Math.min(r, this.grid.rows - 1))
    const clampedC = Math.max(0, Math.min(c, this.grid.cols - 1))
    return this.grid.nodes[clampedR][clampedC]
  }

  /**
   * Called when zones change to selectively re-evaluate blocked nodes instead of rebuilding entire grid.
   */
  public updateZones(zones: RestrictedPolygon[]): void {
    if (!this.grid) {
      this.buildGrid(zones)
      return
    }
    this.zones = zones
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        const node = this.grid.nodes[r][c]
        const pt = { lat: node.lat, lng: node.lng }
        const inNavigable = isInsideNavigableWater(pt)
        const inZone = isInsideAnyZone(pt, zones)
        node.blocked = !inNavigable || inZone
      }
    }
  }
}
