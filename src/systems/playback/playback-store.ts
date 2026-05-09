import { create } from 'zustand'
import type { PlaybackFrameExt } from './playback-types'

type PlaybackStore = {
  isPlaybackMode: boolean
  isPlaying: boolean
  cursorTimestamp: number | null
  liveNowTimestamp: number | null
  frames: PlaybackFrameExt[]
  setFrames: (frames: PlaybackFrameExt[]) => void
  enterPlayback: (ts?: number) => void
  exitPlayback: () => void
  setPlaying: (playing: boolean) => void
  scrubTo: (ts: number) => void
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  isPlaybackMode: false,
  isPlaying: false,
  cursorTimestamp: null,
  liveNowTimestamp: null,
  frames: [],

  setFrames: (frames) =>
    set({
      frames,
      liveNowTimestamp: frames.at(-1)?.timestamp ?? null,
      cursorTimestamp: get().isPlaybackMode ? get().cursorTimestamp : null,
    }),

  enterPlayback: (ts) => {
    const frames = get().frames
    set({
      isPlaybackMode: true,
      isPlaying: false,
      cursorTimestamp: ts ?? frames.at(-1)?.timestamp ?? null,
    })
  },

  exitPlayback: () =>
    set({
      isPlaybackMode: false,
      isPlaying: false,
      cursorTimestamp: null,
    }),

  setPlaying: (playing) => set({ isPlaying: playing }),
  scrubTo: (ts) => set({ cursorTimestamp: ts }),
}))
