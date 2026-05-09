import type { ShipState } from '@/types/fleet'
import { clamp, estimateVelocity, lerp, normalizeHeading, shortestHeadingDelta, type Vec2 } from './motion-utils'

export type InterpolationSample = {
  id: string
  prevPosition: Vec2
  prevHeading: number
  currentPosition: Vec2
  currentHeading: number
  prevTimestamp: number
  currentTimestamp: number
  lastServerSpeed: number
}

export type RenderState = {
  id: string
  position: Vec2
  heading: number
  speed: number
}

export function lerpPosition(a: Vec2, b: Vec2, t: number): Vec2 {
  return { lat: lerp(a.lat, b.lat, t), lng: lerp(a.lng, b.lng, t) }
}

export function interpolateHeading(from: number, to: number, t: number): number {
  const delta = shortestHeadingDelta(from, to)
  return normalizeHeading(from + delta * t)
}

export function estimateRenderT(nowMs: number, sample: InterpolationSample, interpolationDelayMs: number) {
  const renderTime = nowMs - interpolationDelayMs
  const dt = Math.max(sample.currentTimestamp - sample.prevTimestamp, 1)
  return clamp((renderTime - sample.prevTimestamp) / dt, 0, 1.2)
}

export function computeRenderPosition(
  nowMs: number,
  sample: InterpolationSample,
  interpolationDelayMs: number,
  maxExtrapolationMs = 1500,
): RenderState {
  const t = estimateRenderT(nowMs, sample, interpolationDelayMs)
  const interpT = clamp(t, 0, 1)
  const basePos = lerpPosition(sample.prevPosition, sample.currentPosition, interpT)
  const baseHeading = interpolateHeading(sample.prevHeading, sample.currentHeading, interpT)

  // dead reckoning during late packets
  if (t > 1) {
    const vel = estimateVelocity(sample.prevPosition, sample.currentPosition, sample.currentTimestamp - sample.prevTimestamp)
    const lateMs = Math.min((t - 1) * (sample.currentTimestamp - sample.prevTimestamp), maxExtrapolationMs)
    const lateSec = lateMs / 1000
    return {
      id: sample.id,
      position: { lat: basePos.lat + vel.lat * lateSec, lng: basePos.lng + vel.lng * lateSec },
      heading: sample.currentHeading,
      speed: sample.lastServerSpeed,
    }
  }

  return { id: sample.id, position: basePos, heading: baseHeading, speed: sample.lastServerSpeed }
}

export function toInterpolationSample(next: ShipState, prev?: ShipState): InterpolationSample {
  const prevTimestamp = prev?.lastUpdated ?? next.lastUpdated - 1000
  return {
    id: next.id,
    prevPosition: prev?.position ?? next.position,
    prevHeading: prev?.heading ?? next.heading,
    currentPosition: next.position,
    currentHeading: next.heading,
    prevTimestamp,
    currentTimestamp: next.lastUpdated,
    lastServerSpeed: next.speed,
  }
}
