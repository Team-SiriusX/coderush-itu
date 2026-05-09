import { WeatherSeverity } from './weather-types'

export function classifyWeather(
  windSpeedKnots: number,
  waveHeightMeters: number,
  stormScore: number
): WeatherSeverity {
  if (waveHeightMeters > 8 || windSpeedKnots > 50 || stormScore > 80) {
    return 'EXTREME'
  }
  if (waveHeightMeters > 5 || windSpeedKnots > 35 || stormScore > 50) {
    return 'SEVERE'
  }
  if (waveHeightMeters > 2 || windSpeedKnots > 20 || stormScore > 20) {
    return 'MODERATE'
  }
  return 'LOW'
}
