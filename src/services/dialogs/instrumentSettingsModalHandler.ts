import { refreshTrack } from '../editor/barFilling'
import { redrawTrack } from '../editor/layoutInvalidation'
import { BaseModalHandler, ModalState } from './baseModalHandler'
import { Song } from '../../stores/song'
import { recordTrackEdit } from '../editor/songSettingsCommands'
import Picker from 'vanilla-picker'
import { notifySongDataChanged } from '../appEvents'
import { modalManager } from './modalManager'
import { TuningModalHandler } from './tuningModalHandler'
import { MODALS } from './modalTypes'

interface InstrumentSettingsState extends ModalState {
  instrumentSettingData: {
    name: string
    color: { red: number; green: number; blue: number }
    numStrings: number
    capo: number
    letItRing: boolean
  }
  trackId: number
}

export class InstrumentSettingsModalHandler extends BaseModalHandler {
  private colorPicker: Picker | null = null

  constructor() {
    super(MODALS.INSTRUMENT_SETTINGS.id, MODALS.INSTRUMENT_SETTINGS.name)
    this.modalState = {
      ...this.modalState,
      instrumentSettingData: {
        name: '',
        color: { red: 0, green: 0, blue: 0 },
        numStrings: 0,
        capo: 0,
        letItRing: false,
      },
      trackId: 0,
    } as InstrumentSettingsState
  }

  openModal(params: { trackId: number }) {
    const trackId = params ? params.trackId : Song.currentTrackId
    this.modalState.trackId = trackId
    this.initializeIfNeeded(() => {
      this.setupModalContent()
    })
    this.setInstrumentSettingsState()
    this.showModal()
  }

  public submitFromModal() {
    this.handleSettingsSubmit()
    this.closeModal()
  }

  protected setupModalContent(): void {
    this.setupEventListeners()
  }

  private setInstrumentSettingsState() {
    const { trackId, instrumentSettingData } = this.modalState
    const track = Song.tracks[trackId]

    // Update state
    instrumentSettingData.name = track.name
    instrumentSettingData.color = track.color
    instrumentSettingData.numStrings = track.numStrings
    instrumentSettingData.capo = track.capo
    instrumentSettingData.letItRing = track.letItRing

    // Update DOM
    const ringCheckbox = document.getElementById('ringCheckbox') as HTMLInputElement
    const stringCountSelect = document.getElementById('stringCountSelect') as HTMLInputElement
    const instrumentNameInput = document.getElementById('instrumentNameInput') as HTMLInputElement
    const capoSelect = document.getElementById('capoSelect') as HTMLInputElement

    ringCheckbox.checked = instrumentSettingData.letItRing
    instrumentNameInput.value = instrumentSettingData.name
    stringCountSelect.value = instrumentSettingData.numStrings.toString()
    capoSelect.value = instrumentSettingData.capo.toString()

    this.setupColorPicker()
    modalManager
      .getHandler<TuningModalHandler>(MODALS.TUNING.id)
      .constructTuningArea(trackId, false, instrumentSettingData.numStrings)
  }

  private setupColorPicker() {
    const { color } = this.modalState.instrumentSettingData
    const pickerParent = document.getElementById('instrumentColorPicker')!

    pickerParent.style.backgroundColor = `rgb(${color.red},${color.green},${color.blue})`

    if (this.colorPicker) {
      this.colorPicker.setColor(`rgb(${color.red},${color.green},${color.blue})`, true)
      return
    }

    this.colorPicker = new Picker({
      parent: pickerParent,
      color: `rgb(${color.red},${color.green},${color.blue})`,
      popup: 'bottom',
      alpha: false,
    })

    this.colorPicker.onChange = (pickerColor: { rgba: number[] }) => {
      pickerParent.style.backgroundColor = `rgb(${pickerColor.rgba[0]},${pickerColor.rgba[1]},${pickerColor.rgba[2]})`
      this.modalState.instrumentSettingData.color = {
        red: pickerColor.rgba[0],
        green: pickerColor.rgba[1],
        blue: pickerColor.rgba[2],
      }
    }

    this.colorPicker.onOpen = () => {
      requestAnimationFrame(() => this.repositionColorPickerPopup())
    }

    this.colorPicker.onClose = () => {
      this.restoreColorPickerPopup()
    }
  }

  private findColorPickerPopup(): HTMLElement | null {
    const pickerParent = document.getElementById('instrumentColorPicker')
    if (!pickerParent) {
      return null
    }

    return (
      (pickerParent.querySelector('.picker_wrapper.popup') as HTMLElement | null) ??
      (document.body.querySelector('.picker_wrapper.popup') as HTMLElement | null)
    )
  }

  private repositionColorPickerPopup(): void {
    const pickerParent = document.getElementById('instrumentColorPicker')
    const wrapper = this.findColorPickerPopup()
    if (!pickerParent || !wrapper) {
      return
    }

    if (wrapper.parentElement !== document.body) {
      document.body.appendChild(wrapper)
    }

    const rect = pickerParent.getBoundingClientRect()
    const wrapperWidth = wrapper.offsetWidth || 200
    const wrapperHeight = wrapper.offsetHeight || 220
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - wrapperWidth - 8)
    const topBelow = rect.bottom + 6
    const topAbove = rect.top - wrapperHeight - 6
    const top = topBelow + wrapperHeight > window.innerHeight - 8 && topAbove > 8 ? topAbove : topBelow

    wrapper.style.position = 'fixed'
    wrapper.style.left = `${left}px`
    wrapper.style.top = `${top}px`
    wrapper.style.zIndex = '10001'
    wrapper.style.margin = '0'
  }

  private restoreColorPickerPopup(): void {
    const pickerParent = document.getElementById('instrumentColorPicker')
    const wrapper = this.findColorPickerPopup()
    if (!pickerParent || !wrapper || wrapper.parentElement !== document.body) {
      return
    }

    pickerParent.appendChild(wrapper)
    wrapper.style.position = ''
    wrapper.style.left = ''
    wrapper.style.top = ''
    wrapper.style.zIndex = ''
    wrapper.style.margin = ''
  }

  private setupEventListeners() {
    const { trackId, instrumentSettingData } = this.modalState

    this.setupSelect('instrumentNameInput', (value) => {
      instrumentSettingData.name = value
    })

    this.setupSelect('stringCountSelect', (value) => {
      instrumentSettingData.numStrings = parseInt(value, 10)
      modalManager
        .getHandler<TuningModalHandler>(MODALS.TUNING.id)
        .constructTuningArea(trackId, true, instrumentSettingData.numStrings)
    })

    this.setupSelect('capoSelect', (value) => {
      instrumentSettingData.capo = parseInt(value, 10)
    })
  }

  private handleSettingsSubmit() {
    const { trackId, instrumentSettingData } = this.modalState
    const ringChecked = (document.getElementById('ringCheckbox') as HTMLInputElement).checked
    const tuning: number[] = []
    for (let i = 0; i < instrumentSettingData.numStrings; i++) {
      const selectEl = document.getElementById(`tuningSelect${i}`) as HTMLInputElement | null
      if (selectEl) {
        tuning[i] = parseInt(selectEl.value, 10)
      }
    }

    recordTrackEdit(
      'Track settings',
      trackId,
      () => {
        const track = Song.tracks[trackId]
        track.name = instrumentSettingData.name
        track.color = { ...instrumentSettingData.color }
        track.numStrings = instrumentSettingData.numStrings
        track.capo = instrumentSettingData.capo
        track.letItRing = ringChecked
        track.strings.length = 0
        tuning.forEach((value, i) => {
          track.strings[i] = value
        })
      },
      refreshTrackSettings,
    )
  }
}

/** Re-layout after a track-settings change, its undo and its redo. */
function refreshTrackSettings(trackId: number): void {
  // Labels and colours in the sequencer are reactive; the tab needs a new layout.
  refreshTrack(trackId)
  if (trackId === Song.currentTrackId) {
    redrawTrack(Song.currentTrackId, Song.currentVoiceId)
  }
  notifySongDataChanged()
}
