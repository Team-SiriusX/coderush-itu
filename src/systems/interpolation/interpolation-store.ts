import { create } from 'zustand'
import type { ShipState } from '@/types/fleet'
import {
  computeRenderPosition,
  toInterpolationSample,
  type InterpolationSample,
  type RenderState,
} from './interpolation-engine'

type InterpolationStore = {
  samples: Record<string, InterpolationSample>
  renderShips: Record<string, RenderState>
  interpolationDelayMs: number
  ingestServerShips: (ships: ShipState[]) => void
  tickRender: (nowMs: number) => void
  reset: () => void
}

export const useInterpolationStore = create<InterpolationStore>((set, get) => ({
  samples: {},
  renderShips: {},
  interpolationDelayMs: 350,

  ingestServerShips: (ships) => {
    set((state) => {
      const nextSamples = { ...state.samples }
      for (const ship of ships) {
        const prev = nextSamples[ship.id]
        const prevShip = prev
          ? ({
              id: ship.id,
              name: ship.name,
              position: prev.currentPosition,
              speed: prev.lastServerSpeed,
              heading: prev.currentHeading,
              destinationPortId: ship.destinationPortId,
              fuelRemaining: ship.fuelRemaining,
              cargo: ship.cargo,
              status: ship.status,
              route: ship.route,
              weatherPenalty: ship.weatherPenalty,
              lastUpdated: prev.currentTimestamp,
            } as ShipState)
          : undefined
        nextSamples[ship.id] = toInterpolationSample(ship, prevShip)
      }
      return { samples: nextSamples }
    })
  },

  tickRender: (nowMs) => {
    const { samples, interpolationDelayMs } = get()
    const renderShips: Record<string, RenderState> = {}
    for (const sample of Object.values(samples)) {
      renderShips[sample.id] = computeRenderPosition(nowMs, sample, interpolationDelayMs)
    }
    set({ renderShips })
  },

  reset: () => set({ samples: {}, renderShips: {} }),
}))
