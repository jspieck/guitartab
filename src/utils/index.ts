/**
 * Utilities Index
 * 
 * Central export point for all utility modules in the guitar tab application.
 */

// Tab Layout utilities
export { 
  TAB_CONSTANTS, 
  getDurationInBeats, 
  getDisplayWidth,
  getMeasureXOffset, 
  getBeatXOffset, 
  findMeasureAtPosition, 
  findBeatAtPosition, 
  clickToTabPosition
} from './tabLayout'

// Duration utilities
export { 
  DURATION_BEATS, 
  BEAM_COUNTS, 
  REST_SYMBOLS,
  isRestDuration,
  getBaseDuration,
  getDurationBeats,
  getRestSymbol,
  getBeamCount,
  beatHasNotes,
  isRest,
  needsStem,
  getNoteStringPositions
} from './durationUtils'

// Music theory utilities
export {
  // Duration types and constants
  DURATION_TICKS,
  DURATION_WIDTH,
  DURATION_BEAMS,
  DURATION_NAMES,
  NAME_TO_CODE,
  // Duration functions
  getDurationTicks,
  getDurationWidth as getMusicDurationWidth,
  getDurationName,
  durationNameToCode,
  ticksToDurationCode,
  calculateDottedDuration,
  calculateTupletDuration,
  getTupletSubstitutedNotes,
  // Note/pitch constants
  NOTE_NAMES,
  STANDARD_GUITAR_TUNING,
  STANDARD_BASS_TUNING,
  // Note/pitch functions
  midiToNoteName,
  midiToOctave,
  midiToNoteString,
  noteToMidi,
  fretToMidi,
  midiToFrequency,
  frequencyToMidi,
  // Time signature helpers
  getBeatsPerMeasure,
  getTicksPerMeasure,
  formatTimeSignature,
  // Tempo helpers
  getBeatDuration,
  getTickDuration,
  secondsToPosition
} from './musicUtils'

// DOM utilities
export {
  removeAllChildren,
  removeElement,
  createSVGElement,
  createElement,
  $,
  $$,
  byId,
  setStyles,
  toggleVisibility,
  show,
  hide,
  addClasses,
  removeClasses,
  toggleClass,
  addListener,
  once,
  easeInOutQuad,
  smoothScrollTo,
  animationFrame,
  getBounds,
  isInViewport,
  getScrollPosition,
  getInputValue,
  setInputValue,
  isInputFocused
} from './domUtils'

// Typed event bus
export {
  typedEventBus,
  type AppEvents,
  type TabPosition,
  type PartialTabPosition,
  type EffectCollisionData,
  type SelectionChangeData
} from './typedEventBus'
