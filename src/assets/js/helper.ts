import fastdom from 'fastdom';
import { instrumentList } from './instrumentData';
import Settings from './settingManager';
import { Song, Measure } from './songData';
import Duration from './duration';
import { tab } from './tab';

class Helper {
  static OFFSET_LEFT(): number {
    return 10;
  }

  static removeAllChildren(box: HTMLElement | SVGGElement | null): void {
    if (box != null) {
      while (box.lastChild) {
        box.removeChild(box.lastChild);
      }
    }
  }

  static easeInOutQuad(t: number, b: number, c: number, d: number): number {
    // t = current time, b = start value, c = change in value, d = duration
    let t2 = t / (d / 2);
    if (t2 < 1) {
      return (c / 2) * t2 * t2 + b;
    }
    t2 -= 1;
    return (-c / 2) * (t2 * (t2 - 2) - 1) + b;
  }

  static scrollToPure(elementIn: HTMLElement, from: number, to: number, duration: number): void {
    const element = elementIn;
    const start = from;
    const change = to - start;
    let currentTime = 0;
    const startTime = Date.now();
    const increment = 20;

    const animateScroll = () => {
      // currentTime += increment;
      currentTime = Date.now() - startTime;
      const val = Helper.easeInOutQuad(currentTime, start, change, duration);
      fastdom.mutate(() => {
        element.scrollTop = val;
      });
      if (currentTime < duration) {
        setTimeout(animateScroll, increment);
      }
    };
    animateScroll();
  }

  static deleteDOMObject(object: HTMLElement | SVGGElement | null) {
    if (object != null && object.parentNode != null) {
      object.parentNode.removeChild(object);
    }
  }

  static getGreatestNotelengthToFit(spaceToFill: number): number {
    return 2 ** Math.min(6, Math.floor(Math.log2(spaceToFill)));
  }

  static getIconSrc(instrument: string): string {
    if (instrumentList[instrument] == null) {
      return '';
    }
    let iconPath = instrumentList[instrument][0];
    if (Settings.darkMode) {
      iconPath = `${iconPath.substring(0, iconPath.length - 4)}White.svg`;
    }
    return iconPath;
  }

  static isInt(value: string): boolean {
    if (Number.isNaN(value)) {
      return false;
    }
    const x = parseFloat(value);
    return (x | 0) === x;
  }

  static findNextNote(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  ) {
    // We do not want slides with rests between!
    const MAXNOTELOOKFORWARD = 1;
    let curBlockId = blockId;
    let curBeatId = beatId;
    for (let i = 0; i < MAXNOTELOOKFORWARD; i += 1) {
      if (curBeatId + 1 >= Song.measures[trackId][curBlockId][voiceId].length) {
        if (curBlockId + 1 < Song.measures[trackId].length) {
          curBlockId += 1;
          curBeatId = 0;
        } else {
          break;
        }
      } else {
        curBeatId += 1;
      }
      const beat = Song.measures[trackId][curBlockId][voiceId][curBeatId];
      if (beat != null && beat.notes != null && beat.notes[string] != null) {
        return beat.notes[string]!.fret;
      }
    }
    return null;
  }

  static groupMeasureBeats(
    trackId: number, blockId: number, voiceId: number,
  ) {
    const test = Song.measures[trackId][blockId][voiceId];
    const groupings: Measure[][] = [];
    let groupIndex = 0;
    let positionWeAreAt = 0;
    let noteLengthPosition = 0;
    const QUARTER_DURATION = Duration.getDurationOfType('q');
    for (let i = 0; i < test.length; i += 1) {
      const currentDuration = Duration.getDurationOfNote(test[i], false);
      groupings[groupIndex] = [];
      if (test[i].tuplet != null) {
        // get duration of first and check until three times
        // its length is filled (one time is given by first note)
        // const withoutTuple = Duration.getDurationOfNote(test[i], true);
        // var lengthToBeReached = withoutTuple*test[i].tuplet;
        const startTupletId = test[i].tupletId;
        // console.log(test[i].tuplet, startTupletId);
        for (let j = i; j < test.length; j += 1) {
          if (test[j].tuplet == null || test[j].tupletId !== startTupletId) break;
          // we add so long the value is not higher than a quarter
          const nextDuration = Duration.getDurationOfNote(test[j], false);
          // const nextWithoutTuple = Duration.getDurationOfNote(test[j], true);
          Song.measureMoveHelper[trackId][blockId][voiceId][j] = positionWeAreAt;
          positionWeAreAt += Duration.getDurationWidth(test[j]);
          noteLengthPosition += nextDuration;
          groupings[groupIndex].push(test[j]);
          if (j !== i) {
            i += 1;
          }
          // lengthToBeReached -= nextWithoutTuple;
        }
      } else if (currentDuration >= QUARTER_DURATION || test[i].duration.length > 1) {
        groupings[groupIndex].push(test[i]);
        Song.measureMoveHelper[trackId][blockId][voiceId][i] = positionWeAreAt;
        positionWeAreAt += Duration.getDurationWidth(test[i]);
        noteLengthPosition += currentDuration;
      } else {
        // TODO: fixme, with tuplets/ with new width
        let begin = noteLengthPosition % QUARTER_DURATION;
        const startPos = i;
        for (let j = 0; j < QUARTER_DURATION; j += 1) {
          if (startPos + j >= test.length) break;
          // we add so long the value is not higher than a quarter
          const nextDuration = Duration.getDurationOfNote(test[startPos + j], false);
          if (nextDuration >= QUARTER_DURATION
            || test[startPos + j].duration.length > 1
            || test[startPos + j].tuplet != null) {
            break;
          }
          begin += nextDuration;
          Song.measureMoveHelper[trackId][blockId][voiceId][startPos + j] = positionWeAreAt;
          positionWeAreAt += Duration.getDurationWidth(test[startPos + j]);
          noteLengthPosition += nextDuration;
          groupings[groupIndex].push(test[startPos + j]);
          if (j !== 0) {
            i += 1;
          }
          if (begin >= QUARTER_DURATION) {
            break;
          }
        }
      }
      groupIndex += 1;
    }
    return groupings;
  }

  static getLeftOffset(blockId: number): number {
    let leftOFF = Helper.OFFSET_LEFT();
    if (Song.measureMeta[blockId] != null) {
      if (Song.measureMeta[blockId].repeatOpen) {
        leftOFF += 20;
      }
      if (blockId === 0 || Song.measureMeta[blockId].bpmPresent) {
        leftOFF += 43;
        if ((`${Song.measureMeta[blockId].bpm}`).length > 2) {
          leftOFF += 8;
        }
      } else if (blockId === 0 || Song.measureMeta[blockId].timeMeterPresent) {
        leftOFF += 10;
      }
    }
    return leftOFF;
  }

  // returns position in block at 16th beat distance indexX
  static getLeftPos(trackId: number, blockId: number, voiceId: number, indexX: number): number {
    const leftOFF = Helper.getLeftOffset(blockId);
    return leftOFF + indexX * tab.measureOffset[trackId][blockId][voiceId];
  }

  static getBeatPosX(trackId: number, blockId: number, voiceId: number, beatId: number): number {
    if (Song.measureMoveHelper[trackId][blockId][voiceId][beatId] == null) {
      return 0;
    }
    return Helper.getLeftPos(
      trackId, blockId, voiceId, Song.measureMoveHelper[trackId][blockId][voiceId][beatId],
    );
  }

  static getNumberOfOverbarRows(
    trackId: number, voiceId: number, rowId: number,
  ): {
    numberOfOverbarRows: number,
    textRowHeight: number,
    chordRowHeight: number,
    dynamicRowHeight: number
  } {
    let beatHeightMax = 0;
    let textPresent = 0;
    let dynamicPresent = 0;
    let chordPresent = 0;
    for (let blockId = tab.blocksPerRow[trackId][voiceId][rowId].start;
      blockId < tab.blocksPerRow[trackId][voiceId][rowId].end;
      blockId += 1
    ) {
      for (let beatId = 0, n = Song.measures[trackId][blockId][voiceId].length;
        beatId < n; beatId += 1) {
        const beat = Song.measures[trackId][blockId][voiceId][beatId];
        if (beat.textPresent) { textPresent = 1; }
        if (beat.dynamicPresent) { dynamicPresent = 1; }
        if (beat.chordPresent) { chordPresent = 1; }

        let beatHeight = 0;
        if (beat.effects != null && beat.effects.tremoloBarPresent
          && beat.effects.tremoloBar != null) {
          beatHeight += 1;
        }
        const articulationsPresent = {
          palmMute: false,
          stacatto: false,
          tap: false,
          fadeIn: false,
          pop: false,
          slap: false,
          accentuated: false,
          heavyAccentuated: false,
          vibrato: false,
          trill: false,
          artificial: false,
          pullDown: false,
          letRing: false,
        };
        if (beat.notes != null) {
          for (let string = 0, m = beat.notes.length; string < m; string += 1) {
            const note = beat.notes[string];
            if (note != null) {
              if (note.palmMute && !articulationsPresent.palmMute) {
                articulationsPresent.palmMute = true;
                beatHeight += 1;
              }
              if (note.stacatto && !articulationsPresent.stacatto) {
                articulationsPresent.stacatto = true;
                beatHeight += 1;
              }
              if (note.tap && !articulationsPresent.tap) {
                articulationsPresent.tap = true;
                beatHeight += 1;
              }
              if (note.fadeIn && !articulationsPresent.fadeIn) {
                articulationsPresent.fadeIn = true;
                beatHeight += 1;
              }
              if (note.pop && !articulationsPresent.pop) {
                articulationsPresent.pop = true;
                beatHeight += 1;
              }
              if (note.slap && !articulationsPresent.slap) {
                articulationsPresent.slap = true;
                beatHeight += 1;
              }
              if (note.accentuated && !articulationsPresent.accentuated) {
                articulationsPresent.accentuated = true;
                beatHeight += 1;
              }
              if (note.heavyAccentuated && !articulationsPresent.heavyAccentuated) {
                articulationsPresent.heavyAccentuated = true;
                beatHeight += 1;
              }
              if (note.vibrato && !articulationsPresent.vibrato) {
                articulationsPresent.vibrato = true;
                beatHeight += 1;
              }
              if (note.trillPresent && !articulationsPresent.trill) {
                articulationsPresent.trill = true;
                beatHeight += 1;
              }
              if (note.artificialPresent && !articulationsPresent.artificial) {
                articulationsPresent.artificial = true;
                beatHeight += 1;
              }
              if (note.pullDown && !articulationsPresent.pullDown) {
                articulationsPresent.pullDown = true;
                beatHeight += 1;
              }
              if (note.letRing && !articulationsPresent.letRing) {
                articulationsPresent.letRing = true;
                beatHeight += 1;
              }
            }
          }
          beatHeightMax = Math.max(beatHeightMax, beatHeight);
        }
      }
    }
    // we set an own row for text, dynamics and chords
    return {
      numberOfOverbarRows: beatHeightMax + textPresent + dynamicPresent + chordPresent,
      textRowHeight: beatHeightMax,
      chordRowHeight: beatHeightMax + textPresent,
      dynamicRowHeight: beatHeightMax + textPresent + chordPresent,
    };
  }
}

export default Helper;
