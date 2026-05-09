import type { Directive, FleetAlert, RestrictedZone, ShipState } from '@/types/fleet'

export type PlaybackFrameExt = {
  timestamp: number
  ships: ShipState[]
  alerts: FleetAlert[]
  zones: RestrictedZone[]
  directives: Directive[]
}
