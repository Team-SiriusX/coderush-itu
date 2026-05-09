import { Hono } from 'hono'
import directives from './directives'
import distress   from './distress'
import zones      from './zones'
import alerts     from './alerts'
import playback   from './playback'
import weather    from './weather'
import advisor    from './advisor'

const base = new Hono()

base.route('/directives', directives)
base.route('/distress',   distress)
base.route('/zones',      zones)
base.route('/alerts',     alerts)
base.route('/playback',   playback)
base.route('/weather',    weather)
base.route('/advisor',    advisor)

// Health check
base.get('/health', (c) => c.json({ ok: true, ts: Date.now() }))

export default base
