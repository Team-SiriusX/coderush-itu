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
