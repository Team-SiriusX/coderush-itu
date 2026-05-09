import { Hono } from 'hono'
import directives from './directives'
import distress   from './distress'
import zones      from './zones'
import alerts     from './alerts'
import playback   from './playback'

const base = new Hono()

base.route('/directives', directives)
base.route('/distress',   distress)
base.route('/zones',      zones)
base.route('/alerts',     alerts)
base.route('/playback',   playback)

// Health check
base.get('/health', (c) => c.json({ ok: true, ts: Date.now() }))

export default base
