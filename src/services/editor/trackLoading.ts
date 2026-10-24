import { createMeasures } from './measureStructureCommands'
import { fillMeasures } from './barFilling'
import { redrawTrack } from './layoutInvalidation'
import { tupletState } from '../../stores/tupletState'
import { selectionState } from '../../stores/selectionState'
import Song, { type PlayBackInstrument } from '../../stores/song'
import { clearRange } from './rangeSelection'
import playback from '../playback'
import { instrumentIconSrc, numToInstr } from '../../data/instrumentData'
import { audioGraph } from '../audio/audioGraph'
import { setSequencerIndicator } from '../../stores/sequencerState'
import { modalManager } from '../dialogs/modalManager'
import { notifySongDataChanged } from '../appEvents'
import { setTrackSignIcon } from '../../utils/editorUi'

/** Stops playback and puts cursor, selection and track back to the start. */
export function resetEditorState(): void {
  playback.stop()
  Song.currentTrackId = 0
  Song.currentVoiceId = 0
  selectionState.cursor = { trackId: 0, voiceId: 0, blockId: 0, beatId: 0, string: 0 }
  tupletState.groups.length = 0
  clearRange()
  playback.resetPosition()
}

/** Bars without their own time signature take the one in force before them. */
export function fillTimeSignatures(): void {
  let numerator = 0
  let denominator = 0
  for (const meta of Song.measureMeta) {
    if (meta.denominator != null) {
      denominator = meta.denominator
    } else {
      meta.denominator = denominator
    }
    if (meta.numerator != null) {
      numerator = meta.numerator
    } else {
      meta.numerator = numerator
    }
  }
}

/** Playback settings for a track, from its program (GPIF/MIDI) or its GP channel. */
export function playbackInstrumentFor(trackId: number): PlayBackInstrument {
  const track = Song.tracks[trackId]
  const fromProgram = track.program != null
  const channel = fromProgram ? null : Song.allChannels[track.channel.index]
  const program = fromProgram ? track.program : channel?.cInstrument
  const channelIndex = fromProgram ? track.primaryChannel : track.channel.index
  const mix = channel ?? { volume: 100, balance: 66, chorus: 0, reverb: 0, phaser: 0, tremolo: 0 }
  const { volume, balance, chorus, reverb, phaser, tremolo } = mix
  const instrument: PlayBackInstrument = {
    volume,
    balance,
    chorus,
    reverb,
    phaser,
    tremolo,
    instrument: '',
    mute: false,
    solo: false,
  }
  if (program != null) {
    instrument.instrument = channelIndex === 9 ? 'drums' : numToInstr[program]
  }
  return instrument
}

/** Sets up a track's playback settings and audio bus. */
export function initTrackPlayback(trackId: number): void {
  Song.playBackInstrument[trackId] = playbackInstrumentFor(trackId)
  audioGraph.updateBusses(Song.playBackInstrument)
  notifySongDataChanged()
}

/** Shows a freshly loaded (or created) song in the editor, starting on `trackId`. */
export function loadSongIntoEditor(trackId: number): void {
  resetEditorState()
  Song.currentTrackId = trackId
  Song.measureMoveHelper = Song.measures.map((bars) => bars.map((voices) => voices.map(() => [])))
  for (let track = 0; track < Song.measures.length; track += 1) {
    for (let voice = 0; voice < Song.numVoices; voice += 1) {
      createMeasures(track, voice)
      fillMeasures(track, voice)
    }
  }
  fillTimeSignatures()
  for (let track = 0; track < Song.tracks.length; track += 1) {
    initTrackPlayback(track)
  }

  selectionState.cursor = { trackId: 0, blockId: 0, beatId: 0, voiceId: 0, string: 0 }
  redrawTrack(trackId, 0)
  setTrackSignIcon(instrumentIconSrc(Song.playBackInstrument[trackId].instrument))
  setSequencerIndicator(0, 0)
  modalManager.closeAllModals()
  notifySongDataChanged()
}

/**
 * Shows another track or voice. Does nothing (but still calls `callback`)
 * when it is already shown, unless `force`.
 */
export function switchTrack(
  trackId: number,
  voiceId: number,
  force = false,
  callback: (() => void) | null = null,
): void {
  if (!force && Song.currentTrackId === trackId && Song.currentVoiceId === voiceId) {
    callback?.()
    return
  }
  Song.currentTrackId = trackId
  Song.currentVoiceId = voiceId
  clearRange()
  setTrackSignIcon(instrumentIconSrc(Song.playBackInstrument[trackId].instrument))
  playback.followTrackChange()
  // The cursor's beat or string may not exist on the new track.
  selectionState.cursor.beatId = 0
  selectionState.cursor.string = 0
  redrawTrack(trackId, voiceId, callback)
  notifySongDataChanged()
}
