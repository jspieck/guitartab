import Song from '../../stores/song'
import { samplePlayer } from '../audio/samplePlayer'
import { audioGraph } from '../audio/audioGraph'
import playback from '../playback'
import Settings from '../../stores/settingsState'
import { pressLiveNote, releaseLiveNote } from '../../stores/soundingNotesState'
import Duration from '../../utils/duration'
import { recordBarEdit } from '../editor/editCommands'
import { requestBlockRender } from '../editor/renderCommands'
import { arrangeOnStrings } from './noteArranger'
import { setMidiMessageHandler } from './devices'

/**
 * Notes played live (MIDI keyboard, the virtual piano): sounds them on the
 * current track, shows them on the piano/guitar, and while recording during
 * playback writes them into the beat playback is at when recording stops.
 */
class LiveInput {
  isRecording = false

  /** The gain of each sounding pitch, to fade it out on release. */
  private readonly sounding = new Map<number, GainNode>()

  /** Strings taken by held pitches, so a new pitch goes on a free one. */
  private readonly heldStrings = new Map<number, number>()

  private readonly recorded: number[] = []

  onMidiMessage(event: WebMidi.MIDIMessageEvent): void {
    const [status, pitch, velocity] = event.data
    const command = status >> 4
    // 9 = note on (velocity 0 means off), 8 = note off
    if (command === 8 || (command === 9 && velocity === 0)) this.noteOff(pitch)
    else if (command === 9) this.noteOn(pitch, velocity)
  }

  noteOn(pitch: number, velocity: number): void {
    const trackId = Song.currentTrackId
    const voiceId = Song.currentVoiceId
    const track = Song.tracks[trackId]
    const volume = (2 * velocity) / 127
    const now = audioGraph.getCurrentTime()
    if (Settings.songPlaying && this.isRecording) this.recorded.push(pitch)

    const gain = samplePlayer.playPitch(
      trackId,
      voiceId,
      pitch,
      volume,
      now,
      2,
      Song.defaultMeasure(),
      Song.defaultNote(),
    )
    if (gain != null) this.sounding.set(pitch, gain)

    const [placed] = arrangeOnStrings([pitch], track.strings, track.capo, new Set(this.heldStrings.values()))
    if (placed != null && placed.string !== -1) {
      pressLiveNote(pitch, placed.string, placed.fret + track.capo)
      this.heldStrings.set(pitch, placed.string)
    } else {
      pressLiveNote(pitch)
    }
  }

  noteOff(pitch: number): void {
    releaseLiveNote(pitch)
    this.heldStrings.delete(pitch)
    const gain = this.sounding.get(pitch)
    if (gain == null) return
    this.sounding.delete(pitch)
    const now = audioGraph.getCurrentTime()
    // drop the rest of the envelope (its own note-off and release are scheduled 2 s ahead)
    const level = gain.gain.value
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(level, now)
    gain.gain.setTargetAtTime(0, now, 0.03)
  }

  recordMidi(): void {
    this.recorded.length = 0
    this.isRecording = true
  }

  stopRecording(): void {
    this.isRecording = false
    this.writeRecordedNotes()
  }

  /** Puts the notes recorded so far on the beat nearest to the playback position. */
  writeRecordedNotes(): void {
    const pitches = [...this.recorded]
    this.recorded.length = 0
    if (pitches.length === 0) return
    const trackId = Song.currentTrackId
    const voiceId = Song.currentVoiceId
    const { blockId, positionInBlock } = playback.songPosition()
    const beatId = nearestBeat(trackId, blockId, voiceId, positionInBlock)
    const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
    const taken = new Set(beat.notes.flatMap((note, string) => (note != null ? [string] : [])))
    const { strings, capo } = Song.tracks[trackId]

    recordBarEdit('Record MIDI', { trackId, blockIds: [blockId] }, () => {
      for (const { pitch, string, fret } of arrangeOnStrings(pitches, strings, capo, taken)) {
        const note = { ...Song.defaultNote(), height: pitch }
        if (string === -1) {
          ;(beat.otherNotes ??= []).push(note)
        } else {
          beat.notes[string] = { ...note, string, fret }
        }
      }
    })
    requestBlockRender(trackId, blockId, voiceId)
  }
}

/** The beat whose start is closest to `position` (0–1 through the bar). */
export function nearestBeat(trackId: number, blockId: number, voiceId: number, position: number): number {
  const beats = Song.measures[trackId][blockId][voiceId]
  const barTicks = Duration.getDurationOfBar(Song.measureMeta[blockId])
  let best = 0
  let bestDistance = Infinity
  let ticks = 0
  beats.forEach((beat, beatId) => {
    const distance = Math.abs(position - ticks / barTicks)
    if (distance < bestDistance) {
      bestDistance = distance
      best = beatId
    }
    ticks += Duration.getDurationOfNote(beat, false)
  })
  return best
}

const liveInput = new LiveInput()
// Connected devices (./devices.ts) send their notes here.
setMidiMessageHandler((event) => liveInput.onMidiMessage(event))
export default liveInput
