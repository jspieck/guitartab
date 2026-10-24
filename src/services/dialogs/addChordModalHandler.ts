import { BaseModalHandler, ModalState } from './baseModalHandler'
import { MODALS } from './modalTypes'
import { Song } from '../../stores/song'
import { requestChordDiagramRefresh } from '../editor/chordDiagramAdapter'
import { editTransaction, recordBarEdit } from '../editor/editCommands'
import { setLibraryChord } from '../editor/songSettingsCommands'
import type { Chord } from '../../stores/song'
import { reactive } from 'vue'

interface AddChordModalState extends ModalState {
  chordModalData: {
    chordRoot: string
    chordType: string
  }
  chordProperties: {
    name: string
    capo: number
    currentNotes: number[]
    fingers: (number | null)[]
  }
}

export const allChords: {
  [chordName: string]: {
    [chordType: string]: {
      capo: number
      notes: number[]
      fingers: (number | null)[]
    }
  }
} = {
  C: {
    maj: {
      capo: 0,
      notes: [-1, 3, 2, 0, 1, 0] as number[],
      fingers: [null, 3, 2, null, 1, null] as (number | null)[],
    },
    min: { capo: 8, notes: [0, 2, 2, 0, 0, 0] as number[], fingers: [1, 3, 4, 1, 1, 1] as (number | null)[] },
  },
  'C#': {
    maj: { capo: 9, notes: [0, 2, 2, 1, 0, 0] as number[], fingers: [1, 3, 4, 2, 1, 1] as (number | null)[] },
    min: { capo: 9, notes: [0, 2, 2, 0, 0, 0] as number[], fingers: [1, 3, 4, 1, 1, 1] as (number | null)[] },
  },
  D: {
    maj: {
      capo: 0,
      notes: [-1, -1, 0, 2, 3, 2] as number[],
      fingers: [null, null, null, 1, 2, 3] as (number | null)[],
    },
    min: {
      capo: 0,
      notes: [-1, -1, 0, 2, 3, 1] as number[],
      fingers: [null, null, null, 2, 3, 1] as (number | null)[],
    },
  },
  'D#': {
    maj: {
      capo: 11,
      notes: [0, 2, 2, 1, 0, 0] as number[],
      fingers: [1, 3, 4, 2, 1, 1] as (number | null)[],
    },
    min: {
      capo: 11,
      notes: [0, 2, 2, 0, 0, 0] as number[],
      fingers: [1, 3, 4, 1, 1, 1] as (number | null)[],
    },
  },
  E: {
    maj: {
      capo: 0,
      notes: [0, 2, 2, 1, 0, 0] as number[],
      fingers: [null, 2, 3, 1, null, null] as (number | null)[],
    },
    min: {
      capo: 0,
      notes: [0, 2, 2, 0, 0, 0] as number[],
      fingers: [null, 2, 3, null, null, null] as (number | null)[],
    },
  },
  F: {
    maj: { capo: 1, notes: [0, 2, 2, 1, 0, 0] as number[], fingers: [1, 3, 4, 2, 1, 1] as (number | null)[] },
    min: { capo: 1, notes: [0, 2, 2, 0, 0, 0] as number[], fingers: [1, 3, 4, 1, 1, 1] as (number | null)[] },
  },
  'F#': {
    maj: { capo: 2, notes: [0, 2, 2, 1, 0, 0] as number[], fingers: [1, 3, 4, 2, 1, 1] as (number | null)[] },
    min: { capo: 2, notes: [0, 2, 2, 0, 0, 0] as number[], fingers: [1, 3, 4, 1, 1, 1] as (number | null)[] },
  },
  G: {
    maj: {
      capo: 0,
      notes: [3, 2, 0, 0, 0, 3] as number[],
      fingers: [3, 2, null, null, null, 4] as (number | null)[],
    },
    min: { capo: 3, notes: [0, 2, 2, 0, 0, 0] as number[], fingers: [1, 3, 4, 1, 1, 1] as (number | null)[] },
  },
  'G#': {
    maj: { capo: 4, notes: [0, 2, 2, 1, 0, 0] as number[], fingers: [1, 3, 4, 2, 1, 1] as (number | null)[] },
    min: { capo: 4, notes: [0, 2, 2, 0, 0, 0] as number[], fingers: [1, 3, 4, 1, 1, 1] as (number | null)[] },
  },
  A: {
    maj: {
      capo: 0,
      notes: [0, 0, 2, 2, 2, 0] as number[],
      fingers: [null, null, 1, 2, 3, null] as (number | null)[],
    },
    min: {
      capo: 0,
      notes: [0, 0, 2, 2, 1, 0] as number[],
      fingers: [null, null, 2, 3, 1, null] as (number | null)[],
    },
  },
  'A#': {
    maj: { capo: 6, notes: [0, 2, 2, 1, 0, 0] as number[], fingers: [1, 3, 4, 2, 1, 1] as (number | null)[] },
    min: { capo: 6, notes: [0, 2, 2, 0, 0, 0] as number[], fingers: [1, 3, 4, 1, 1, 1] as (number | null)[] },
  },
  H: {
    maj: {
      capo: 2,
      notes: [-1, 0, 2, 2, 2, 0] as number[],
      fingers: [null, 1, 3, 3, 3, 1] as (number | null)[],
    },
    min: {
      capo: 2,
      notes: [-1, 1, 2, 2, 1, 0] as number[],
      fingers: [null, 1, 3, 4, 1, 1] as (number | null)[],
    },
  },
} as const

export class AddChordModalHandler extends BaseModalHandler {
  // SVG Constants
  width = 120 as const
  height = 140 as const
  numStrings = 6 as const
  horizontalSteps = 5 as const
  stringPadding = 10 as const
  paddingRight = 10 as const
  paddingLeft = 30 as const

  constructor() {
    super(MODALS.ADD_CHORD.id, MODALS.ADD_CHORD.name)
    this.modalState = reactive({
      ...this.modalState,
      chordModalData: {
        chordRoot: 'C',
        chordType: 'maj',
      },
      chordProperties: {
        name: '',
        // Base fret as in Guitar Pro and the diagram renderer: 1 = no barre.
        capo: 1,
        currentNotes: [0, 0, 0, 0, 0, 0],
        fingers: Array(6).fill(null),
      },
    } as AddChordModalState)
  }

  getStringY = (index: number) => {
    return (
      ((this.height - 2 * this.stringPadding) / (this.numStrings - 1)) * index +
      this.stringPadding +
      this.paddingRight
    )
  }

  getFretX = (fret: number): number => {
    return (this.width / this.horizontalSteps) * fret + this.paddingLeft
  }

  public handleChordClick(e: MouseEvent): void {
    const svg = e.currentTarget as SVGElement
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const fret = Math.round((x - this.paddingLeft) / (this.width / this.horizontalSteps))
    const string = Math.round(
      ((y - this.paddingRight - this.stringPadding) / (this.height - 2 * this.stringPadding)) *
        (this.numStrings - 1),
    )
    if (string >= 0 && string < this.numStrings && fret > 0 && fret <= this.horizontalSteps) {
      const stringIndex = this.numStrings - string - 1
      const currentNote = this.modalState.chordProperties.currentNotes[stringIndex]

      let newNote: number
      if (currentNote === fret) {
        newNote = -1 // muted
      } else if (currentNote === -1) {
        newNote = 0 // open
      } else {
        newNote = fret
      }
      this.modalState.chordProperties.currentNotes[stringIndex] = newNote
    }
  }

  public updateChordPreset(): void {
    const chord =
      allChords[this.modalState.chordModalData.chordRoot]?.[this.modalState.chordModalData.chordType]
    if (!chord) return

    this.modalState.chordProperties.name = `${this.modalState.chordModalData.chordRoot}${this.modalState.chordModalData.chordType}`
    // Presets give the barre fret (0 = open chord); the form holds the base fret (barre + 1).
    this.modalState.chordProperties.capo = chord.capo + 1
    this.modalState.chordProperties.currentNotes = [...chord.notes]
    this.modalState.chordProperties.fingers = [...chord.fingers]
  }

  /** The beat the toolbar opened the dialog for; null when opened from the chord manager. */
  private targetBeat: { trackId: number; blockId: number; voiceId: number; beatId: number } | null = null

  private targetTrackId = 0

  public saveChord(): void {
    const chordObj: Chord = {
      capo: this.modalState.chordProperties.capo,
      name: this.modalState.chordProperties.name,
      chordRoot: this.modalState.chordModalData.chordRoot,
      chordType: this.modalState.chordModalData.chordType,
      frets: AddChordModalHandler.computeFretsFromNotesAndCapo(
        this.modalState.chordProperties.currentNotes,
        this.modalState.chordProperties.capo,
      ),
      fingers: this.modalState.chordProperties.fingers,
      display: true,
    }

    const target = this.targetBeat
    // One undo step: the chord on the beat (if any) and in the track's chord library.
    editTransaction('Chord', () => {
      setLibraryChord(this.targetTrackId, chordObj)
      if (target != null) {
        recordBarEdit('Chord', { trackId: target.trackId, blockIds: [target.blockId] }, () => {
          Song.getBeat(target).chord = { ...chordObj, fingers: [...chordObj.fingers] }
        })
      }
    })
    requestChordDiagramRefresh()
    this.closeModal()
  }

  private static computeFretsFromNotesAndCapo(notes: number[], capo: number): number[] {
    return notes.map((note) => (note >= 0 ? note + (capo - 1) : note)).reverse()
  }

  public updateCapo(capo: number): void {
    if (capo < 0) {
      this.modalState.chordProperties.capo = 0
      return
    }

    this.modalState.chordProperties.capo = capo + 1
  }

  public getCapo(): number {
    return this.modalState.chordProperties.capo - 1
  }

  public getChordRoot(): string {
    return this.modalState.chordModalData.chordRoot
  }

  public getChordType(): string {
    return this.modalState.chordModalData.chordType
  }

  public getModalState(): AddChordModalState {
    return this.modalState as AddChordModalState
  }

  /**
   * From the toolbar: `{ trackId, blockId, voiceId, beatId }` puts the chord on that beat.
   * From the chord manager: `{ trackId, existingChord? }` edits the library only.
   */
  public openModal(params?: {
    trackId: number
    blockId?: number
    voiceId?: number
    beatId?: number
    existingChord?: Chord
  }): void {
    this.targetTrackId = params?.trackId ?? Song.currentTrackId
    const { blockId, voiceId, beatId } = params ?? {}
    this.targetBeat =
      blockId != null && voiceId != null && beatId != null
        ? { trackId: this.targetTrackId, blockId, voiceId, beatId }
        : null
    if (params?.existingChord) {
      this.loadChord(params.existingChord)
    }
    this.showModal()
  }

  /** Fills the form from a stored chord (inverse of `computeFretsFromNotesAndCapo`). */
  private loadChord(chord: Chord): void {
    const { chordModalData, chordProperties } = this.modalState
    chordModalData.chordRoot = chord.chordRoot ?? chordModalData.chordRoot
    chordModalData.chordType = chord.chordType ?? chordModalData.chordType
    chordProperties.name = chord.name
    chordProperties.capo = chord.capo
    chordProperties.currentNotes = [...chord.frets]
      .reverse()
      .map((fret) => (fret >= 0 ? fret - (chord.capo - 1) : fret))
    chordProperties.fingers = [...(chord.fingers ?? [])]
  }

  public setupModalContent(): void {}

  public updateChordRoot(root: string): void {
    this.modalState.chordModalData.chordRoot = root
    this.updateChordPreset()
  }

  public updateChordType(type: string): void {
    this.modalState.chordModalData.chordType = type
    this.updateChordPreset()
  }
}
