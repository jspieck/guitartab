import { reactive } from 'vue';
import { BaseModalHandler } from './baseModalHandler';
import Song, {
  type Beat, type Grace, type Marker, type Note, type Stroke,
} from '../songData';
import { toggleNoteEffect } from '../../../services/editor/effectToggles';
import { recordBarEdit } from '../../../services/editor/editCommands';
import { requestBlocksRender } from '../../../services/editor/renderCommands';
import { classicalNotation } from '../../../services/editor/classicalNotationAdapter';
import { clampTempo } from '../../../utils/tempo';

/** The bars an edit dialog changes, for the undo snapshot and the re-render. */
interface EditScope {
  trackId: number;
  voiceId: number;
  blockIds: number[];
}

/**
 * One edit dialog: a form, how to fill it from the song when it opens, and
 * how to write it back. Everything else (undo, re-render, closing) is shared.
 */
export interface EditModalConfig<TParams, TForm extends object> {
  id: string;
  name: string;
  /** Undo label. */
  label: string;
  defaults: () => TForm;
  /** Form values from the song for the selection the dialog was opened on. */
  read: (params: TParams) => Partial<TForm>;
  scope: (params: TParams) => EditScope;
  /** Writes the form into the song. Return false to refuse; nothing is recorded then. */
  write: (form: TForm, params: TParams) => void | boolean;
  /** Runs after the edit and after each undo/redo of it. */
  afterChange?: (params: TParams) => void;
}

/** Generic handler for the dialogs that edit beats, notes or bar settings. */
export class EditModalHandler<TParams, TForm extends object> extends BaseModalHandler {
  readonly form: TForm;

  private params: TParams | null = null;

  constructor(private readonly config: EditModalConfig<TParams, TForm>) {
    super(config.id, config.name);
    this.form = reactive(config.defaults()) as TForm;
  }

  openModal(params: TParams) {
    this.params = params;
    Object.assign(this.form, this.config.defaults(), this.config.read(params));
    this.showModal();
  }

  protected setupModalContent(): void {
    // The Vue component binds to `form`.
  }

  /** Applies the form as one undo step and closes the dialog. */
  apply(): void {
    const params = this.params;
    if (params == null) return;
    const { trackId, voiceId, blockIds } = this.config.scope(params);
    const afterChange = this.config.afterChange;
    recordBarEdit(this.config.label, {
      trackId,
      blockIds,
      afterChange: afterChange ? () => afterChange(params) : undefined,
    }, () => this.config.write(this.form, params));
    requestBlocksRender(trackId, blockIds, voiceId);
    this.closeModal();
  }
}

/** A handler class (constructed without arguments, as `modalTypes` expects) for a config. */
export function defineEditModal<TParams, TForm extends object>(config: EditModalConfig<TParams, TForm>) {
  return class extends EditModalHandler<TParams, TForm> {
    constructor() {
      super(config);
    }
  };
}

// --- Selections the dialogs are opened on ----------------------------------

/** A beat (text) or a bar (marker, repeats, tempo) at the cursor. */
interface PositionParams {
  trackId: number;
  blockId: number;
  voiceId: number;
  beatId?: number;
}

/** The notes and beats of the cursor or the range selection. */
interface SelectionParams {
  notes: { trackId: number; blockId: number; voiceId: number; beatId: number; string: number; note: Note }[];
  beats: { trackId: number; blockId: number; voiceId: number; beatId: number; beat: Beat }[];
  blocks: number[];
  isVariableSet?: boolean;
}

function barScope({ trackId, blockId, voiceId }: PositionParams): EditScope {
  return { trackId, voiceId, blockIds: [blockId] };
}

function selectionScope(params: SelectionParams): EditScope {
  const first = params.notes[0] ?? params.beats[0];
  const blockIds = [...new Set([
    ...params.blocks,
    ...params.notes.map((note) => note.blockId),
    ...params.beats.map((beat) => beat.blockId),
  ])];
  return { trackId: first?.trackId ?? Song.currentTrackId, voiceId: first?.voiceId ?? Song.currentVoiceId, blockIds };
}

function liveBeat({ trackId, blockId, voiceId, beatId }: PositionParams): Beat {
  return Song.getBeat({ trackId, blockId, voiceId, beatId: beatId ?? 0 });
}

// --- The dialogs -----------------------------------------------------------

export const TextModalHandler = defineEditModal<PositionParams, { text: string }>({
  id: 'textModal',
  name: 'Text',
  label: 'Text',
  defaults: () => ({ text: '' }),
  read: (params) => ({ text: liveBeat(params).text ?? '' }),
  scope: barScope,
  write: ({ text }, params) => {
    const beat = liveBeat(params);
    if (text.trim() === '') {
      delete beat.text;
    } else {
      beat.text = text;
    }
  },
});

export const MarkerModalHandler = defineEditModal<PositionParams, { text: string; color: Marker['color'] }>({
  id: 'markerModal',
  name: 'Marker',
  label: 'Marker',
  defaults: () => ({ text: '', color: { red: 255, green: 0, blue: 0 } }),
  read: ({ blockId }) => {
    const marker = Song.measureMeta[blockId].marker;
    return marker ? { text: marker.text, color: { ...marker.color } } : {};
  },
  scope: barScope,
  write: ({ text, color }, { blockId }) => {
    Song.measureMeta[blockId].marker = { text, color: { ...color } };
  },
});

export const RepetitionModalHandler = defineEditModal<PositionParams, { count: number }>({
  id: 'repetitionModal',
  name: 'Repetition',
  label: 'Repeat count',
  defaults: () => ({ count: 1 }),
  read: ({ blockId }) => {
    const count = Song.measureMeta[blockId].repeatClose;
    return count != null ? { count } : {};
  },
  scope: barScope,
  write: ({ count }, { blockId }) => {
    Song.measureMeta[blockId].repeatClose = Math.max(1, Math.round(Number(count) || 1));
  },
});

/** Bit `i` of `repeatAlternative` marks ending `i + 1`. */
export const RepeatAlternativeModalHandler = defineEditModal<PositionParams, { endings: boolean[] }>({
  id: 'repeatAlternativeModal',
  name: 'Repeat Alternative',
  label: 'Repeat ending',
  defaults: () => ({ endings: Array.from({ length: 8 }, () => false) }),
  read: ({ blockId }) => {
    const bits = Song.measureMeta[blockId].repeatAlternative ?? 0;
    return { endings: Array.from({ length: 8 }, (_, i) => bits > 0 && ((bits >> i) & 1) === 1) };
  },
  scope: barScope,
  write: ({ endings }, { blockId }) => {
    const bits = endings.reduce((sum, checked, i) => (checked ? sum + 2 ** i : sum), 0);
    if (bits === 0) {
      delete Song.measureMeta[blockId].repeatAlternative;
    } else {
      Song.measureMeta[blockId].repeatAlternative = bits;
    }
  },
});

export const TempoModalHandler = defineEditModal<PositionParams, { bpm: number }>({
  id: 'tempoModal',
  name: 'Tempo',
  label: 'Tempo change',
  defaults: () => ({ bpm: 90 }),
  read: ({ blockId }) => ({ bpm: Song.measureMeta[blockId].bpm ?? Song.bpm }),
  scope: barScope,
  write: ({ bpm }, { blockId }) => {
    Song.measureMeta[blockId].bpm = clampTempo(Number(bpm));
  },
});

export const StrokeModalHandler = defineEditModal<SelectionParams, Stroke>({
  id: 'strokeModal',
  name: 'Stroke',
  label: 'Stroke',
  defaults: () => ({ strokeType: 'up', strokeLength: 8 }),
  read: ({ beats }) => {
    const stroke = beats[0]?.beat.effects.stroke;
    return stroke ? { ...stroke } : {};
  },
  scope: selectionScope,
  write: ({ strokeType, strokeLength }, { beats }) => {
    for (const { beat } of beats) {
      beat.effects.stroke = { strokeType, strokeLength: Number(strokeLength) };
    }
  },
});

export const ArtificialModalHandler = defineEditModal<SelectionParams, { style: string }>({
  id: 'artificialModal',
  name: 'Artificial',
  label: 'Harmonic',
  defaults: () => ({ style: 'N.H.' }),
  read: ({ notes }) => {
    const style = notes[0]?.note.artificialStyle;
    return style ? { style } : {};
  },
  scope: selectionScope,
  write: ({ style }, { notes }) => {
    for (const { note } of notes) {
      note.artificialStyle = style;
    }
  },
});

export const GraceModalHandler = defineEditModal<SelectionParams, Grace>({
  id: 'graceModal',
  name: 'Grace',
  label: 'Grace note',
  defaults: () => ({
    fret: 0, duration: 's', dynamic: 'f', transition: 'none', setOnBeat: 'before', string: 0, height: 0, dead: false,
  }),
  read: ({ notes }) => {
    const grace = notes[0]?.note.graceObj;
    return grace ? { ...grace } : {};
  },
  scope: selectionScope,
  write: (form, { notes }) => {
    for (const { note } of notes) {
      note.graceObj = { ...form, fret: Number(form.fret) };
    }
  },
  afterChange: (params) => {
    const { trackId, voiceId } = selectionScope(params);
    classicalNotation.computeVexFlowDataStructures(trackId, voiceId);
  },
});

export const TremoloPickingModalHandler = defineEditModal<SelectionParams, { length: string }>({
  id: 'tremoloPickingModal',
  name: 'Tremolo Picking',
  label: 'Tremolo picking',
  defaults: () => ({ length: 'e' }),
  read: ({ notes }) => {
    const length = notes[0]?.note.tremoloPickingLength;
    return length ? { length } : {};
  },
  scope: selectionScope,
  write: ({ length }, { notes, isVariableSet }) => {
    toggleNoteEffect(notes, 'tremoloPicking', isVariableSet ?? false);
    for (const { note } of notes) {
      note.tremoloPicking = true;
      note.tremoloPickingLength = length;
    }
  },
});
