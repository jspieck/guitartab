<template>
  <div class="keyboard-manager">
    <div class="keyboard-header">
      <h3>Keyboard Shortcuts</h3>
      <div class="header-controls">
        <button @click="toggleHelp" class="help-btn">
          {{ showHelp ? '❌' : '❓' }} {{ showHelp ? 'Close' : 'Help' }}
        </button>
        <button @click="resetToDefaults" class="reset-btn">
          🔄 Reset to Defaults
        </button>
        <button @click="exportShortcuts" class="export-btn">
          📤 Export
        </button>
        <button @click="importShortcuts" class="import-btn">
          📥 Import
        </button>
      </div>
    </div>
    
    <!-- Help Overlay -->
    <div v-if="showHelp" class="help-overlay">
      <div class="help-content">
        <div class="help-section">
          <h4>🎵 Playback Controls</h4>
          <div class="shortcut-list">
            <div v-for="shortcut in getShortcutsByCategory('playback')" :key="shortcut.id" class="shortcut-item">
              <span class="shortcut-key">{{ formatShortcut(shortcut.keys) }}</span>
              <span class="shortcut-desc">{{ shortcut.description }}</span>
            </div>
          </div>
        </div>
        
        <div class="help-section">
          <h4>✏️ Editing</h4>
          <div class="shortcut-list">
            <div v-for="shortcut in getShortcutsByCategory('editing')" :key="shortcut.id" class="shortcut-item">
              <span class="shortcut-key">{{ formatShortcut(shortcut.keys) }}</span>
              <span class="shortcut-desc">{{ shortcut.description }}</span>
            </div>
          </div>
        </div>
        
        <div class="help-section">
          <h4>🎸 Note Entry</h4>
          <div class="shortcut-list">
            <div v-for="shortcut in getShortcutsByCategory('notes')" :key="shortcut.id" class="shortcut-item">
              <span class="shortcut-key">{{ formatShortcut(shortcut.keys) }}</span>
              <span class="shortcut-desc">{{ shortcut.description }}</span>
            </div>
          </div>
        </div>
        
        <div class="help-section">
          <h4>🎛️ Interface</h4>
          <div class="shortcut-list">
            <div v-for="shortcut in getShortcutsByCategory('interface')" :key="shortcut.id" class="shortcut-item">
              <span class="shortcut-key">{{ formatShortcut(shortcut.keys) }}</span>
              <span class="shortcut-desc">{{ shortcut.description }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Shortcut Editor -->
    <div v-if="showEditor" class="shortcut-editor">
      <h4>Customize Shortcuts</h4>
      
      <div class="category-tabs">
        <button 
          v-for="category in categories"
          :key="category.id"
          @click="selectedCategory = category.id"
          class="category-tab"
          :class="{ active: selectedCategory === category.id }"
        >
          {{ category.icon }} {{ category.name }}
        </button>
      </div>
      
      <div class="shortcuts-list">
        <div 
          v-for="shortcut in getShortcutsByCategory(selectedCategory)"
          :key="shortcut.id"
          class="shortcut-editor-item"
        >
          <div class="shortcut-info">
            <div class="shortcut-name">{{ shortcut.name }}</div>
            <div class="shortcut-description">{{ shortcut.description }}</div>
          </div>
          
          <div class="shortcut-input">
            <div class="current-keys">
              <span 
                v-for="key in shortcut.keys"
                :key="key"
                class="key-tag"
              >
                {{ key }}
              </span>
            </div>
            <button 
              @click="editShortcut(shortcut)"
              class="edit-shortcut-btn"
            >
              Edit
            </button>
            <button 
              @click="clearShortcut(shortcut.id)"
              class="clear-shortcut-btn"
              :disabled="shortcut.required"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Key Capture Modal -->
    <div v-if="capturingShortcut" class="capture-modal" @click="cancelCapture">
      <div class="capture-content" @click.stop>
        <h3>Press new key combination</h3>
        <div class="capture-display">
          <div class="captured-keys">
            <span 
              v-for="key in capturedKeys"
              :key="key"
              class="captured-key"
            >
              {{ key }}
            </span>
          </div>
        </div>
        <div class="capture-instructions">
          <p>Press the key combination you want to assign</p>
          <p>Press <kbd>Escape</kbd> to cancel</p>
        </div>
        <div class="capture-actions">
          <button @click="saveShortcut" class="save-btn" :disabled="capturedKeys.length === 0">
            Save
          </button>
          <button @click="cancelCapture" class="cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
    
    <!-- Status Display -->
    <div class="status-display" v-if="statusMessage">
      <div class="status-message" :class="statusType">
        {{ statusMessage }}
      </div>
    </div>
    
    <!-- Current Context Display -->
    <div class="context-display">
      <span class="context-label">Context:</span>
      <span class="context-value">{{ currentContext }}</span>
      <div class="active-modes">
        <span 
          v-for="mode in activeModes"
          :key="mode"
          class="mode-tag"
        >
          {{ mode }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'

// Shortcut interface
interface Shortcut {
  id: string
  name: string
  description: string
  keys: string[]
  category: string
  context: string[]
  action: string
  required: boolean
  enabled: boolean
}

// Props
interface Props {
  enabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true
})

// Emits
const emit = defineEmits([
  'shortcutPressed',
  'contextChanged',
  'modeChanged'
])

// State
const showHelp = ref(false)
const showEditor = ref(false)
const selectedCategory = ref('playback')
const capturingShortcut = ref(false)
const editingShortcut = ref<Shortcut | null>(null)
const capturedKeys = ref<string[]>([])
const statusMessage = ref('')
const statusType = ref('info')
const currentContext = ref('global')
const activeModes = ref<string[]>([])

// Key state tracking
const keyState = reactive({
  pressed: new Set<string>(),
  sequence: [] as string[],
  lastPressed: null as string | null,
  combo: [] as string[]
})

// Categories
const categories = [
  { id: 'playback', name: 'Playback', icon: '🎵' },
  { id: 'editing', name: 'Editing', icon: '✏️' },
  { id: 'notes', name: 'Note Entry', icon: '🎸' },
  { id: 'interface', name: 'Interface', icon: '🎛️' },
  { id: 'navigation', name: 'Navigation', icon: '🧭' },
  { id: 'selection', name: 'Selection', icon: '🎯' }
]

// Default shortcuts
const defaultShortcuts: Shortcut[] = [
  // Playback
  { id: 'play-pause', name: 'Play/Pause', description: 'Toggle playback', keys: ['Space'], category: 'playback', context: ['global'], action: 'playback.toggle', required: true, enabled: true },
  { id: 'stop', name: 'Stop', description: 'Stop playback', keys: ['Escape'], category: 'playback', context: ['global'], action: 'playback.stop', required: true, enabled: true },
  { id: 'rewind', name: 'Rewind', description: 'Rewind 10 seconds', keys: ['ArrowLeft'], category: 'playback', context: ['global'], action: 'playback.rewind', required: false, enabled: true },
  { id: 'fast-forward', name: 'Fast Forward', description: 'Fast forward 10 seconds', keys: ['ArrowRight'], category: 'playback', context: ['global'], action: 'playback.fastForward', required: false, enabled: true },
  { id: 'beginning', name: 'Go to Beginning', description: 'Go to song beginning', keys: ['Home'], category: 'playback', context: ['global'], action: 'playback.beginning', required: false, enabled: true },
  { id: 'end', name: 'Go to End', description: 'Go to song end', keys: ['End'], category: 'playback', context: ['global'], action: 'playback.end', required: false, enabled: true },
  
  // Editing
  { id: 'undo', name: 'Undo', description: 'Undo last action', keys: ['Ctrl', 'z'], category: 'editing', context: ['global'], action: 'edit.undo', required: true, enabled: true },
  { id: 'redo', name: 'Redo', description: 'Redo last undone action', keys: ['Ctrl', 'y'], category: 'editing', context: ['global'], action: 'edit.redo', required: true, enabled: true },
  { id: 'copy', name: 'Copy', description: 'Copy selection', keys: ['Ctrl', 'c'], category: 'editing', context: ['global'], action: 'edit.copy', required: true, enabled: true },
  { id: 'paste', name: 'Paste', description: 'Paste from clipboard', keys: ['Ctrl', 'v'], category: 'editing', context: ['global'], action: 'edit.paste', required: true, enabled: true },
  { id: 'cut', name: 'Cut', description: 'Cut selection', keys: ['Ctrl', 'x'], category: 'editing', context: ['global'], action: 'edit.cut', required: true, enabled: true },
  { id: 'select-all', name: 'Select All', description: 'Select all notes', keys: ['Ctrl', 'a'], category: 'editing', context: ['tab'], action: 'edit.selectAll', required: false, enabled: true },
  { id: 'delete', name: 'Delete', description: 'Delete selection', keys: ['Delete'], category: 'editing', context: ['tab'], action: 'edit.delete', required: true, enabled: true },
  
  // Note Entry
  { id: 'note-0', name: 'Fret 0 (Open)', description: 'Enter open string note', keys: ['0'], category: 'notes', context: ['tab'], action: 'note.fret.0', required: false, enabled: true },
  { id: 'note-1', name: 'Fret 1', description: 'Enter fret 1 note', keys: ['1'], category: 'notes', context: ['tab'], action: 'note.fret.1', required: false, enabled: true },
  { id: 'note-2', name: 'Fret 2', description: 'Enter fret 2 note', keys: ['2'], category: 'notes', context: ['tab'], action: 'note.fret.2', required: false, enabled: true },
  { id: 'note-3', name: 'Fret 3', description: 'Enter fret 3 note', keys: ['3'], category: 'notes', context: ['tab'], action: 'note.fret.3', required: false, enabled: true },
  { id: 'note-4', name: 'Fret 4', description: 'Enter fret 4 note', keys: ['4'], category: 'notes', context: ['tab'], action: 'note.fret.4', required: false, enabled: true },
  { id: 'note-5', name: 'Fret 5', description: 'Enter fret 5 note', keys: ['5'], category: 'notes', context: ['tab'], action: 'note.fret.5', required: false, enabled: true },
  { id: 'note-6', name: 'Fret 6', description: 'Enter fret 6 note', keys: ['6'], category: 'notes', context: ['tab'], action: 'note.fret.6', required: false, enabled: true },
  { id: 'note-7', name: 'Fret 7', description: 'Enter fret 7 note', keys: ['7'], category: 'notes', context: ['tab'], action: 'note.fret.7', required: false, enabled: true },
  { id: 'note-8', name: 'Fret 8', description: 'Enter fret 8 note', keys: ['8'], category: 'notes', context: ['tab'], action: 'note.fret.8', required: false, enabled: true },
  { id: 'note-9', name: 'Fret 9', description: 'Enter fret 9 note', keys: ['9'], category: 'notes', context: ['tab'], action: 'note.fret.9', required: false, enabled: true },
  
  // Interface
  { id: 'toggle-toolbar', name: 'Toggle Toolbar', description: 'Show/hide toolbar', keys: ['t'], category: 'interface', context: ['global'], action: 'ui.toolbar.toggle', required: false, enabled: true },
  { id: 'toggle-chord-library', name: 'Toggle Chord Library', description: 'Show/hide chord library', keys: ['c'], category: 'interface', context: ['global'], action: 'ui.chordLibrary.toggle', required: false, enabled: true },
  { id: 'toggle-track-selector', name: 'Toggle Track Selector', description: 'Show/hide track selector', keys: ['Shift', 't'], category: 'interface', context: ['global'], action: 'ui.trackSelector.toggle', required: false, enabled: true },
  { id: 'zoom-in', name: 'Zoom In', description: 'Increase tab zoom', keys: ['Ctrl', '='], category: 'interface', context: ['tab'], action: 'ui.zoom.in', required: false, enabled: true },
  { id: 'zoom-out', name: 'Zoom Out', description: 'Decrease tab zoom', keys: ['Ctrl', '-'], category: 'interface', context: ['tab'], action: 'ui.zoom.out', required: false, enabled: true },
  { id: 'zoom-reset', name: 'Reset Zoom', description: 'Reset zoom to 100%', keys: ['Ctrl', '0'], category: 'interface', context: ['tab'], action: 'ui.zoom.reset', required: false, enabled: true },
  
  // Navigation
  { id: 'next-measure', name: 'Next Measure', description: 'Move to next measure', keys: ['Ctrl', 'ArrowRight'], category: 'navigation', context: ['tab'], action: 'nav.nextMeasure', required: false, enabled: true },
  { id: 'prev-measure', name: 'Previous Measure', description: 'Move to previous measure', keys: ['Ctrl', 'ArrowLeft'], category: 'navigation', context: ['tab'], action: 'nav.prevMeasure', required: false, enabled: true },
  { id: 'next-beat', name: 'Next Beat', description: 'Move to next beat', keys: ['ArrowRight'], category: 'navigation', context: ['tab'], action: 'nav.nextBeat', required: false, enabled: true },
  { id: 'prev-beat', name: 'Previous Beat', description: 'Move to previous beat', keys: ['ArrowLeft'], category: 'navigation', context: ['tab'], action: 'nav.prevBeat', required: false, enabled: true },
  { id: 'next-string', name: 'Next String', description: 'Move to next string', keys: ['ArrowDown'], category: 'navigation', context: ['tab'], action: 'nav.nextString', required: false, enabled: true },
  { id: 'prev-string', name: 'Previous String', description: 'Move to previous string', keys: ['ArrowUp'], category: 'navigation', context: ['tab'], action: 'nav.prevString', required: false, enabled: true }
]

const shortcuts = ref<Shortcut[]>([...defaultShortcuts])

// Computed
const getShortcutsByCategory = computed(() => (category: string) => {
  return shortcuts.value.filter(s => s.category === category && s.enabled)
})

// Methods
function toggleHelp() {
  showHelp.value = !showHelp.value
  if (showHelp.value) {
    showEditor.value = false
  }
}

function toggleEditor() {
  showEditor.value = !showEditor.value
  if (showEditor.value) {
    showHelp.value = false
  }
}

function editShortcut(shortcut: Shortcut) {
  editingShortcut.value = shortcut
  capturedKeys.value = []
  capturingShortcut.value = true
}

function clearShortcut(shortcutId: string) {
  const shortcut = shortcuts.value.find(s => s.id === shortcutId)
  if (shortcut && !shortcut.required) {
    shortcut.keys = []
    showStatus('Shortcut cleared', 'success')
  }
}

function cancelCapture() {
  capturingShortcut.value = false
  editingShortcut.value = null
  capturedKeys.value = []
}

function saveShortcut() {
  if (editingShortcut.value && capturedKeys.value.length > 0) {
    // Check for conflicts
    const conflicting = shortcuts.value.find(s => 
      s.id !== editingShortcut.value!.id &&
      s.enabled &&
      arraysEqual(s.keys, capturedKeys.value) &&
      s.context.some(ctx => editingShortcut.value!.context.includes(ctx))
    )
    
    if (conflicting) {
      showStatus(`Shortcut conflicts with "${conflicting.name}"`, 'error')
      return
    }
    
    editingShortcut.value.keys = [...capturedKeys.value]
    showStatus('Shortcut saved', 'success')
    cancelCapture()
    saveShortcutsToStorage()
  }
}

function resetToDefaults() {
  if (confirm('Reset all shortcuts to defaults? This will overwrite your customizations.')) {
    shortcuts.value = [...defaultShortcuts]
    saveShortcutsToStorage()
    showStatus('Shortcuts reset to defaults', 'success')
  }
}

function exportShortcuts() {
  const data = JSON.stringify(shortcuts.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'guitar-tab-shortcuts.json'
  a.click()
  URL.revokeObjectURL(url)
  showStatus('Shortcuts exported', 'success')
}

function importShortcuts() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string)
          if (Array.isArray(imported) && imported.every(isValidShortcut)) {
            shortcuts.value = imported
            saveShortcutsToStorage()
            showStatus('Shortcuts imported successfully', 'success')
          } else {
            showStatus('Invalid shortcut file format', 'error')
          }
        } catch {
          showStatus('Failed to parse shortcut file', 'error')
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

function isValidShortcut(obj: any): obj is Shortcut {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    Array.isArray(obj.keys) &&
    typeof obj.category === 'string' &&
    Array.isArray(obj.context) &&
    typeof obj.action === 'string' &&
    typeof obj.required === 'boolean' &&
    typeof obj.enabled === 'boolean'
}

function formatShortcut(keys: string[]): string {
  return keys.map(key => {
    // Format special keys
    const specialKeys: { [key: string]: string } = {
      'Ctrl': 'Ctrl',
      'Alt': 'Alt',
      'Shift': 'Shift',
      'Meta': 'Cmd',
      ' ': 'Space',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'Enter': '↵',
      'Escape': 'Esc',
      'Backspace': '⌫',
      'Delete': 'Del',
      'Tab': '⇥'
    }
    return specialKeys[key] || key.toUpperCase()
  }).join(' + ')
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((val, i) => val === b[i])
}

function showStatus(message: string, type: 'info' | 'success' | 'error' = 'info') {
  statusMessage.value = message
  statusType.value = type
  setTimeout(() => {
    statusMessage.value = ''
  }, 3000)
}

function saveShortcutsToStorage() {
  localStorage.setItem('guitarTabShortcuts', JSON.stringify(shortcuts.value))
}

function loadShortcutsFromStorage() {
  const saved = localStorage.getItem('guitarTabShortcuts')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.every(isValidShortcut)) {
        shortcuts.value = parsed
      }
    } catch {
      console.warn('Failed to load saved shortcuts')
    }
  }
}

function setContext(context: string) {
  currentContext.value = context
  emit('contextChanged', context)
}

function addMode(mode: string) {
  if (!activeModes.value.includes(mode)) {
    activeModes.value.push(mode)
    emit('modeChanged', activeModes.value)
  }
}

function removeMode(mode: string) {
  const index = activeModes.value.indexOf(mode)
  if (index > -1) {
    activeModes.value.splice(index, 1)
    emit('modeChanged', activeModes.value)
  }
}

// Key event handlers
function handleKeyDown(event: KeyboardEvent) {
  if (!props.enabled || capturingShortcut.value) {
    if (capturingShortcut.value) {
      handleCaptureKeyDown(event)
    }
    return
  }
  
  const key = event.key
  keyState.pressed.add(key)
  keyState.lastPressed = key
  
  // Build current combo
  const combo: string[] = []
  if (event.ctrlKey) combo.push('Ctrl')
  if (event.altKey) combo.push('Alt')
  if (event.shiftKey) combo.push('Shift')
  if (event.metaKey) combo.push('Meta')
  
  // Add the main key if it's not a modifier
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    combo.push(key)
  }
  
  keyState.combo = combo
  
  // Find matching shortcut
  const matchingShortcut = shortcuts.value.find(shortcut => {
    return shortcut.enabled &&
           arraysEqual(shortcut.keys, combo) &&
           shortcut.context.some(ctx => ctx === 'global' || ctx === currentContext.value)
  })
  
  if (matchingShortcut) {
    event.preventDefault()
    emit('shortcutPressed', {
      shortcut: matchingShortcut,
      action: matchingShortcut.action,
      context: currentContext.value
    })
  }
}

function handleKeyUp(event: KeyboardEvent) {
  if (!props.enabled) return
  
  const key = event.key
  keyState.pressed.delete(key)
  
  // Clear combo if no modifiers are held
  if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
    keyState.combo = []
  }
}

function handleCaptureKeyDown(event: KeyboardEvent) {
  event.preventDefault()
  
  if (event.key === 'Escape') {
    cancelCapture()
    return
  }
  
  const combo: string[] = []
  if (event.ctrlKey) combo.push('Ctrl')
  if (event.altKey) combo.push('Alt')
  if (event.shiftKey) combo.push('Shift')
  if (event.metaKey) combo.push('Meta')
  
  // Add the main key if it's not a modifier
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
    combo.push(event.key)
  }
  
  capturedKeys.value = combo
}

// Lifecycle
onMounted(() => {
  loadShortcutsFromStorage()
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
})

// Expose methods for external use
defineExpose({
  setContext,
  addMode,
  removeMode,
  toggleHelp,
  toggleEditor
})
</script>

<style scoped>
.keyboard-manager {
  position: relative;
}

.keyboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px 8px 0 0;
}

.keyboard-header h3 {
  margin: 0;
  color: #333;
}

.header-controls {
  display: flex;
  gap: 8px;
}

.help-btn, .reset-btn, .export-btn, .import-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.help-btn:hover, .reset-btn:hover, .export-btn:hover, .import-btn:hover {
  background: #e9ecef;
  border-color: #4A90E2;
}

.help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  color: white;
}

.help-content {
  background: #2c3e50;
  border-radius: 12px;
  padding: 24px;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  margin: 20px;
}

.help-section {
  margin-bottom: 24px;
}

.help-section h4 {
  margin: 0 0 12px 0;
  color: #ecf0f1;
  font-size: 16px;
  border-bottom: 1px solid #34495e;
  padding-bottom: 8px;
}

.shortcut-list {
  display: grid;
  gap: 8px;
}

.shortcut-item {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
}

.shortcut-key {
  font-family: 'Courier New', monospace;
  background: #34495e;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
  border: 1px solid #4a6741;
}

.shortcut-desc {
  color: #bdc3c7;
  font-size: 14px;
}

.shortcut-editor {
  background: white;
  border: 1px solid #dee2e6;
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 16px;
}

.shortcut-editor h4 {
  margin: 0 0 16px 0;
  color: #333;
}

.category-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 12px;
}

.category-tab {
  padding: 8px 16px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 6px 6px 0 0;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #666;
}

.category-tab:hover {
  background: #f8f9fa;
  color: #333;
}

.category-tab.active {
  background: #4A90E2;
  color: white;
  border-color: #4A90E2;
}

.shortcuts-list {
  display: grid;
  gap: 12px;
}

.shortcut-editor-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  background: #f8f9fa;
}

.shortcut-info {
  min-width: 0;
}

.shortcut-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.shortcut-description {
  font-size: 12px;
  color: #666;
}

.shortcut-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-keys {
  display: flex;
  gap: 4px;
  min-width: 100px;
}

.key-tag {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-family: 'Courier New', monospace;
  color: #333;
  border: 1px solid #ced4da;
}

.edit-shortcut-btn, .clear-shortcut-btn {
  padding: 4px 8px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.edit-shortcut-btn:hover {
  background: #4A90E2;
  color: white;
  border-color: #4A90E2;
}

.clear-shortcut-btn:hover:not(:disabled) {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

.clear-shortcut-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.capture-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.capture-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  max-width: 400px;
  width: 90%;
}

.capture-content h3 {
  margin: 0 0 20px 0;
  color: #333;
}

.capture-display {
  background: #f8f9fa;
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.captured-keys {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.captured-key {
  background: #4A90E2;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.capture-instructions {
  margin-bottom: 20px;
  color: #666;
}

.capture-instructions p {
  margin: 8px 0;
}

.capture-instructions kbd {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  border: 1px solid #ced4da;
}

.capture-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.save-btn, .cancel-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-btn {
  background: #28a745;
  color: white;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  background: #6c757d;
  color: white;
}

.status-display {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2500;
}

.status-message {
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.status-message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #b8daff;
}

.status-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.context-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #e9ecef;
  border-top: 1px solid #dee2e6;
  font-size: 12px;
}

.context-label {
  font-weight: 600;
  color: #495057;
}

.context-value {
  background: #6c757d;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-family: 'Courier New', monospace;
}

.active-modes {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.mode-tag {
  background: #ffc107;
  color: #212529;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
}
</style> 