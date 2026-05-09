import type { PlaybackFrameExt } from './playback-types'

export function findFrameAt(frames: PlaybackFrameExt[], ts: number | null): PlaybackFrameExt | null {
  if (!ts || frames.length === 0) return null
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (frames[mid].timestamp <= ts) lo = mid
    else hi = mid - 1
  }
  return frames[lo] ?? null
}
