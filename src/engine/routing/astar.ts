import { distanceNm, smoothPath, buildRoutePath } from './path-utils'
import { isLineSegmentValid } from './route-validator'
import type { LatLng, NavigationGrid, GridNode, AStarNode, RoutingResult, RestrictedPolygon } from './types'
import { DIAGONAL_COST_MULTIPLIER, MAX_PATHFINDING_ITERATIONS } from './constants'
import { weatherCost } from './weather-costs'

export function findPath(
  startPos: LatLng,
  endPos: LatLng,
  grid: NavigationGrid,
  getClosestNode: (pos: LatLng) => GridNode | null,
  zones: RestrictedPolygon[]
): RoutingResult {
  const startNode = getClosestNode(startPos)
  const endNode = getClosestNode(endPos)

  if (!startNode || !endNode) {
    return { success: false, reason: 'OUTSIDE_NAVIGABLE_WATER', detail: 'Start or end is outside the navigation grid.' }
  }

  // Allow routing to end node even if blocked? If destination is completely blocked, A* will fail anyway.
  if (endNode.blocked) {
    return { success: false, reason: 'DESTINATION_BLOCKED', detail: 'The destination is inside a restricted zone or non-navigable water.' }
  }

  // If start node is blocked (ship inside zone), we need an escape path.
  // For A*, we temporarily unblock the start node just for this calculation, 
  // or allow traversal from blocked to unblocked but heavily penalize it.
  // We'll allow moving OUT of a blocked node, but not INTO a blocked node.

  const openList: AStarNode[] = []
  // using a map for closed list: key is `${r},${c}`
  const closedSet: Set<string> = new Set()
  // track best g for a node
  const gScores: Map<string, number> = new Map()

  const startAStarNode: AStarNode = {
    row: startNode.row,
    col: startNode.col,
    g: 0,
    h: distanceNm(startPos, endPos),
    f: 0,
    parent: null
  }
  startAStarNode.f = startAStarNode.g + startAStarNode.h
  
  openList.push(startAStarNode)
  gScores.set(`${startNode.row},${startNode.col}`, 0)

  let iterations = 0

  while (openList.length > 0) {
    iterations++
    if (iterations > MAX_PATHFINDING_ITERATIONS) {
      break
    }

    // sort open list to find lowest f
    openList.sort((a, b) => a.f - b.f)
    const current = openList.shift()!
    const key = `${current.row},${current.col}`

    // check if reached goal
    if (current.row === endNode.row && current.col === endNode.col) {
      const path = reconstructPath(current, grid, startPos, endPos)
      const smoothed = smoothPath(path, (p1, p2) => isLineSegmentValid(p1, p2, zones))
      return { success: true, path: buildRoutePath(smoothed) }
    }

    closedSet.add(key)

    // get neighbors (8 directions)
    const neighbors = getNeighbors(current.row, current.col, grid)

    for (const n of neighbors) {
      const nKey = `${n.row},${n.col}`
      if (closedSet.has(nKey)) continue

      // Disallow moving into a blocked node. 
      // (If we started blocked, we can move out to unblocked, but not into another blocked)
      if (n.blocked) continue

      const isDiagonal = current.row !== n.row && current.col !== n.col
      const dist = isDiagonal ? DIAGONAL_COST_MULTIPLIER : 1.0
      
      // Calculate movement cost including weather
      const wCost = weatherCost(n)
      
      const tentativeG = current.g + (dist * wCost)

      const existingG = gScores.get(nKey)
      if (existingG === undefined || tentativeG < existingG) {
        // found a better path
        gScores.set(nKey, tentativeG)
        
        const h = distanceNm({lat: n.lat, lng: n.lng}, endPos)
        const neighborNode: AStarNode = {
          row: n.row,
          col: n.col,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current
        }

        const existingOpenIdx = openList.findIndex(o => o.row === n.row && o.col === n.col)
        if (existingOpenIdx >= 0) {
          openList[existingOpenIdx] = neighborNode
        } else {
          openList.push(neighborNode)
        }
      }
    }
  }

  // if start was blocked, it might mean trapped.
  if (startNode.blocked) {
     return { success: false, reason: 'SHIP_INSIDE_ZONE', detail: 'Ship is trapped inside a restricted zone with no escape path.' }
  }

  return { success: false, reason: 'NO_VALID_PATH', detail: 'No valid path could be found to the destination.' }
}

function getNeighbors(row: number, col: number, grid: NavigationGrid): GridNode[] {
  const neighbors: GridNode[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = row + dr
      const nc = col + dc
      if (nr >= 0 && nr < grid.rows && nc >= 0 && nc < grid.cols) {
        neighbors.push(grid.nodes[nr][nc])
      }
    }
  }
  return neighbors
}

function reconstructPath(
  endNode: AStarNode, 
  grid: NavigationGrid,
  startPos: LatLng,
  endPos: LatLng
): LatLng[] {
  const path: LatLng[] = []
  let curr: AStarNode | null = endNode
  while (curr !== null) {
    const node = grid.nodes[curr.row][curr.col]
    path.push({ lat: node.lat, lng: node.lng })
    curr = curr.parent
  }
  path.reverse()
  
  // replace first and last with exact start and end positions
  if (path.length > 0) {
    path[0] = startPos
    path[path.length - 1] = endPos
  }
  return path
}
