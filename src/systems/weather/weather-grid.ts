import { WeatherCell, WeatherSeverity } from './weather-types'
import { weatherCache } from './weather-cache'

// Basic Haversine for fast nearest-cell lookup without depending on turf
function fastDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p = 0.017453292519943295 // Math.PI / 180
  const c = Math.cos
  const a = 0.5 - c((lat2 - lat1) * p)/2 + 
          c(lat1 * p) * c(lat2 * p) * 
          (1 - c((lon2 - lon1) * p))/2
  return 12742 * Math.asin(Math.sqrt(a)) // 2 * R; R = 6371 km
}

export class WeatherGrid {
  static getCellAt(lat: number, lng: number): WeatherCell | null {
    const data = weatherCache.getGridData()
    if (!data || data.cells.length === 0) return null

    let closest: WeatherCell | null = null
    let minDist = Infinity

    for (const cell of data.cells) {
      const dist = fastDistance(lat, lng, cell.lat, cell.lng)
      if (dist < minDist) {
        minDist = dist
        closest = cell
      }
    }
    return closest
  }

  static getSeverityAt(lat: number, lng: number): WeatherSeverity {
    const cell = this.getCellAt(lat, lng)
    return cell?.severity ?? 'LOW'
  }
}
