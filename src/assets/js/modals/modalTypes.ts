import { AddTrackModalHandler } from './addTrackModalHandler';
import { ArtificialModalHandler } from './artificialModalHandler';
import { BaseModalHandler } from './baseModalHandler';
import { BendModalHandler } from './bendModalHandler';
import { ChordModalHandler } from './chordModalHandler';
import { CompressorModalHandler } from './compressorModalHandler';
import { DeleteTrackModalHandler } from './deleteTrackModalHandler';
import { DrumInfoModalHandler } from './drumInfoModalHandler';
import { EqualizerModalHandler } from './equalizerModalHandler';
import { GraceModalHandler } from './graceModalHandler';
import { GuitarModalHandler } from './guitarModalHandler';
import { InfoModalHandler } from './infoModalHandler';
import { InstrumentSettingsModalHandler } from './instrumentSettingsModalHandler';
import { MarkerModalHandler } from './markerModalHandler';
import { MidiModalHandler } from './midiModalHandler';
import { MixerModalHandler } from './mixerModalHandler';
import { PianoModalHandler } from './pianoModalHandler';
import { RepeatAlternativeModalHandler } from './repeatAlternativeModalHandler';
import { RepetitionModalHandler } from './repetitionModalHandler';
import { StrokeModalHandler } from './strokeModalHandler';
import { TempoModalHandler } from './tempoModalHandler';
import { TextModalHandler } from './textModalHandler';
import { TimeMeterModalHandler } from './timeMeterModalHandler';
import { TremoloBarModalHandler } from './tremoloBarModalHandler';
import { TremoloPickingModalHandler } from './tremoloPickingModalHandler';
import { TuningModalHandler } from './tuningModalHandler';
import { AddChordModalHandler } from './addChordModalHandler';
import { ChordManagerModalHandler } from './chordManagerModalHandler';
import { CopyrightModalHandler } from './copyRightModalHandler';

export interface ModalDefinition {
    id: string;
    name: string;
    handlerClass: new () => BaseModalHandler;
}

export class MidiModal implements ModalDefinition {
    readonly id = 'midiModal';
    readonly name = 'MIDI';
    readonly handlerClass = MidiModalHandler;
}

export class PianoModal implements ModalDefinition {
    readonly id = 'pianoModal';
    readonly name = 'Piano';
    readonly handlerClass = PianoModalHandler;
}

export class RepetitionModal implements ModalDefinition {
    readonly id = 'repetitionModal';
    readonly name = 'Repetition';
    readonly handlerClass = RepetitionModalHandler;
}

export class TimeMeterModal implements ModalDefinition {
    readonly id = 'timeMeterModal';
    readonly name = 'Time Meter';
    readonly handlerClass = TimeMeterModalHandler;
}

export class TremoloBarModal implements ModalDefinition {
    readonly id = 'tremoloBarModal';
    readonly name = 'Tremolo Bar';
    readonly handlerClass = TremoloBarModalHandler;
}

export class TremoloPickingModal implements ModalDefinition {
    readonly id = 'tremoloPickingModal';
    readonly name = 'Tremolo Picking';
    readonly handlerClass = TremoloPickingModalHandler;
}

export class BendModal implements ModalDefinition {
    readonly id = 'bendModal';
    readonly name = 'Bend';
    readonly handlerClass = BendModalHandler;
}

export class DeleteTrackModal implements ModalDefinition {
    readonly id = 'deleteTrackModal';
    readonly name = 'Delete Track';
    readonly handlerClass = DeleteTrackModalHandler;
}

export class GuitarModal implements ModalDefinition {
    readonly id = 'guitarModal';
    readonly name = 'Guitar';
    readonly handlerClass = GuitarModalHandler;
}

export class InfoModal implements ModalDefinition {
    readonly id = 'infoModal';
    readonly name = 'Info';
    readonly handlerClass = InfoModalHandler;
}

export class InstrumentSettingsModal implements ModalDefinition {
    readonly id = 'instrumentSettingsModal';
    readonly name = 'Instrument Settings';
    readonly handlerClass = InstrumentSettingsModalHandler;
}

export class MixerModal implements ModalDefinition {
    readonly id = 'mixerModal';
    readonly name = 'Mixer';
    readonly handlerClass = MixerModalHandler;
}

export class AddTrackModal implements ModalDefinition {
    readonly id = 'addTrackModal';
    readonly name = 'Add Track';
    readonly handlerClass = AddTrackModalHandler;
}

export class GraceModal implements ModalDefinition {
    readonly id = 'graceModal';
    readonly name = 'Grace';
    readonly handlerClass = GraceModalHandler;
}

export class MarkerModal implements ModalDefinition {
    readonly id = 'markerModal';
    readonly name = 'Marker';
    readonly handlerClass = MarkerModalHandler;
}

export class TextModal implements ModalDefinition {
    readonly id = 'textModal';
    readonly name = 'Text';
    readonly handlerClass = TextModalHandler;
}

export class StrokeModal implements ModalDefinition {
    readonly id = 'strokeModal';
    readonly name = 'Stroke';
    readonly handlerClass = StrokeModalHandler;
}

export class EqualizerModal implements ModalDefinition {
    readonly id = 'equalizerModal';
    readonly name = 'Equalizer';
    readonly handlerClass = EqualizerModalHandler;
}

export class CompressorModal implements ModalDefinition {
    readonly id = 'compressorModal';
    readonly name = 'Compressor';
    readonly handlerClass = CompressorModalHandler;
}

export class TempoModal implements ModalDefinition {
    readonly id = 'tempoModal';
    readonly name = 'Tempo';
    readonly handlerClass = TempoModalHandler;
}

export class TuningModal implements ModalDefinition {
    readonly id = 'tuningModal';
    readonly name = 'Tuning';
    readonly handlerClass = TuningModalHandler;
}

export class ArtificialModal implements ModalDefinition {
    readonly id = 'artificialModal';
    readonly name = 'Artificial';
    readonly handlerClass = ArtificialModalHandler;
}

export class DrumInfoModal implements ModalDefinition {
    readonly id = 'drumInfoModal';
    readonly name = 'Drum Info';
    readonly handlerClass = DrumInfoModalHandler;
}

export class RepeatAlternativeModal implements ModalDefinition {
    readonly id = 'repeatAlternativeModal';
    readonly name = 'Repeat Alternative';
    readonly handlerClass = RepeatAlternativeModalHandler;
}

export class AddChordModal implements ModalDefinition {
    readonly id = 'addChordModal';
    readonly name = 'Add Chord';
    readonly handlerClass = AddChordModalHandler;
}

export class ChordManagerModal implements ModalDefinition {
    readonly id = 'chordManagerModal';
    readonly name = 'Chord Manager';
    readonly handlerClass = ChordManagerModalHandler;
}

export class CopyrightModal implements ModalDefinition {
    readonly id = 'copyrightModal';
    readonly name = 'Copyright';
    readonly handlerClass = CopyrightModalHandler;
}

export const MODALS = {
    INSTRUMENT_SETTINGS: new InstrumentSettingsModal(),
    MIXER: new MixerModal(),
    ADD_TRACK: new AddTrackModal(),
    GRACE: new GraceModal(),
    MARKER: new MarkerModal(),
    TEXT: new TextModal(),
    STROKE: new StrokeModal(),
    EQUALIZER: new EqualizerModal(),
    COMPRESSOR: new CompressorModal(),
    TEMPO: new TempoModal(),
    TUNING: new TuningModal(),
    ARTIFICIAL: new ArtificialModal(),
    BEND: new BendModal(),
    DELETE_TRACK: new DeleteTrackModal(),
    GUITAR: new GuitarModal(),
    MIDI: new MidiModal(),
    PIANO: new PianoModal(),
    REPETITION: new RepetitionModal(),
    TIME_METER: new TimeMeterModal(),
    TREMOLO_BAR: new TremoloBarModal(),
    TREMOLO_PICKING: new TremoloPickingModal(),
    INFO: new InfoModal(),
    DRUM_INFO: new DrumInfoModal(),
    REPEAT_ALTERNATIVE: new RepeatAlternativeModal(),   
    ADD_CHORD: new AddChordModal(),
    CHORD_MANAGER: new ChordManagerModal(),
    COPYRIGHT: new CopyrightModal(),
} as const; 