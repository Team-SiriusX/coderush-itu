import { Hono } from 'hono'
import { createId } from '@paralleldrive/cuid2'
import db from '@/lib/db'
import { getPusherServer } from '@/lib/pusher-server'
import { openRouter } from '@/lib/open-router'
import { simulationEngine } from '@/engine/simulation-engine'

const distress = new Hono()

// POST /api/distress — Captain sends free-text distress
// AI extracts structured fields (IMO GMDSS schema via OmniExtract few-shot pattern)
// Then fires DISTRESS_SIGNAL alert to Command via Pusher
distress.post('/', async (c) => {
  const { shipId, message } = await c.req.json<{ shipId: string; message: string }>()

  // ── AI Extraction (OmniExtract few-shot pattern) ───────────────────────────
  const extractionPrompt = `You are a maritime distress signal parser following IMO GMDSS protocol.
Extract structured information from captain distress messages.
Respond ONLY with a valid JSON object. No explanation, no markdown, no preamble.

Schema:
{
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "natureOfDistress": string,
  "injuriesReported": boolean,
  "injuryCount": number | null,
  "systemsAffected": string[],
  "assistanceRequired": string,
  "immediateRisk": boolean,
  "summary": string
}

Examples:
Input: "Engine room fire, 2 crew injured, flooding through starboard hull, need immediate assistance"
Output: {"severity":"CRITICAL","natureOfDistress":"engine room fire and flooding","injuriesReported":true,"injuryCount":2,"systemsAffected":["propulsion","hull integrity","engine room"],"assistanceRequired":"emergency tug and medical evacuation","immediateRisk":true,"summary":"Engine room fire with flooding; 2 crew injured, immediate rescue required"}

Input: "Minor fuel leak detected, no injuries, under control but monitoring"
Output: {"severity":"LOW","natureOfDistress":"fuel leak","injuriesReported":false,"injuryCount":null,"systemsAffected":["fuel system"],"assistanceRequired":"monitoring only","immediateRisk":false,"summary":"Minor fuel leak, no casualties, crew managing situation"}

Input: "Navigation systems down, GPS lost, proceeding on dead reckoning, no injuries"
Output: {"severity":"MEDIUM","natureOfDistress":"navigation system failure","injuriesReported":false,"injuryCount":null,"systemsAffected":["navigation","GPS"],"assistanceRequired":"navigation assistance and route guidance","immediateRisk":false,"summary":"Navigation systems offline, vessel navigating by dead reckoning"}

Now extract from this message:
Input: "${message.replace(/"/g, '\\"')}"
Output:`

  // Fallback extraction if AI fails
  let extraction: Record<string, unknown> = {
    severity:           'HIGH',
    natureOfDistress:   message,
    injuriesReported:   false,
    injuryCount:        null,
    systemsAffected:    [],
    assistanceRequired: 'assistance required',
    immediateRisk:      false,
    summary:            message,
  }

  try {
    const aiResponse = await openRouter.chat.completions.create({
      model:       'meta-llama/llama-3.1-8b-instruct:free',
      max_tokens:  400,
      temperature: 0.1,
      messages: [{ role: 'user', content: extractionPrompt }],
    })

    const raw   = aiResponse.choices[0]?.message?.content ?? ''
    const clean = raw.replace(/```json|```/g, '').trim()
    extraction  = JSON.parse(clean)
  } catch (err) {
    console.error('[distress] AI extraction failed, using fallback:', err)
  }

  // ── Persist distress record ────────────────────────────────────────────────
  // NOTE: schema field is `extraction`, not `extracted`
  const distressRecord = await db.distressMessage.create({
    data: {
      id:         createId(),
      shipId,
      rawMessage: message,
      extraction,
    },
  })

  // ── Create Alert ───────────────────────────────────────────────────────────
  const alert = await db.alert.create({
    data: {
      id:       createId(),
      type:     'DISTRESS_SIGNAL',
      severity: (extraction.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') ?? 'CRITICAL',
      shipId,
      message:  (extraction.summary as string) ?? message,
      metadata: extraction,
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

  // Mark ship as DISTRESSED in the live engine
  simulationEngine.markDistressed(shipId)

  return c.json({ distress: distressRecord, alert, extraction }, 201)
})

export default distress
