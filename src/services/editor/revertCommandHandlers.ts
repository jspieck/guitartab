import Song, {
  Beat,
  MeasureMetaInfo,
  Track,
  Bend,
  TremoloBar,
  Chord,
  Marker,
  Stroke,
  Grace,
  Note,
  BeatEffects,
  VoiceSnapshot,
} from '../../assets/js/songData'
import { setMenuEffectVariable, type MenuEffectState } from '../menuEffectMutations'
import { tab, Tab } from '../../assets/js/tab'
import AppManager from '../../assets/js/appManager'
import { sequencerHandler, SequencerHandler } from '../../assets/js/sequencerHandler'
import { menuHandler } from '../../assets/js/menuHandler'
import { processEffectSelect, setEffectVariable } from '../../assets/js/menuHelper'
import { typedEventBus } from '../../utils/typedEventBus'
import { requestBlockRender, requestDurationRender } from './renderCommands'

function requestCurrentVoiceBlockRender(trackId: number, blockId: number) {
  requestBlockRender(trackId, blockId, Song.currentVoiceId)
}

// Note length
export function revertNoteLength(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  measureBefore: Beat[]
}) {
  Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId] = infoObj.measureBefore
  tab.drawTrack(infoObj.trackId, infoObj.voiceId, true, null)
}

export function restoreNoteLength(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  measureAfter: Beat[]
}) {
  Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId] = infoObj.measureAfter
  tab.drawTrack(infoObj.trackId, infoObj.voiceId, true, null)
}

// Delete Note
export function revertDeleteNote(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  noteObj: Note
  effectObj: BeatEffects
}) {
  const { trackId, blockId, voiceId, beatId, string, noteObj, effectObj } = infoObj
  const redrawSequencer = Song.isBeatEmpty(trackId, blockId)
  const beatObj = Song.getBeat({ trackId, blockId, voiceId, beatId })
  beatObj.duration = beatObj.duration[0]
  beatObj.notes[string] = noteObj
  beatObj.effects = effectObj
  if (trackId === Song.currentTrackId && voiceId === Song.currentVoiceId) {
    requestCurrentVoiceBlockRender(trackId, blockId)
  }
  if (redrawSequencer) {
    sequencerHandler.redrawSequencerMain()
  }
}

export function restoreDeleteNote(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
}) {
  Tab.deleteNote(infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId, infoObj.string, true)
  if (infoObj.trackId === Song.currentTrackId && infoObj.voiceId === Song.currentVoiceId) {
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  }
}

// Copy Paste
export function revertCopyPaste(infoObj: {
  trackId: number
  voiceId: number
  blocksBefore: { blockId: number; block: Beat[][] }[]
}) {
  for (let i = 0, n = infoObj.blocksBefore.length; i < n; i += 1) {
    const { blockId } = infoObj.blocksBefore[i]
    Song.measures[infoObj.trackId][blockId] = infoObj.blocksBefore[i].block
  }
  if (infoObj.trackId === Song.currentTrackId && infoObj.voiceId === Song.currentVoiceId) {
    tab.drawTrack(0, 0, true, null)
  }
}

export function restoreCopyPaste(infoObj: {
  trackId: number
  voiceId: number
  blocksAfter: { blockId: number; block: Beat[][] }[]
}) {
  for (let i = 0, n = infoObj.blocksAfter.length; i < n; i += 1) {
    const { blockId } = infoObj.blocksAfter[i]
    Song.measures[infoObj.trackId][blockId] = infoObj.blocksAfter[i].block
  }
  if (infoObj.trackId === Song.currentTrackId && infoObj.voiceId === Song.currentVoiceId) {
    tab.drawTrack(0, 0, true, null)
  }
}

// Tied
export function revertTied(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  noteTiedTo: { blockId: number; beatId: number }
}) {
  // Handle tied note restoration directly
  const beat = Song.getBeat(infoObj)
  const note = beat.notes[infoObj.string]
  if (note != null) {
    note.tied = !note.tied
    note.tiedTo = note.tied ? infoObj.noteTiedTo : { blockId: -1, beatId: -1 }
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
    typedEventBus.emit('menu.activateEffectsForMarkedPos')
  }
}

export function restoreTied(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  noteTiedTo: { blockId: number; beatId: number }
}) {
  // Handle tied note restoration directly
  const beat = Song.getBeat(infoObj)
  const note = beat.notes[infoObj.string]
  if (note != null) {
    note.tied = !note.tied
    note.tiedTo = note.tied ? infoObj.noteTiedTo : { blockId: -1, beatId: -1 }
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
    typedEventBus.emit('menu.activateEffectsForMarkedPos')
  }
}

// Note placement
export function revertNotePlacement(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  previousFret: number
}) {
  if (infoObj.previousFret !== -1) {
    tab.drawNote(
      infoObj.trackId,
      infoObj.blockId,
      infoObj.voiceId,
      infoObj.beatId,
      infoObj.string,
      infoObj.previousFret,
      true,
    )
  } else {
    Tab.deleteNote(infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId, infoObj.string, true)
    requestDurationRender(infoObj.trackId, infoObj.blockId, infoObj.voiceId)
  }
}

export function restoreNotePlacement(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  newFret: number
}) {
  tab.drawNote(
    infoObj.trackId,
    infoObj.blockId,
    infoObj.voiceId,
    infoObj.beatId,
    infoObj.string,
    infoObj.newFret,
    true,
  )
}

// Special Select effects - simplified implementation
export function setSpecialSelect(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  tupleSel: number
  id: string
}) {
  // Simplified implementation for special select operations
  if (infoObj.id === 'tuplet') {
    const tupletSet = tab.setTuplet(
      infoObj.trackId,
      infoObj.blockId,
      infoObj.voiceId,
      infoObj.beatId,
      infoObj.tupleSel,
    )
    if (tupletSet) {
      requestDurationRender(infoObj.trackId, infoObj.blockId, infoObj.voiceId)
      tab.drawTrack(infoObj.trackId, infoObj.voiceId, true, null)
    }
  }

  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

// Zoom
export function revertZoom(infoObj: { up: boolean }) {
  tab.scaleCompleteTab(!infoObj.up)
}

export function restoreZoom(infoObj: { up: boolean }) {
  tab.scaleCompleteTab(infoObj.up)
}

// NoteEffectSelect
export function revertNoteEffectSelect(infoObj: {
  arr: {
    notes: { trackId: number; blockId: number; voiceId: number; beatId: number; string: number; note: Note }[]
    blocks: number[]
    beats: { trackId: number; blockId: number; voiceId: number; beatId: number; beat: Beat }[]
  }
  changes: { [key: string]: { [s: string]: MenuEffectState } }
  id: string
}) {
  for (const no of infoObj.arr.notes) {
    const { trackId, blockId, voiceId, beatId, string } = no
    const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`
    const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
    // Restore every effect of the group, including the toggled one, from the
    // snapshot. Re-toggling it instead would lose data such as a bend curve.
    for (const effect in infoObj.changes[noteStr]) {
      setEffectVariable(beat, beat.notes[string], effect, infoObj.changes[noteStr][effect])
    }
  }
  const trackId = infoObj.arr.notes[0]?.trackId ?? Song.currentTrackId
  for (const blockId of infoObj.arr.blocks) {
    requestCurrentVoiceBlockRender(trackId, blockId)
  }
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

export function restoreNoteEffectSelect(infoObj: {
  arr: {
    notes: { trackId: number; blockId: number; voiceId: number; beatId: number; string: number; note: Note }[]
    blocks: number[]
    beats: { trackId: number; blockId: number; voiceId: number; beatId: number; beat: Beat }[]
  }
  id: string
}) {
  processEffectSelect(infoObj.arr, infoObj.id, true)
}

// NotationSelect: restore the effect group snapshots taken around the toggle
function applyNotationState(
  infoObj: { trackId: number; blockId: number; voiceId: number; beatId: number },
  state: Record<string, MenuEffectState> | undefined,
) {
  const beat = Song.getBeat(infoObj)
  for (const [effectId, value] of Object.entries(state ?? {})) {
    setMenuEffectVariable(beat, null, effectId, value, Song.measureMeta[infoObj.blockId])
  }
  SequencerHandler.setMarker(infoObj.blockId)
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

export function revertNotationSelect(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  id: string
  stateBefore?: Record<string, MenuEffectState>
}) {
  applyNotationState(infoObj, infoObj.stateBefore)
}

export function restoreNotationSelect(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  id: string
  stateAfter?: Record<string, MenuEffectState>
}) {
  applyNotationState(infoObj, infoObj.stateAfter)
}

// Dynamic Select - simplified implementation
export function revertDynamicSelect({
  trackId,
  blockId,
  voiceId,
  beatId,
  id,
}: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  id: string
}) {
  const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
  beat.dynamicPresent = !beat.dynamicPresent
  if (beat.dynamicPresent) {
    beat.dynamic = id.replace('Dynamic', '')
  }
  requestCurrentVoiceBlockRender(trackId, blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

export function restoreDynamicSelect({
  trackId,
  blockId,
  voiceId,
  beatId,
  id,
}: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  id: string
}) {
  const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
  beat.dynamicPresent = !beat.dynamicPresent
  if (beat.dynamicPresent) {
    beat.dynamic = id.replace('Dynamic', '')
  }
  requestCurrentVoiceBlockRender(trackId, blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

// OpenBar and closeBar - simplified implementation
export function toggleMeasureSelect(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  id: string
}) {
  if (infoObj.id === 'openBar') {
    Song.measureMeta[infoObj.blockId].repeatOpen = !Song.measureMeta[infoObj.blockId].repeatOpen
  }
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

// Text
function setBeatText(beat: Beat, text: string | undefined) {
  if (text == null || text === '') {
    delete beat.text
  } else {
    beat.text = text
  }
}

export function revertText({
  trackId,
  blockId,
  voiceId,
  beatId,
  previousText,
}: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  previousText?: string
}) {
  setBeatText(Song.getBeat({ trackId, blockId, voiceId, beatId }), previousText)
  requestCurrentVoiceBlockRender(trackId, blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

export function restoreText({
  trackId,
  blockId,
  voiceId,
  beatId,
  nextText,
}: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  nextText?: string
}) {
  setBeatText(Song.getBeat({ trackId, blockId, voiceId, beatId }), nextText)
  requestCurrentVoiceBlockRender(trackId, blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

// Marker
/** Sets or (for undefined) removes an optional bar field. */
function setOptionalMeta<K extends 'marker' | 'bpm' | 'repeatAlternative' | 'repeatClose'>(
  blockId: number,
  key: K,
  value: MeasureMetaInfo[K] | undefined,
) {
  if (value == null) {
    delete Song.measureMeta[blockId][key]
  } else {
    Song.measureMeta[blockId][key] = value
  }
}

export function revertMarker(infoObj: { trackId?: number; blockId: number; markerBefore?: Marker }) {
  setOptionalMeta(infoObj.blockId, 'marker', infoObj.markerBefore)
  SequencerHandler.setMarker(infoObj.blockId)
  if (infoObj.trackId != null) requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

export function restoreMarker(infoObj: { trackId?: number; blockId: number; markerAfter?: Marker }) {
  setOptionalMeta(infoObj.blockId, 'marker', infoObj.markerAfter)
  SequencerHandler.setMarker(infoObj.blockId)
  if (infoObj.trackId != null) requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

// Time Meter
export function revertTimeMeter(infoObj: {
  blockId: number
  timeMeterPresentBefore: boolean
  notesBefore: VoiceSnapshot[][][]
  numeratorBefore: number
  denominatorBefore: number
}) {
  Song.measureMeta[infoObj.blockId].timeMeterPresent = infoObj.timeMeterPresentBefore
  // Put back the beats the change cut off, and drop the rests it added to fill bars.
  // (This used to read beatId from the wrong level and wrote into voice[undefined].)
  infoObj.notesBefore.forEach((voices, trackId) => {
    voices.forEach((snapshots, voiceId) => {
      for (const { blockId, beatCount, beats } of snapshots) {
        Song.measureMeta[blockId].numerator = infoObj.numeratorBefore
        Song.measureMeta[blockId].denominator = infoObj.denominatorBefore
        const voice = Song.measures[trackId][blockId][voiceId]
        for (const { beatId, beat } of beats) {
          voice[beatId] = JSON.parse(JSON.stringify(beat))
        }
        voice.length = beatCount
      }
    })
  })
  tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

export function restoreTimeMeter(infoObj: {
  blockId: number
  timeMeterPresentAfter: boolean
  numeratorAfter: number
  denominatorAfter: number
}) {
  Song.measureMeta[infoObj.blockId].timeMeterPresent = infoObj.timeMeterPresentAfter
  Song.measureMeta[infoObj.blockId].numerator = infoObj.numeratorAfter
  Song.measureMeta[infoObj.blockId].denominator = infoObj.denominatorAfter
  AppManager.checkAndAdaptTimeMeter(infoObj.blockId)
  tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

// Bpm Meter
export function revertBpmMeter(infoObj: { trackId: number; blockId: number; bpmBefore?: number }) {
  setOptionalMeta(infoObj.blockId, 'bpm', infoObj.bpmBefore)
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

export function restoreBpmMeter(infoObj: { trackId: number; blockId: number; bpmAfter?: number }) {
  setOptionalMeta(infoObj.blockId, 'bpm', infoObj.bpmAfter)
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

// Chord
function setBeatChord(beat: Beat, chord: Chord | undefined) {
  if (chord == null) {
    delete beat.chord
  } else {
    beat.chord = chord
  }
}

export function revertChord({
  trackId,
  blockId,
  voiceId,
  beatId,
  chordBefore,
}: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  chordBefore?: Chord
}) {
  setBeatChord(Song.getBeat({ trackId, blockId, voiceId, beatId }), chordBefore)
  requestCurrentVoiceBlockRender(trackId, blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

export function restoreChord({
  trackId,
  blockId,
  voiceId,
  beatId,
  chordAfter,
}: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  chordAfter?: Chord
}) {
  setBeatChord(Song.getBeat({ trackId, blockId, voiceId, beatId }), chordAfter)
  requestCurrentVoiceBlockRender(trackId, blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

// Repeat Alternative
export function revertRepeatAlternative({
  trackId,
  blockId,
  repeatAlternativeBefore,
}: {
  trackId: number
  blockId: number
  repeatAlternativeBefore?: number
}) {
  setOptionalMeta(blockId, 'repeatAlternative', repeatAlternativeBefore)
  requestCurrentVoiceBlockRender(trackId, blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

export function restoreRepeatAlternative({
  trackId,
  blockId,
  repeatAlternativeAfter,
}: {
  trackId: number
  blockId: number
  repeatAlternativeAfter?: number
}) {
  setOptionalMeta(blockId, 'repeatAlternative', repeatAlternativeAfter)
  requestCurrentVoiceBlockRender(trackId, blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

// Repeat Close
export function revertRepeatClose(infoObj: { trackId: number; blockId: number; repeatCloseBefore?: number }) {
  setOptionalMeta(infoObj.blockId, 'repeatClose', infoObj.repeatCloseBefore)
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

export function restoreRepeatClose(infoObj: { trackId: number; blockId: number; repeatCloseAfter?: number }) {
  setOptionalMeta(infoObj.blockId, 'repeatClose', infoObj.repeatCloseAfter)
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

// Stroke
function setOptionalEffect<K extends 'stroke' | 'tremoloBar'>(beat: Beat, key: K, value: BeatEffects[K]) {
  if (value == null) {
    delete beat.effects[key]
  } else {
    beat.effects[key] = value
  }
}

export function revertStroke(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  strokeBefore?: Stroke
}) {
  const beat = Song.getBeat(infoObj)
  setOptionalEffect(beat, 'stroke', infoObj.strokeBefore)
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedBeat')
}

export function restoreStroke(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  strokeAfter?: Stroke
}) {
  const beat = Song.getBeat(infoObj)
  setOptionalEffect(beat, 'stroke', infoObj.strokeAfter)
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedBeat')
}

// Artificial
function setOptionalNoteField<K extends 'artificialStyle' | 'graceObj' | 'bendObj'>(
  note: Note,
  key: K,
  value: Note[K] | undefined,
) {
  if (value == null) {
    delete note[key]
  } else {
    note[key] = value
  }
}

export function revertArtificial({
  trackId,
  blockId,
  voiceId,
  beatId,
  string,
  artificialBefore,
}: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  artificialBefore?: string
}) {
  const note = Song.getBeat({ trackId, blockId, voiceId, beatId }).notes[string]
  if (note != null) {
    setOptionalNoteField(note, 'artificialStyle', artificialBefore)
    requestCurrentVoiceBlockRender(trackId, blockId)
    typedEventBus.emit('menu.activateEffectsForMarkedPos')
  } else {
    console.error('Note is null')
  }
}

export function restoreArtificial({
  trackId,
  blockId,
  voiceId,
  beatId,
  string,
  artificialAfter,
}: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  artificialAfter?: string
}) {
  const note = Song.getBeat({ trackId, blockId, voiceId, beatId }).notes[string]
  if (note != null) {
    setOptionalNoteField(note, 'artificialStyle', artificialAfter)
    requestCurrentVoiceBlockRender(trackId, blockId)
    typedEventBus.emit('menu.activateEffectsForMarkedPos')
  } else {
    console.error('Note is nul')
  }
}

// Grace
export function revertGrace({
  trackId,
  blockId,
  voiceId,
  beatId,
  string,
  graceBefore,
}: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  graceBefore?: Grace
}) {
  const note = Song.getBeat({ trackId, blockId, voiceId, beatId }).notes[string]
  if (note != null) {
    setOptionalNoteField(note, 'graceObj', graceBefore)
    requestCurrentVoiceBlockRender(trackId, blockId)
    typedEventBus.emit('menu.activateEffectsForMarkedPos')
  } else {
    console.error('Note is null')
  }
}

export function restoreGrace({
  trackId,
  blockId,
  voiceId,
  beatId,
  string,
  graceAfter,
}: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  graceAfter?: Grace
}) {
  const note = Song.getBeat({ trackId, blockId, voiceId, beatId }).notes[string]
  if (note != null) {
    setOptionalNoteField(note, 'graceObj', graceAfter)
    requestCurrentVoiceBlockRender(trackId, blockId)
    typedEventBus.emit('menu.activateEffectsForMarkedPos')
  } else {
    console.error('Note is null')
  }
}

// TremoloBar
export function revertTremoloBar(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  tremoloBarBefore?: TremoloBar
  effectsBefore: { string: number; effects: { [s: string]: MenuEffectState } }[]
}) {
  const beat = Song.getBeat(infoObj)
  setOptionalEffect(beat, 'tremoloBar', infoObj.tremoloBarBefore)
  for (const { string, effects } of infoObj.effectsBefore) {
    for (const effect in effects) {
      if (Object.prototype.hasOwnProperty.call(effects, effect)) {
        setEffectVariable(beat, beat.notes[string], effect, effects[effect])
      }
    }
  }
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedBeat')
}

export function restoreTremoloBar(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  tremoloBarAfter?: TremoloBar
  effectsBefore: { string: number; effects: { [s: string]: MenuEffectState } }[]
}) {
  menuHandler.handleEffectGroupCollisionBeat([infoObj], 'tremoloBar', infoObj.tremoloBarAfter != null)
  const beat = Song.getBeat(infoObj)
  setOptionalEffect(beat, 'tremoloBar', infoObj.tremoloBarAfter)
  requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
  typedEventBus.emit('menu.activateEffectsForMarkedBeat')
}

// tremoloPicking
export function revertTremoloPicking(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  tremoloPickingBefore: string
  tremoloPickingPresentBefore: boolean
  effectsBefore: { [m: string]: MenuEffectState }
}) {
  const beat = Song.getBeat(infoObj)
  const note = beat.notes[infoObj.string]
  if (note != null) {
    note.tremoloPickingLength = infoObj.tremoloPickingBefore
    note.tremoloPicking = infoObj.tremoloPickingPresentBefore
    for (const effect in infoObj.effectsBefore) {
      if (Object.prototype.hasOwnProperty.call(infoObj.effectsBefore, effect)) {
        setEffectVariable(beat, note, effect, infoObj.effectsBefore[effect])
      }
    }
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
    typedEventBus.emit('menu.activateEffectsForMarkedPos')
  } else {
    console.error('Note is null')
  }
}

export function restoreTremoloPicking(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  tremoloPickingAfter: string
  tremoloPickingPresentAfter: boolean
}) {
  const { trackId, blockId, voiceId, beatId, string, tremoloPickingAfter, tremoloPickingPresentAfter } =
    infoObj
  menuHandler.handleEffectGroupCollision([infoObj], 'tremoloPicking', tremoloPickingPresentAfter)
  const note = Song.getBeat({ trackId, blockId, voiceId, beatId }).notes[string]
  if (note != null) {
    note.tremoloPickingLength = tremoloPickingAfter
    note.tremoloPicking = tremoloPickingPresentAfter
    requestCurrentVoiceBlockRender(trackId, blockId)
    typedEventBus.emit('menu.activateEffectsForMarkedPos')
  } else {
    console.error('Note is null')
  }
}

// Bend
export function revertBend(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  bendBefore?: Bend
  effectsBefore: { [m: string]: MenuEffectState }
}) {
  const beat = Song.getBeat(infoObj)
  const note = beat.notes[infoObj.string]
  if (note != null) {
    setOptionalNoteField(note, 'bendObj', infoObj.bendBefore)
    for (const effect in infoObj.effectsBefore) {
      if (Object.prototype.hasOwnProperty.call(infoObj.effectsBefore, effect)) {
        setEffectVariable(beat, note, effect, infoObj.effectsBefore[effect])
      }
    }
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId)
    typedEventBus.emit('menu.activateEffectsForMarkedPos')
  } else {
    console.error('Note is null')
  }
}

export function restoreBend(infoObj: {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  bendAfter?: Bend
}) {
  const { trackId, blockId, voiceId, beatId, string, bendAfter } = infoObj
  // Switching the bend on also clears the other effects in its group (slide, pull-off).
  menuHandler.handleEffectGroupCollision([infoObj], 'bend', bendAfter == null)
  const note = Song.getBeat({ trackId, blockId, voiceId, beatId }).notes[string]
  if (note != null) {
    setOptionalNoteField(note, 'bendObj', bendAfter)
    requestCurrentVoiceBlockRender(trackId, blockId)
    typedEventBus.emit('menu.activateEffectsForMarkedPos')
  } else {
    console.error('Note is null')
  }
}

export function adaptToChangedTrack(trackId: number, currentTrack: Track, trackAfter: Track) {
  if (currentTrack.numStrings !== trackAfter.numStrings) {
    tab.redrawCompleteTrack(trackId)
  }
  if (trackId === Song.currentTrackId) {
    tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null)
  }
  AppManager.setTrackInstrument(trackId)
}

// InstrumentSettings
export function revertInstrumentSetting(infoObj: { trackId: number; trackBefore: Track }) {
  const currentTrack = Song.tracks[infoObj.trackId]
  Song.tracks[infoObj.trackId] = infoObj.trackBefore
  adaptToChangedTrack(infoObj.trackId, currentTrack, infoObj.trackBefore)
}

export function restoreInstrumentSetting(infoObj: { trackId: number; trackAfter: Track }) {
  const currentTrack = Song.tracks[infoObj.trackId]
  Song.tracks[infoObj.trackId] = infoObj.trackAfter
  adaptToChangedTrack(infoObj.trackId, currentTrack, infoObj.trackAfter)
}

// Add BLOCK
export function revertAddBlock() {
  tab.removeBlock(true)
}

export function restoreAddBlock() {
  tab.addBlock(true)
}

// Remove Block
export function revertRemoveBlock(info: { blocksBefore: Beat[][][]; measureMetaBefore: MeasureMetaInfo }) {
  for (let i = 0; i < info.blocksBefore.length; i += 1) {
    if (Song.measures[i] != null) {
      Song.measures[i].push(info.blocksBefore[i])
    }
  }
  Song.measureMeta.push(info.measureMetaBefore)
  Song.numMeasures += 1
  tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null)
  sequencerHandler.redrawSequencerMain()
}

export function restoreRemoveBlock() {
  tab.removeBlock(true)
}
