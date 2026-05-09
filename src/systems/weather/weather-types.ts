export type WeatherSeverity = 'LOW' | 'MODERATE' | 'SEVERE' | 'EXTREME'

export interface WeatherData {
  windSpeed: number // knots
  waveHeight: number // meters
  stormScore: number // 0-100
  visibility?: number // nautical miles
  severity: WeatherSeverity
}

export interface WeatherCell extends WeatherData {
  lat: number
  lng: number
}

export interface WeatherGridData {
  cells: WeatherCell[]
  lastUpdated: number
}
