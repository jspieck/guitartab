import { reactive } from 'vue'

/**
 * The big beat counter: which beat of the bar is sounding, also during the count-in. The
 * scheduler queues each beat with its audio time ahead of time; the playhead's animation
 * frame moves the display on when the audio clock reaches it.
 */

export interface BeatPulse {
  /** AudioContext time the beat sounds */
  time: number
  /** 1-based beat in the bar */
  beat: number
  beats: number
  /** bar index, -1 in the count-in */
  blockId: number
  countIn: boolean
}

export const beatClockState = reactive({
  beat: 0,
  beats: 0,
  blockId: -1,
  countIn: false,
})

const queue: BeatPulse[] = []

export function queueBeatPulse(pulse: BeatPulse): void {
  // kept in time order (count-in clicks and bar beats are queued in order already)
  let index = queue.length
  while (index > 0 && queue[index - 1].time > pulse.time) index -= 1
  queue.splice(index, 0, pulse)
}

/** Shows the latest beat that has started by `now`. */
export function advanceBeatClock(now: number): void {
  let reached: BeatPulse | undefined
  while (queue.length > 0 && queue[0].time <= now) reached = queue.shift()
  if (reached == null) return
  beatClockState.beat = reached.beat
  beatClockState.beats = reached.beats
  beatClockState.blockId = reached.blockId
  beatClockState.countIn = reached.countIn
}

/** Playback stopped or jumped: nothing queued is going to sound. */
export function resetBeatClock(): void {
  queue.length = 0
  beatClockState.beat = 0
  beatClockState.beats = 0
  beatClockState.blockId = -1
  beatClockState.countIn = false
}
