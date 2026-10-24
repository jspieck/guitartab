import Song, { type Note } from '../../stores/song'
import Settings from '../../stores/settingsState'
import { setSequencerIndicator } from '../../stores/sequencerState'
import { showPlaybackBeat } from '../../stores/soundingNotesState'
import { tabLayout } from '../../stores/tabLayoutState'
import { audioGraph } from '../audio/audioGraph'
import * as navigationController from '../editor/navigationController'
import { publishPlaybackPosition } from '../editor/playbackEngineBridge'
import * as playbackController from '../editor/playbackController'
import { startPosition } from './startPosition'

/**
 * The animation loop while playing: when a scheduled beat of the shown track and voice
 * starts sounding on the audio clock, it publishes the position, lights the piano/guitar,
 * moves the sequencer marker, scrolls to the beat's row and glides the playhead to the next
 * beat. Runs every animation frame from `start()` until playback stops.
 */

interface QueuedBeat {
  notes: (Note | null)[]
  time: number
  block: number
  voiceId: number
  beat: number
  nextBlock: number
  nextBeat: number
  nextTime: number
}

type PlayheadMove =
  | { type: 'ToBeat'; params: [number, number, number, number, number] }
  | { type: 'ToPosition'; params: [number, number, number, number, number, number, number, number] }

/** How much longer than the beat the glide to the next one takes (it is cut off by the next beat). */
const GLIDE_FACTOR = 1.2

class Playhead {
  /** beats of the shown voice, in the order they will sound */
  private readonly queue: QueuedBeat[] = []

  private readonly moves: PlayheadMove[] = []

  /** bar and beat sounding now (-1 before the first) */
  block = -1

  beat = 0

  private lastRow = -1

  private trackChanged = false

  /** the track shown changed while playing: start over with the new track's beats */
  private pendingTrackChange = false

  queueBeat(entry: QueuedBeat): void {
    this.queue.push(entry)
  }

  clearQueue(): void {
    this.queue.length = 0
  }

  /** After a jump: drop what was queued and put the playhead on a beat. */
  jumpTo(trackId: number, blockId: number, voiceId: number, beatId: number): void {
    this.moves.length = 0
    this.moves.push({ type: 'ToBeat', params: [trackId, blockId, voiceId, beatId, 0] })
  }

  followTrackChange(): void {
    this.pendingTrackChange = true
  }

  reset(): void {
    this.lastRow = -1
    this.block = -1
    this.trackChanged = false
  }

  /** Shows a bar as the playing one (a click in the sequencer). */
  showBar(blockId: number): void {
    this.queue.length = 0
    this.block = blockId
    publishPlaybackPosition(blockId, this.beat, startPosition.positionInBlock)
  }

  start(): void {
    this.frame()
  }

  private readonly frame = (): void => {
    if (!Settings.songPlaying) {
      this.reset()
      this.queue.length = 0
      return
    }
    if (this.pendingTrackChange) {
      this.queue.length = 0
      this.beat = 0
      this.pendingTrackChange = false
      this.trackChanged = true
    }
    const now = audioGraph.getCurrentTime()
    let reached: QueuedBeat | null = null
    while (this.queue.length > 0 && this.queue[0].time < now) {
      reached = this.queue.shift()!
      this.block = reached.block
      this.beat = reached.beat
    }
    setSequencerIndicator(Song.currentTrackId, this.block)
    if (reached != null && !this.showBeat(reached)) return
    this.moveNext()
    window.requestAnimationFrame(this.frame)
  }

  /** A beat started sounding; false stops the loop (no layout yet, as the original did). */
  private showBeat(reached: QueuedBeat): boolean {
    const trackId = Song.currentTrackId
    const { voiceId } = reached
    publishPlaybackPosition(this.block, this.beat, startPosition.positionInBlock)
    const track = Song.tracks[trackId]
    showPlaybackBeat(reached.notes, track.strings, track.capo)

    const row = tabLayout.blockToRow?.[trackId]?.[voiceId]?.[this.block]
    if (!row) return false
    if (this.lastRow !== row.rowId || this.trackChanged) {
      if (Settings.scrollingEnabled)
        navigationController.scrollToSvgPos(trackId, voiceId, row.rowId, this.block)
      this.lastRow = row.rowId
      this.trackChanged = false
    }
    const glideTime = (reached.nextTime - audioGraph.getCurrentTime()) * 1000
    // after a jump, first put the playhead on the beat (once), then glide from there
    if (playbackController.hasBeenJumped() && this.moves[this.moves.length - 1]?.type !== 'ToBeat') {
      this.moves.push({ type: 'ToBeat', params: [trackId, this.block, Song.currentVoiceId, this.beat, 0] })
    }
    this.moves.push({
      type: 'ToPosition',
      params: [
        trackId,
        reached.nextBlock,
        voiceId,
        reached.nextBeat,
        glideTime,
        GLIDE_FACTOR,
        this.block,
        this.beat,
      ],
    })
    return true
  }

  /** One playhead move per frame. */
  private moveNext(): void {
    const move = this.moves.shift()
    if (move == null) return
    if (move.type === 'ToBeat') playbackController.movePlayBackBarToBeat(...move.params)
    else playbackController.movePlayBackBarToPosition(...move.params)
  }
}

export type { Playhead }

export const playhead = new Playhead()
