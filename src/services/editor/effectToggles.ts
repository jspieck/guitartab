import Song, { type Beat, type Note } from '../../stores/song'
import { selectionState } from '../../stores/selectionState'
import {
  deactivateMenuEffectsInGroup,
  getMenuEffectVariable,
  handleMenuEffectGroupCollision,
  handleMenuEffectGroupCollisionBeat,
  setMenuEffectVariable,
  type MenuEffectBeatRef,
  type MenuEffectNoteRef,
  type MenuEffectState,
} from '../menuEffectMutations'

/**
 * The toolbar's effect switches on the song. Bar-level effects (repeats,
 * markers…) are read from the bar the cursor is in.
 */

function cursorBarMeta() {
  return Song.measureMeta[selectionState.cursor.blockId ?? 0]
}

function barMeta(blockId: number) {
  return Song.measureMeta[blockId]
}

function beatOf(ref: MenuEffectNoteRef | MenuEffectBeatRef): Beat {
  return Song.getBeat({
    trackId: ref.trackId,
    blockId: ref.blockId,
    voiceId: ref.voiceId,
    beatId: ref.beatId,
  })
}

export function isEffectSet(beat: Beat, note: Note | null, name: string): boolean {
  return getMenuEffectVariable(beat, note, name, cursorBarMeta())
}

export function setEffect(beat: Beat, note: Note | null, name: string, value: MenuEffectState): void {
  setMenuEffectVariable(beat, note, name, value, cursorBarMeta())
}

/** Turns off every effect of a group (e.g. all dynamics) before one is set. */
export function clearEffectGroup(beat: Beat, note: Note | null, effects: string[]): void {
  deactivateMenuEffectsInGroup(beat, note, effects, cursorBarMeta())
}

/** Toggles a note effect on the selected notes, removing effects it cannot be combined with. */
export function toggleNoteEffect(notes: MenuEffectNoteRef[], id: string, isVariableSet: boolean) {
  return handleMenuEffectGroupCollision(notes, id, isVariableSet, beatOf, barMeta)
}

/** Like `toggleNoteEffect`, for beat effects. */
export function toggleBeatEffect(beats: MenuEffectBeatRef[], id: string, isVariableSet: boolean) {
  return handleMenuEffectGroupCollisionBeat(beats, id, isVariableSet, beatOf, barMeta)
}
