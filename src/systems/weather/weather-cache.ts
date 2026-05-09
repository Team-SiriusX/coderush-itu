import { WeatherGridData } from './weather-types'
import { fetchWeatherGrid } from './weather-provider'

export class WeatherCache {
  private data: WeatherGridData | null = null
  private refreshIntervalMs = 15 * 60 * 1000 // 15 mins
  private timer: ReturnType<typeof setInterval> | null = null
  private isFetching = false

  start() {
    this.refresh()
    this.timer = setInterval(() => this.refresh(), this.refreshIntervalMs)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
  }

  async refresh() {
    if (this.isFetching) return
    this.isFetching = true
    try {
      const cells = await fetchWeatherGrid()
      if (cells.length > 0) {
        this.data = { cells, lastUpdated: Date.now() }
        console.log(`[weather-cache] Updated ${cells.length} cells`)
      }
    } catch (e) {
      console.error('[weather-cache] refresh failed', e)
    } finally {
      this.isFetching = false
    }
  }

  getGridData(): WeatherGridData | null {
    return this.data
  }
}

export const weatherCache = new WeatherCache()
