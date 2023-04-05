import Song, { Measure, Note, TremoloBar } from './songData';
import GPXByteBuffer from './GPXByteBuffer';
import GProReader from './GProReader';
import { menuHandler } from './menuHandler';
import AppManager from './appManager';

class GpxReader {
  fileSystem: {fileName: string, fileContents: number[]}[];

  xmlDoc: XMLDocument | null;

  xmlGPIF: Element | null;

  bars: {id: string, voiceIds: number[], clef: string, simileMark: string}[];

  voices: {id: string, beatIds: number[]}[];

  beats: Measure[];

  rhythms: {id: number, noteValue: string, primaryTupletDen: number | null,
    primaryTupletNum: number | null, augmentationDotCount: number}[];

  notes: Note[];

  barIdsPerMeasure: number[][];

  GP_WHAMMY_BAR_POSITION: number;

  TREMOLO_MAX_POS: number;

  GP_BEND_POSITION: number;

  MAX_POSITION_LENGTH: number;

  constructor() {
    this.fileSystem = [];
    this.xmlDoc = null;
    this.xmlGPIF = null;

    this.barIdsPerMeasure = [];
    this.bars = [];
    this.voices = [];
    this.beats = [];
    this.rhythms = [];
    this.notes = [];

    this.GP_WHAMMY_BAR_POSITION = 100.0;
    this.TREMOLO_MAX_POS = 60;
    this.GP_BEND_POSITION = 100.0;
    this.MAX_POSITION_LENGTH = 60;
  }

  read(readerBuffer: Uint8Array) {
    Song.measures.length = 0;
    Song.measureMeta.length = 0;
    this.fileSystem.length = 0;
    Song.chordsMap = [];
    // create the file-system
    GPXByteBuffer.load(readerBuffer, this.fileSystem);
    // read score.gpif
    this.buildXMLDocument();
    this.processXML();

    Song.numMeasures = Song.measures[0].length;
    AppManager.resetVariables();
    // t0 = performance.now();
    GProReader.writeNoteInfoToBeat();
    AppManager.createGuitarTab(0);
    menuHandler.applyStyleMode();
    // console.log("Track Change: " + (performance.now()-t0)+"ms");
  }

  buildXMLDocument() {
    // grab score.gpif
    let scoreContent = null;
    for (let i = 0; i < this.fileSystem.length; i += 1) {
      if (this.fileSystem[i].fileName === 'score.gpif') {
        scoreContent = this.fileSystem[i].fileContents;
        break;
      }
    }
    if (scoreContent == null) {
      alert('READ ERROR');
      return;
    }
    const xmlDocString = new TextDecoder('utf-8').decode(new Uint8Array(scoreContent));
    // var parser = new DOMParser();
    // this.xmlDoc = parser.parseFromString(xmlDocString,"text/xml");
    this.xmlDoc = jQuery.parseXML(xmlDocString);
    // this.xmlDoc.getElementsByTagName("title")[0].children[0].nodeValue;
  }

  processXML() {
    if (this.xmlDoc != null) {
      // eslint-disable-next-line prefer-destructuring
      this.xmlGPIF = this.xmlDoc.getElementsByTagName('GPIF')[0];
      this.readXMLScore();
      this.readXMLTracks();
      this.readXMLMasterBars();
      this.readXMLBars();
      this.readXMLVoices();
      this.readXMLBeats();
      this.readXMLNotes();
      this.readXMLRhythms();

      this.mergeToMeasure();
      this.readXMLAutomations();
    }
  }

  static getChildNode(node: Element, name: string): Element | null {
    for (let i = 0; i < node.children.length; i += 1) {
      if (node.children[i].tagName === name) {
        return node.children[i];
      }
    }
    return null;
  }

  static getChildNodeBooleanContent(node: Element, childName: string) {
    const value = GpxReader.getChildNodeContent(node, childName);
    if (value != null) {
      return value === 'true';
    }
    return false;
  }

  static getChildNodeContent(node: Element, childName: string) {
    const child = GpxReader.getChildNode(node, childName);
    if (child != null) {
      return child.children[0].nodeValue;
    }
    return null;
  }

  static getChildNodeIntegerContent(node: Element, childName: string) {
    const child = GpxReader.getChildNode(node, childName);
    if (child != null) {
      return parseInt(child.children[0].nodeValue ?? '0', 10);
    }
    return null;
  }

  static getChildNodeContentArray(node: Element, childName: string, regexIn: string) {
    let regex = regexIn;
    const str = GpxReader.getChildNodeContent(node, childName);
    if (str != null) {
      if (regex == null) {
        regex = ' ';
      }
      return str.trim().split(regex);
    }
    return null;
  }

  static getChildNodeIntegerContentArray(
    node: Element, childName: string, regex: string,
  ): number[] | null {
    const arr = GpxReader.getChildNodeContentArray(node, childName, regex);
    if (arr == null) {
      return null;
    }
    const arrInt = [];
    for (let i = 0; i < arr.length; i += 1) {
      arrInt[i] = parseInt(arr[i], 10);
    }
    return arrInt;
  }

  readXMLScore() {
    if (this.xmlGPIF == null) {
      return;
    }
    const node = GpxReader.getChildNode(this.xmlGPIF, 'Score');
    if (node != null) {
      Song.songDescription.title = GpxReader.getChildNodeContent(node, 'Title') ?? '';
      Song.songDescription.subtitle = GpxReader.getChildNodeContent(node, 'SubTitle') ?? '';
      Song.songDescription.artist = GpxReader.getChildNodeContent(node, 'Artist') ?? '';
      Song.songDescription.album = GpxReader.getChildNodeContent(node, 'Album') ?? '';
      Song.songDescription.writer = GpxReader.getChildNodeContent(node, 'Words') ?? '';
      Song.songDescription.music = GpxReader.getChildNodeContent(node, 'Music') ?? '';
      Song.songDescription.wordsAndMusic = GpxReader.getChildNodeContent(node, 'WordsAndMusic') ?? '';
      Song.songDescription.copyright = GpxReader.getChildNodeContent(node, 'Copyright') ?? '';
      Song.songDescription.author = GpxReader.getChildNodeContent(node, 'Tabber') ?? '';
      Song.songDescription.instructions = GpxReader.getChildNodeContent(node, 'Instructions') ?? '';
      const comments: string[] = [];
      comments.push(GpxReader.getChildNodeContent(node, 'Notices') ?? '');
      Song.songDescription.comments = comments;
    }
    AppManager.setTrackInfo();
  }

  readXMLAutomations() {
    if (this.xmlGPIF != null) {
      const masterTrackNode = GpxReader.getChildNode(this.xmlGPIF, 'MasterTrack');
      if (masterTrackNode != null) {
        const automationNodes = GpxReader.getChildNode(masterTrackNode, 'Automations');
        if (automationNodes != null) {
          for (let i = 0; i < automationNodes.children.length; i += 1) {
            if (automationNodes.children[i].tagName === 'Automation') {
              const automationNode = automationNodes.children[i];

              const type = GpxReader.getChildNodeContent(automationNode, 'Type') ?? '';
              const blockId = GpxReader.getChildNodeIntegerContent(automationNode, 'Bar');
              const value = GpxReader.getChildNodeIntegerContentArray(automationNode, 'Value', '') ?? [];
              const linear = GpxReader.getChildNodeBooleanContent(automationNode, 'Linear');
              const position = GpxReader.getChildNodeIntegerContent(automationNode, 'Position') ?? 0;
              const visible = GpxReader.getChildNodeBooleanContent(automationNode, 'Visible');

              // TODO more than one tempo
              if (type === 'Tempo' && blockId != null) {
                Song.measureMeta[blockId].bpmPresent = true;
                // eslint-disable-next-line prefer-destructuring
                Song.measureMeta[blockId].bpm = value[0];
              }
              if (blockId != null) {
                const automation = {
                  type, blockId, value, linear, position, visible,
                };
                Song.measureMeta[blockId].automations.push(automation);
              }
            }
          }
        }
      }
      Song.setTempo(Song.measureMeta[0].bpm);
    }
  }

  readXMLTracks() {
    if (this.xmlGPIF == null) {
      return;
    }
    Song.tracks.length = 0;
    let trackCounter = 0;
    const trackNodes = GpxReader.getChildNode(this.xmlGPIF, 'Tracks');
    if (trackNodes == null) {
      console.error('Track Nodes are null');
      return;
    }
    for (let i = 0; i < trackNodes.children.length; i += 1) {
      if (trackNodes.children[i].tagName === 'Track') {
        const trackNode = trackNodes.children[i];

        const name = GpxReader.getChildNodeContent(trackNode, 'Name') ?? '';
        const colorArr = GpxReader.getChildNodeContentArray(trackNode, 'Color', ' ');
        const color = colorArr != null
          ? {
            red: parseInt(colorArr[0], 10),
            green: parseInt(colorArr[1], 10),
            blue: parseInt(colorArr[2], 10),
          }
          : { red: 255, green: 0, blue: 0 };
        const letItRing = false;

        const instrument = GpxReader.getChildNode(trackNode, 'Instrument');
        const instrName = instrument ? instrument.getAttribute('ref') ?? '' : '';

        let program = 0;
        let primaryChannel = 0;
        let secondaryChannel = 0;
        const generalMidi = GpxReader.getChildNode(trackNode, 'GeneralMidi');
        if (generalMidi != null) {
          program = GpxReader.getChildNodeIntegerContent(generalMidi, 'Program') ?? 0;
          primaryChannel = GpxReader.getChildNodeIntegerContent(generalMidi, 'PrimaryChannel') ?? 0;
          secondaryChannel = GpxReader.getChildNodeIntegerContent(generalMidi, 'SecondaryChannel') ?? 0;
        }
        let capo = 0;
        let strings = null;
        const propertyNodes = GpxReader.getChildNode(trackNode, 'Properties');
        if (propertyNodes != null) {
          for (let j = 0; j < propertyNodes.children.length; j += 1) {
            if (propertyNodes.children[j].tagName === 'Property') {
              const propertyNode = propertyNodes.children[j];
              // track.proper
              const nameProp = propertyNode.getAttribute('name');
              if (nameProp === 'Tuning') {
                strings = GpxReader.getChildNodeIntegerContentArray(propertyNode, 'Pitches', '');
              } else if (nameProp === 'CapoFret') {
                capo = GpxReader.getChildNodeIntegerContent(propertyNode, 'Fret') ?? 0;
              }
            }
          }
        }

        let numStrings = 6;
        if (strings != null) {
          numStrings = strings.length;
        } else {
          strings = [40, 45, 50, 55, 59, 64];
        }

        const track = {
          name,
          color,
          letItRing,
          program,
          primaryChannel,
          secondaryChannel,
          capo,
          strings,
          numStrings,
          volume: 127,
          balance: 0,
          reverb: 0,
          channel: { index: 0, effectChannel: 0 },
        };

        Song.tracks[trackCounter] = track;
        trackCounter += 1;
        // duplicate for piano left hand
        if ((track.program <= 5 && track.primaryChannel !== 9 && instrName !== 'a-piano-ss'
          && instrName !== 'e-piano-ss') || instrName === 'a-piano-gs' || instrName === 'e-piano-gs') {
          Song.tracks[trackCounter] = track;
          trackCounter += 1;
        }
      }
    }
  }

  readXMLMasterBars() {
    if (this.xmlGPIF == null) {
      return;
    }
    Song.measureMeta.length = 0;
    const masterBarNodes = GpxReader.getChildNode(this.xmlGPIF, 'MasterBars');
    if (masterBarNodes == null) {
      console.error('Master Bar is null');
      return;
    }

    let measureCounter = 0;
    for (let i = 0; i < masterBarNodes.children.length; i += 1) {
      if (masterBarNodes.children[i].tagName === 'MasterBar') {
        const masterBarNode = masterBarNodes.children[i];

        const barIds = GpxReader.getChildNodeIntegerContentArray(masterBarNode, 'Bars', '') ?? [];
        this.barIdsPerMeasure.push(barIds);
        const time = GpxReader.getChildNodeIntegerContentArray(masterBarNode, 'Time', '/') ?? [4, 4];
        // eslint-disable-next-line prefer-destructuring
        const numerator = time[0];
        // eslint-disable-next-line prefer-destructuring
        const denominator = time[1];
        let timeMeterPresent = false;
        if (measureCounter === 0
          || (Song.measureMeta[measureCounter - 1].numerator !== numerator)
          || (Song.measureMeta[measureCounter - 1].denominator !== denominator)) {
          timeMeterPresent = true;
        }
        const tripletFeel = GpxReader.getChildNodeContent(masterBarNode, 'TripletFeel');
        if (Song.measureMeta.length === 0) {
          timeMeterPresent = true;
        }

        const repeatNode = GpxReader.getChildNode(masterBarNode, 'Repeat');
        let repeatOpen = false;
        let repeatClosePresent = false;
        let repeatClose = 0;
        if (repeatNode != null) {
          repeatOpen = repeatNode.getAttribute('start') === 'true';
          if (repeatNode.getAttribute('end') === 'true') {
            repeatClosePresent = true;
            repeatClose = parseInt(repeatNode.getAttribute('count') ?? '0', 10);
          }
        }
        const keyNode = GpxReader.getChildNode(masterBarNode, 'Key');
        let accidentalCount = 0;
        let mode = '';
        if (keyNode != null) {
          accidentalCount = parseInt(GpxReader.getChildNodeContent(keyNode, 'AccidentalCount') ?? '0', 10);
          mode = GpxReader.getChildNodeContent(keyNode, 'Mode') ?? '';
        }

        const measureM = {
          numerator,
          denominator,
          timeMeterPresent,
          tripletFeel,
          repeatOpen,
          repeatClosePresent,
          repeatClose,
          accidentalCount,
          mode,
          bpmPresent: false,
          bpm: 0,
          repeatAlternativePresent: false,
          repeatAlternative: 0,
          markerPresent: false,
          marker: { text: '', color: { red: 0, green: 0, blue: 0 } },
          keySignature: 0,
          automations: [],
        };

        Song.measureMeta[measureCounter] = measureM;
        measureCounter += 1;
      }
    }
  }

  readXMLBars() {
    if (this.xmlGPIF == null) {
      return;
    }
    this.bars.length = 0;
    const barNodes = GpxReader.getChildNode(this.xmlGPIF, 'Bars');
    if (barNodes == null) {
      console.error('Bar Nodes is null');
      return;
    }
    for (let i = 0; i < barNodes.children.length; i += 1) {
      if (barNodes.children[i].tagName === 'Bar') {
        const barNode = barNodes.children[i];

        const id = barNode.getAttribute('id') ?? '';
        const voiceIds = GpxReader.getChildNodeIntegerContentArray(barNode, 'Voices', '') ?? [];
        const clef = GpxReader.getChildNodeContent(barNode, 'Clef') ?? '';
        const simileMark = GpxReader.getChildNodeContent(barNode, 'SimileMark') ?? '';
        const bar = {
          id, voiceIds, clef, simileMark,
        };
        this.bars.push(bar);
      }
    }
  }

  readXMLVoices() {
    if (this.xmlGPIF == null) {
      return;
    }
    this.voices.length = 0;
    const voiceNodes = GpxReader.getChildNode(this.xmlGPIF, 'Voices');
    if (voiceNodes == null) {
      console.error('Voice Nodes is null');
      return;
    }
    for (let i = 0; i < voiceNodes.children.length; i += 1) {
      if (voiceNodes.children[i].tagName === 'Voice') {
        const voiceNode = voiceNodes.children[i];
        const id = voiceNode.getAttribute('id') ?? '';
        const beatIds = GpxReader.getChildNodeIntegerContentArray(voiceNode, 'Beats', '') ?? [];
        const voice = { id, beatIds };
        this.voices.push(voice);
      }
    }
  }

  readXMLBeats() {
    if (this.xmlGPIF == null) {
      return;
    }
    this.beats.length = 0;
    const beatsNodes = GpxReader.getChildNode(this.xmlGPIF, 'Beats');
    if (beatsNodes == null) {
      console.error('Beats Nodes is null');
      return;
    }
    for (let i = 0; i < beatsNodes.children.length; i += 1) {
      if (beatsNodes.children[i].tagName === 'Beat') {
        const beatNode = beatsNodes.children[i];

        const id = beatNode.getAttribute('id');
        let dynamic = GpxReader.parseDynamic(GpxReader.getChildNodeContent(beatNode, 'Dynamic'));
        let dynamicPresent = false;
        if (dynamic != null) {
          dynamicPresent = true;
        } else {
          dynamic = '';
        }
        const rhythmId = parseInt(GpxReader.getChildNode(beatNode, 'Rhythm')!.getAttribute('ref') ?? '0', 10);
        const tremolo = GpxReader.getChildNodeContentArray(beatNode, 'Tremolo', ' ');
        if (tremolo != null && tremolo.length === 2) {
          console.log('TREMOLO PICKING');
          // eslint-disable-next-line prefer-destructuring
          // TODO note.tremoloPicking = tremolo[1];
        }

        const gracePresent = GpxReader.getChildNode(beatNode, 'GraceNotes') != null;
        let graceObj = '';
        if (gracePresent) {
          graceObj = GpxReader.getChildNodeContent(beatNode, 'GraceNotes') ?? '';
        }
        const noteIds = GpxReader.getChildNodeIntegerContentArray(beatNode, 'Notes', ' ') ?? [];

        let whammyEnabled = false;
        let whammyBarOriginValue = 0;
        let whammyBarMiddleValue = 0;
        let whammyBarDestinationValue = 0;
        let whammyBarOriginOffset = 0;
        let whammyBarMiddleOffset1 = 0;
        let whammyBarMiddleOffset2 = 0;
        let whammyBarDestinationOffset = 0;

        const propertyNodes = GpxReader.getChildNode(beatNode, 'Properties');
        if (propertyNodes != null) {
          for (let j = 0; j < propertyNodes.children.length; j += 1) {
            if (propertyNodes.children[j].tagName === 'Property') {
              const propertyNode = propertyNodes.children[j];
              // track.proper
              const name = propertyNode.getAttribute('name');
              if (name === 'WhammyBar') {
                whammyEnabled = GpxReader.getChildNode(propertyNode, 'Enable') != null;
              } else if (name === 'WhammyBarOriginValue') {
                whammyBarOriginValue = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
              } else if (name === 'WhammyBarMiddleValue') {
                whammyBarMiddleValue = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
              } else if (name === 'WhammyBarDestinationValue') {
                whammyBarDestinationValue = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
              } else if (name === 'WhammyBarOriginOffset') {
                whammyBarOriginOffset = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
              } else if (name === 'WhammyBarMiddleOffset1') {
                whammyBarMiddleOffset1 = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
              } else if (name === 'WhammyBarMiddleOffset2') {
                whammyBarMiddleOffset2 = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
              } else if (name === 'WhammyBarDestinationOffset') {
                whammyBarDestinationOffset = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
              }
            }
          }
        }

        // Write tremolo bar
        const tremoloBar: TremoloBar = [];
        let tremoloBarPresent = false;
        if (whammyEnabled && whammyBarOriginValue != null
          && whammyBarDestinationValue != null) {
          tremoloBar.push({
            position: 0,
            value: GpxReader.parseTremoloBarValue(whammyBarOriginValue),
            vibrato: 0,
          });
          if (whammyBarOriginOffset != null) {
            tremoloBar.push({
              position: this.parseTremoloBarPosition(whammyBarOriginOffset),
              value: GpxReader.parseTremoloBarValue(whammyBarOriginValue),
              vibrato: 0,
            });
          }
          if (whammyBarMiddleValue != null) {
            let hiddenPoint = false;
            if (whammyBarDestinationValue !== 0) {
              if (whammyBarMiddleValue === Math.round(whammyBarDestinationOffset / 2.0)) {
                hiddenPoint = false;
              }
            }
            if (!hiddenPoint) {
              const defaultMiddleOffset = this.GP_WHAMMY_BAR_POSITION / 2;
              const offset1 = (whammyBarMiddleOffset1 != null
                ? whammyBarMiddleOffset1 : defaultMiddleOffset);
              if (whammyBarOriginOffset == null || offset1 >= whammyBarOriginOffset) {
                tremoloBar.push({
                  position: this.parseTremoloBarPosition(offset1),
                  value: GpxReader.parseTremoloBarValue(whammyBarMiddleValue),
                  vibrato: 0,
                });
              }
              const offset2 = (whammyBarMiddleOffset2 != null
                ? whammyBarMiddleOffset2 : defaultMiddleOffset);
              if (whammyBarOriginOffset == null
                || (offset1 >= whammyBarOriginOffset && offset2 > offset1)) {
                tremoloBar.push({
                  position: this.parseTremoloBarPosition(offset2),
                  value: GpxReader.parseTremoloBarValue(whammyBarMiddleValue),
                  vibrato: 0,
                });
              }
            }
          }
          if (whammyBarDestinationOffset != null
            && whammyBarDestinationOffset < this.GP_WHAMMY_BAR_POSITION) {
            tremoloBar.push({
              position: this.parseTremoloBarPosition(whammyBarDestinationOffset),
              value: GpxReader.parseTremoloBarValue(whammyBarDestinationValue),
              vibrato: 0,
            });
          }
          tremoloBar.push({
            position: this.TREMOLO_MAX_POS,
            value: GpxReader.parseTremoloBarValue(whammyBarDestinationValue),
            vibrato: 0,
          });
          tremoloBarPresent = true;
        }
        const beat = {
          id,
          dynamic,
          dynamicPresent,
          rhythmId,
          tremolo,
          gracePresent,
          graceObj,
          noteIds,
          whammyEnabled,
          whammyBarOriginValue,
          whammyBarMiddleValue,
          whammyBarDestinationValue,
          whammyBarOriginOffset,
          whammyBarMiddleOffset1,
          whammyBarMiddleOffset2,
          whammyBarDestinationOffset,
          effects: {
            tremoloBarPresent,
            tremoloBar,
            strokePresent: false,
            stroke: { strokeLength: 0, strokeType: 'up' as 'up' },
            fadeIn: false,
            vibrato: false,
            tap: false,
            slap: false,
            pop: false,
          },
          duration: '',
          otherNotes: [],
          notes: [],
          dotted: false,
          doubleDotted: false,
          textPresent: false,
          text: '',
          tupletId: -1,
          chordPresent: false,
          chord: Song.defaultChord(),
          tuplet: -1,
          keySignature: '',
          empty: false,
        };
        this.beats.push(beat);
      }
    }
  }

  static parseDynamic(dynamic: string | null): string | null {
    if (dynamic == null) {
      return null;
    }
    return dynamic.toLowerCase();
  }

  static parseTremoloBarValue(gpValue: number): number {
    const HIGHEST_VALUE = 400;
    const LOWEST_VALUE = -800;
    let value = gpValue;
    if (value > HIGHEST_VALUE) {
      value = HIGHEST_VALUE;
    }
    if (value < LOWEST_VALUE) {
      value = LOWEST_VALUE;
    }
    return value;
  }

  parseTremoloBarPosition(gpOffset: number): number {
    return Math.round(
      gpOffset * (this.TREMOLO_MAX_POS / this.GP_WHAMMY_BAR_POSITION),
    );
  }

  readXMLNotes() {
    if (this.xmlGPIF == null) {
      return;
    }
    this.notes.length = 0;
    const noteNodes = GpxReader.getChildNode(this.xmlGPIF, 'Notes');
    if (noteNodes == null) {
      console.error('Note Nodes is null');
      return;
    }
    for (let i = 0; i < noteNodes.children.length; i += 1) {
      if (noteNodes.children[i].tagName === 'Note') {
        const noteNode = noteNodes.children[i];

        const id = parseInt(noteNode.getAttribute('id') ?? '-1', 10);

        const tieNode = GpxReader.getChildNode(noteNode, 'Tie');
        const tied = (tieNode != null ? tieNode.getAttribute('destination') === 'true' : false);

        const letRingNode = GpxReader.getChildNode(noteNode, 'LetRing');
        const letRing = letRingNode != null;

        const ghostNoteContent = GpxReader.getChildNodeContent(noteNode, 'AntiAccent');
        let ghost = false;
        if (ghostNoteContent != null) {
          ghost = (ghostNoteContent === 'Normal');
        }

        const accent = GpxReader.getChildNodeIntegerContent(noteNode, 'Accent');
        let stacatto = false;
        let heavyAccentuated = false;
        let accentuated = false;
        if (accent === 1) {
          stacatto = true;
        } else if (accent === 4) {
          heavyAccentuated = true;
        } else if (accent === 8) {
          accentuated = true;
        }

        const trillPresent = GpxReader.parseTrill(GpxReader.getChildNodeIntegerContent(noteNode, 'Trill'));
        const vibrato = GpxReader.getChildNode(noteNode, 'Vibrato') != null;

        let string = 0;
        let fret = 0;
        let midiNumber = 0;
        let tone = 0;
        let octave = 0;
        let element = 0;
        let variation = 0;
        let dead = false;
        let palmMuted = false;
        let slide = false;
        let slideFlags = 0;
        let tap = false;
        let bendPresent = false;
        let bendOriginValue = 0;
        let bendMiddleValue = 0;
        let bendDestinationValue = 0;
        let bendOriginOffset = 0;
        let bendMiddleOffset1 = 0;
        let bendMiddleOffset2 = 0;
        let bendDestinationOffset = 0;
        let pullDown = false;
        let harmonicFret = 0;
        let harmonicType = 0;

        const propertyNodes = GpxReader.getChildNode(noteNode, 'Properties');
        if (propertyNodes != null) {
          for (let j = 0; j < propertyNodes.children.length; j += 1) {
            if (propertyNodes.children[j].tagName === 'Property') {
              const propertyNode = propertyNodes.children[j];
              const name = propertyNode.getAttribute('name');
              switch (name) {
                case 'String':
                  string = GpxReader.getChildNodeIntegerContent(propertyNode, 'String') ?? 0;
                  break;
                case 'Fret':
                  fret = GpxReader.getChildNodeIntegerContent(propertyNode, 'Fret') ?? 0;
                  break;
                case 'Midi':
                  midiNumber = GpxReader.getChildNodeIntegerContent(propertyNode, 'Number') ?? 0;
                  break;
                case 'Tone':
                  tone = GpxReader.getChildNodeIntegerContent(propertyNode, 'Step') ?? 0;
                  break;
                case 'Octave':
                  octave = GpxReader.getChildNodeIntegerContent(propertyNode, 'Number') ?? 0;
                  break;
                case 'Element':
                  element = GpxReader.getChildNodeIntegerContent(propertyNode, 'Element') ?? 0;
                  break;
                case 'Variation':
                  variation = GpxReader.getChildNodeIntegerContent(propertyNode, 'Variation') ?? 0;
                  break;
                case 'Muted':
                  dead = GpxReader.getChildNode(propertyNode, 'Enable') != null;
                  break;
                case 'PalmMuted':
                  palmMuted = GpxReader.getChildNode(propertyNode, 'Enable') != null;
                  break;
                case 'Slide':
                  slide = true;
                  slideFlags = GpxReader.getChildNodeIntegerContent(propertyNode, 'Flags') ?? 0;
                  break;
                case 'Tapped':
                  tap = GpxReader.getChildNode(propertyNode, 'Enable') != null;
                  break;
                case 'Bended':
                  // console.log(propertyNodes);
                  if (GpxReader.getChildNode(propertyNode, 'Enable') != null) {
                    bendPresent = true;
                  }
                  break;
                case 'BendOriginValue':
                  bendOriginValue = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
                  break;
                case 'BendMiddleValue':
                  bendMiddleValue = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
                  break;
                case 'BendDestinationValue':
                  bendDestinationValue = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
                  break;
                case 'BendOriginOffset':
                  bendOriginOffset = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
                  break;
                case 'BendMiddleOffset1':
                  bendMiddleOffset1 = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
                  break;
                case 'BendMiddleOffset2':
                  bendMiddleOffset2 = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
                  break;
                case 'BendDestinationOffset':
                  bendDestinationOffset = GpxReader.getChildNodeIntegerContent(propertyNode, 'Float') ?? 0;
                  break;
                case 'HopoOrign':
                  pullDown = true;
                  break;
                case 'HopoDestination':
                  break;
                case 'HarmonicFret':
                  harmonicFret = GpxReader.getChildNodeIntegerContent(propertyNode, 'HFret') ?? -1;
                  break;
                case 'HarmonicType':
                  harmonicType = GpxReader.getChildNodeIntegerContent(propertyNode, 'HType') ?? -1;
                  break;
                default:
              }
            }
          }
        }
        const artificialStyle = '';
        if (harmonicType != null) {
          /* TODO: ATM we get back an integer (Not a string)
          if (harmonicType === 'Artificial') {
            artificialStyle = 'A.H.';
          } else if (harmonicType === 'Natural') {
            artificialStyle = 'N.H.';
          } else if (harmonicType === 'Pinch') {
            artificialStyle = 'P.H.';
          } else {
            artificialStyle = 'N.H.';
          } */
        }
        // Write bend
        const bendObj = [];
        if (bendPresent) {
          bendObj.push({
            bendPosition: 0,
            bendValue: GpxReader.parseBendValue(bendOriginValue),
            vibrato: -1,
          });
          if (bendOriginOffset != null) {
            bendObj.push({
              bendPosition: this.parseBendPosition(bendOriginOffset),
              bendValue: GpxReader.parseBendValue(bendOriginValue),
              vibrato: -1,
            });
          }
          if (bendMiddleValue != null) {
            const defaultMiddleOffset = Math.round(this.GP_BEND_POSITION / 2);
            if (bendMiddleOffset1 == null || bendMiddleOffset1 !== 12) {
              const offset2 = bendMiddleOffset1 != null
                ? bendMiddleOffset1 : defaultMiddleOffset;
              bendObj.push({
                bendPosition: this.parseBendPosition(offset2),
                bendValue: GpxReader.parseBendValue(bendMiddleValue),
                vibrato: -1,
              });
            }
            if (bendMiddleOffset2 == null || bendMiddleOffset2 !== 12) {
              const offset3 = (bendMiddleOffset2 != null
                ? bendMiddleOffset2 : defaultMiddleOffset);
              bendObj.push({
                bendPosition: this.parseBendPosition(offset3),
                bendValue: GpxReader.parseBendValue(bendMiddleValue),
                vibrato: -1,
              });
            }
          }
          if (bendDestinationOffset != null
            && bendDestinationOffset < this.GP_BEND_POSITION) {
            bendObj.push({
              bendPosition: this.parseBendPosition(bendDestinationOffset),
              bendValue: GpxReader.parseBendValue(bendDestinationValue),
              vibrato: -1,
            });
          }
          bendObj.push({
            bendPosition: this.MAX_POSITION_LENGTH,
            bendValue: GpxReader.parseBendValue(bendDestinationValue),
            vibrato: -1,
          });
        }
        const note = {
          id,
          tied,
          letRing,
          ghost,
          stacatto,
          heavyAccentuated,
          accentuated,
          trillPresent,
          vibrato,
          string,
          fret,
          midiNumber,
          tone,
          octave,
          element,
          variation,
          dead,
          palmMuted,
          slide,
          slideFlags,
          tap,
          bendPresent,
          bendOriginValue,
          bendMiddleValue,
          bendDestinationValue,
          bendOriginOffset,
          bendMiddleOffset1,
          bendMiddleOffset2,
          bendDestinationOffset,
          pullDown,
          harmonicFret,
          harmonicType,
          artificialStyle,
          bendObj,
        };
        this.notes[note.id] = { ...Song.defaultNote(), ...note };
      }
    }
  }

  static parseBendValue(gpValue: number): number {
    return gpValue;
  }

  parseBendPosition(gpOffset: number): number {
    return Math.round(gpOffset * (this.MAX_POSITION_LENGTH / this.GP_BEND_POSITION));
  }

  static parseTrill(trill: number | null) {
    // TODO
    return trill != null;
  }

  readXMLRhythms() {
    if (this.xmlGPIF == null) {
      return;
    }
    this.rhythms.length = 0;
    const rhythmNodes = GpxReader.getChildNode(this.xmlGPIF, 'Rhythms');
    if (rhythmNodes == null) {
      console.error('Rhythms Nodes is null');
      return;
    }
    for (let i = 0; i < rhythmNodes.children.length; i += 1) {
      if (rhythmNodes.children[i].tagName === 'Rhythm') {
        const rhythmNode = rhythmNodes.children[i];
        const primaryTupletNode = GpxReader.getChildNode(rhythmNode, 'PrimaryTuplet');
        const augmentationDotNode = GpxReader.getChildNode(rhythmNode, 'AugmentationDot');

        const id = parseInt(rhythmNode.getAttribute('id') ?? '0', 10);
        const noteValue = GpxReader.getChildNodeContent(rhythmNode, 'NoteValue') ?? '';
        const primaryTupletDen = primaryTupletNode != null
          ? parseInt(primaryTupletNode.getAttribute('den') ?? '0', 10) : null;
        const primaryTupletNum = primaryTupletNode != null
          ? parseInt(primaryTupletNode.getAttribute('num') ?? '0', 10) : null;
        const augmentationDotCount = augmentationDotNode != null
          ? parseInt(augmentationDotNode.getAttribute('count') ?? '0', 10) : 0;

        const rhythm = {
          id, noteValue, primaryTupletDen, primaryTupletNum, augmentationDotCount,
        };
        this.rhythms[rhythm.id] = rhythm;
      }
    }
  }

  static noteValueToDuration(nValue: string): string {
    switch (nValue) {
      case 'Whole':
        return 'w';
      case 'Half':
        return 'h';
      case 'Quarter':
        return 'q';
      case 'Eighth':
        return 'e';
      case '16th':
        return 's';
      case '32nd':
        return 't';
      case '64th':
        return 'z';
      default:
        console.log('Not supported');
        return 't';
    }
  }

  /* Masterbar: measure -> barIds (plural)
    Bar: bar -> voices
    Voices: voice -> beats
    Beat -> rhythm_id & note id
    Rhythm: duration
    Note: fret, string, noteEffects */
  mergeToMeasure() {
    // initalize tracks
    Song.measures.length = 0;
    for (let j = 0; j < Song.tracks.length; j += 1) {
      Song.measures[j] = [];
    }

    // One measure per Masterbar
    for (let i = 0; i < Song.measureMeta.length; i += 1) {
      // Bar pro trackId - Piano gets two bars for both hands
      for (let j = 0; j < this.barIdsPerMeasure[i].length; j += 1) {
        const barId = this.barIdsPerMeasure[i][j];

        Song.measures[j][i] = [];
        for (let voiceIdScaled = 0;
          voiceIdScaled < this.bars[barId].voiceIds.length; voiceIdScaled += 1) {
          Song.measures[j][i][voiceIdScaled] = [];
          // TODO: for now we only look at the first voice
          const voiceId = this.bars[barId].voiceIds[0];
          if (voiceId === -1) {
            Song.measures[j][i][voiceIdScaled][0] = Song.defaultMeasure();
          } else {
            const { beatIds } = this.voices[voiceId];
            let graceObj = null;
            let beatId = 0;
            for (let k = 0; k < beatIds.length; k += 1) {
              const indexInBeats = beatIds[k];
              const { noteIds } = this.beats[indexInBeats];
              const rhythm = this.rhythms[this.beats[indexInBeats].rhythmId];

              const duration = GpxReader.noteValueToDuration(rhythm.noteValue);
              let tuplet = 0;
              if (rhythm.primaryTupletDen != null && rhythm.primaryTupletNum != null) {
                tuplet = rhythm.primaryTupletNum;
              }
              const { dynamicPresent } = this.beats[indexInBeats];
              const { dynamic } = this.beats[indexInBeats];
              const { effects } = this.beats[indexInBeats];
              const dotted = (rhythm.augmentationDotCount > 0);
              const notes: Note[] = [];
              const beatObj = {
                ...Song.defaultMeasure(),
                ...{
                  duration,
                  tuplet,
                  dynamicPresent,
                  dynamic,
                  effects,
                  dotted,
                  notes,
                },
              };
              if (noteIds == null || noteIds.length === 0) {
                beatObj.duration += 'r';
                Song.measures[j][i][voiceIdScaled][beatId] = beatObj;
                beatId += 1;
              } else {
                const pianoArrangedNotes = [];
                const allNotes = [];
                for (let l = 0; l < noteIds.length; l += 1) {
                  if (noteIds[l] !== -1) {
                    const note: Note = { ...this.notes[noteIds[l]] };
                    if (graceObj != null && graceObj.notes[l] != null) {
                      note.gracePresent = true;
                      note.graceObj = {
                        fret: graceObj.notes[l].fret,
                        string: graceObj.notes[l].string,
                        height: graceObj.notes[l].height,
                        dynamic: 'f',
                        transition: 'none',
                        duration: graceObj.duration,
                        setOnBeat: graceObj.setOnBeat,
                        dead: false,
                      };
                    }
                    // transfer element to note
                    if (note.fret == null) {
                      // Elements
                      if (note.element != null) {
                        // console.log(note.element);
                        const elementToFret: {[a: number]: number} = {
                          0: 36, 1: 38, 6: 43, 7: 45, 8: 47, 10: 42, 12: 49,
                        };
                        // DRUMS
                        note.fret = 0;
                        if (elementToFret[note.element] != null) {
                          note.fret = elementToFret[note.element];
                        }
                        note.string = l;
                        beatObj.notes[note.string] = note;
                      } else if (note.tone != null) {
                        if (note.octave === 0) {
                          note.height = note.tone;
                        } else {
                          // note.height = 3+(note.octave-1)*12+note.tone;
                          note.height = (note.octave - 1) * 12 + note.tone;
                        }
                        pianoArrangedNotes.push(note);
                      }
                    } else {
                      beatObj.notes[note.string] = note;
                    }
                    allNotes[l] = note;
                  }
                }
                graceObj = null;
                if (this.beats[indexInBeats].gracePresent) {
                  let setOnBeat = 'after';
                  if (this.beats[indexInBeats].graceObj === 'BeforeBeat') {
                    setOnBeat = 'before';
                  }
                  graceObj = {
                    notes: allNotes,
                    duration: GpxReader.noteValueToDuration(rhythm.noteValue),
                    setOnBeat,
                  };
                } else {
                  Song.measures[j][i][voiceIdScaled][beatId] = beatObj;
                  if (pianoArrangedNotes.length > 0) {
                    const set: Set<number> = new Set();
                    GpxReader.arrangeAndSetNotesToGuitar(j, i, voiceIdScaled,
                      beatId, pianoArrangedNotes, set);
                  }
                  beatId += 1;
                }
              }
            }
          }
        }
      }
    }
    // Noe set second empty voice if not set already
    for (let i = 0; i < Song.measures.length; i += 1) {
      for (let j = 0; j < Song.measures[i].length; j += 1) {
        if (Song.measures[i][j].length === 1) {
          // add second empty voice
          Song.measures[i][j][1] = [];
          for (let p = 0; p < 8; p += 1) {
            Song.measures[i][j][1][p] = Song.defaultMeasure();
          }
        }
      }
    }
  }

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
    pianoArrangedNotes.sort(GpxReader.comparePianoHeight);
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
    const arrangedNotes = GpxReader.arrangeNotesToGuitar(trackId, pianoArrangedNotes, usedStrings);
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

const gpxReader = new GpxReader();
export { gpxReader, GpxReader };
