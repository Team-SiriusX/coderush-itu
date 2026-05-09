import { WeatherCell } from './weather-types'
import { classifyWeather } from './weather-classifier'

// 3x3 Grid covering the operational area (Strait of Hormuz / Gulf of Oman)
const LATS = [24.5, 25.5, 26.5]
const LNGS = [54.5, 55.5, 56.5]

export async function fetchWeatherGrid(): Promise<WeatherCell[]> {
  try {
    const latParams: number[] = []
    const lngParams: number[] = []
    for (const lat of LATS) {
      for (const lng of LNGS) {
        latParams.push(lat)
        lngParams.push(lng)
      }
    }

    const latStr = latParams.join(',')
    const lngStr = lngParams.join(',')

    // Wind speed & Weather code
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latStr}&longitude=${lngStr}&current=wind_speed_10m,weather_code&wind_speed_unit=kn`
    )
    if (!weatherRes.ok) throw new Error(`Weather API returned ${weatherRes.status}`)
    const weatherData = await weatherRes.json()

    // Marine wave height
    let marineData = null
    try {
      const marineRes = await fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${latStr}&longitude=${lngStr}&current=wave_height`
      )
      if (marineRes.ok) {
        marineData = await marineRes.json()
      }
    } catch (err) {
      console.warn('[weather-provider] Marine API failed, will fallback to estimations.', err)
    }

    const cells: WeatherCell[] = []
    for (let i = 0; i < latParams.length; i++) {
      const wData = Array.isArray(weatherData) ? weatherData[i] : weatherData
      const mData = marineData ? (Array.isArray(marineData) ? marineData[i] : marineData) : null

      const windSpeed = wData?.current?.wind_speed_10m ?? 10
      const weatherCode = wData?.current?.weather_code ?? 0
      
      let stormScore = 0
      if (weatherCode >= 51 && weatherCode <= 69) stormScore = 30
      if (weatherCode >= 80 && weatherCode <= 82) stormScore = 60
      if (weatherCode >= 95) stormScore = 90

      // Fallback wave height based on wind speed
      const estimatedWaveHeight = Math.pow(windSpeed / 16, 2)
      const waveHeight = mData?.current?.wave_height ?? estimatedWaveHeight

      cells.push({
        lat: latParams[i],
        lng: lngParams[i],
        windSpeed,
        waveHeight,
        stormScore,
        severity: classifyWeather(windSpeed, waveHeight, stormScore)
      })
    }
    return cells

  } catch (error) {
    console.error('[weather-provider] Error fetching weather', error)
    return []
  }
}
