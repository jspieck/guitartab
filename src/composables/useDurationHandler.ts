import { tab } from '../assets/js/tab'
import EventBus from '../assets/js/eventBus'
import { DURATION_BEATS } from '../utils/durationUtils'
import { NAME_TO_CODE } from '../utils/musicUtils'

export function useDurationHandler(syncSongData: () => void) {
  function getDurationInBeats(duration: string): number {
    return DURATION_BEATS[duration] ?? 1
  }

  function durationToCode(duration: string): string {
    return NAME_TO_CODE[duration as keyof typeof NAME_TO_CODE] ?? 'q'
  }
  
  function changeDuration(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatIndex: number,
    stringIndex: number,
    duration: string
  ): boolean {
    const shortDuration = durationToCode(duration)
    const success = tab.changeNoteDuration(
      trackId, blockId, voiceId, beatIndex, stringIndex, shortDuration, false
    )
    
    if (success) {
      syncSongData()
      EventBus.emit('song-data-changed')
      return true
    }
    
    return false
  }
  
  function calculateBeatXOffset(measureData: any[], beatIndex: number, beatWidth: number, contentPadding = 0): number {
    let beats = 0
    for (let i = 0; i < beatIndex; i++) {
      const beat = measureData[i]
      beats += getDurationInBeats(beat?.duration || 'q')
    }
    return contentPadding + (beats * beatWidth)
  }
  
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
