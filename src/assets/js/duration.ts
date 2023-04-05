import Song, { Measure } from './songData';

// import Duration from './duration';
const Duration = {
  // Tuplets: 3 for 2, 5/6/7 for 4, 9/10/11/12/13 for 8
  tupletToNumOfSubstitutedNotes(i: number): number {
    const subNotes = [0, 0, 0, 2, 0, 4, 4, 4, 0, 8, 8, 8, 8, 8, 8, 8, 0];
    return subNotes[i];
  },

  getDurationOfNote(t: Measure, ignoreTuplet: boolean): number {
    let size = Duration.getDurationOfType(t.duration);
    if (t.dotted) size += size / 2;
    if (t.doubleDotted) size += size / 2 + size / 4;
    if (t.tuplet != null && t.tuplet !== 0 && !ignoreTuplet) {
      const numSubs = Duration.tupletToNumOfSubstitutedNotes(t.tuplet);
      if (numSubs === 0) {
        console.log('Tuplet ERROR!', t.tuplet);
        size *= 2;
        return size / t.tuplet;
      }
      size *= numSubs / t.tuplet;
    }
    return size;
  },

  getDurationWidth(t: Measure): number {
    let size = 0;
    if (t.duration === 'w' || t.duration === 'wr') size = 8;
    else if (t.duration === 'h' || t.duration === 'hr') size = 4;
    else if (t.duration === 'q' || t.duration === 'qr') size = 2;
    else if (t.duration === 'e' || t.duration === 'er') size = 1;
    else if (t.duration === 's' || t.duration === 'sr') size = 1;
    else if (t.duration === 't' || t.duration === 'tr') size = 1;
    // 64th
    else if (t.duration === 'z' || t.duration === 'zr') size = 1;
    // 128th only for grace!
    else if (t.duration === 'o' || t.duration === 'or') size = 0.5;

    if ((t.dotted || t.doubleDotted) && size >= 2) size += size / 2;
    if (t.doubleDotted && size >= 4) size += size / 4;
    /* Tuplets have the same size
      if(t.tuplet != null)
          size *= 2/t.tuplet; */
    return size;
  },

  getDurationOfType(t: string): number {
    if (t === 'w' || t === 'wr') return 64;
    if (t === 'h' || t === 'hr') return 32;
    if (t === 'q' || t === 'qr') return 16;
    if (t === 'e' || t === 'er') return 8;
    if (t === 's' || t === 'sr') return 4;
    if (t === 't' || t === 'tr') return 2;
    // 64th
    if (t === 'z' || t === 'zr') return 1;
    // 64th
    if (t === 'o' || t === 'or') return 0.5;
    return 0;
  },

  typeToString(t: number): string {
    if (t === 0.5) return 'o';
    if (t === 1) return 'z';
    if (t === 2) return 't';
    if (t === 4) return 's';
    if (t === 8) return 'e';
    if (t === 16) return 'q';
    if (t === 32) return 'h';
    if (t === 64) return 'w';
    return '';
  },

  getDurationOfBlock(blockId: number): number {
    return Duration.getDurationOfType('wr')
      * (Song.measureMeta[blockId].numerator
      / Song.measureMeta[blockId].denominator);
  },
};

export default Duration;
