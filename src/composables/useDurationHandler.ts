import legacyEditorCore from '../services/legacy/editorCoreAdapter'
import { DURATION_BEATS } from '../utils/durationUtils'
import { NAME_TO_CODE } from '../utils/musicUtils'
import type { TabBeat } from '../types/tab'

export function useDurationHandler() {
  function getDurationInBeats(duration: string): number {
    return DURATION_BEATS[duration] ?? 1
  }

  function durationToCode(duration: string): string {
    return NAME_TO_CODE[duration as keyof typeof NAME_TO_CODE] ?? duration
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
    return legacyEditorCore.changeNoteDuration(
      trackId, blockId, voiceId, beatIndex, stringIndex, shortDuration
    )
  }
  
  function calculateBeatXOffset(measureData: TabBeat[], beatIndex: number, beatWidth: number, contentPadding = 0): number {
    let beats = 0
    for (let i = 0; i < beatIndex; i++) {
      const beat = measureData[i]
      beats += getDurationInBeats(beat?.duration || 'q')
    }
    return contentPadding + (beats * beatWidth)
  }
  
  function findBeatAtPosition(measureData: TabBeat[], xPosition: number, beatWidth: number): number {
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
