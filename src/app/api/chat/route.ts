import { NextRequest } from 'next/server'
import { buildFleetChain, formatFleetContext, type FleetContextInput } from '@/lib/langchain/fleet-chain'
import type { ConversationChain } from 'langchain/chains'
import db from '@/lib/db'
import { simulationEngine } from '@/engine/simulation-engine'
import { weatherCache } from '@/systems/weather/weather-cache'

// ─── Per-session chain store (server-side, resets on server restart) ──────────
// Key: conversationId (browser session ID), Value: ConversationChain
const chainStore = new Map<string, ConversationChain>()

// ─── Build live fleet context from engine + DB ────────────────────────────────

async function buildLiveFleetContext(): Promise<string> {
  // Get live ships from simulation engine (authoritative)
  const engineShips = simulationEngine.getShips()

  const ships: FleetContextInput['ships'] = engineShips.map((s) => ({
    id:               s.id,
    name:             s.name,
    status:           s.status,
    fuelRemaining:    s.fuelRemaining,
    speed:            s.speed,
    cargo:            s.cargo,
    destinationPortId: s.destinationPortId,
    weatherPenalty:   s.weatherPenalty,
    weatherSeverity:  s.weatherSeverity,
  }))

  // Fetch unacked alerts from DB
  const dbAlerts = await db.alert.findMany({
    where:   { acknowledged: false },
    orderBy: { createdAt: 'desc' },
    take:    20,
  })
  const alerts: FleetContextInput['alerts'] = dbAlerts.map((a) => ({
    type:         a.type,
    severity:     a.severity,
    shipId:       a.shipId,
    message:      a.message,
    acknowledged: a.acknowledged,
  }))

  // Zones
  const dbZones = await db.restrictedZone.findMany({ select: { id: true, active: true } })

  // Weather summary from in-memory cache
  const weatherData = weatherCache.getGridData()
  let weatherSummary = 'No adverse weather data available.'
  if (weatherData && weatherData.cells.length > 0) {
    const worst = weatherData.cells.reduce(
      (max, c) => {
        const rank = { LOW: 0, MODERATE: 1, SEVERE: 2, EXTREME: 3 }[c.severity] ?? 0
        const maxRank = { LOW: 0, MODERATE: 1, SEVERE: 2, EXTREME: 3 }[max.severity] ?? 0
        return rank > maxRank ? c : max
      },
      weatherData.cells[0],
    )
    if (worst.severity === 'LOW') {
      weatherSummary = 'All operational corridors CLEAR.'
    } else {
      weatherSummary = `${worst.severity} conditions detected (wind ${worst.windSpeed.toFixed(0)} kts, waves ${worst.waveHeight.toFixed(1)} m).`
    }
  }

  return formatFleetContext({ ships, alerts, zones: dbZones, weatherSummary })
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { message: string; conversationId: string }

  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 })
  }

  const { message, conversationId } = body
  if (!message?.trim() || !conversationId?.trim()) {
    return new Response(JSON.stringify({ error: 'message and conversationId are required' }), { status: 400 })
  }

  // Build fresh live context every message
  let fleetContext: string
  try {
    fleetContext = await buildLiveFleetContext()
  } catch (err) {
    console.error('[chat] Failed to build fleet context:', err)
    fleetContext = 'FLEET STATUS: context unavailable — engine may not be running.'
  }

  // Get or create chain for this session
  // Context is re-injected via a fresh chain to keep system prompt current
  // Memory is preserved across messages for the same conversationId
  let chain = chainStore.get(conversationId)
  if (!chain) {
    chain = buildFleetChain(fleetContext)
    chainStore.set(conversationId, chain)
  } else {
    // Rebuild chain with fresh context but carry over the existing memory
    const existingMemory = chain.memory
    chain = buildFleetChain(fleetContext)
    chain.memory = existingMemory as typeof chain.memory
    chainStore.set(conversationId, chain)
  }

  // Clean up stale sessions (cap at 100 to avoid memory leaks)
  if (chainStore.size > 100) {
    const firstKey = chainStore.keys().next().value
    if (firstKey) chainStore.delete(firstKey)
  }

  // Stream the response as Server-Sent Events
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: data })}\n\n`))
      }

      try {
        await chain!.call(
          { input: message },
          {
            callbacks: [
              {
                handleLLMNewToken(token: string) {
                  sendEvent(token)
                },
              },
            ],
          },
        )
        // Signal completion
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, timestamp: Date.now() })}\n\n`))
      } catch (err) {
        console.error('[chat] LLM error:', err)
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: 'HORMUZ-AI is temporarily unavailable. Stand by.' })}\n\n`,
          ),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
