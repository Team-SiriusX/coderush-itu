import type { Directive, FleetAlert, RestrictedZone, ShipState } from '@/types/fleet'
import type { PlaybackFrameExt } from './playback-types'

const MAX_FRAMES = 120 // 1 hour at 30s snapshots

export class PlaybackRecorder {
  private frames: PlaybackFrameExt[] = []
  private lastSnapshot = 0

  pushSnapshot(input: {
    ships: ShipState[]
    alerts: FleetAlert[]
    zones: RestrictedZone[]
    directives: Directive[]
    nowMs?: number
  }) {
    const now = input.nowMs ?? Date.now()
    if (now - this.lastSnapshot < 30000) return

    this.lastSnapshot = now
    this.frames.push({
      timestamp: now,
      ships: structuredClone(input.ships),
      alerts: structuredClone(input.alerts),
      zones: structuredClone(input.zones),
      directives: structuredClone(input.directives),
    })

    if (this.frames.length > MAX_FRAMES) {
      this.frames.splice(0, this.frames.length - MAX_FRAMES)
    }
  }

  getFrames() {
    return this.frames
  }
}
