/**
 * Composables Index
 * 
 * Central export point for all Vue composables in the guitar tab application.
 */

// Song data management
export { useSongData } from './useSongData'

// Tab selection and navigation
export { useTabSelection } from './useTabSelection'
export type { TabSelection } from './useTabSelection'

// Duration handling
export { useDurationHandler } from './useDurationHandler'

// Playback control
export { usePlayback } from './usePlayback'
export type { PlaybackPosition, PlaybackState } from './usePlayback'

// Track management
export { useTrack } from './useTrack'
export type { Track, TrackColor, TrackInstrument } from './useTrack'
