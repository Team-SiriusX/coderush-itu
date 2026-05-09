import type { ShipState } from '@/types/fleet'
import type { InterpolationSample } from './interpolation-engine'

export function buildPredictedShip(sample: InterpolationSample, template: ShipState, horizonSec = 180): ShipState {
  const dt = Math.max(sample.currentTimestamp - sample.prevTimestamp, 1)
  const latV = (sample.currentPosition.lat - sample.prevPosition.lat) / (dt / 1000)
  const lngV = (sample.currentPosition.lng - sample.prevPosition.lng) / (dt / 1000)

  return {
    ...template,
    position: {
      lat: sample.currentPosition.lat + latV * horizonSec,
      lng: sample.currentPosition.lng + lngV * horizonSec,
    },
    lastUpdated: Date.now(),
  }
}
