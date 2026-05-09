import { Hono } from 'hono'
import { weatherCache } from '@/systems/weather/weather-cache'

const app = new Hono()

app.get('/', (c) => {
  const data = weatherCache.getGridData()
  return c.json(data ?? { cells: [] })
})

export default app
