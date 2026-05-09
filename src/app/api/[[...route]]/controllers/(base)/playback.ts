import { Hono } from 'hono'
import db from '@/lib/db'

const playback = new Hono()

// GET /api/playback — return all frames ordered by timestamp
playback.get('/', async (c) => {
  const frames = await db.playbackFrame.findMany({
    orderBy: { timestamp: 'asc' },
  })
  return c.json(frames)
})

export default playback
