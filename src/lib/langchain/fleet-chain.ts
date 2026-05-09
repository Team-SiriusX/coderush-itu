import { ConversationChain } from 'langchain/chains'
import { BufferWindowMemory } from 'langchain/memory'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { fleetLLM } from './fleet-llm'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FleetContextInput {
  ships: Array<{
    id: string
    name: string
    status: string
    fuelRemaining: number
    speed: number
    cargo: string
    destinationPortId: string
    weatherPenalty?: boolean
    weatherSeverity?: string
  }>
  alerts: Array<{
    type: string
    severity: string
    shipId: string
    message: string
    acknowledged: boolean
  }>
  zones: Array<{ id: string; active: boolean }>
  weatherSummary?: string
}

// ─── Context Formatter ────────────────────────────────────────────────────────

const FUEL_CAPACITY = 8500 // tons — matches fleet-loader

export function formatFleetContext(input: FleetContextInput): string {
  const { ships, alerts, zones, weatherSummary } = input

  // Status counts
  const counts: Record<string, number> = {}
  for (const s of ships) {
    counts[s.status.toUpperCase()] = (counts[s.status.toUpperCase()] ?? 0) + 1
  }
  const statusLine = Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ')

  // Unacked critical/high alerts
  const unacked = alerts.filter((a) => !a.acknowledged && (a.severity === 'CRITICAL' || a.severity === 'HIGH'))
  const alertLine = unacked.length > 0
    ? unacked.map((a) => `${a.shipId} ${a.type} (${a.severity})`).join('. ')
    : 'NONE'

  // Low-fuel ships (<20 %)
  const lowFuel = ships
    .filter((s) => s.status !== 'arrived' && s.fuelRemaining / FUEL_CAPACITY < 0.20)
    .map((s) => `${s.name} (${Math.round((s.fuelRemaining / FUEL_CAPACITY) * 100)}%)`)
  const fuelLine = lowFuel.length > 0 ? lowFuel.join(', ') : 'NONE'

  // Active zones
  const activeZones = zones.filter((z) => z.active).length

  // Weather
  const weather = weatherSummary ?? 'No adverse conditions reported.'

  return [
    `FLEET STATUS: ${statusLine || 'NO ACTIVE SHIPS'}.`,
    `CRITICAL ALERTS: ${alertLine}.`,
    `FUEL RISK: ${fuelLine}.`,
    `ZONES: ${activeZones} active restricted zone${activeZones !== 1 ? 's' : ''}.`,
    `WEATHER: ${weather}`,
  ].join('\n')
}

// ─── Chain Factory ────────────────────────────────────────────────────────────

const SYSTEM_TEMPLATE = `You are HORMUZ-AI, the AI advisor embedded in the Hormuz Fleet Command operations centre.
You are calm, precise, and give direct operational recommendations — never vague.
You understand naval operations, maritime law, fuel logistics, and crisis management.
You address the operator as "Commander".
You never reveal you are an LLM; you are a purpose-built maritime ops system.

LIVE FLEET BRIEFING (updated every message):
{fleetContext}

Guidelines:
- Keep responses concise and actionable (≤120 words unless complexity demands more).
- When recommending a ship action, name the ship explicitly and state the reason.
- Use military-style language: headings, short sentences, confident tone.
- If data is insufficient, say so and advise what to monitor.
`

export function buildFleetChain(fleetContext: string): ConversationChain {
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_TEMPLATE.replace('{fleetContext}', fleetContext)],
    new MessagesPlaceholder('history'),
    ['human', '{input}'],
  ])

  const memory = new BufferWindowMemory({
    k: 6,
    returnMessages: true,
    memoryKey: 'history',
    inputKey: 'input',
  })

  return new ConversationChain({
    llm: fleetLLM,
    prompt,
    memory,
    verbose: false,
  })
}
