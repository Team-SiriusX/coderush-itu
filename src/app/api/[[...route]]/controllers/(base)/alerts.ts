import { Hono } from 'hono'
import db from '@/lib/db'
import { getPusherServer } from '@/lib/pusher-server'

const alerts = new Hono()

// GET /api/alerts — list recent alerts
alerts.get('/', async (c) => {
  const list = await db.alert.findMany({
    orderBy: { createdAt: 'desc' },
    take:    100,
  })
  return c.json(list)
})

// POST /api/alerts — create an alert and broadcast
alerts.post('/', async (c) => {
  const body = await c.req.json<{
    type: 'GEOFENCE_BREACH' | 'PROXIMITY_WARNING' | 'COLLISION_RISK' | 'DISTRESS_SIGNAL' | 'LOW_FUEL' | 'OUT_OF_FUEL' | 'ROUTE_BLOCKED' | 'INSUFFICIENT_FUEL'
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    shipId: string
    message: string
    metadata?: Record<string, unknown>
  }>()

  const alert = await db.alert.create({
    data: {
      type: body.type === 'COLLISION_RISK' ? 'PROXIMITY_WARNING' : body.type,
      severity: body.severity,
      shipId: body.shipId,
      message: body.message,
      metadata: {
        ...(body.metadata ?? {}),
        semanticType: body.type,
      },
    },
  })

  const pusher = getPusherServer()
  await pusher.trigger('alerts', 'alert:new', {
    ...alert,
    createdAt: alert.createdAt.getTime(),
    updatedAt: alert.updatedAt.getTime(),
  })

  return c.json(alert, 201)
})

// PATCH /api/alerts/:id/acknowledge — mark alert as acknowledged
alerts.patch('/:id/acknowledge', async (c) => {
  const id    = c.req.param('id')
  const alert = await db.alert.update({
    where: { id },
    data:  { acknowledged: true },
  })

  const pusher = getPusherServer()
  await pusher.trigger('alerts', 'alert:update', {
    ...alert,
    createdAt: alert.createdAt.getTime(),
    updatedAt: alert.updatedAt.getTime(),
  })

  return c.json(alert)
})

export default alerts
