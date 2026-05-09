import { Hono } from 'hono'
import { aiFleetAdvisor } from '@/systems/advisor/ai-fleet-advisor'
import { simulationEngine } from '@/engine/simulation-engine'

const app = new Hono()

app.get('/recommendations', (c) => {
  const ships = simulationEngine.getShips()
  const recs = aiFleetAdvisor.getFleetRecommendations(ships)
  return c.json(recs)
})

export default app
