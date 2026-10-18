import Song, { Note } from './songData';

/** Places MIDI-keyboard notes (by pitch) onto guitar strings, for live MIDI input. */
class NoteArranger {
  static comparePianoHeight(a: {height: number}, b: {height: number}) {
    if (a.height > b.height) { return -1; }
    if (a.height < b.height) { return 1; }
    return 0;
  }

  static arrangeNotesToGuitar(
    trackId: number,
    pianoArrangedNotes: Note[],
    usedStrings: Set<number>,
  ) {
    // first sort notes from lowest to highest
    pianoArrangedNotes.sort(NoteArranger.comparePianoHeight);
    // then check which is the lowest fret that is possible
    const numNotes = pianoArrangedNotes.length;
    const { numStrings } = Song.tracks[trackId];
    let stringLastNoteWasPlacedOn = -1;
    const arrangedNotes = [];
    const { capo } = Song.tracks[trackId];
    for (let i = 0; i < numNotes; i += 1) {
      const note = pianoArrangedNotes[i];
      // run over all possible strings and find smallest value
      let smallestDifference = 5000;
      let bestString = -1;
      for (let j = stringLastNoteWasPlacedOn + 1; j < numStrings - numNotes + 1 + i; j += 1) {
        if (!usedStrings.has(j)) {
          const difference = note.height - Song.tracks[trackId].strings[j] - capo;
          // console.log(difference);
          if (difference >= 0 && difference < smallestDifference) {
            smallestDifference = difference;
            bestString = j;
          }
        }
      }
      if (bestString === -1) {
        console.log('A note could not be placed!');
        arrangedNotes.push({
          fret: -1,
          string: -1,
          note,
          fretWithCapo: -1,
        });
      } else {
        // console.log(smallestDifference, bestString);
        stringLastNoteWasPlacedOn = bestString;
        // set note
        // note.fret = smallestDifference;
        // note.string = bestString;
        arrangedNotes.push({
          fret: smallestDifference,
          string: bestString,
          note,
          fretWithCapo: smallestDifference + capo,
        });
        // Song.measures[trackId][blockId][voiceId][beatId].notes[bestString] = note;
      }
    }
    return arrangedNotes;
  }

  static arrangeAndSetNotesToGuitar(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    pianoArrangedNotes: Note[],
    usedStrings: Set<number>,
  ) {
    const arrangedNotes = NoteArranger.arrangeNotesToGuitar(trackId, pianoArrangedNotes, usedStrings);
    for (let i = 0; i < arrangedNotes.length; i += 1) {
      if (arrangedNotes[i].string !== -1) {
        const ms = Song.measures[trackId][blockId][voiceId][beatId];
        ms.notes[arrangedNotes[i].string] = arrangedNotes[i].note;
      } else {
        if (Song.measures[trackId][blockId][voiceId][beatId].otherNotes == null) {
          Song.measures[trackId][blockId][voiceId][beatId].otherNotes = [];
        }
        Song.measures[trackId][blockId][voiceId][beatId].otherNotes.push(
          arrangedNotes[i].note,
        );
      }
    }
    return arrangedNotes;
  }
}

export default NoteArranger;
