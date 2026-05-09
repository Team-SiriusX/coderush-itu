import { z } from 'zod'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { fleetLLM } from './fleet-llm'
import { simulationEngine } from '@/engine/simulation-engine'
import db from '@/lib/db'
import { getPusherServer } from '@/lib/pusher-server'
import { weatherCache } from '@/systems/weather/weather-cache'
import { createId } from '@paralleldrive/cuid2'

// ─── Zod Schema for Structured Extraction ─────────────────────────────────────

const PredictionSchema = z.object({
  predictions: z.array(z.object({
    shipId: z.string().describe("The ID of the vessel at risk"),
    riskType: z.enum([
      "FUEL_EXHAUSTION", 
      "ZONE_ENTRY", 
      "COLLISION_COURSE", 
      "WEATHER_IMPACT", 
      "STRANDED_RISK"
    ]),
    timeToEventMinutes: z.number().describe("Estimated minutes until the risk event occurs"),
    confidence: z.number().min(0).max(1).describe("Confidence score of this prediction (0 to 1)"),
    reasoning: z.string().describe("One sentence explaining why this risk is predicted"),
    suggestedAction: z.string().describe("Recommended action to prevent the risk")
  }))
})

type PredictionExtraction = z.infer<typeof PredictionSchema>['predictions'][0]

// ─── System Prompt ────────────────────────────────────────────────────────────

const PREDICTIVE_SYSTEM = `You are a maritime risk prediction system for the HORMUZ naval operations command.
Analyze the fleet and identify ships that will experience problems in the next 5-15 minutes. 
Be specific with ship IDs and timeframes. Only flag genuine risks, not minor concerns.
Use the provided context containing ship states, active zones, weather conditions, and recent alerts.`

const predictivePrompt = ChatPromptTemplate.fromMessages([
  ['system', PREDICTIVE_SYSTEM],
  [
    'human',
    `Current Fleet State:
{ships}

Active Restricted Zones:
{zones}

Weather Grid Severity:
{weather}

Recent Alerts (Last 10 minutes):
{alerts}

Identify any vessels at risk of failure, collision, zone breach, or severe weather impact.`
  ]
])

const structuredLLM = fleetLLM.withStructuredOutput(PredictionSchema, {
  name: 'predictive_analysis'
})

const predictiveChain = predictivePrompt.pipe(structuredLLM)

// ─── Agent Execution ──────────────────────────────────────────────────────────

export async function runPredictiveAgent() {
  console.log('[predictive-agent] Running LangChain predictive analysis...')
  try {
    const ships = simulationEngine.getShips()
    if (ships.length === 0) return

    // Gather context
    const shipsContext = ships.map(s => ({
      id: s.id,
      name: s.name,
      status: s.status,
      speed: s.speed,
      fuelPct: Math.round((s.fuelRemaining / s.fuelCapacity) * 100),
      heading: Math.round(s.heading),
      position: { lat: s.position.lat.toFixed(3), lng: s.position.lng.toFixed(3) },
      weatherSeverity: s.weatherSeverity
    }))

    const zones = await db.restrictedZone.findMany({ where: { active: true } })
    const zonesContext = zones.map(z => ({ name: z.name }))

    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000)
    const recentAlerts = await db.alert.findMany({
      where: { createdAt: { gte: tenMinsAgo } },
      select: { type: true, severity: true, shipId: true, message: true }
    })

    const weatherData = weatherCache.getGridData()
    const extremeWeatherCount = weatherData?.cells.filter(c => c.severity === 'EXTREME').length ?? 0

    // Invoke chain
    const result = await predictiveChain.invoke({
      ships: JSON.stringify(shipsContext),
      zones: JSON.stringify(zonesContext),
      weather: extremeWeatherCount > 0 ? `${extremeWeatherCount} EXTREME weather cells active in theater` : 'Normal',
      alerts: JSON.stringify(recentAlerts)
    })

    const predictions = result.predictions

    // Process high-confidence predictions
    for (const pred of predictions) {
      if (pred.confidence > 0.7) {
        await firePredictiveAlert(pred)
      }
    }

  } catch (err) {
    console.error('[predictive-agent] Failed to run analysis:', err)
  }
}

// Track recently fired predictive alerts to avoid spamming
const recentPredictions = new Map<string, number>()

async function firePredictiveAlert(pred: PredictionExtraction) {
  // Deduplicate: Don't fire the same risk type for the same ship within 5 minutes
  const dedupKey = `${pred.shipId}-${pred.riskType}`
  const lastFired = recentPredictions.get(dedupKey)
  if (lastFired && Date.now() - lastFired < 5 * 60 * 1000) {
    return
  }
  recentPredictions.set(dedupKey, Date.now())

  const alertType = pred.riskType === 'FUEL_EXHAUSTION' ? 'LOW_FUEL' 
    : pred.riskType === 'ZONE_ENTRY' ? 'PROXIMITY_WARNING'
    : 'DISTRESS_SIGNAL'

  const metadataJson = JSON.parse(JSON.stringify({
    isPredictive: true,
    riskType: pred.riskType,
    confidence: pred.confidence,
    timeToEventMinutes: pred.timeToEventMinutes,
    reasoning: pred.reasoning,
    suggestedAction: pred.suggestedAction
  })) as Record<string, unknown>

  const alert = await db.alert.create({
    data: {
      id: createId(),
      type: alertType,
      severity: pred.confidence > 0.9 ? 'CRITICAL' : 'HIGH',
      shipId: pred.shipId,
      message: `AI PRED (${Math.round(pred.confidence * 100)}%): ${pred.riskType.replace(/_/g, ' ')} expected in ~${pred.timeToEventMinutes}m.`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: metadataJson as any
    }
  })

  const pusher = getPusherServer()
  await pusher.trigger('alerts', 'alert:new', {
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    shipId: alert.shipId,
    message: alert.message,
    acknowledged: false,
    resolved: false,
    metadata: metadataJson,
    createdAt: alert.createdAt.getTime(),
  })
}
