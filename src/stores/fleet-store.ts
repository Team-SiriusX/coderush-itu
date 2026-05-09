import { create } from 'zustand'
import type { ShipState, FleetAlert, RestrictedZone, Directive } from '@/types/fleet'

type FleetStore = {
  ships: ShipState[]
  selectedShipId: string | null
  alerts: FleetAlert[]
  zones: RestrictedZone[]
  directives: Directive[]
  isPlayback: boolean
  playbackTimestamp: number | null

  setShips: (ships: ShipState[]) => void
  setSelectedShip: (id: string | null) => void
  addAlert: (alert: FleetAlert) => void
  updateAlert: (id: string, updates: Partial<FleetAlert>) => void
  setZones: (zones: RestrictedZone[]) => void
  addZone: (zone: RestrictedZone) => void
  removeZone: (id: string) => void
  addDirective: (directive: Directive) => void
  setPlayback: (active: boolean, timestamp?: number) => void
}

export const useFleetStore = create<FleetStore>((set) => ({
  ships: [],
  selectedShipId: null,
  alerts: [],
  zones: [],
  directives: [],
  isPlayback: false,
  playbackTimestamp: null,

  setShips: (ships) => set({ ships }),
  setSelectedShip: (id) => set({ selectedShipId: id }),
  addAlert: (alert) => set((s) => ({ alerts: [alert, ...s.alerts] })),
  updateAlert: (id, updates) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  setZones: (zones) => set({ zones }),
  addZone: (zone) => set((s) => ({ zones: [...s.zones, zone] })),
  removeZone: (id) => set((s) => ({ zones: s.zones.filter((z) => z.id !== id) })),
  addDirective: (directive) => set((s) => ({ directives: [directive, ...s.directives] })),
  setPlayback: (active, timestamp) =>
    set({ isPlayback: active, playbackTimestamp: timestamp ?? null }),
}))
