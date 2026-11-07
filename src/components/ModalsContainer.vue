<template>
  <div>
    <!-- Each dialog is its own chunk, mounted the first time it opens and kept afterwards. -->
    <component :is="DIALOG_COMPONENTS[id]" v-for="id in mountedDialogs" :key="id" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, type Component } from 'vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { dialogElement, dialogState, frontDialogId, hideDialog } from '../stores/dialogState'
import { handleDialogKey } from '../services/a11y/dialogFocus'

const lazy = (load: () => Promise<{ default: Component }>) => defineAsyncComponent(load)

const DIALOG_COMPONENTS: Record<string, Component> = {
  [DIALOGS.BEND.id]: lazy(() => import('./BendModal.vue')),
  [DIALOGS.PIANO.id]: lazy(() => import('./PianoModal.vue')),
  [DIALOGS.DRUM_INFO.id]: lazy(() => import('./DrumInfoModal.vue')),
  [DIALOGS.DRUM_GRID.id]: lazy(() => import('./DrumGridModal.vue')),
  [DIALOGS.GUITAR.id]: lazy(() => import('./GuitarModal.vue')),
  [DIALOGS.DELETE_TRACK.id]: lazy(() => import('./DeleteModal.vue')),
  [DIALOGS.REPETITION.id]: lazy(() => import('./RepetitionModal.vue')),
  [DIALOGS.ADD_TRACK.id]: lazy(() => import('./AddTrackModal.vue')),
  [DIALOGS.REPEAT_ALTERNATIVE.id]: lazy(() => import('./RepeatAlternativeModal.vue')),
  [DIALOGS.ARTIFICIAL.id]: lazy(() => import('./HarmonicModal.vue')),
  [DIALOGS.TREMOLO_PICKING.id]: lazy(() => import('./TremoloPickingModal.vue')),
  [DIALOGS.TIME_METER.id]: lazy(() => import('./TimeMeterModal.vue')),
  [DIALOGS.TEMPO.id]: lazy(() => import('./BpmModal.vue')),
  [DIALOGS.KEY_SIGNATURE.id]: lazy(() => import('./KeySignatureModal.vue')),
  [DIALOGS.CLEF.id]: lazy(() => import('./ClefModal.vue')),
  [DIALOGS.TUNER.id]: lazy(() => import('./TunerModal.vue')),
  [DIALOGS.STROKE.id]: lazy(() => import('./StrokeModal.vue')),
  [DIALOGS.TEXT.id]: lazy(() => import('./AddTextModal.vue')),
  [DIALOGS.MARKER.id]: lazy(() => import('./AddMarkerModal.vue')),
  [DIALOGS.DIRECTION.id]: lazy(() => import('./DirectionModal.vue')),
  [DIALOGS.ADD_CHORD.id]: lazy(() => import('./AddChordModal.vue')),
  [DIALOGS.CHORD_MANAGER.id]: lazy(() => import('./ChordManagerModal.vue')),
  [DIALOGS.GRACE.id]: lazy(() => import('./GraceModal.vue')),
  [DIALOGS.TREMOLO_BAR.id]: lazy(() => import('./TremoloBarModal.vue')),
  [DIALOGS.INFO.id]: lazy(() => import('./TrackInfoModal.vue')),
  [DIALOGS.MIDI.id]: lazy(() => import('./MidiModal.vue')),
  [DIALOGS.COPYRIGHT.id]: lazy(() => import('./CopyrightModal.vue')),
  [DIALOGS.MIXER.id]: lazy(() => import('./Mixer.vue')),
  [DIALOGS.COMPRESSOR.id]: lazy(() => import('./Compressor.vue')),
  [DIALOGS.EQUALIZER.id]: lazy(() => import('./Equalizer.vue')),
  [DIALOGS.INSTRUMENT_SETTINGS.id]: lazy(() => import('./InstrumentSettingModal.vue')),
  [DIALOGS.CLOUD_SONGS.id]: lazy(() => import('./CloudSongsModal.vue')),
  [DIALOGS.EXAMPLE_SONGS.id]: lazy(() => import('./ExampleSongsModal.vue')),
}

const mountedDialogs = computed(() => dialogState.mounted.filter((id) => DIALOG_COMPONENTS[id] != null))

// Bubble phase: a popover or field inside the dialog that takes Escape cancels it first.
function onKeyDown(event: KeyboardEvent) {
  if (dialogState.windows.length === 0) return
  const front = frontDialogId()
  handleDialogKey(event, front, dialogElement(front), hideDialog)
}
document.addEventListener('keydown', onKeyDown)
onBeforeUnmount(() => document.removeEventListener('keydown', onKeyDown))
</script>
