import { weatherCache } from './weather-cache'
import { WeatherGrid } from './weather-grid'

export const weatherEngine = {
  init: () => {
    weatherCache.start()
  },
  stop: () => {
    weatherCache.stop()
  },
  getCellAt: (lat: number, lng: number) => WeatherGrid.getCellAt(lat, lng),
  getSeverityAt: (lat: number, lng: number) => WeatherGrid.getSeverityAt(lat, lng)
}
