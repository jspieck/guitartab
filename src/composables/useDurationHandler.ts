import { tab } from '../assets/js/tab'

/**
 * Duration values in beats
 */
const DURATION_IN_BEATS: Record<string, number> = {
  'w': 4, 'wr': 4, 'whole': 4,
  'h': 2, 'hr': 2, 'half': 2,
  'q': 1, 'qr': 1, 'quarter': 1,
  'e': 0.5, 'er': 0.5, 'eighth': 0.5,
  's': 0.25, 'sr': 0.25, 'sixteenth': 0.25,
  't': 0.125, 'tr': 0.125, 'thirty-second': 0.125
}

/**
 * Duration name mapping (long names to short codes)
 */
const DURATION_TO_CODE: Record<string, string> = {
  'whole': 'w',
  'half': 'h',
  'quarter': 'q',
  'eighth': 'e',
  'sixteenth': 's',
  'thirty-second': 't'
}

/**
 * Composable for handling note duration changes
 */
export function useDurationHandler(syncSongData: () => void) {
  /**
   * Get duration value in beats
   */
  function getDurationInBeats(duration: string): number {
    return DURATION_IN_BEATS[duration] || 1
  }
  
  /**
   * Convert duration name to short code
   */
  function durationToCode(duration: string): string {
    return DURATION_TO_CODE[duration] || 'q'
  }
  
  /**
   * Change the duration of a beat
   * @returns true if successful, false otherwise
   */
  function changeDuration(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatIndex: number,
    stringIndex: number,
    duration: string
  ): boolean {
    const shortDuration = durationToCode(duration)
    
    // Use the Tab class to handle complex duration change logic
    const success = tab.changeNoteDuration(
      trackId,
      blockId,
      voiceId,
      beatIndex,
      stringIndex,
      shortDuration,
      false // not during revert
    )
    
    if (success) {
      // Sync and notify
      syncSongData()
      
      // Dispatch event
      const event = new CustomEvent('songDataChanged', {
        detail: { trackId, blockId, voiceId, beatIndex, duration }
      })
      window.dispatchEvent(event)
      
      return true
    }
    
    return false
  }
  
  /**
   * Calculate the X offset for a beat within a measure
   */
  function calculateBeatXOffset(measureData: any[], beatIndex: number, beatWidth: number, contentPadding: number = 0): number {
    let beats = 0
    for (let i = 0; i < beatIndex; i++) {
      const beat = measureData[i]
      beats += getDurationInBeats(beat?.duration || 'q')
    }
    return contentPadding + (beats * beatWidth)
  }
  
  /**
   * Find which beat index corresponds to an X position
   */
  function findBeatAtPosition(measureData: any[], xPosition: number, beatWidth: number): number {
    let currentX = 0
    
    for (let i = 0; i < measureData.length; i++) {
      const beat = measureData[i]
      const duration = getDurationInBeats(beat?.duration || 'q')
      const width = duration * beatWidth
      
      if (xPosition >= currentX && xPosition < currentX + width) {
        return i
      }
      
      currentX += width
    }
    
    // Default to last beat if position is past the end
    return Math.max(0, measureData.length - 1)
  }
  
  return {
    getDurationInBeats,
    durationToCode,
    changeDuration,
    calculateBeatXOffset,
    findBeatAtPosition
  }
}
