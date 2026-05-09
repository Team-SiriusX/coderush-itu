/**
 * Engine bootstrap — called once from instrumentation.ts when the
 * Next.js server process starts. Guards against duplicate starts during
 * Turbopack hot-reload using the singleton inside simulationEngine.
 */
import { simulationEngine } from './simulation-engine'
import { runPredictiveAgent } from '@/lib/langchain/predictive-agent'

const BOOT_KEY = '__hormuz_engine_booted__'

type GlobalWithBoot = typeof globalThis & {
  [BOOT_KEY]?: boolean
}

export function bootstrapEngine(): void {
  // Only run in Node.js runtime (not Edge / browser)
  if (typeof setInterval === 'undefined') return

  const g = globalThis as GlobalWithBoot

  if (g[BOOT_KEY]) {
    console.log('[bootstrap] Engine already booted — skipping')
    return
  }

  g[BOOT_KEY] = true

  console.log('[bootstrap] Starting HORMUZ fleet simulation engine...')
  simulationEngine.start(1000)
  console.log('[bootstrap] Engine started — 15 ships active at 1Hz')

  // Start LangChain predictive agent
  setInterval(() => void runPredictiveAgent(), 60_000)
}
