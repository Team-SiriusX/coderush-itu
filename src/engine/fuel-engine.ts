import type { FuelComputation } from './types'

/**
 * Base fuel burn rate: tons per nautical mile at standard speed.
 * Derived from typical VLCC consumption: ~150t/day at 15 knots
 * = 150 / (15 × 24) ≈ 0.417 t/nm
 */
const BASE_BURN_RATE_T_PER_NM = 0.417

/**
 * Speed-indexed burn multiplier. Fuel consumption scales roughly with
 * cube of speed (Admiralty coefficient). We use a simplified linear
 * approximation: every extra knot above 12 adds 5% more burn.
 */
function speedMultiplier(speedKnots: number): number {
  const base = 12
  const excess = Math.max(0, speedKnots - base)
  return 1 + excess * 0.05
}

import { WeatherSeverity } from '@/systems/weather/weather-types'

/**
 * Compute fuel consumption for one tick.
 *
 * @param fuelRemaining  Current fuel in tons
 * @param speedKnots     Current speed in knots
 * @param distanceNm     Distance travelled this tick in nautical miles
 * @param weatherSeverity Weather severity
 *
 * @returns FuelComputation with consumed, remaining, and depleted flag
 */
export function computeFuel(
  fuelRemaining:  number,
  speedKnots:     number,
  distanceNm:     number,
  weatherSeverity: WeatherSeverity,
): FuelComputation {
  // No movement → no burn
  if (distanceNm <= 0 || speedKnots <= 0) {
    return {
      burnRate:  0,
      consumed:  0,
      remaining: fuelRemaining,
      depleted:  false,
    }
  }

  let penalty = 1.0
  if (weatherSeverity === 'MODERATE') penalty = 1.15
  else if (weatherSeverity === 'SEVERE') penalty = 1.30
  else if (weatherSeverity === 'EXTREME') penalty = 1.50

  const burnRate = BASE_BURN_RATE_T_PER_NM
    * speedMultiplier(speedKnots)
    * penalty

  const consumed  = burnRate * distanceNm
  const remaining = Math.max(0, fuelRemaining - consumed)
  const depleted  = fuelRemaining > 0 && remaining === 0

  return {
    burnRate,
    consumed,
    remaining,
    depleted,
  }
}

/**
 * Estimate nautical miles remaining on current fuel.
 * Useful for lookahead "will it make it?" logic.
 */
export function estimatedRangeNm(
  fuelRemaining:  number,
  speedKnots:     number,
  weatherSeverity: WeatherSeverity,
): number {
  let penalty = 1.0
  if (weatherSeverity === 'MODERATE') penalty = 1.15
  else if (weatherSeverity === 'SEVERE') penalty = 1.30
  else if (weatherSeverity === 'EXTREME') penalty = 1.50

  const burnRate = BASE_BURN_RATE_T_PER_NM
    * speedMultiplier(speedKnots)
    * penalty

  if (burnRate <= 0) return Infinity
  return fuelRemaining / burnRate
}
