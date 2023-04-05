import Song from './songData';

class Tuning {
  bundNoten: number[];

  octave: string[];

  noteNames: string[];

  constructor() {
    // number from 0 to 30 from E2 to E4+15
    this.octave = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    this.noteNames = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'];
    this.bundNoten = [0, 5, 10, 15, 19, 24, 29];
  }

  // gets e.g. 4,0 returns something like [C#, Bund 5]
  fretToNoteValue(bund: number, noteValue: number): [string, number] {
    const numValue = this.bundNoten[bund] + noteValue;
    return this.numValueToNoteValue(numValue);
  }

  numValueToNoteValue(numValue: number): [string, number] {
    const noteName = this.noteNames[numValue % 12];
    // 0 is an e3, so transform it to c (for easier computation)
    const bund = 3 + Math.floor((numValue + 4) / 12);
    return [noteName, bund];
  }

  getNoteHeight(trackId: number, guitarString: number, fret: number): number {
    const myCapo = Math.round(Song.tracks[trackId].capo);
    const tuningDiff = this.getTuningDifference(trackId, guitarString);
    return 40 + this.bundNoten[guitarString] + fret + myCapo + tuningDiff;
  }

  getTuningDifference(trackId: number, guitarString: number): number {
    const stringTuning: number = Song.tracks[trackId].strings[guitarString];
    let sampleHeight = 0;
    if (guitarString < this.bundNoten.length) {
      sampleHeight = this.bundNoten[guitarString];
    } else {
      sampleHeight = this.bundNoten[this.bundNoten.length - 1];
    }
    return stringTuning - (40 + sampleHeight);
  }
}

const tuning = new Tuning();
export default tuning;
