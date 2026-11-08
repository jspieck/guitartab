import Song from '../../stores/song'
import { audioGraph } from '../audio/audioGraph'
import type { Chord } from '../../types/tab'
import type { PlayBackInstrument, Track } from '../../stores/song'
import type { EqBand, TrackAmp, TrackCompressor } from '../../types/song'
import { notifySongDataChanged } from '../appEvents'
import { cloneData, executeCommand, setValue, syncInto, trackScoped, type EditCommand } from './editCommands'
import { requestChordDiagramsRender } from './renderCommands'
import { clampTempo } from '../../utils/tempo'

/**
 * Song tempo. Pass `before` when the tempo was already changed live (the
 * toolbar drag updates it on every mouse move and records once on release).
 */
export function setSongTempo(bpm: number, before?: number): EditCommand | null {
  return setValue(
    {
      label: 'Tempo',
      get: () => Song.bpm,
      set: (value) => Song.setTempo(value),
    },
    clampTempo(bpm),
    before,
  )
}

/** Live update of a track's volume, without an undo entry (slider drag). */
export function previewTrackVolume(trackId: number, volume: number): void {
  const instrument = Song.playBackInstrument[trackId]
  if (instrument) {
    instrument.volume = volume
  }
  audioGraph.busses[trackId]?.setVolume(volume / 100.0)
}

/** A track's mixer volume (0–127). */
export function setTrackVolume(trackId: number, volume: number, before?: number): EditCommand | null {
  return setValue(
    {
      label: 'Track volume',
      trackId,
      get: (currentTrackId) => Song.playBackInstrument[currentTrackId ?? trackId]?.volume ?? 60,
      set: (value, currentTrackId) => previewTrackVolume(currentTrackId ?? trackId, value),
    },
    volume,
    before,
  )
}

/** Live change of a track's amp (null: back to the program's default), without an undo entry. */
export function previewTrackAmp(trackId: number, amp: TrackAmp | null): void {
  const track = Song.tracks[trackId]
  if (track == null) return
  if (amp) track.amp = { ...amp }
  else delete track.amp
  audioGraph.applyTrackAmp(trackId)
}

/**
 * A track's amp and cabinet settings. The amp panel previews every knob move and records once
 * when it closes, passing what the track had when it opened as `before`.
 */
export function setTrackAmp(
  trackId: number,
  amp: TrackAmp | null,
  before?: TrackAmp | null,
): EditCommand | null {
  return setValue(
    {
      label: 'Amp settings',
      trackId,
      get: (currentTrackId) => cloneData(Song.tracks[currentTrackId ?? trackId]?.amp ?? null),
      set: (value, currentTrackId) => previewTrackAmp(currentTrackId ?? trackId, value),
    },
    amp,
    before,
  )
}

/**
 * A track's channel EQ (null: flat, out of the bus). Mixer setting: no undo step, like the
 * sequencer's pan and effect knobs; autosave sees it through the change event.
 */
export function setTrackEq(trackId: number, bands: EqBand[] | null): void {
  const track = Song.tracks[trackId]
  if (track == null) return
  if (bands) track.eq = cloneData(bands)
  else delete track.eq
  audioGraph.applyTrackInserts(trackId)
  notifySongDataChanged()
}

/** A track's channel compressor (null: none). Mixer setting, no undo step. */
export function setTrackCompressor(trackId: number, compressor: TrackCompressor | null): void {
  const track = Song.tracks[trackId]
  if (track == null) return
  if (compressor) track.compressor = { ...compressor }
  else delete track.compressor
  audioGraph.applyTrackInserts(trackId)
  notifySongDataChanged()
}

function trackChords(trackId: number): Map<string, Chord> {
  if (Song.chordsMap[trackId] == null) {
    Song.chordsMap[trackId] = new Map()
  }
  return Song.chordsMap[trackId]
}

/** Removes a chord from the track's chord library (beats keep their chord names). */
export function deleteLibraryChord(trackId: number, name: string): EditCommand | null {
  const chord = Song.chordsMap[trackId]?.get(name)
  if (chord == null) {
    return null
  }
  const ref = { trackId }
  const command = trackScoped<EditCommand>(
    {
      label: 'Delete chord',
      apply: () => trackChords(ref.trackId).delete(name),
      invert: () => trackChords(ref.trackId).set(name, chord),
      afterChange: requestChordDiagramsRender,
    },
    ref,
  )
  executeCommand(command)
  return command
}

/** Shows or hides a library chord's diagram above the tab. */
export function toggleLibraryChordDisplay(trackId: number, name: string): EditCommand | null {
  if (Song.chordsMap[trackId]?.get(name) == null) {
    return null
  }
  const flip = (currentTrackId: number) => {
    const chord = trackChords(currentTrackId).get(name)
    if (chord) {
      chord.display = !chord.display
    }
  }
  const ref = { trackId }
  const command = trackScoped<EditCommand>(
    {
      label: 'Chord diagram visibility',
      apply: () => flip(ref.trackId),
      invert: () => flip(ref.trackId),
      afterChange: requestChordDiagramsRender,
    },
    ref,
  )
  executeCommand(command)
  return command
}

interface TrackState {
  track: Track
  playback: PlayBackInstrument | undefined
}

function captureTrack(trackId: number): TrackState {
  return { track: cloneData(Song.tracks[trackId]), playback: cloneData(Song.playBackInstrument[trackId]) }
}

function restoreTrack(trackId: number, state: TrackState): void {
  // The channel EQ and compressor are mixer settings without undo: undoing an older track
  // edit keeps them as they are now.
  const restored = cloneData(state.track)
  const { eq, compressor } = Song.tracks[trackId] ?? {}
  delete restored.eq
  delete restored.compressor
  if (eq) restored.eq = cloneData(eq)
  if (compressor) restored.compressor = cloneData(compressor)
  syncInto(
    Song.tracks[trackId] as unknown as Record<string, unknown>,
    restored as unknown as Record<string, unknown>,
  )
  const playback = Song.playBackInstrument[trackId]
  if (playback && state.playback) {
    syncInto(
      playback as unknown as Record<string, unknown>,
      cloneData(state.playback) as unknown as Record<string, unknown>,
    )
  }
}

/**
 * Runs `mutate` on a track's settings (name, tuning, capo, instrument…) and
 * records one undo step. `afterChange(trackId)` refreshes what depends on them.
 */
export function recordTrackEdit(
  label: string,
  trackId: number,
  mutate: () => void,
  afterChange?: (trackId: number) => void,
): EditCommand | null {
  const before = captureTrack(trackId)
  mutate()
  const after = captureTrack(trackId)
  if (JSON.stringify(before) === JSON.stringify(after)) {
    return null
  }
  const ref = { trackId }
  const command = trackScoped<EditCommand>(
    {
      label,
      apply: () => restoreTrack(ref.trackId, after),
      invert: () => restoreTrack(ref.trackId, before),
      afterChange: () => afterChange?.(ref.trackId),
    },
    ref,
  )
  executeCommand(command, { alreadyApplied: true })
  return command
}

/** Runs `mutate` on the song description (title, artist, comments…) as one undo step. */
export function recordSongInfoEdit(mutate: () => void): EditCommand | null {
  const before = cloneData(Song.songDescription)
  mutate()
  const after = cloneData(Song.songDescription)
  if (JSON.stringify(before) === JSON.stringify(after)) {
    return null
  }
  const restore = (state: typeof before) =>
    syncInto(
      Song.songDescription as unknown as Record<string, unknown>,
      cloneData(state) as unknown as Record<string, unknown>,
    )
  const command: EditCommand = {
    label: 'Song info',
    apply: () => restore(after),
    invert: () => restore(before),
  }
  executeCommand(command, { alreadyApplied: true })
  return command
}

/** Adds or replaces a chord in the track's chord library. */
export function setLibraryChord(trackId: number, chord: Chord): EditCommand {
  const before = Song.chordsMap[trackId]?.get(chord.name)
  const ref = { trackId }
  const command = trackScoped<EditCommand>(
    {
      label: 'Chord library',
      apply: () => trackChords(ref.trackId).set(chord.name, cloneData(chord)),
      invert: () => {
        if (before) trackChords(ref.trackId).set(chord.name, cloneData(before))
        else trackChords(ref.trackId).delete(chord.name)
      },
      afterChange: requestChordDiagramsRender,
    },
    ref,
  )
  executeCommand(command)
  return command
}
