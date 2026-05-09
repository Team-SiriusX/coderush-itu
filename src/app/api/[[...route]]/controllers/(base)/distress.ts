import { Hono } from 'hono'
import { createId } from '@paralleldrive/cuid2'
import db from '@/lib/db'
import { getPusherServer } from '@/lib/pusher-server'
import { simulationEngine } from '@/engine/simulation-engine'
import { extractDistress } from '@/lib/langchain/distress-chain'
import type { DistressExtractionResult } from '@/lib/langchain/distress-chain'

const distress = new Hono()

// POST /api/distress — Captain sends free-text distress
// LangChain structured output chain extracts IMO GMDSS fields via Zod schema
distress.post('/', async (c) => {
  const { shipId, message } = await c.req.json<{ shipId: string; message: string }>()

  // ── Structured AI Extraction (LangChain + Zod) ─────────────────────────────
  const extraction: DistressExtractionResult = await extractDistress(message, shipId)

  // ── Persist distress record ────────────────────────────────────────────────
  // Serialise via JSON roundtrip so Prisma accepts it as InputJsonValue
  const extractionJson = JSON.parse(JSON.stringify(extraction)) as Record<string, unknown>

  const distressRecord = await db.distressMessage.create({
    data: {
      id:         createId(),
      shipId,
      rawMessage: message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extraction: extractionJson as any,
    },
  })

  // ── Derive a rich alert message from structured fields ─────────────────────
  const alertMessage = [
    extraction.situation,
    extraction.casualtyCount > 0
      ? `⚠ ${extraction.casualtyCount} CASUALT${extraction.casualtyCount > 1 ? 'IES' : 'Y'}`
      : null,
    extraction.canContinue ? null : 'Vessel CANNOT continue under own power.',
  ]
    .filter(Boolean)
    .join(' — ')

  // ── Create Alert ───────────────────────────────────────────────────────────
  const alert = await db.alert.create({
    data: {
      id:       createId(),
      type:     'DISTRESS_SIGNAL',
      severity: extraction.severity,
      shipId,
      message:  alertMessage,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: extractionJson as any,
    },
  })

  // ── Push to Command via Pusher ─────────────────────────────────────────────
  const pusher = getPusherServer()
  await pusher.trigger('alerts', 'alert:new', {
    id:           alert.id,
    type:         'DISTRESS_SIGNAL',
    severity:     alert.severity,
    shipId,
    message:      alert.message,
    acknowledged: false,
    resolved:     false,
    metadata:     extraction,
    createdAt:    alert.createdAt.getTime(),
  })

  // ── Mark ship as DISTRESSED in the live engine ─────────────────────────────
  simulationEngine.markDistressed(shipId)

  return c.json({ distress: distressRecord, alert, extraction }, 201)
})

export default distress
