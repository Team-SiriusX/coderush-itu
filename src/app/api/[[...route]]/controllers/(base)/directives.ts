import { Hono } from 'hono'
import { createId } from '@paralleldrive/cuid2'
import db from '@/lib/db'
import { getPusherServer } from '@/lib/pusher-server'

const directives = new Hono()

// POST /api/directives — Command sends directive to a ship's captain
// Pusher: triggers captain-{shipId} channel → directive:new event
directives.post('/', async (c) => {
  const body = await c.req.json<{
    shipId: string
    type: 'REROUTE' | 'HOLD' | 'DIVERT' | 'RETURN_TO_PORT'
    payload?: Record<string, unknown>
    issuedById?: string
  }>()

  const directive = await db.directive.create({
    data: {
      id:      createId(),
      shipId:  body.shipId,
      type:    body.type,
      payload: body.payload ?? {},
    },
  })

  // Push to captain's private channel
  const pusher = getPusherServer()
  await pusher.trigger(`captain-${body.shipId}`, 'directive:new', {
    id:        directive.id,
    type:      directive.type,
    payload:   directive.payload,
    createdAt: directive.createdAt.getTime(),
  })

  return c.json(directive, 201)
})

// POST /api/directives/:id/respond — Captain accepts or escalates
directives.post('/:id/respond', async (c) => {
  const id              = c.req.param('id')
  const { response }    = await c.req.json<{ response: 'ACCEPT' | 'ESCALATE_DISTRESS' }>()

  const directive = await db.directive.update({
    where: { id },
    data:  { response },
  })

  const pusher = getPusherServer()
  await pusher.trigger('alerts', 'alert:update', {
    type:    'DIRECTIVE_RESPONSE',
    shipId:  directive.shipId,
    message: `Captain of ${directive.shipId} ${response === 'ACCEPT' ? 'accepted' : 'escalated'} directive: ${directive.type}`,
  })

  return c.json(directive)
})

// GET /api/directives?shipId=MV-7 — fetch directives for a ship
directives.get('/', async (c) => {
  const shipId = c.req.query('shipId')
  const list   = await db.directive.findMany({
    where:   shipId ? { shipId } : undefined,
    orderBy: { createdAt: 'desc' },
    take:    50,
  })
  return c.json(list)
})

export default directives
