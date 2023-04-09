const instrumentGroups = [
  { title: 'Keyboards', choices: ['piano', 'brightPiano', 'electricGrand', 'epiano1', 'epiano2', 'harpsichord', 'clavinet'] },
  { title: 'Organs', choices: ['organ', 'percussiveOrgan', 'churchOrgan', 'rockOrgan', 'reedOrgan', 'accordion', 'harmonica', 'bandoneon'] },
  { title: 'Plucked Instruments', choices: ['bass', 'guitar', 'nylonGuitar', 'eguitar', 'overdriveguitar', 'disteguitar', 'mutedGuitar', 'banjo'] },
  { title: 'Drums', choices: ['drums'] },
  { title: 'Strings', choices: ['violin', 'viola', 'cello', 'contrabass', 'tremoloStrings', 'pizzicatoStrings', 'strings', 'harp'] },
  { title: 'Ensemble', choices: ['synthStrings1', 'synthStrings2', 'voicesAah', 'voicesOoh', 'synthlead', 'orchestraHit'] },
  { title: 'Brass', choices: ['trumpet', 'trombone', 'tuba', 'mutedTrumpet', 'frenchHorn', 'brassSection', 'synthBrass1', 'synthBrass2'] },
  { title: 'Woodwinds', choices: ['sopranoSax', 'altoSax', 'tenorSax', 'baritoneSax', 'oboe', 'englishHorn', 'bassoon', 'clarinet'] },
  { title: 'Pipe', choices: ['flute', 'piccolo', 'recorder', 'blownBottle', 'shakuhachi', 'whistle', 'ocarina'] },
  { title: 'Leads', choices: ['lead1', 'lead2', 'lead3', 'lead4', 'lead5', 'lead6', 'lead7', 'lead8'] },
  { title: 'Pads', choices: ['pad1', 'pad2', 'pad3', 'pad4', 'pad5', 'pad6', 'pad7', 'pad8'] },
  { title: 'Pitched Percussion', choices: ['celesta', 'musicbox', 'glockenspiel', 'vibraphone', 'marimba', 'xylophone', 'tubularBells', 'dulcimer'] },
  { title: 'Percussion', choices: ['tinkleBell', 'agogo', 'steelDrum', 'woodblock', 'taiko', 'melodicTom', 'synthDrum', 'reverseCymbal', 'timpani'] },
  { title: 'Ethnic', choices: ['sitar', 'banjo', 'shamisen', 'koto', 'kalimba', 'bagpipe', 'fiddle', 'shanai'] },
  { title: 'Synth FX', choices: ['fx1', 'fx2', 'fx3', 'fx4', 'fx5', 'fx6', 'fx7', 'fx8'] },
  { title: 'Sound FX', choices: ['guitarFretNoise', 'breathNoise', 'seashore', 'birdTweet', 'telephoneRing', 'helicopter', 'applause', 'gunshot'] },
];

// Icon-Path/Name/GeneralMidi/volume
const instrumentList: {[a: string]: [string, string, number, number]} = {
  piano: ['./src/assets/images/instrumentIcons/myPianoDesign.svg', 'Grand Piano', 0, 0.15], // 1.6
  brightPiano: ['./src/assets/images/instrumentIcons/myPianoDesign.svg', 'Bright Piano', 1, 0.3], // 1.6
  electricGrand: ['./src/assets/images/instrumentIcons/myPianoDesign.svg', 'Electric Grand Piano', 2, 0.15], // 1.6
  honkyTonk: ['./src/assets/images/instrumentIcons/myPianoDesign.svg', 'Honky Tonk Piano', 3, 0.1], // 1.6
  epiano1: ['./src/assets/images/instrumentIcons/myPianoDesign.svg', 'E-Piano 1', 4, 0.15], // 1.6
  epiano2: ['./src/assets/images/instrumentIcons/myPianoDesign.svg', 'E-Piano 2', 5, 0.3], // 1.6
  harpsichord: ['./src/assets/images/instrumentIcons/myHarpsichordDesign.svg', 'Harpsichord', 6, 0.4], // 1.6
  clavinet: ['./src/assets/images/instrumentIcons/myClavinetDesign.svg', 'Clavinet', 7, 0.4], // 1.6

  celesta: ['./src/assets/images/instrumentIcons/myCelestaDesign.svg', 'Celesta', 8, 1.0],
  glockenspiel: ['./src/assets/images/instrumentIcons/myGlockenspielDesign.svg', 'Glockenspiel', 9, 1.0],
  musicbox: ['./src/assets/images/instrumentIcons/myMusicBoxDesign.svg', 'Musicbox', 10, 1.0],
  vibraphone: ['./src/assets/images/instrumentIcons/myVibraphoneDesign.svg', 'Vibraphone', 11, 1.0],
  marimba: ['./src/assets/images/instrumentIcons/myMarimbaDesign.svg', 'Marimba', 12, 1.0],
  xylophone: ['./src/assets/images/instrumentIcons/myXylophoneDesign.svg', 'Xilophone', 13, 1.0],
  tubularBells: ['./src/assets/images/instrumentIcons/myTubularBellsDesign.svg', 'Tubular Bells', 14, 1.0],
  dulcimer: ['./src/assets/images/instrumentIcons/myDulcimerDesign.svg', 'Dulcimer', 15, 1.0],

  organ: ['./src/assets/images/instrumentIcons/myOrganDesign.svg', 'Drawbar Organ', 16, 0.7],
  percussiveOrgan: ['./src/assets/images/instrumentIcons/myOrganDesign.svg', 'Percussive Organ', 16, 0.7],
  rockOrgan: ['./src/assets/images/instrumentIcons/myOrganDesign.svg', 'Rock Organ', 18, 0.7],
  churchOrgan: ['./src/assets/images/instrumentIcons/myOrganDesign.svg', 'Church Organ', 19, 0.5],
  reedOrgan: ['./src/assets/images/instrumentIcons/myOrganDesign.svg', 'Reed Organ', 20, 0.5],
  accordion: ['./src/assets/images/instrumentIcons/myAccordionDesign.svg', 'Accordion', 21, 0.1],
  harmonica: ['./src/assets/images/instrumentIcons/myHarmonicaDesign.svg', 'Harmonica', 22, 0.5],
  bandoneon: ['./src/assets/images/instrumentIcons/myBandoneonDesign.svg', 'Bandoneon', 23, 0.5],

  guitar: ['./src/assets/images/instrumentIcons/myAccGuitarDesign.svg', 'Acoustic Guitar', 24, 0.6],
  nylonGuitar: ['./src/assets/images/instrumentIcons/myAccGuitarDesign.svg', 'Western Guitar', 25, 0.6],
  eguitar: ['./src/assets/images/instrumentIcons/myGuitarDesign.svg', 'E-Guitar', 26, 0.6],
  overdriveguitar: ['./src/assets/images/instrumentIcons/myGuitarDesign.svg', 'Overdrive E-Guitar', 29, 0.10],
  disteguitar: ['./src/assets/images/instrumentIcons/myGuitarDesign.svg', 'Distorted E-Guitar', 30, 0.10],
  mutedGuitar: ['./src/assets/images/instrumentIcons/myGuitarDesign.svg', 'Muted E-Guitar', 30, 0.4],
  bass: ['./src/assets/images/instrumentIcons/myBassDesign.svg', 'Bass', 33, 1.0],

  drums: ['./src/assets/images/instrumentIcons/myDrumsDesign.svg', 'Drums', 10, 1.0],

  violin: ['./src/assets/images/instrumentIcons/myViolinDesign.svg', 'Violin', 40, 0.5],
  viola: ['./src/assets/images/instrumentIcons/myViolinDesign.svg', 'Viola', 41, 0.5],
  cello: ['./src/assets/images/instrumentIcons/myViolinDesign.svg', 'Cello', 42, 0.5],
  contrabass: ['./src/assets/images/instrumentIcons/myViolinDesign.svg', 'Contrabass', 43, 0.6],
  tremoloStrings: ['./src/assets/images/instrumentIcons/myViolinDesign.svg', 'Tremolo Strings', 44, 0.6],
  pizzicatoStrings: ['./src/assets/images/instrumentIcons/myViolinDesign.svg', 'Pizzicato Strings', 45, 1.0],
  harp: ['./src/assets/images/instrumentIcons/myHarpDesign.svg', 'Harp', 46, 0.6],
  timpani: ['./src/assets/images/instrumentIcons/myTimpaniDesign.svg', 'Timpani', 47, 0.3],

  strings: ['./src/assets/images/instrumentIcons/myViolinDesign.svg', 'Strings', 48, 0.075],
  synthStrings1: ['./src/assets/images/instrumentIcons/myViolinDesign.svg', 'Synth Strings 1', 50, 0.4],
  synthStrings2: ['./src/assets/images/instrumentIcons/myViolinDesign.svg', 'Synth Strings 2', 51, 0.6],
  voicesAah: ['./src/assets/images/instrumentIcons/myVoiceDesign.svg', 'Voices Aah', 52, 1.5],
  voicesOoh: ['./src/assets/images/instrumentIcons/myVoiceDesign.svg', 'Voices Ooh', 53, 1.5],
  synthlead: ['./src/assets/images/instrumentIcons/myVoiceDesign.svg', 'Voice', 54, 0.4],
  orchestraHit: ['./src/assets/images/instrumentIcons/myViolinDesign.svg', 'Orchestra Hit', 55, 0.6],

  trumpet: ['./src/assets/images/instrumentIcons/myTrumpetDesign.svg', 'Trumpet', 56, 0.5],
  trombone: ['./src/assets/images/instrumentIcons/myTromboneDesign.svg', 'Trombone', 57, 0.5],
  tuba: ['./src/assets/images/instrumentIcons/myTubaDesign.svg', 'Tuba', 58, 0.5],
  mutedTrumpet: ['./src/assets/images/instrumentIcons/myTrumpetDesign.svg', 'Muted Trumpet', 59, 0.5],
  frenchHorn: ['./src/assets/images/instrumentIcons/myFrenchHornDesign.svg', 'French Horn', 60, 0.2],
  brassSection: ['./src/assets/images/instrumentIcons/myBrassDesign.svg', 'Brass Section', 61, 0.4],
  synthBrass1: ['./src/assets/images/instrumentIcons/myBrassDesign.svg', 'Synth Brass 1', 62, 0.3],
  synthBrass2: ['./src/assets/images/instrumentIcons/myBrassDesign.svg', 'Synth Brass 2', 63, 0.3],

  sopranoSax: ['./src/assets/images/instrumentIcons/mySaxDesign.svg', 'Soprano Saxophone', 64, 1.2],
  altoSax: ['./src/assets/images/instrumentIcons/mySaxDesign.svg', 'Alto Saxophone', 65, 0.5],
  tenorSax: ['./src/assets/images/instrumentIcons/mySaxDesign.svg', 'Tenor Saxophone', 66, 0.8],
  baritoneSax: ['./src/assets/images/instrumentIcons/mySaxDesign.svg', 'Baritone Saxophone', 67, 0.8],
  oboe: ['./src/assets/images/instrumentIcons/myOboeDesign.svg', 'Oboe', 68, 1.0],
  englishHorn: ['./src/assets/images/instrumentIcons/myOboeDesign.svg', 'English Horn', 69, 1.0],
  bassoon: ['./src/assets/images/instrumentIcons/myBassoonDesign.svg', 'Bassoon', 70, 1.4],
  clarinet: ['./src/assets/images/instrumentIcons/myClarinetDesign.svg', 'Clarinet', 71, 1.0],

  piccolo: ['./src/assets/images/instrumentIcons/myPiccoloDesign.svg', 'Piccolo', 72, 0.9],
  flute: ['./src/assets/images/instrumentIcons/myFluteDesign.svg', 'Flute', 73, 0.2],
  recorder: ['./src/assets/images/instrumentIcons/myFluteDesign.svg', 'Recorder', 74, 3.0],
  panFlute: ['./src/assets/images/instrumentIcons/myFluteDesign.svg', 'Pan Flute', 75, 0.4],
  blownBottle: ['./src/assets/images/instrumentIcons/myBottleDesign.svg', 'Blown Bottle', 76, 0.5],
  shakuhachi: ['./src/assets/images/instrumentIcons/myShakuhachiDesign.svg', 'Shakuhachi', 77, 0.3],
  whistle: ['./src/assets/images/instrumentIcons/myWhistleDesign.svg', 'Whistle', 78, 0.3],
  ocarina: ['./src/assets/images/instrumentIcons/myOcarinaDesign.svg', 'Ocarina', 79, 0.3],

  lead1: ['./src/assets/images/instrumentIcons/myLeadDesign.svg', 'Square Lead', 80, 0.7],
  lead2: ['./src/assets/images/instrumentIcons/myLeadDesign.svg', 'Saw Lead', 81, 0.7],
  lead3: ['./src/assets/images/instrumentIcons/myLeadDesign.svg', 'Calliope Lead', 82, 0.7],
  lead4: ['./src/assets/images/instrumentIcons/myLeadDesign.svg', 'Chiff Lead', 83, 0.7],
  lead5: ['./src/assets/images/instrumentIcons/myLeadDesign.svg', 'Charang Lead', 84, 0.7],
  lead6: ['./src/assets/images/instrumentIcons/myLeadDesign.svg', 'Voice Lead', 85, 0.7],
  lead7: ['./src/assets/images/instrumentIcons/myLeadDesign.svg', 'Fifths Lead', 86, 0.7],
  lead8: ['./src/assets/images/instrumentIcons/myLeadDesign.svg', 'Bass+Lead Lead', 87, 0.7],

  pad1: ['./src/assets/images/instrumentIcons/myPadDesign.svg', 'New Age Pad', 88, 1.0],
  pad2: ['./src/assets/images/instrumentIcons/myPadDesign.svg', 'Warm Pad', 89, 1.0],
  pad3: ['./src/assets/images/instrumentIcons/myPadDesign.svg', 'Polysynth Pad', 90, 1.0],
  pad4: ['./src/assets/images/instrumentIcons/myPadDesign.svg', 'Choir Pad', 91, 1.0],
  pad5: ['./src/assets/images/instrumentIcons/myPadDesign.svg', 'Bowed Pad', 92, 1.0],
  pad6: ['./src/assets/images/instrumentIcons/myPadDesign.svg', 'Metallic Pad', 93, 1.0],
  pad7: ['./src/assets/images/instrumentIcons/myPadDesign.svg', 'Halo Pad', 94, 1.0],
  pad8: ['./src/assets/images/instrumentIcons/myPadDesign.svg', 'Sweep Pad', 95, 1.0],

  fx1: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Rain FX', 96, 1.0],
  fx2: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Soundtrack FX', 97, 1.0],
  fx3: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Crystal FX', 98, 1.0],
  fx4: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Atmosphere FX', 99, 1.0],
  fx5: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Brightness FX', 100, 1.0],
  fx6: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Goblins FX', 101, 1.0],
  fx7: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Echoes FX', 102, 1.0],
  fx8: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Sci-Fi FX', 103, 1.0],

  sitar: ['./src/assets/images/instrumentIcons/mySitarDesign.svg', 'Sitar', 104, 0.5],
  banjo: ['./src/assets/images/instrumentIcons/myBanjoDesign.svg', 'Banjo', 105, 0.5],
  shamisen: ['./src/assets/images/instrumentIcons/myShamisenDesign.svg', 'Shamisen', 106, 0.5],
  koto: ['./src/assets/images/instrumentIcons/myKotoDesign.svg', 'Koto', 107, 0.5],
  kalimba: ['./src/assets/images/instrumentIcons/myKalimbaDesign.svg', 'Kalimba', 108, 0.5],
  bagpipe: ['./src/assets/images/instrumentIcons/myBagpipeDesign.svg', 'Bagpipe', 109, 0.5],
  fiddle: ['./src/assets/images/instrumentIcons/myViolinDesign.svg', 'Fiddle', 110, 0.5],
  shanai: ['./src/assets/images/instrumentIcons/myShanaiDesign.svg', 'Shanai', 111, 0.5],

  tinkleBell: ['./src/assets/images/instrumentIcons/myTinkleBellDesign.svg', 'Tinkle Bell', 112, 0.4],
  agogo: ['./src/assets/images/instrumentIcons/myAgogoDesign.svg', 'Agogo Bells', 113, 0.4],
  steelDrum: ['./src/assets/images/instrumentIcons/mySteelDrumDesign.svg', 'Steel Drum', 114, 0.4],
  woodblock: ['./src/assets/images/instrumentIcons/myWoodblockDesign.svg', 'Woodblock', 115, 0.4],
  taiko: ['./src/assets/images/instrumentIcons/myTaikoDesign.svg', 'Taiko Drum', 116, 0.4],
  melodicTom: ['./src/assets/images/instrumentIcons/myTomDesign.svg', 'Melodic Tom', 117, 0.4],
  synthDrum: ['./src/assets/images/instrumentIcons/mySynthDrumDesign.svg', 'Synth Drum', 118, 0.4],
  reverseCymbal: ['./src/assets/images/instrumentIcons/myWoodblockDesign.svg', 'Reverse Cymbal', 119, 0.4],

  guitarFretNoise: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Guitar Fret Noise', 120, 0.4],
  breathNoise: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Breath Noise', 121, 0.4],
  seashore: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Seashore', 122, 0.4],
  birdTweet: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Bird Tweet', 123, 0.4],
  telephoneRing: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Telephone Ring', 124, 0.4],
  helicopter: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Helicopter', 125, 0.4],
  applause: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Applause', 126, 0.4],
  gunshot: ['./src/assets/images/instrumentIcons/myFXDesign.svg', 'Gunshot', 127, 0.4],
};

const numToInstr = [
  'piano', 'brightPiano', 'electricGrand', 'honkyTonk', 'epiano1', 'epiano2', 'harpsichord', 'clavinet',
  'celesta', 'glockenspiel', 'musicbox', 'vibraphone', 'marimba', 'xylophone', 'tubularBells', 'dulcimer',
  'organ', 'percussiveOrgan', 'rockOrgan', 'churchOrgan', 'reedOrgan', 'accordion', 'harmonica', 'bandoneon',
  'guitar', 'nylonGuitar', 'eguitar', 'eguitar', 'eguitar', 'overdriveguitar', 'disteguitar', 'guitarHarmonics',
  'bass', 'bass', 'bass', 'bass', 'bass', 'bass', 'bass', 'bass',
  'violin', 'viola', 'cello', 'contrabass', 'tremoloStrings', 'pizzicatoStrings', 'harp', 'timpani',
  'violin', 'strings', 'synthStrings1', 'synthStrings2', 'voicesAah', 'voicesOoh', 'synthlead', 'orchestraHit',
  'trumpet', 'trombone', 'tuba', 'mutedTrumpet', 'frenchHorn', 'brassSection', 'synthBrass1', 'synthBrass2',
  'sopranoSax', 'altoSax', 'tenorSax', 'baritoneSax', 'oboe', 'englishHorn', 'bassoon', 'clarinet',
  'piccolo', 'flute', 'recorder', 'panFlute', 'blownBottle', 'shakuhachi', 'whistle', 'ocarina',
  'lead1', 'lead2', 'lead3', 'lead4', 'lead5', 'lead6', 'lead7', 'lead8',
  'pad1', 'pad2', 'pad3', 'pad4', 'pad5', 'pad6', 'pad7', 'pad8',
  'fx1', 'fx2', 'fx3', 'fx4', 'fx5', 'fx6', 'fx7', 'fx8',
  'sitar', 'banjo', 'shamisen', 'koto', 'kalimba', 'bagpipe', 'fiddle', 'shanai',
  'tinkleBell', 'agogo', 'steelDrum', 'woodblock', 'taiko', 'melodicTom', 'synthDrum', 'reverseCymbal',
  'guitarFretNoise', 'breathNoise', 'seashore', 'birdTweet', 'telephoneRing', 'helicopter', 'applause', 'gunshot',
];

const instrumentAudio = {
  metronome: [
    ['X', './audio/metronome/metronomeHigh.ogg'],
    ['X', './audio/metronome/metronomeLow.ogg'],
  ],
  /*
    "./audio/mguitar/MGuitarE3.mp3",
    "./audio/mguitar/MGuitarA3.mp3",
    "./audio/mguitar/MGuitarD4.mp3",
    "./audio/mguitar/MGuitarG4.mp3",
    "./audio/mguitar/MGuitarH4.mp3",
    "./audio/mguitar/MGuitarE5.mp3", */
  dead: [
    ['X', './audio/AccGuitar/dead1.ogg'],
    ['X', './audio/AccGuitar/dead2.ogg'],
  ],
  // By Ample Guitar
  guitar: [
    ['E3', './audio/AccGuitar/accguitarE3.ogg', 0.734, 0.855],
    ['A3', './audio/AccGuitar/accguitarA3.ogg', 1.051, 1.160],
    ['D4', './audio/AccGuitar/accguitarD4.ogg', 1.495, 1.665],
    ['G4', './audio/AccGuitar/accguitarG4.ogg', 1.308, 1.409],
    ['H4', './audio/AccGuitar/accguitarH4.ogg'],
    ['E5', './audio/AccGuitar/accguitarE5.ogg'],
  ],
  nylonGuitar: [
    ['E3', './audio/AccGuitar/martinE3.ogg'],
    ['A3', './audio/AccGuitar/martinA3.ogg'],
    ['D4', './audio/AccGuitar/martinD4.ogg'],
    ['G4', './audio/AccGuitar/martinG4.ogg'],
    ['H4', './audio/AccGuitar/martinH4.ogg'],
    ['E5', './audio/AccGuitar/martinE5.ogg'],
  ],
  slap: [
    ['', './audio/Slap.ogg'],
  ],
  /* "disteguitar":[
        ["E3", "./audio/ampGuit/fender3E3.ogg"],
        ["A3", "./audio/ampGuit/fender3A3.ogg"],
        ["D4", "./audio/ampGuit/fender3D4.ogg"],
        ["G4", "./audio/ampGuit/fender3G4.ogg"],
        ["H4", "./audio/ampGuit/fender3H4.ogg"],
        ["E5", "./audio/ampGuit/fender3E5.ogg"],
    ], */
  disteguitar: [
    ['E3', './audio/eGuit/ampdistE3.ogg'],
    ['A3', './audio/eGuit/ampdistA3.ogg'],
    ['D4', './audio/eGuit/ampdistD4.ogg'],
    ['G4', './audio/eGuit/ampdistG4.ogg'],
    ['H4', './audio/eGuit/ampdistH4.ogg'],
    ['E5', './audio/eGuit/ampdistE5.ogg'],
  ],
  /* "overdriveguitar":[
        ["E3", "./audio/voice/adistE3.ogg"],
        ["A3", "./audio/voice/adistA3.ogg"],
        ["D4", "./audio/voice/adistD4.ogg"],
        ["G4", "./audio/voice/adistG4.ogg"],
        ["H4", "./audio/voice/adistH4.ogg"],
        ["E5", "./audio/voice/adistE5.ogg"],
    ], */
  overdriveguitar: [
    ['E3', './audio/ampGuit/solE3.ogg'],
    ['A3', './audio/ampGuit/solA3.ogg'],
    ['D4', './audio/ampGuit/solD4.ogg'],
    ['G4', './audio/ampGuit/solG4.ogg'],
    ['H4', './audio/ampGuit/solH4.ogg'],
    ['E5', './audio/ampGuit/solE5.ogg'],
  ],
  mutedGuitar: [
    ['E3', './audio/ampGuit/fenderMutedE3.ogg'],
    ['A3', './audio/ampGuit/fenderMutedA3.ogg'],
    ['D4', './audio/ampGuit/fenderMutedD4.ogg'],
    ['G4', './audio/ampGuit/fenderMutedG4.ogg'],
    ['H4', './audio/ampGuit/fenderMutedH4.ogg'],
    ['E5', './audio/ampGuit/fenderMutedE5.ogg'],
  ],
  naturalHarmonic: [
    ['E4', './audio/ampGuit/naturalHarmonicE4.ogg'],
    ['E6', './audio/ampGuit/naturalHarmonicE6.ogg'],
  ],
  /* "./audio/PianoC3Mid.mp3",
    "./audio/PianoC4Mid.mp3",
    "./audio/PianoC5Mid.mp3",
    "./audio/PianoC6Mid.mp3",
    //By Sonatina
    "piano": [
        ["C3","./audio/piano/pianoC3.ogg"],
        ["C4","./audio/piano/pianoC4.ogg"],
        ["C5","./audio/piano/pianoC5.ogg"],
        ["C6","./audio/piano/pianoC6.ogg"],
    ], */
  // ACCordion https://freesound.org/people/hammondman/packs/18842/
  accordion: [
    ['C4', './audio/accordion/accordionC4.ogg'],
    ['C6', './audio/accordion/accordionC6.ogg'],
    ['C7', './audio/accordion/accordionC7.ogg'],
  ],
  // IOWA SAX
  sopranoSax: [
    ['G4', './audio/saxophone/sopranoSaxG4.ogg'],
    ['C5', './audio/saxophone/sopranoSaxC5.ogg'],
    ['C6', './audio/saxophone/sopranoSaxC6.ogg'],
  ],
  // club tenor sax from bigcat
  tenorSax: [
    ['C4', './audio/saxophone/tenorSaxC4.ogg'],
    ['C5', './audio/saxophone/tenorSaxC5.ogg'],
    ['C6', './audio/saxophone/tenorSaxC6.ogg'],
  ],
  baritoneSax: [
    ['C3', './audio/saxophone/baritoneSaxC3.ogg'],
    ['C4', './audio/saxophone/baritoneSaxC4.ogg'],
    ['C5', './audio/saxophone/baritoneSaxC5.ogg'],
    ['C6', './audio/saxophone/baritoneSaxC6.ogg'],
  ],
  // MLSP bigcat
  recorder: [
    ['G5', './audio/recorder/recorderG5.ogg'],
    ['G6', './audio/recorder/recorderG6.ogg'],
  ],
  // MK bigcat
  panFlute: [
    ['C4', './audio/flute/panFluteC4.ogg'],
    ['C5', './audio/flute/panFluteC5.ogg'],
    ['C6', './audio/flute/panFluteC6.ogg'],
  ],
  blownBottle: [
    ['C4', './audio/flute/bottleBlowC4.ogg'],
    ['C5', './audio/flute/bottleBlowC5.ogg'],
    ['C6', './audio/flute/bottleBlowC6.ogg'],
  ],
  whistle: [
    ['C7', './audio/flute/whistleC7.ogg'],
  ],
  ocarina: [
    ['C4', './audio/flute/ocarinaC4.ogg'],
    ['C5', './audio/flute/ocarinaC5.ogg'],
    ['C6', './audio/flute/ocarinaC6.ogg'],
    ['C7', './audio/flute/ocarinaC7.ogg'],
  ],
  synthBrass1: [
    ['C3', './audio/brass/synthBrass1C3.ogg'],
    ['C5', './audio/brass/synthBrass1C5.ogg'],
  ],
  synthBrass2: [
    ['C3', './audio/brass/synthBrass2C3.ogg'],
    ['C5', './audio/brass/synthBrass2C5.ogg'],
  ],
  mutedTrumpet: [
    ['C4', './audio/trumpet/mutedTrumpetC4.ogg'],
    ['C5', './audio/trumpet/mutedTrumpetC5.ogg'],
    ['C6', './audio/trumpet/mutedTrumpetC6.ogg'],
  ],
  brassSection: [
    ['C3', './audio/brass/brassSectionC3.ogg'],
    ['C4', './audio/brass/brassSectionC4.ogg'],
    ['C5', './audio/brass/brassSectionC5.ogg'],
    ['C6', './audio/brass/brassSectionC6.ogg'],
  ],
  orchestraHit: [
    ['C5', './audio/strings/orchestraHitC5.ogg'],
  ],
  guitarFretNoise: [
    ['C5', './audio/fx/fretNoiseC5.ogg'],
  ],
  breathNoise: [
    ['C6', './audio/fx/breathingNoiseC6.ogg'],
  ],
  seashore: [
    ['C5', './audio/fx/seaShoreC5.ogg'],
  ],
  birdTweet: [
    ['C5', './audio/fx/birdTweetC5.ogg'],
  ],
  telephoneRing: [
    ['C5', './audio/fx/telephoneRingC5.ogg'],
  ],
  helicopter: [
    ['C5', './audio/fx/helicopterC5.ogg'],
  ],
  applause: [
    ['C5', './audio/fx/applauseC5.ogg'],
  ],
  gunshot: [
    ['C5', './audio/fx/gunShotC5.ogg'],
  ],
  tinkleBell: [
    ['C5', './audio/percussion/tinkleBellC5.ogg'],
  ],
  steelDrum: [
    ['C5', './audio/percussion/steelDrum.ogg'],
  ],
  taiko: [
    ['X', './audio/percussion/taikoDrum.ogg'],
  ],
  melodicTom: [
    ['C5', './audio/percussion/melodicTomC5.ogg'],
  ],
  synthDrum: [
    ['C5', './audio/percussion/synthDrumC5.ogg'],
  ],
  reverseCymbal: [
    ['X', './audio/percussion/reverseCymbal.ogg'],
  ],
  sitar: [
    ['C4', './audio/ethnic/sitarC4.ogg'],
    ['C5', './audio/ethnic/sitarC5.ogg'],
  ],
  shamisen: [
    ['C4', './audio/ethnic/shamisenC4.ogg'],
    ['C5', './audio/ethnic/shamisenC5.ogg'],
  ],
  koto: [
    ['C4', './audio/ethnic/kotoC4.ogg'],
    ['C5', './audio/ethnic/kotoC5.ogg'],
  ],
  kalimba: [
    ['C4', './audio/ethnic/kalimbaC4.ogg'],
    ['C5', './audio/ethnic/kalimbaC5.ogg'],
  ],
  bagpipe: [
    ['C4', './audio/ethnic/bagpipeC4.ogg'],
    ['C5', './audio/ethnic/bagpipeC5.ogg'],
  ],
  fiddle: [
    ['C4', './audio/ethnic/fiddleC4.ogg'],
    ['C5', './audio/ethnic/fiddleC5.ogg'],
  ],
  shanai: [
    ['C4', './audio/ethnic/shanaiC4.ogg'],
    ['C5', './audio/ethnic/shanaiC5.ogg'],
  ],
  tremoloStrings: [ // Orchestral Companion
    ['C4', './audio/strings/tremoloStringsC4.ogg'],
    ['C5', './audio/strings/tremoloStringsC5.ogg'],
    ['C6', './audio/strings/tremoloStringsC6.ogg'],
    ['C7', './audio/strings/tremoloStringsC7.ogg'],
  ],
  pizzicatoStrings: [
    ['C4', './audio/strings/pizzicatoStringsC4.ogg'],
    ['C5', './audio/strings/pizzicatoStringsC5.ogg'],
    ['C6', './audio/strings/pizzicatoStringsC6.ogg'],
  ],
  synthStrings1: [
    ['C5', './audio/strings/synthStrings1C5.ogg'],
  ],
  synthStrings2: [
    ['C5', './audio/strings/synthStrings22C5.ogg'],
  ],
  voicesAah: [ // KONTAKT
    ['D4', './audio/voice/voiceAahD4.ogg'],
    ['C5', './audio/voice/voiceAahC5.ogg'],
  ],
  voicesOoh: [
    ['C6', './audio/voice/voiceOohC6.ogg'],
  ],
  // DON
  piano: [
    ['C3', './audio/don/pianoC3.ogg'],
    ['C4', './audio/don/pianoC4.ogg'],
    ['C5', './audio/don/pianoC5.ogg'],
    ['C6', './audio/don/pianoC6.ogg'],
    ['C7', './audio/don/pianoC6.ogg'],
  ],
  brightPiano: [
    ['C3', './audio/don/brightPianoC3.ogg'],
    ['C4', './audio/don/brightPianoC4.ogg'],
    ['C5', './audio/don/brightPianoC5.ogg'],
    ['C6', './audio/don/brightPianoC6.ogg'],
  ],
  electricGrand: [
    ['C3', './audio/don/electricGrandC3.ogg'],
    ['C4', './audio/don/electricGrandC4.ogg'],
    ['C5', './audio/don/electricGrandC5.ogg'],
    ['C6', './audio/don/electricGrandC6.ogg'],
  ],
  honkyTonk: [
    ['C3', './audio/don/honkyTonkC3.ogg'],
    ['C4', './audio/don/honkyTonkC4.ogg'],
    ['C5', './audio/don/honkyTonkC5.ogg'],
    ['C6', './audio/don/honkyTonkC6.ogg'],
  ],
  epiano1: [
    ['C3', './audio/don/epiano1C3.ogg'],
    ['C4', './audio/don/epiano1C4.ogg'],
    ['C5', './audio/don/epiano1C5.ogg'],
    ['C6', './audio/don/epiano1C6.ogg'],
  ],
  epiano2: [
    ['C3', './audio/don/epiano2C3.ogg'],
    ['C4', './audio/don/epiano2C4.ogg'],
    ['C5', './audio/don/epiano2C5.ogg'],
    ['C6', './audio/don/epiano2C6.ogg'],
  ],
  harpsichord: [
    ['C3', './audio/don/harpsichordC3.ogg'],
    ['C4', './audio/don/harpsichordC4.ogg'],
    ['C5', './audio/don/harpsichordC5.ogg'],
    ['C6', './audio/don/harpsichordC6.ogg'],
  ],
  clavinet: [
    ['C3', './audio/don/clavinetC3.ogg'],
    ['C4', './audio/don/clavinetC4.ogg'],
    ['C5', './audio/don/clavinetC5.ogg'],
    ['C6', './audio/don/clavinetC6.ogg'],
  ],
  shakuhachi: [
    ['C5', './audio/don/shakuhachiC5.ogg'],
  ],
  marimba: [
    ['C5', './audio/don/marimbaC5.ogg'],
  ],
  tubularBells: [
    ['C5', './audio/don/tubularBellsC5.ogg'],
  ],
  dulcimer: [
    ['C5', './audio/don/dulcimerC5.ogg'],
  ],
  musicbox: [
    ['C5', './audio/don/musicboxC5.ogg'],
  ],
  celesta: [
    ['C5', './audio/don/celestaC5.ogg'],
  ],
  harmonica: [
    ['C3', './audio/harmonica/harmonicaC3.ogg'],
    ['C4', './audio/harmonica/harmonicaC4.ogg'],
    ['C5', './audio/harmonica/harmonicaC5.ogg'],
  ],
  bandoneon: [
    ['C3', './audio/don/bandoneonC3.ogg'],
    ['C4', './audio/don/bandoneonC4.ogg'],
    ['C5', './audio/don/bandoneonC5.ogg'],
    ['C6', './audio/don/bandoneonC6.ogg'],
  ],
  // By Sonatina
  piccolo: [
    ['C5', './audio/piccolo/piccoloC5.ogg'],
    ['C6', './audio/piccolo/piccoloC6.ogg'],
    ['C7', './audio/piccolo/piccoloC7.ogg'],
  ],
  // By Ample Bass
  bass: [
    ['E2', './audio/bass/bassE2.ogg'],
    ['A2', './audio/bass/bassA2.ogg'],
    ['D3', './audio/bass/bassD3.ogg'],
    ['G3', './audio/bass/bassG3.ogg'],
    ['H3', './audio/bass/bassH3.ogg'],
  ],
  // Layered by me
  //
  drums: [
    ['', './audio/drums/Kick_2.ogg'],
    ['', './audio/drums/HiHat_2.ogg'],
    ['', './audio/drums/Snare_2.ogg'],
    ['', './audio/drums/HiHatOpen.ogg'],
    ['', './audio/drums/Crash.ogg'],
    ['', './audio/drums/stick.ogg'], // Session Drums
    ['', './audio/drums/cabasa.ogg'], // Don
    ['', './audio/drums/clap.ogg'], // Session Drums
    ['', './audio/drums/tambourine.ogg'], // Session Drums
    ['', './audio/drums/ride.ogg'], // Session Drums
    ['', './audio/drums/tom1.ogg'],
    ['', './audio/drums/tom2.ogg'],
    ['', './audio/drums/tom3.ogg'],
    ['', './audio/drums/tom4.ogg'],
    ['', './audio/drums/chineseCymbal.ogg'], // https://freesound.org/people/soundjoao/sounds/330132/
    ['', './audio/drums/rideBell.ogg'], // TimbresOfHeaven
    ['', './audio/drums/splashCymbal.ogg'], // TimbresOfHeaven
    ['', './audio/drums/cowbell.ogg'], // TimbresOfHeaven
    ['', './audio/drums/vibraSlap.ogg'], // TimbresOfHeaven
    ['', './audio/drums/bongo.ogg'], // TimbresOfHeaven
    ['', './audio/drums/conga.ogg'], // TimbresOfHeaven
    ['', './audio/drums/timbale.ogg'], // TimbresOfHeaven
    ['', './audio/drums/agogo.ogg'], // TimbresOfHeaven
    ['', './audio/drums/maracas.ogg'], // TimbresOfHeaven
    ['', './audio/drums/whistle.ogg'], // TimbresOfHeaven
    ['', './audio/drums/guiro.ogg'], // TimbresOfHeaven
    ['', './audio/drums/claves.ogg'], // TimbresOfHeaven
    ['', './audio/drums/woodBlock.ogg'], // TimbresOfHeaven
    ['', './audio/drums/cuica.ogg'], // TimbresOfHeaven
    ['', './audio/drums/triangle.ogg'], // TimbresOfHeaven
  ],
  // By Kontakt
  eguitar: [
    ['E3', './audio/eGuit/eguitarE3.ogg'],
    ['A3', './audio/eGuit/eguitarA3.ogg'],
    ['D4', './audio/eGuit/eguitarD4.ogg'],
    ['G4', './audio/eGuit/eguitarG4.ogg'],
    ['H4', './audio/eGuit/eguitarH4.ogg'],
    ['E5', './audio/eGuit/eguitarE5.ogg'],
  ],
  /* "./audio/eGuit/dist/eguitardistE3.ogg",
    "./audio/eGuit/dist/eguitardistA3.ogg",
    "./audio/eGuit/dist/eguitardistD4.ogg",
    "./audio/eGuit/dist/eguitardistG4.ogg",
    "./audio/eGuit/dist/eguitardistH4.ogg",
    "./audio/eGuit/dist/eguitardistE5.ogg", */

  /* By Kontakt
    "organ": [
        ["C3","./audio/organ/OrganC3.mp3"],
        ["C4","./audio/organ/OrganC4.mp3"],
        ["C5","./audio/organ/OrganC5.mp3"],
        ["C6","./audio/organ/OrganC6.mp3"],
    ], */
  // Leeds Organ
  organ: [
    ['C3', './audio/organ/organC3.ogg'],
    ['C4', './audio/organ/organC4.ogg'],
    ['C5', './audio/organ/organC5.ogg'],
    ['C6', './audio/organ/organC6.ogg'],
    ['C7', './audio/organ/organC7.ogg'],
  ],
  percussiveOrgan: [
    ['C3', './audio/organ/percussiveOrganC3.ogg'],
    ['C4', './audio/organ/percussiveOrganC4.ogg'],
    ['C5', './audio/organ/percussiveOrganC5.ogg'],
    ['C6', './audio/organ/percussiveOrganC6.ogg'],
    ['C7', './audio/organ/percussiveOrganC7.ogg'],
  ],
  churchOrgan: [
    ['C3', './audio/organ/churchOrganC3.ogg'],
    ['C4', './audio/organ/churchOrganC4.ogg'],
    ['C5', './audio/organ/churchOrganC5.ogg'],
    ['C6', './audio/organ/churchOrganC6.ogg'],
    ['C7', './audio/organ/churchOrganC7.ogg'],
  ],
  rockOrgan: [
    /* ["C3","./audio/organ/rockOrganC3.ogg"],
        ["C4","./audio/organ/rockOrganC4.ogg"],
        ["C5","./audio/organ/rockOrganC5.ogg"],
        ["C6","./audio/organ/rockOrganC6.ogg"],
        ["C7","./audio/organ/rockOrganC7.ogg"], */
    ['C4', './audio/organ/rockKontaktC4.ogg'],
    ['C5', './audio/organ/rockKontaktC5.ogg'],
    ['C6', './audio/organ/rockKontaktC6.ogg'],
  ],
  reedOrgan: [
    ['C3', './audio/organ/reedOrganC3.ogg'],
    ['C4', './audio/organ/reedOrganC4.ogg'],
    ['C5', './audio/organ/reedOrganC5.ogg'],
    ['C6', './audio/organ/reedOrganC6.ogg'],
    ['C7', './audio/organ/reedOrganC7.ogg'],
  ],
  // By Sonatina
  strings: [
    ['G4', './audio/violin/violin-g4.ogg'],
    ['A#4', './audio/violin/violin-ais4.ogg'],
    ['A#5', './audio/violin/violin-ais5.ogg'],
    ['A#6', './audio/violin/violin-ais6.ogg'],
  ],
  /* sonatina
    "violin": [
        ["G4","./audio/soloStrings/violinC5.ogg"],
        ["A#4","./audio/soloStrings/violinC6.ogg"],
        ["A#5","./audio/soloStrings/violinC7.ogg"]
    ],
    //ldk1609
    "violin": [
        ["C4","./audio/violin/violin2C4.ogg"],
        ["C5","./audio/violin/violin2C5.ogg"],
        ["C6","./audio/violin/violin2C6.ogg"],
        ["C7","./audio/violin/violin2C7.ogg"]
    ], */
  // Orchestral Strings Companion Sonnivox
  violin: [
    ['C4', './audio/soloStrings/stringsC4.ogg'],
    ['C5', './audio/soloStrings/stringsC5.ogg'],
    ['C6', './audio/soloStrings/stringsC6.ogg'],
    ['C7', './audio/soloStrings/stringsC7.ogg'],
  ],
  // VSCO
  /* "viola": [
        ["C4","./audio/violin/violaC4.ogg"],
        ["C5","./audio/violin/violaC5.ogg"],
        ["C6","./audio/violin/violaC6.ogg"],
        ["C7","./audio/violin/violaC7.ogg"]
    ], */
  viola: [
    ['C4', './audio/soloStrings/stringsC4.ogg'],
    ['C5', './audio/soloStrings/stringsC5.ogg'],
    ['C6', './audio/soloStrings/stringsC6.ogg'],
    ['C7', './audio/soloStrings/stringsC7.ogg'],
  ],
  // VSCO
  cello: [
    ['C3', './audio/violin/cello2C3.ogg'],
    ['C4', './audio/violin/cello2C4.ogg'],
    ['C5', './audio/violin/cello2C5.ogg'],
    ['C6', './audio/violin/cello2C6.ogg'],
  ],
  contrabass: [
    ['C3', './audio/violin/contrabassC3.ogg'],
    ['C4', './audio/violin/contrabassC4.ogg'],
    ['C5', './audio/violin/contrabassC5.ogg'],
  ],
  /* By Philarmonik
    "./audio/strings/StringsC3.ogg",
    "./audio/strings/StringsC4.ogg",
    "./audio/strings/StringsC5.ogg",
    "./audio/strings/StringsC6.ogg", */
  // By Ample Guitar
  palmMute: [
    ['E3', './audio/guitarPM/palmMuteE3.ogg'],
    ['A3', './audio/guitarPM/palmMuteA3.ogg'],
    ['D4', './audio/guitarPM/palmMuteD4.ogg'],
    ['G4', './audio/guitarPM/palmMuteG4.ogg'],
    ['H4', './audio/guitarPM/palmMuteH4.ogg'],
    ['E5', './audio/guitarPM/palmMuteE5.ogg'],
  ],
  // By Sonatina
  altoSax: [
    ['C3', './audio/saxophone/altoSaxC3.ogg'],
    ['C4', './audio/saxophone/altoSaxC4.ogg'],
    ['C5', './audio/saxophone/altoSaxC5.ogg'],
    ['C6', './audio/saxophone/altoSaxC6.ogg'],
  ],
  // By Sonatina
  clarinet: [
    ['C3', './audio/clarinet/clarinetD4.ogg'],
    ['C4', './audio/clarinet/clarinetC5.ogg'],
    ['C5', './audio/clarinet/clarinetC6.ogg'],
    ['C6', './audio/clarinet/clarinetC7.ogg'],
  ],
  // By Philarmonik
  bassoon: [
    ['C3', './audio/bassoon/bassoonC3.ogg'],
    ['C4', './audio/bassoon/bassoonC4.ogg'],
    ['C5', './audio/bassoon/bassoonC5.ogg'],
    ['C6', './audio/bassoon/bassoonC6.ogg'],
  ],
  // By Sonatina
  flute: [
    ['C4', './audio/flute/flute-c3.ogg'],
    ['C5', './audio/flute/flute-c4.ogg'],
    ['C6', './audio/flute/flute-c5.ogg'],
  ],
  // By Philarmonik
  oboe: [
    ['C5', './audio/OneSamples/oboe.ogg'],
  ],
  // By Philarmonia
  tuba: [
    ['A2', './audio/tuba/tubaA1.ogg'],
    ['A3', './audio/tuba/tubaA2.ogg'],
    ['A4', './audio/tuba/tubaA3.ogg'],
    ['C#4', './audio/tuba/tubaCis4.ogg'],
  ],
  trumpet: [
    ['A3', './audio/trumpet/trumpetA3.ogg'],
    ['A4', './audio/trumpet/trumpetA4.ogg'],
    ['A5', './audio/trumpet/trumpetA5.ogg'],
    ['C6', './audio/trumpet/trumpetC6.ogg'],
  ],
  trombone: [
    ['A3', './audio/trombone/tromboneA2.ogg'],
    ['A4', './audio/trombone/tromboneA3.ogg'],
    ['A5', './audio/trombone/tromboneA4.ogg'],
    ['A6', './audio/trombone/tromboneA5.ogg'],
    ['E6', './audio/trombone/tromboneE6.ogg'],
  ],
  frenchHorn: [
    ['D2', './audio/frenchHorn/frenchHornD2.ogg'],
    ['C3', './audio/frenchHorn/frenchHornC3.ogg'],
    ['C4', './audio/frenchHorn/frenchHornC4.ogg'],
    ['C5', './audio/frenchHorn/frenchHornC5.ogg'],
  ],
  englishHorn: [
    ['F3', './audio/englishHorn/englishHornF3.ogg'],
    ['C4', './audio/englishHorn/englishHornC4.ogg'],
    ['C5', './audio/englishHorn/englishHornC5.ogg'],
    ['A5', './audio/englishHorn/englishHornA5.ogg'],
  ],
  xylophone: [ // By sonatina
    ['C4', './audio/xylophone/xylophoneC4.ogg'],
    ['C5', './audio/xylophone/xylophoneC5.ogg'],
    ['C6', './audio/xylophone/xylophoneC6.ogg'],
  ],
  harp: [ // By sonatina
    ['C4', './audio/harp/harpC4.ogg'],
    ['C5', './audio/harp/harpC5.ogg'],
    ['C6', './audio/harp/harpC6.ogg'],
    ['C7', './audio/harp/harpC7.ogg'],
  ],
  glockenspiel: [ // By sonatina
    ['C4', './audio/glockenspiel/glockenspielC4.ogg'],
    ['C5', './audio/glockenspiel/glockenspielC5.ogg'],
  ],
  banjo: [
    ['C3', './audio/banjo/banjoC3.ogg'],
    ['C4', './audio/banjo/banjoC4.ogg'],
    ['C5', './audio/banjo/banjoC5.ogg'],
    ['C6', './audio/banjo/banjoC6.ogg'],
  ],
  // By Kontakt
  vibraphone: [
    ['C5', './audio/OneSamples/vibraphone.ogg'],
  ],
  agogo: [
    ['X', './audio/percussion/agogoBell.ogg'],
  ],
  woodblock: [
    ['X', './audio/percussion/woodblock.ogg'],
  ],
  // By XPAND
  synthlead: [
    ['C5', './audio/OneSamples/SynChoir.ogg'],
  ],
  // By Fl Studio
  convolution: [
    ['', './audio/convolution.ogg'],
  ],
  // By me
  lead1: [
    ['C5', './audio/leads/squareLead.ogg'],
  ],
  lead2: [
    ['C5', './audio/leads/sawLead.ogg'],
  ],
  // by GM
  lead3: [
    ['C5', './audio/leads/calliopeGM.ogg'],
  ],
  lead4: [
    ['C5', './audio/leads/chiffGM.ogg'],
  ],
  lead5: [
    ['C5', './audio/leads/charangGM.ogg'],
  ],
  lead6: [
    ['C5', './audio/leads/voiceGM.ogg'],
  ],
  lead7: [
    ['C5', './audio/leads/fifthsGM.ogg'],
  ],
  lead8: [
    ['C5', './audio/leads/bassLeadGM.ogg'],
  ],
  // By GM
  pad1: [
    ['C5', './audio/leads/padNewAgeGM.ogg'],
  ],
  pad2: [
    ['C5', './audio/leads/padWarmGM.ogg'],
  ],
  pad3: [
    ['C5', './audio/leads/padPolysynthGM.ogg'],
  ],
  pad4: [
    ['C5', './audio/leads/padChoirGM.ogg'],
  ],
  pad5: [
    ['C5', './audio/leads/padBowedGM.ogg'],
  ],
  pad6: [
    ['C5', './audio/leads/padMetallicGM.ogg'],
  ],
  pad7: [
    ['C5', './audio/leads/padHaloGM.ogg'],
  ],
  pad8: [
    ['C5', './audio/leads/padSweepGM.ogg'],
  ],
  fx1: [
    ['C5', './audio/fx/rainFX.ogg'],
  ],
  fx2: [
    ['C5', './audio/fx/soundtrackFX.ogg'],
  ],
  fx3: [
    ['C5', './audio/fx/crystalFX.ogg'],
  ],
  fx4: [
    ['C5', './audio/fx/atmosphereFX.ogg'],
  ],
  fx5: [
    ['C5', './audio/fx/brightnessFX.ogg'],
  ],
  fx6: [
    ['C5', './audio/fx/goblinsFX.ogg'],
  ],
  fx7: [
    ['C5', './audio/fx/echoesFX.ogg'],
  ],
  fx8: [
    ['C5', './audio/fx/scifiFX.ogg'],
  ],
};

export {
  instrumentGroups,
  instrumentList,
  numToInstr,
  instrumentAudio,
};
