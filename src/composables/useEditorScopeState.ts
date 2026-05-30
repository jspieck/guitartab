import { computed, shallowReactive } from 'vue'

interface EditorScopeState {
  currentTrackId: number
  currentVoiceId: number
}

export const editorScopeState = shallowReactive<EditorScopeState>({
  currentTrackId: 0,
  currentVoiceId: 0,
})

export function syncEditorScope(trackId: number, voiceId: number): void {
  editorScopeState.currentTrackId = trackId
  editorScopeState.currentVoiceId = voiceId
}

export function setCurrentTrack(trackId: number): void {
  editorScopeState.currentTrackId = trackId
}

export function setCurrentVoice(voiceId: number): void {
  editorScopeState.currentVoiceId = voiceId
}

export function resetEditorScopeState(): void {
  editorScopeState.currentTrackId = 0
  editorScopeState.currentVoiceId = 0
}

export function useEditorScopeState() {
  return {
    editorScopeState,
    currentTrackId: computed(() => editorScopeState.currentTrackId),
    currentVoiceId: computed(() => editorScopeState.currentVoiceId),
  }
}