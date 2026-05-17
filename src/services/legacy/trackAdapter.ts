import Song, { type PlayBackInstrument, type Track as SongTrack } from '../../assets/js/songData'
import EventBus from '../../assets/js/eventBus'
import { typedEventBus } from '../../utils/typedEventBus'
import type { TrackColor, TrackInstrumentSettings, TrackUpdate, TrackViewModel } from '../../types/track'

const DEFAULT_TRACK_COLOR: TrackColor = { red: 255, green: 0, blue: 0 }
const DEFAULT_PLAYBACK_SETTINGS: TrackInstrumentSettings = {
  instrument: 'guitar',
  solo: false,
  mute: false,
  volume: 100,
  tremolo: 0,
  reverb: 0,
  chorus: 0,
  phaser: 0,
  balance: 64,
}
const STANDARD_TUNING = [64, 59, 55, 50, 45, 40]

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeProgram(program: number | string | undefined): number {
  const parsed = typeof program === 'string' ? Number.parseInt(program, 10) : program
  return Number.isFinite(parsed) && Number(parsed) > 0 ? Number(parsed) : 25
}

function normalizeColor(color: TrackColor | undefined): TrackColor {
  if (!color) {
    return { ...DEFAULT_TRACK_COLOR }
  }

  return {
    red: color.red ?? DEFAULT_TRACK_COLOR.red,
    green: color.green ?? DEFAULT_TRACK_COLOR.green,
    blue: color.blue ?? DEFAULT_TRACK_COLOR.blue,
  }
}

function arraysMatch(left: number[] | undefined, right: number[]): boolean {
  if (!left || left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function ensurePlaybackSettings(trackId: number): PlayBackInstrument {
  if (!Song.playBackInstrument[trackId]) {
    Song.playBackInstrument[trackId] = { ...DEFAULT_PLAYBACK_SETTINGS }
  }

  return Song.playBackInstrument[trackId]
}

export function resizeTrackTuning(tuning: number[], targetLength: number): number[] {
  const nextLength = clamp(1, targetLength, 12)
  const nextTuning = tuning.slice(0, nextLength)

  while (nextTuning.length < nextLength) {
    nextTuning.push(STANDARD_TUNING[nextTuning.length] ?? 40)
  }

  return nextTuning
}

export function trackToViewModel(
  track: SongTrack | undefined,
  playback: PlayBackInstrument | undefined,
  index: number,
): TrackViewModel {
  const numStrings = track?.numStrings || track?.strings?.length || 6
  const tuning = resizeTrackTuning(track?.strings ?? [], numStrings)

  return {
    id: index,
    name: track?.name || `Track ${index + 1}`,
    numStrings: tuning.length,
    tuning,
    capo: track?.capo || 0,
    color: normalizeColor(track?.color),
    program: normalizeProgram(track?.program),
    volume: playback?.volume ?? DEFAULT_PLAYBACK_SETTINGS.volume,
    balance: playback?.balance ?? DEFAULT_PLAYBACK_SETTINGS.balance,
    reverb: playback?.reverb ?? DEFAULT_PLAYBACK_SETTINGS.reverb,
    isMuted: playback?.mute ?? DEFAULT_PLAYBACK_SETTINGS.mute,
    isSolo: playback?.solo ?? DEFAULT_PLAYBACK_SETTINGS.solo,
  }
}

function emitSongDataChanged() {
  EventBus.emit('song-data-changed')
}

function listTrackViewModels(
  tracks: SongTrack[] = Song.tracks,
  playbackInstruments: PlayBackInstrument[] = Song.playBackInstrument,
): TrackViewModel[] {
  return (tracks ?? []).map((track, index) => trackToViewModel(track, playbackInstruments?.[index], index))
}

function getTrackViewModel(
  trackId: number,
  tracks: SongTrack[] = Song.tracks,
  playbackInstruments: PlayBackInstrument[] = Song.playBackInstrument,
): TrackViewModel | null {
  const track = tracks?.[trackId]
  if (!track) {
    return null
  }

  return trackToViewModel(track, playbackInstruments?.[trackId], trackId)
}

function selectTrack(trackId: number): void {
  if (trackId >= 0 && trackId < (Song.tracks?.length ?? 0)) {
    Song.currentTrackId = trackId
    typedEventBus.emit('ui.trackChanged', trackId)
  }
}

function selectVoice(voiceId: number): void {
  if (voiceId >= 0 && voiceId < 4) {
    Song.currentVoiceId = voiceId
    typedEventBus.emit('ui.voiceChanged', voiceId)
  }
}

function updateTrack(trackId: number, patch: TrackUpdate): void {
  const track = Song.tracks?.[trackId]
  if (!track) {
    return
  }

  const playback = ensurePlaybackSettings(trackId)
  let didChange = false

  if (patch.name !== undefined) {
    const nextName = patch.name.trim() || `Track ${trackId + 1}`
    if (track.name !== nextName) {
      track.name = nextName
      didChange = true
    }
  }

  if (patch.color !== undefined) {
    const nextColor = normalizeColor(patch.color)
    if (
      track.color.red !== nextColor.red
      || track.color.green !== nextColor.green
      || track.color.blue !== nextColor.blue
    ) {
      track.color = nextColor
      didChange = true
    }
  }

  if (patch.capo !== undefined) {
    const nextCapo = clamp(0, patch.capo, 24)
    if (track.capo !== nextCapo) {
      track.capo = nextCapo
      didChange = true
    }
  }

  if (patch.program !== undefined) {
    const nextProgram = normalizeProgram(patch.program)
    if (track.program !== nextProgram) {
      track.program = nextProgram
      didChange = true
    }
  }

  if (patch.tuning !== undefined || patch.numStrings !== undefined) {
    const requestedLength = patch.numStrings ?? track.numStrings ?? patch.tuning?.length ?? 6
    const nextTuning = resizeTrackTuning(patch.tuning ?? track.strings ?? [], requestedLength)

    if (!arraysMatch(track.strings, nextTuning)) {
      track.strings = nextTuning
      didChange = true
    }

    if (track.numStrings !== nextTuning.length) {
      track.numStrings = nextTuning.length
      didChange = true
    }
  }

  if (patch.volume !== undefined) {
    const nextVolume = clamp(0, patch.volume, 127)
    if (playback.volume !== nextVolume) {
      playback.volume = nextVolume
      didChange = true
    }
  }

  if (patch.balance !== undefined) {
    const nextBalance = clamp(0, patch.balance, 127)
    if (playback.balance !== nextBalance) {
      playback.balance = nextBalance
      didChange = true
    }
  }

  if (patch.reverb !== undefined) {
    const nextReverb = clamp(0, patch.reverb, 127)
    if (playback.reverb !== nextReverb) {
      playback.reverb = nextReverb
      didChange = true
    }
  }

  if (patch.isMuted !== undefined && playback.mute !== patch.isMuted) {
    playback.mute = patch.isMuted
    didChange = true
  }

  if (patch.isSolo !== undefined && playback.solo !== patch.isSolo) {
    playback.solo = patch.isSolo
    didChange = true
  }

  if (didChange) {
    emitSongDataChanged()
  }
}

function setTrackName(trackId: number, name: string): void {
  updateTrack(trackId, { name })
}

function setTrackVolume(trackId: number, volume: number): void {
  updateTrack(trackId, { volume })
}

function setTrackBalance(trackId: number, balance: number): void {
  updateTrack(trackId, { balance })
}

function toggleMute(trackId: number): void {
  const track = getTrackViewModel(trackId)
  if (track) {
    updateTrack(trackId, { isMuted: !track.isMuted })
  }
}

function toggleSolo(trackId: number): void {
  const track = getTrackViewModel(trackId)
  if (track) {
    updateTrack(trackId, { isSolo: !track.isSolo })
  }
}

function setInstrument(trackId: number, program: number | string): void {
  updateTrack(trackId, { program })
}

function setCapo(trackId: number, capo: number): void {
  updateTrack(trackId, { capo })
}

function setTuning(trackId: number, tuning: number[]): void {
  updateTrack(trackId, { tuning })
}

function setTrackColor(trackId: number, color: TrackColor): void {
  updateTrack(trackId, { color })
}

function getTrackColorCSS(trackId: number, tracks: TrackViewModel[] = listTrackViewModels()): string {
  const track = tracks[trackId]
  if (!track) {
    return 'rgb(255, 0, 0)'
  }

  return `rgb(${track.color.red}, ${track.color.green}, ${track.color.blue})`
}

function getInstrumentSettings(trackId: number): TrackInstrumentSettings | null {
  const settings = Song.playBackInstrument?.[trackId]
  if (!settings) {
    return null
  }

  return {
    instrument: settings.instrument || DEFAULT_PLAYBACK_SETTINGS.instrument,
    solo: settings.solo ?? DEFAULT_PLAYBACK_SETTINGS.solo,
    mute: settings.mute ?? DEFAULT_PLAYBACK_SETTINGS.mute,
    volume: settings.volume ?? DEFAULT_PLAYBACK_SETTINGS.volume,
    tremolo: settings.tremolo ?? DEFAULT_PLAYBACK_SETTINGS.tremolo,
    reverb: settings.reverb ?? DEFAULT_PLAYBACK_SETTINGS.reverb,
    chorus: settings.chorus ?? DEFAULT_PLAYBACK_SETTINGS.chorus,
    phaser: settings.phaser ?? DEFAULT_PLAYBACK_SETTINGS.phaser,
    balance: settings.balance ?? DEFAULT_PLAYBACK_SETTINGS.balance,
  }
}

function isTrackAudible(trackId: number, tracks: TrackViewModel[] = listTrackViewModels()): boolean {
  const track = tracks[trackId]
  if (!track) {
    return false
  }

  const hasSoloedTrack = tracks.some((trackIt) => trackIt.isSolo)
  if (track.isMuted) {
    return false
  }

  if (hasSoloedTrack && !track.isSolo) {
    return false
  }

  return true
}

const legacyTrackAdapter = {
  listTrackViewModels,
  getTrackViewModel,
  selectTrack,
  selectVoice,
  updateTrack,
  setTrackName,
  setTrackVolume,
  setTrackBalance,
  toggleMute,
  toggleSolo,
  setInstrument,
  setCapo,
  setTuning,
  setTrackColor,
  getTrackColorCSS,
  getInstrumentSettings,
  isTrackAudible,
}

export { legacyTrackAdapter }
export default legacyTrackAdapter