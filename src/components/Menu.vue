<template>
    <div id="completeBar" class="toolbar" role="banner" @pointerover="tooltip.show" @pointerout="tooltip.hide"
        @focusin="tooltip.show" @focusout="tooltip.hide" @pointerdown="tooltip.hide">
        <!-- Top bar: the song and playing it. -->
        <div id="tabBar" ref="topBarRef" class="toolbar__bar toolbar__bar--top" role="toolbar" aria-label="Song and playback"
            data-roving-toolbar @keydown="onToolbarKeydown" @focusin="onToolbarFocusin">
            <div class="toolbar__section" data-fit-section>
                <ToolbarMenu v-if="topFit.isFolded('file')" button-id="fileMenuButton" name="File" label="File"
                    icon="open" :entries="fileMenuEntries" />
                <div v-else class="toolbar__group" data-fold="file">
                    <ToolbarButton :action="act('openFile')" />
                    <SaveFormatMenu />
                    <ToolbarButton v-for="id in FILE_BAR_ACTIONS" :key="id"
                        :action="act(id)" />
                    <span class="toolbar__sep" />
                </div>
                <div class="toolbar__group">
                    <ToolbarButton v-for="action in historyActions" :key="action.id" :action="action"
                        :disabled="disabledOf(action)" />
                </div>
            </div>

            <div class="toolbar__section" data-fit-section>
                <div class="toolbar__group toolbar__transport">
                    <ToolbarButton :action="act('oneMeasureBack')" :disabled="disabledOf(act('oneMeasureBack'))" />
                    <button id="play" type="button" class="tb-play"
                        :class="{ playing: playbackTransportState.isPlaying, 'is-loading': soundFontLoading != null, 'is-waiting': soundFontState.playWhenReady }"
                        :style="soundFontLoading != null ? { '--load-progress': soundFontProgress() ?? 0 } : undefined"
                        :aria-label="playbackTransportState.isPlaying ? 'Pause' : soundFontLoading ?? 'Play'"
                        :aria-pressed="soundFontState.playWhenReady || undefined"
                        :data-tip="soundFontLoading ?? actionTooltip(act('play'))" @click="act('play').run()"
                        @pointerenter="preloadPlayback()">
                        <AppIcon :name="playbackTransportState.isPlaying ? 'pause' : 'play'" :size="22" />
                    </button>
                    <ToolbarButton :action="act('oneMeasureForward')" :disabled="disabledOf(act('oneMeasureForward'))" />
                    <ToolbarButton :action="act('stopButton')" />
                    <ToolbarButton :action="act('recordButton')" class="tb-record"
                        :class="{ prepareRecording: playbackTransportState.isRecordingArmed, recording: playbackTransportState.isRecordingActive }"
                        :pressed="pressedOf(act('recordButton'))" />
                </div>
                <span class="toolbar__sep" />
                <PracticeControls :folded="topFit.isFolded('practiceExtras')" />
                <TempoPill />
            </div>

            <div class="toolbar__section" data-fit-section>
                <ToolbarMenu v-if="topFit.isFolded('view')" button-id="viewMenuButton"
                    name="View: notation, zoom, chords, instruments" icon="more" :entries="viewMenuEntries" />
                <div v-else class="toolbar__group" data-fold="view">
                    <ToolbarButton :action="act('classicalToggleButton')" :pressed="pressedOf(act('classicalToggleButton'))"
                        :icon-size="24" />
                    <ToolbarMenu button-id="tabViewMenuButton" name="Tab view options" icon="rhythm-stems"
                        :entries="tabViewEntries" />
                    <ToolbarButton :action="act('zoomOut')" />
                    <span class="toolbar__zoom" aria-live="polite">{{ zoomPercent }}</span>
                    <ToolbarButton :action="act('zoomIn')" />
                    <span class="toolbar__sep" />
                    <ToolbarButton v-for="id in ['chordManagerButton', 'guitarEyeToggle', 'pianoEyeToggle', 'tunerButton', 'fullscreen']"
                        :key="id" :action="act(id)" />
                    <span class="toolbar__sep" />
                </div>
                <div class="toolbar__group">
                    <ToolbarButton :action="act('shortcutsHelpButton')" />
                    <ToolbarButton :action="act('themeToggle')" :pressed="pressedOf(act('themeToggle'))" />
                </div>
            </div>
        </div>

        <!-- Edit bar: changing notes, in tabs. Inert while playing (as the old bars were hidden). -->
        <div id="statusBars" ref="editBarRef" class="toolbar__bar toolbar__bar--edit"
            :class="{ 'is-inert': playbackTransportState.isPlaying }" :inert="playbackTransportState.isPlaying || undefined">
            <div id="barButtons" class="toolbar__tabs" role="tablist" aria-label="Edit tools" data-fit-section
                @keydown="onTabKeydown">
                <button v-for="tab in EDIT_TABS" :id="`barButton${tab.legacyBarId}`" :key="tab.id" type="button" role="tab"
                    class="toolbar__tab" :class="{ 'is-selected': toolbarUiState.editTab === tab.id }"
                    :aria-selected="toolbarUiState.editTab === tab.id" :tabindex="toolbarUiState.editTab === tab.id ? 0 : -1"
                    :aria-controls="`statusBar${tab.legacyBarId}`" @click="setEditTab(tab.id)">{{ tab.label }}</button>
            </div>

            <div :id="`statusBar${currentTab.legacyBarId}`" class="toolbar__section toolbar__tools" role="tabpanel"
                :aria-labelledby="`barButton${currentTab.legacyBarId}`" data-fit-section data-roving-toolbar
                @keydown="onToolbarKeydown" @focusin="onToolbarFocusin">
                <div v-for="(group, index) in visibleEditGroups" :key="group.id" class="toolbar__group"
                    :data-fold="foldableEditGroups.includes(group.id) ? group.id : undefined" role="group"
                    :aria-label="group.label">
                    <span v-if="index > 0" class="toolbar__sep" />
                    <template v-if="group.id === 'voice'">
                        <span class="toolbar__label" aria-hidden="true">Voice</span>
                        <div class="toolbar__segmented">
                            <ToolbarButton v-for="action in actionsInGroup(group.id)" :key="action.id" :action="action"
                                :pressed="pressedOf(action)" />
                        </div>
                    </template>
                    <ToolbarButton v-for="action in actionsInGroup(group.id)" v-else :key="action.id" :action="action"
                        :pressed="pressedOf(action)" :disabled="disabledOf(action)" />
                    <select v-if="group.id === 'tuplet'" id="tupletDropDown" v-model="noteInputState.tuplet"
                        class="tb-pill toolbar__tuplet" aria-label="Notes in the tuplet" data-tip="Notes in the tuplet">
                        <option v-for="num in availableTuplets" :key="num" :value="num.toString()">{{ num }}</option>
                    </select>
                </div>
                <ToolbarMenu v-if="moreEntries.length > 0" button-id="editMoreButton" :name="`More ${currentTab.label.toLowerCase()} tools`"
                    label="More" :entries="moreEntries" />
            </div>

            <div class="toolbar__section toolbar__position" data-fit-section>
                <span v-if="!editFit.isFolded('position')" class="toolbar__chip" data-fold="position">{{ positionText }}</span>
            </div>
        </div>

        <Teleport to="body">
            <div v-if="tooltip.state.text" class="tb-tooltip" role="tooltip" :style="tooltip.state.style">{{ tooltip.state.text }}</div>
        </Teleport>
    </div>
    <div id="trackCapsule">
        <div id="trackSign"><img id="trackSignImg" :src="trackIconSrc" alt="" /></div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { instrumentIconSrc } from '../data/instrumentData'
import Settings from '../stores/settingsState'
import Song from '../stores/song'
import { songState } from '../stores/songState'
import { selectionState } from '../stores/selectionState'
import { noteInputState } from '../stores/noteInputState'
import { playbackTransportState } from '../stores/playbackTransportState'
import { soundFontLoadingLabel, soundFontProgress, soundFontState } from '../stores/soundFontState'
import { setEditTab, toolbarUiState, type EditTab } from '../stores/toolbarUiState'
import editorCore from '../services/editor/editorCore'
import { isTrackInScore, toggleScoreTrack } from '../services/editor/scoreViewCommands'
import {
    actionsInGroup,
    actionTooltip,
    EDIT_TABS,
    groupsOfTab,
    toolbarAction as act,
    type ToolbarAction,
    type ToolbarGroupId,
} from '../services/editor/toolbarActions'
import { usePlaybackEngine } from '../composables/usePlaybackEngine'
import { useToolbarState } from '../composables/useToolbarState'
import { useToolbarFit } from '../composables/useToolbarFit'
import { useToolbarTooltip } from '../composables/useToolbarTooltip'
import { EXPORT_OPTIONS, exportSongAs } from '../utils/exportFormats'
import { formatCursorPosition } from '../utils/positionLabel'
import { CLOUD_ENABLED } from '../utils/features'
import AppIcon from './AppIcon.vue'
import PracticeControls from './PracticeControls.vue'
import SaveFormatMenu from './SaveFormatMenu.vue'
import ToolbarButton from './toolbar/ToolbarButton.vue'
import ToolbarMenu, { type ToolbarMenuEntry } from './toolbar/ToolbarMenu.vue'
import TempoPill from './toolbar/TempoPill.vue'
import { focusMenuItem } from './toolbar/menuKeyboard'
import { moveToolbarFocus, syncRovingTabindex } from './toolbar/rovingToolbar'
import { isToolbarNavigationKey } from '../utils/keyboardShortcuts'

/** The current track's instrument, next to the toolbar. */
const trackIconSrc = computed(() =>
    instrumentIconSrc(songState.playBackInstrument[songState.currentTrackId]?.instrument ?? 'guitar'))

/** The Play button shows the SoundFont download and says when it waits for it. */
const soundFontLoading = computed(() => soundFontLoadingLabel())

const { preload: preloadPlayback } = usePlaybackEngine()
const toolbar = useToolbarState(toRef(noteInputState, 'tuplet'))
const { availableTuplets } = toolbar
const tooltip = useToolbarTooltip()

const historyActions = actionsInGroup('history')
/** Groups that never fold; everything else on the edit bar folds into "More" (last first). */
const FIXED_EDIT_GROUPS: readonly ToolbarGroupId[] = ['length', 'dots', 'tuplet', 'tie', 'dynamics', 'bar', 'text', 'effects-pitch']

const EDIT_GROUP_IDS = new Set<ToolbarGroupId>(EDIT_TABS.flatMap((tab) => groupsOfTab(tab.id).map((group) => group.id)))
const currentTab = computed(() => EDIT_TABS.find((tab) => tab.id === toolbarUiState.editTab) ?? EDIT_TABS[0])
const editGroups = computed(() => groupsOfTab(toolbarUiState.editTab))
const foldableEditGroups = computed(() =>
    editGroups.value.map((group) => group.id).filter((id) => !FIXED_EDIT_GROUPS.includes(id)),
)

// Song-state pressed/disabled come from useToolbarState; the rest (theme, undo…) from the action.
function pressedOf(action: ToolbarAction): boolean | undefined {
    if (action.pressed) return action.pressed()
    return EDIT_GROUP_IDS.has(action.group) && !COMMANDS.has(action.id) ? toolbar.isPressed(action.id) : undefined
}
function disabledOf(action: ToolbarAction): boolean {
    return action.disabled?.() ?? toolbar.isDisabled(action.id)
}
/** Edit-bar buttons that run a command rather than show a state. */
const COMMANDS = new Set(['addMeasure', 'removeMeasure'])

// Folding: the top bar folds File, then the view group, then count-in/trainer; the edit bar
// folds the cursor position, then its last groups into "More".
const topBarRef = ref<HTMLElement | null>(null)
const editBarRef = ref<HTMLElement | null>(null)
const topFit = useToolbarFit(topBarRef, {
    foldOrder: () => ['file', 'view', 'practiceExtras'],
    menus: { file: 'file', view: 'view', practiceExtras: 'practice' },
    // "File ▾", "⋯" and the practice chevron, as rendered.
    menuWidths: { file: 84, view: 36, practice: 36 },
})
const editFit = useToolbarFit(editBarRef, {
    foldOrder: () => ['position', ...[...foldableEditGroups.value].reverse()],
    menus: Object.fromEntries([...EDIT_GROUP_IDS].map((id) => [id, 'more'])),
    menuWidths: { more: 80 },
    remeasureOn: () => toolbarUiState.editTab,
})

const visibleEditGroups = computed(() => editGroups.value.filter((group) => !editFit.isFolded(group.id)))

function actionEntries(actions: ToolbarAction[]): ToolbarMenuEntry[] {
    return actions.map((action) => ({
        kind: 'action',
        action,
        pressed: pressedOf(action),
        disabled: disabledOf(action),
    }))
}

const moreEntries = computed<ToolbarMenuEntry[]>(() =>
    editGroups.value
        .filter((group) => editFit.isFolded(group.id))
        .flatMap((group) => [{ kind: 'heading', label: group.label } as ToolbarMenuEntry, ...actionEntries(actionsInGroup(group.id))]),
)

/** The file group's extra actions; Cloud songs only in builds with the server API (utils/features.ts). */
const FILE_MORE_ACTIONS = [
    ...(CLOUD_ENABLED ? ['cloudSongs'] : []),
    'printTab', 'createPDF', 'exportAudio', 'info', 'recoverDrafts',
]
const FILE_BAR_ACTIONS = ['exampleSongs', ...FILE_MORE_ACTIONS]

const fileMenuEntries = computed<ToolbarMenuEntry[]>(() => [
    ...actionEntries([act('openFile'), act('exampleSongs')]),
    { kind: 'heading', label: 'Save as' },
    ...EXPORT_OPTIONS.map((option): ToolbarMenuEntry => ({
        kind: 'item',
        id: `fileMenu-download-${option.format}`,
        label: option.label,
        icon: 'save',
        run: () => exportSongAs(option.format),
    })),
    { kind: 'heading', label: 'More' },
    ...actionEntries([...FILE_MORE_ACTIONS, 'gettingStarted', 'whatsNew', 'about'].map(act)),
])

/** How the tab is drawn: options kept in one menu, so the top bar stays narrow. */
const TAB_VIEW_ACTIONS = ['tiedParenthesesToggle', 'rhythmStemsToggle', 'multiRestToggle']
/** The score view and its tracks (the edited track is always in it). */
const scoreEntries = computed<ToolbarMenuEntry[]>(() => [
    { kind: 'heading', label: 'Score' },
    ...actionEntries([act('scoreViewToggle')]),
    ...(Settings.scoreView && Song.tracks.length > 1
        ? Song.tracks.map((track, trackId): ToolbarMenuEntry => ({
              kind: 'item',
              id: `scoreTrack-${trackId}`,
              label: track.name || `Track ${trackId + 1}`,
              icon: isTrackInScore(trackId) ? 'eye' : undefined,
              hint: trackId === songState.currentTrackId ? 'edited' : undefined,
              pressed: isTrackInScore(trackId),
              run: () => toggleScoreTrack(trackId),
          }))
        : []),
])
const tabViewEntries = computed<ToolbarMenuEntry[]>(() => [...actionEntries(TAB_VIEW_ACTIONS.map(act)), ...scoreEntries.value])

const viewMenuEntries = computed<ToolbarMenuEntry[]>(() => [
    ...actionEntries(['classicalToggleButton', ...TAB_VIEW_ACTIONS].map(act)),
    ...scoreEntries.value,
    { kind: 'heading', label: `Zoom ${zoomPercent.value}` },
    ...actionEntries(['zoomOut', 'zoomIn', 'fullscreen'].map(act)),
    { kind: 'heading', label: 'Tools' },
    ...actionEntries(['chordManagerButton', 'guitarEyeToggle', 'pianoEyeToggle', 'tunerButton'].map(act)),
])

const zoomPercent = computed(() => `${Math.round(Settings.currentZoom * 100)}%`)

const positionText = computed(() => {
    const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor
    const note = editorCore.getNote(trackId, blockId, voiceId, beatId, string)
    return formatCursorPosition({ blockId, beatId, string }, Song.tracks[trackId]?.numStrings ?? 6, note?.fret)
})

// Arrow keys along a bar, one Tab stop per group (toolbar/rovingToolbar.ts). The stops are set
// when the focus enters a bar, not on every render: measuring which buttons show forces a layout.
function onToolbarKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || !isToolbarNavigationKey(event)) return
    if (moveToolbarFocus(event.currentTarget as HTMLElement, event.key)) event.preventDefault()
}
function onToolbarFocusin(event: FocusEvent): void {
    syncRovingTabindex(event.currentTarget as HTMLElement)
}

function onTabKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    focusMenuItem(event.currentTarget as HTMLElement, event.key)
    const focused = document.activeElement as HTMLElement | null
    const tab = EDIT_TABS.find((entry) => `barButton${entry.legacyBarId}` === focused?.id)
    if (tab) setEditTab(tab.id as EditTab)
}
</script>
