import { z } from 'zod'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { fleetLLM } from './fleet-llm'

// ─── Zod Schema ───────────────────────────────────────────────────────────────

export const DistressSchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .describe('Overall emergency severity level per IMO GMDSS classification'),
  situation: z.string()
    .describe('One concise sentence describing what is wrong aboard the vessel'),
  systemsAffected: z.array(z.string())
    .describe('List of damaged or failing ship systems, e.g. ["propulsion","navigation","hull integrity"]'),
  casualtyCount: z.number()
    .describe('Number of injured or missing crew members; use 0 if no casualties reported'),
  assistanceRequired: z.enum(['NONE', 'MEDICAL', 'TOWING', 'ESCORT', 'FUEL', 'EVACUATION'])
    .describe('Primary type of assistance required from command'),
  canContinue: z.boolean()
    .describe('Whether the vessel can continue to its destination under its own power'),
  estimatedTimeToFailure: z.number().nullable()
    .describe('Estimated minutes until complete system or structural failure; null if unknown'),
  recommendedAction: z.string()
    .describe('Recommended command action in one direct sentence, e.g. "Dispatch rescue tug to vessel coordinates immediately"'),
})

// ─── Inferred type ────────────────────────────────────────────────────────────

export type DistressExtractionResult = z.infer<typeof DistressSchema>

// ─── System prompt ────────────────────────────────────────────────────────────

const DISTRESS_SYSTEM = `You are a maritime distress signal parser embedded in a naval operations command system.
You follow IMO GMDSS (Global Maritime Distress and Safety System) protocol.
Your task is to extract structured operational intelligence from raw captain distress messages.
Be precise, conservative, and err on the side of higher severity when uncertain.
Do not invent details not present in the message. Use null for unknown numeric fields.`

// ─── Chain factory ────────────────────────────────────────────────────────────

const distressPrompt = ChatPromptTemplate.fromMessages([
  ['system', DISTRESS_SYSTEM],
  [
    'human',
    `Vessel ID: {shipId}
Raw distress message from captain: {rawMessage}

Extract all relevant structured information for the command center.`,
  ],
])

// Bind structured output once — reuse the chain for every call
const structuredLLM = fleetLLM.withStructuredOutput(DistressSchema, {
  name: 'distress_extraction',
})

const distressChain = distressPrompt.pipe(structuredLLM)

// ─── Fallback ─────────────────────────────────────────────────────────────────

function buildFallback(rawMessage: string): DistressExtractionResult {
  return {
    severity:                'HIGH',
    situation:               rawMessage.slice(0, 200),
    systemsAffected:         [],
    casualtyCount:           0,
    assistanceRequired:      'NONE',
    canContinue:             false,
    estimatedTimeToFailure:  null,
    recommendedAction:       'Attempt voice contact with vessel and stand by for further information.',
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract structured distress intelligence from a raw captain message.
 * Falls back to a safe default object if the LLM call fails.
 */
export async function extractDistress(
  rawMessage: string,
  shipId:     string,
): Promise<DistressExtractionResult> {
  try {
    const result = await distressChain.invoke({ rawMessage, shipId })
    return result as DistressExtractionResult
  } catch (err) {
    console.error('[distress-chain] Structured extraction failed, using fallback:', err)
    return buildFallback(rawMessage)
  }
}
