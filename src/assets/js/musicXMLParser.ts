/*
  WARNING: this file is currently not usable.
  It has to be adapted to the current progress of the rest of the code.
  It is still highly WIP.
*/

import { Measure, Note } from './songData';
import Duration from './duration';

function createPartList() {
  return '<part-list><score-part id=\'P1\'><part-name>Musik</part-name></score-part></part-list>';
}

function createXMLHeader() {
  return (
    '<?xml version=\'1.0\' encoding=\'UTF-8\' standalone=\'no\'?>'
    + '<!DOCTYPE score-partwise PUBLIC \'-//Recordare//DTD MusicXML 3.0 Partwise//EN\' \'http://www.musicxml.org/dtds/partwise.dtd\'>'
  );
}

function createPause(type: string) {
  return `<note><rest/><type>${type}</type></note>`;
}

function buildXMLNote(note: Note, string: number, type: string, isChord: boolean) {
  let { fret } = note;
  let deadNote = '';
  if (note.dead) {
    deadNote = '<notehead>x</notehead>';
    fret = 0;
  }
  const notation = `<technical><fret>${fret}</fret><string>${string}</string></technical>`;
  let noteContent = `<notations>${notation}</notations>`;
  noteContent += `<type>${type}</type>`;
  if (isChord) {
    noteContent += '<chord/>';
  }
  return `<note>${deadNote}${noteContent}</note>`;
}

function buildXMLChord(parseNotes: {note: Note | null, string: number, type: string}[]) {
  let ret = '';
  for (let i = 0; i < parseNotes.length; i += 1) {
    const isChord = i !== 0;
    if (parseNotes[i].note == null) {
      console.error('Note is null!');
      return ret;
    }
    ret += buildXMLNote(
      parseNotes[i].note!,
      parseNotes[i].string,
      parseNotes[i].type,
      isChord,
    );
  }
  return ret;
}

function createStaff(capo: string) {
  let capoAdd = '';
  if (capo !== '' && capo !== '0') {
    capoAdd = `<capo>${capo}</capo>`;
  }
  return (
    '<staff-details><staff-lines>6</staff-lines>'
    + '<staff-tuning line=\'1\'><tuning-step>E</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>'
    + '<staff-tuning line=\'2\'><tuning-step>A</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>'
    + '<staff-tuning line=\'3\'><tuning-step>D</tuning-step><tuning-octave>4</tuning-octave></staff-tuning>'
    + '<staff-tuning line=\'4\'><tuning-step>G</tuning-step><tuning-octave>4</tuning-octave></staff-tuning>'
    + '<staff-tuning line=\'5\'><tuning-step>B</tuning-step><tuning-octave>4</tuning-octave></staff-tuning>'
    + `<staff-tuning line='6'><tuning-step>E</tuning-step><tuning-octave>5</tuning-octave></staff-tuning>${capoAdd}</staff-details>`
  );
}

function createMeasureAttribute(capo: string) {
  const divisions = '<divisions>960</divisions>';
  const time = '<time><beats>4</beats><beat-type>4</beat-type></time>';
  return `<attributes>${divisions}${time}${createStaff(capo)}</attributes>`;
}

function buildXML(song: Measure[][][], capo: string) {
  let retStr = createXMLHeader();
  retStr += '<score-partwise>';
  // create one measure for each block
  retStr += createPartList();
  retStr += '<part id=\'P1\'>';
  for (let i = 0; i < song.length; i += 1) {
    retStr += `<measure number='${i + 1}'>`;
    retStr += createMeasureAttribute(capo);
    // 16th notes
    let takteToWait = 0;
    for (let j = 0; j < 16; j += 1) {
      if (takteToWait <= 0) {
        takteToWait -= 1;
        if (song[i][j] == null) {
          retStr += createPause('16th');
        } else {
          // create chord object
          const parseNotes = [];
          let longestDuration = 4;
          for (let u = 0; u < 6; u += 1) {
            if (song[i][j][u] != null) {
              const duration = Duration.getDurationOfType(song[i][j][u].duration);
              if (longestDuration > duration) {
                longestDuration = duration;
              }
              // TODO! just a placeholder
              parseNotes.push({
                note: song[i][j][u].notes[u],
                string: u,
                type: song[i][j][u].duration,
              });
            }
          }
          takteToWait = 2 ** (4 - longestDuration) - 1;
          if (parseNotes.length > 0) {
            retStr += buildXMLChord(parseNotes);
          }
        }
      }
    }
    retStr += '</measure>';
  }
  retStr += '</part>';
  retStr += '</score-partwise>';
  return retStr;
}

export default buildXML;
