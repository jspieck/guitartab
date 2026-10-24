import { redrawTrack } from '../editor/layoutInvalidation'
import { BaseModalHandler, ModalState } from './baseModalHandler'
import { Song } from '../../stores/song'
import { recordBarEdit } from '../editor/editCommands'
import { MODALS } from './modalTypes'
import { fitBarsToTimeSignature } from '../editor/timeSignatureCommands'

interface TimeMeterModalState extends ModalState {
  numerator: number
  denominator: number
  trackId: number
  blockId: number
  voiceId: number
}

export class TimeMeterModalHandler extends BaseModalHandler {
  readonly modalType = 'TimeMeterModal' as const

  constructor() {
    super(MODALS.TIME_METER.id, MODALS.TIME_METER.name)
    this.modalState = {
      ...this.modalState,
      numerator: 4,
      denominator: 4,
      trackId: 0,
      blockId: 0,
      voiceId: 0,
    } as TimeMeterModalState
  }

  public getModalState(): TimeMeterModalState {
    return this.modalState as TimeMeterModalState
  }

  public updateNumerator(value: number): void {
    this.modalState.numerator = value
  }

  public updateDenominator(value: number): void {
    this.modalState.denominator = value
  }

  openModal(params: { trackId: number; blockId: number; voiceId: number }) {
    const { trackId, blockId, voiceId } = params
    this.modalState.trackId = trackId
    this.modalState.blockId = blockId
    this.modalState.voiceId = voiceId

    this.setTimeMeterState()
    this.showModal()
  }

  public setTimeMeterState(): void {
    const { blockId } = this.modalState

    // Ensure measureMeta exists and has proper structure
    if (!Song.measureMeta || !Array.isArray(Song.measureMeta)) {
      console.warn(`Song.measureMeta is not properly initialized`)
      // Set defaults
      this.modalState.denominator = 4
      this.modalState.numerator = 4
      return
    }

    if (!Song.measureMeta[blockId]) {
      console.warn(`No measure meta data found for block ${blockId}, using defaults`)
      // Initialize with default values
      Song.measureMeta[blockId] = {
        denominator: 4,
        numerator: 4,
        timeMeterPresent: false,
        repeatOpen: false,
        keySignature: 0,
        automations: [],
      }
    }

    // Set the modal state with defaults if values are missing
    this.modalState.denominator = Song.measureMeta[blockId].denominator ?? 4
    this.modalState.numerator = Song.measureMeta[blockId].numerator ?? 4
  }

  public handleSubmit(): boolean {
    const { blockId, trackId, numerator, denominator } = this.modalState

    // The new time signature holds until the next change; it reaches every track.
    let nextChange = blockId + 1
    while (nextChange < Song.measureMeta.length && !Song.measureMeta[nextChange].timeMeterPresent) {
      nextChange += 1
    }
    const blockIds = Array.from({ length: nextChange - blockId }, (_, index) => blockId + index)

    const command = recordBarEdit('Time signature', { trackId, blockIds, allTracks: true }, () => {
      for (const bId of blockIds) {
        Song.measureMeta[bId].numerator = numerator
        Song.measureMeta[bId].denominator = denominator
      }
      Song.measureMeta[blockId].timeMeterPresent = true
      // null: refused (a tuplet would be cut); recordBarEdit rolls back.
      return fitBarsToTimeSignature(blockId)
    })
    const applied = command != null || Song.measureMeta[blockId].numerator === numerator

    redrawTrack(Song.currentTrackId, Song.currentVoiceId)
    return applied
  }

  setupModalContent() {
    this.setTimeMeterState()
  }
}
