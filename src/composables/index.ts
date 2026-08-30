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
export { useSelectionSurfaceState } from './useSelectionSurfaceState'

// Duration handling
export { useDurationHandler } from './useDurationHandler'

// Playback control
export { usePlaybackEngine } from './usePlaybackEngine'
export type { PlaybackPosition, PlaybackTransportState } from './usePlaybackEngine'
export { usePlayback } from './usePlayback'
export { usePlaybackBarState } from './usePlaybackBarState'
export type { PlaybackBarState } from './usePlaybackBarState'
export { useClassicalNotation } from './useClassicalNotation'

// Track management
export { useTrack } from './useTrack'
export type { TrackViewModel, TrackColor, TrackInstrument } from './useTrack'
