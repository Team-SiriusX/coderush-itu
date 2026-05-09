import { Hono } from 'hono'
import { createId } from '@paralleldrive/cuid2'
import db from '@/lib/db'
import { getPusherServer } from '@/lib/pusher-server'
import { zoneEngine } from '@/engine/routing/zone-engine'

const zones = new Hono()

// POST /api/zones — Command creates a restricted zone
zones.post('/', async (c) => {
  const body = await c.req.json<{
    name: string
    geometry: { type: 'Polygon'; coordinates: number[][][] }
  }>()

  const zone = await db.restrictedZone.create({
    data: {
      id:       createId(),
      name:     body.name,
      geometry: body.geometry,
      active:   true,
    },
  })

  const allZones = await db.restrictedZone.findMany({ where: { active: true } })
  const pusher   = getPusherServer()
  await pusher.trigger('zones', 'zone:update', allZones)

  const geom = zone.geometry as any
  zoneEngine.addZone({
    id: zone.id,
    name: zone.name,
    ring: geom.coordinates[0] as [number, number][]
  })

  return c.json(zone, 201)
})

// DELETE /api/zones/:id — deactivate a zone
zones.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await db.restrictedZone.update({
    where: { id },
    data:  { active: false },
  })

  const allZones = await db.restrictedZone.findMany({ where: { active: true } })
  const pusher   = getPusherServer()
  await pusher.trigger('zones', 'zone:update', allZones)

  zoneEngine.removeZone(id)

  return c.json({ deleted: id })
})

// GET /api/zones — list active zones
zones.get('/', async (c) => {
  const list = await db.restrictedZone.findMany({ where: { active: true } })
  return c.json(list)
})

export default zones
