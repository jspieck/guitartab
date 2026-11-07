import Song, { type Interval } from '../../stores/song'
import { selectionState } from '../../stores/selectionState'
import Settings from '../../stores/settingsState'
import { onSoundFontSettled, soundFontState } from '../../stores/soundFontState'
import { typedEventBus } from '../../utils/typedEventBus'
import { samplePlayer } from '../audio/samplePlayer'
import { playhead } from './playhead'
import { scheduler } from './scheduler'
import { ticksBefore } from './songCursor'
import { resetStartPosition, setStartPosition, startPosition } from './startPosition'

/**
 * Playback: what the rest of the app calls. The parts: `songCursor` (bar order and next
 * beats, pure), `scheduler` (the clock and what gets scheduled when), `notePlayback` (how a
 * beat sounds), `playhead` (the animation loop) and `startPosition` (where Play starts).
 */
export const playback = {
  /** Starts the timer worker; once at startup. */
  init(): void {
    scheduler.init()
    // Play pressed while the instruments were loading
    onSoundFontSettled(() => {
      if (!soundFontState.playWhenReady) return
      soundFontState.playWhenReady = false
      if (!Settings.songPlaying) scheduler.start()
    })
  },

  start(): void {
    scheduler.start()
  },

  stop(): void {
    soundFontState.playWhenReady = false
    scheduler.stop()
  },

  /** Play/pause: pausing keeps the beat that was playing as the start (and moves the cursor there). */
  togglePlayback(): void {
    if (!Settings.songPlaying) {
      // Without instruments the song would play silently: wait for them (pressing again cancels).
      if (soundFontState.status === 'loading') soundFontState.playWhenReady = !soundFontState.playWhenReady
      else scheduler.start()
      return
    }
    const blockId = Math.max(0, playhead.block)
    const beatId = Math.max(0, playhead.beat)
    scheduler.stop()
    setStartPosition(Song.currentTrackId, blockId, Song.currentVoiceId, beatId)
    const ref = { trackId: Song.currentTrackId, blockId, voiceId: Song.currentVoiceId, beatId }
    if (Song.findBeat(ref)) {
      typedEventBus.emit('navigation.setClickedPos', { ...ref, string: selectionState.cursor.string })
    }
  },

  /** The start position (bar, ticks into it). */
  get playPosition(): { block: number; positionInBlock: number } {
    return startPosition
  },

  setPlayPosition(trackId: number, blockId: number, voiceId: number, beatId: number): void {
    setStartPosition(trackId, blockId, voiceId, beatId)
  },

  resetPosition(): void {
    resetStartPosition()
  },

  /** Moves running playback to a beat (a click in the tab); when stopped, only sets the start. */
  jumpToBeat(trackId: number, blockId: number, voiceId: number, beatId: number): void {
    if (!Settings.songPlaying) {
      setStartPosition(trackId, blockId, voiceId, beatId)
      return
    }
    scheduler.jumpToPosition(blockId, ticksBefore(Song, trackId, blockId, voiceId, beatId), beatId)
  },

  /** Moves playback to `ticks` (whole = 64) into a bar; `beatId` is the beat there. */
  jumpToPosition(blockId: number, ticks: number, beatId: number): void {
    scheduler.jumpToPosition(blockId, ticks, beatId)
  },

  stepForward(): void {
    if (playhead.block + 1 < Song.measures[Song.currentTrackId].length) {
      scheduler.jumpToPosition(playhead.block + 1, 0, 0)
    }
  },

  stepBackward(): void {
    if (playhead.block - 1 >= 0) scheduler.jumpToPosition(playhead.block - 1, 0, 0)
  },

  adaptToLoopChange(loop: Interval | null): void {
    scheduler.adaptToLoopChange(loop)
  },

  /** The bar of the next beat to schedule while playing, the cursor's bar otherwise. */
  getCurrentBlock(): number {
    return Settings.songPlaying ? scheduler.scheduledBar() : selectionState.cursor.blockId
  },

  /** The bar playing now and how far into it (whole notes). */
  songPosition(): { blockId: number; positionInBlock: number } {
    return scheduler.songPosition()
  },

  /** The bar sounding now (-1 before the first beat). */
  get playingBlock(): number {
    return playhead.block
  },

  /** Shows a bar as the playing one (a click in the sequencer). */
  showBar(blockId: number): void {
    playhead.showBar(blockId)
  },

  /** The shown track changed while playing. */
  followTrackChange(): void {
    playhead.followTrackChange()
  },

  /**
   * Builds the sample buffers for the first bars from the play position (called when the
   * pointer reaches Play), so the first scheduled notes don't each convert a sample.
   */
  preloadStart(numBlocks = 2): void {
    if (Settings.songPlaying) return
    const firstBlock = startPosition.block
    Song.measures.forEach((blocks, trackId) => {
      const lastBlock = Math.min(firstBlock + numBlocks, blocks.length)
      for (let blockId = firstBlock; blockId < lastBlock; blockId += 1) {
        for (const voice of blocks[blockId]) {
          for (const beat of voice) {
            beat.notes.forEach((note, string) => {
              if (note != null && note.fret >= 0) samplePlayer.preloadFret(trackId, string, note.fret)
            })
          }
        }
      }
    })
  },
}

export default playback
