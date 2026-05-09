export type Vec2 = { lat: number; lng: number }

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function normalizeHeading(deg: number) {
  const h = deg % 360
  return h < 0 ? h + 360 : h
}

export function shortestHeadingDelta(from: number, to: number) {
  const a = normalizeHeading(from)
  const b = normalizeHeading(to)
  let d = b - a
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export function estimateVelocity(from: Vec2, to: Vec2, dtMs: number): Vec2 {
  const dt = Math.max(dtMs, 1) / 1000
  return {
    lat: (to.lat - from.lat) / dt,
    lng: (to.lng - from.lng) / dt,
  }
}
