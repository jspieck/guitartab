<template>
  <div class="chord-library">
    <div class="library-header">
      <h3>Chord Library</h3>
      <div class="header-controls">
        <input 
          v-model="searchTerm"
          placeholder="Search chords..."
          class="search-input"
        />
        <button @click="addCustomChord" class="add-chord-btn">
          <span>+</span> Custom
        </button>
      </div>
    </div>
    
    <!-- Chord Categories -->
    <div class="chord-categories">
      <button 
        v-for="category in categories"
        :key="category.id"
        @click="selectedCategory = category.id"
        class="category-btn"
        :class="{ active: selectedCategory === category.id }"
      >
        {{ category.name }}
      </button>
    </div>
    
    <!-- Chord Grid -->
    <div class="chord-grid">
      <div 
        v-for="chord in filteredChords"
        :key="`${chord.name}-${chord.variation}`"
        class="chord-item"
        @click="selectChord(chord)"
        @dblclick="insertChord(chord)"
        :class="{ selected: selectedChord?.id === chord.id }"
      >
        <div class="chord-preview">
          <ChordDiagram
            :chord-data="chord"
            :x-offset="0"
            :y-offset="0"
            :num-strings="6"
          />
        </div>
        <div class="chord-info">
          <div class="chord-name">{{ chord.name }}</div>
          <div class="chord-variation" v-if="chord.variation">{{ chord.variation }}</div>
        </div>
        <div class="chord-actions">
          <button 
            @click.stop="insertChord(chord)"
            class="action-btn insert-btn"
            title="Insert at cursor"
          >
            ↓
          </button>
          <button 
            @click.stop="editChord(chord)"
            class="action-btn edit-btn"
            title="Edit chord"
            v-if="chord.custom"
          >
            ✎
          </button>
          <button 
            @click.stop="deleteChord(chord)"
            class="action-btn delete-btn"
            title="Delete chord"
            v-if="chord.custom"
          >
            ×
          </button>
        </div>
      </div>
    </div>
    
    <!-- Selected Chord Details -->
    <div v-if="selectedChord" class="chord-details">
      <h4>{{ selectedChord.name }} {{ selectedChord.variation || '' }}</h4>
      
      <div class="chord-large-preview">
        <ChordDiagram
          :chord-data="selectedChord"
          :x-offset="0"
          :y-offset="0"
          :num-strings="6"
        />
      </div>
      
      <div class="chord-properties">
        <div class="property-row">
          <span class="property-label">Frets:</span>
          <span class="property-value">{{ getFretsDisplay(selectedChord) }}</span>
        </div>
        <div class="property-row">
          <span class="property-label">Fingers:</span>
          <span class="property-value">{{ getFingersDisplay(selectedChord) }}</span>
        </div>
        <div class="property-row">
          <span class="property-label">Root:</span>
          <span class="property-value">{{ selectedChord.root || 'N/A' }}</span>
        </div>
        <div class="property-row">
          <span class="property-label">Type:</span>
          <span class="property-value">{{ selectedChord.type || 'N/A' }}</span>
        </div>
      </div>
      
      <div class="chord-actions-panel">
        <button @click="insertChord(selectedChord)" class="primary-btn">
          Insert Chord
        </button>
        <button @click="duplicateChord(selectedChord)" class="secondary-btn">
          Duplicate
        </button>
        <button 
          @click="editChord(selectedChord)" 
          class="secondary-btn"
          v-if="selectedChord.custom"
        >
          Edit
        </button>
      </div>
    </div>
    
    <!-- Custom Chord Editor Modal -->
    <div v-if="showChordEditor" class="chord-editor-modal" @click="closeChordEditor">
      <div class="chord-editor" @click.stop>
        <div class="editor-header">
          <h3>{{ editingChord ? 'Edit' : 'Create' }} Chord</h3>
          <button @click="closeChordEditor" class="close-btn">×</button>
        </div>
        
        <div class="editor-content">
          <div class="editor-controls">
            <div class="control-group">
              <label>Chord Name:</label>
              <input v-model="chordForm.name" placeholder="e.g., C, Am, G7" />
            </div>
            
            <div class="control-group">
              <label>Variation:</label>
              <input v-model="chordForm.variation" placeholder="e.g., open, barre, alt" />
            </div>
            
            <div class="control-group">
              <label>Root Note:</label>
              <select v-model="chordForm.root">
                <option value="">Select root</option>
                <option v-for="note in notes" :key="note" :value="note">{{ note }}</option>
              </select>
            </div>
            
            <div class="control-group">
              <label>Chord Type:</label>
              <select v-model="chordForm.type">
                <option value="">Select type</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
                <option value="7th">7th</option>
                <option value="minor7">Minor 7th</option>
                <option value="major7">Major 7th</option>
                <option value="sus2">Sus2</option>
                <option value="sus4">Sus4</option>
                <option value="dim">Diminished</option>
                <option value="aug">Augmented</option>
              </select>
            </div>
          </div>
          
          <div class="fret-editor">
            <h4>Fret Positions</h4>
            <div class="fret-controls">
              <div 
                v-for="(fret, stringIndex) in chordForm.frets"
                :key="stringIndex"
                class="string-control"
              >
                <label>String {{ stringIndex + 1 }}:</label>
                <input 
                  type="number" 
                  min="-1" 
                  max="12" 
                  v-model.number="chordForm.frets[stringIndex]"
                  placeholder="-1=muted, 0=open"
                />
                <input 
                  type="number" 
                  min="0" 
                  max="4" 
                  v-model.number="chordForm.fingers[stringIndex]"
                  placeholder="finger (0=none)"
                />
              </div>
            </div>
          </div>
          
          <div class="chord-preview-editor">
            <h4>Preview</h4>
            <ChordDiagram
              :chord-data="chordForm"
              :x-offset="0"
              :y-offset="0"
              :num-strings="6"
            />
          </div>
        </div>
        
        <div class="editor-actions">
          <button @click="saveChord" class="primary-btn">Save</button>
          <button @click="closeChordEditor" class="secondary-btn">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import ChordDiagram from './ChordDiagram.vue'

// Props
interface Props {
  visible: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits([
  'insertChord',
  'close'
])

// State
const searchTerm = ref('')
const selectedCategory = ref('all')
const selectedChord = ref<any>(null)
const showChordEditor = ref(false)
const editingChord = ref<any>(null)

const chordForm = reactive({
  name: '',
  variation: '',
  root: '',
  type: '',
  frets: [0, 0, 0, 0, 0, 0],
  fingers: [0, 0, 0, 0, 0, 0],
  custom: true
})

// Data
const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const categories = [
  { id: 'all', name: 'All' },
  { id: 'major', name: 'Major' },
  { id: 'minor', name: 'Minor' },
  { id: '7th', name: '7th' },
  { id: 'sus', name: 'Sus' },
  { id: 'custom', name: 'Custom' }
]

// Predefined chord library
const predefinedChords = [
  // Major chords
  { id: 'c-major', name: 'C', type: 'major', root: 'C', frets: [0, 1, 0, 2, 3, 0], fingers: [0, 1, 0, 2, 3, 0] },
  { id: 'g-major', name: 'G', type: 'major', root: 'G', frets: [3, 2, 0, 0, 3, 3], fingers: [3, 2, 0, 0, 4, 4] },
  { id: 'd-major', name: 'D', type: 'major', root: 'D', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  { id: 'a-major', name: 'A', type: 'major', root: 'A', frets: [0, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  { id: 'e-major', name: 'E', type: 'major', root: 'E', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  
  // Minor chords
  { id: 'am-minor', name: 'Am', type: 'minor', root: 'A', frets: [0, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  { id: 'em-minor', name: 'Em', type: 'minor', root: 'E', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  { id: 'dm-minor', name: 'Dm', type: 'minor', root: 'D', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  
  // 7th chords
  { id: 'g7-seventh', name: 'G7', type: '7th', root: 'G', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  { id: 'd7-seventh', name: 'D7', type: '7th', root: 'D', frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 3, 1, 2] },
  { id: 'c7-seventh', name: 'C7', type: '7th', root: 'C', frets: [0, 1, 0, 2, 1, 0], fingers: [0, 1, 0, 3, 2, 0] }
]

const customChords = ref<any[]>([])

// Computed
const allChords = computed(() => [...predefinedChords, ...customChords.value])

const filteredChords = computed(() => {
  let chords = allChords.value
  
  // Filter by category
  if (selectedCategory.value !== 'all') {
    if (selectedCategory.value === 'custom') {
      chords = chords.filter(chord => chord.custom)
    } else {
      chords = chords.filter(chord => chord.type === selectedCategory.value)
    }
  }
  
  // Filter by search term
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase()
    chords = chords.filter(chord => 
      chord.name.toLowerCase().includes(term) ||
      (chord.variation && chord.variation.toLowerCase().includes(term)) ||
      (chord.root && chord.root.toLowerCase().includes(term))
    )
  }
  
  return chords
})

// Methods
function selectChord(chord: any) {
  selectedChord.value = chord
}

function insertChord(chord: any) {
  emit('insertChord', chord)
}

function addCustomChord() {
  resetChordForm()
  editingChord.value = null
  showChordEditor.value = true
}

function editChord(chord: any) {
  editingChord.value = chord
  Object.assign(chordForm, {
    ...chord,
    frets: [...chord.frets],
    fingers: [...chord.fingers]
  })
  showChordEditor.value = true
}

function duplicateChord(chord: any) {
  const duplicate = {
    ...chord,
    id: `${chord.id}-copy-${Date.now()}`,
    name: `${chord.name} Copy`,
    custom: true,
    frets: [...chord.frets],
    fingers: [...chord.fingers]
  }
  customChords.value.push(duplicate)
  selectedChord.value = duplicate
}

function deleteChord(chord: any) {
  if (chord.custom && confirm(`Delete chord "${chord.name}"?`)) {
    const index = customChords.value.findIndex(c => c.id === chord.id)
    if (index > -1) {
      customChords.value.splice(index, 1)
      if (selectedChord.value?.id === chord.id) {
        selectedChord.value = null
      }
    }
  }
}

function saveChord() {
  if (!chordForm.name) {
    alert('Chord name is required')
    return
  }
  
  const chordData = {
    ...chordForm,
    id: editingChord.value?.id || `custom-${Date.now()}`,
    frets: [...chordForm.frets],
    fingers: [...chordForm.fingers]
  }
  
  if (editingChord.value) {
    // Update existing chord
    const index = customChords.value.findIndex(c => c.id === editingChord.value.id)
    if (index > -1) {
      customChords.value[index] = chordData
    }
  } else {
    // Add new chord
    customChords.value.push(chordData)
  }
  
  selectedChord.value = chordData
  closeChordEditor()
}

function closeChordEditor() {
  showChordEditor.value = false
  editingChord.value = null
  resetChordForm()
}

function resetChordForm() {
  Object.assign(chordForm, {
    name: '',
    variation: '',
    root: '',
    type: '',
    frets: [0, 0, 0, 0, 0, 0],
    fingers: [0, 0, 0, 0, 0, 0],
    custom: true
  })
}

function getFretsDisplay(chord: any): string {
  return chord.frets.map((fret: number) => {
    if (fret === -1) return 'x'
    return fret.toString()
  }).join(' ')
}

function getFingersDisplay(chord: any): string {
  return chord.fingers.map((finger: number) => {
    if (finger === 0) return '-'
    return finger.toString()
  }).join(' ')
}
</script>

<style scoped>
.chord-library {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  max-height: 700px;
  overflow-y: auto;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.library-header h3 {
  margin: 0;
  color: #333;
}

.header-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-input {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  width: 150px;
}

.add-chord-btn {
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.chord-categories {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.category-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-btn:hover {
  background: #f5f5f5;
}

.category-btn.active {
  background: #4A90E2;
  color: white;
  border-color: #4A90E2;
}

.chord-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  margin-bottom: 20px;
}

.chord-item {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
  position: relative;
}

.chord-item:hover {
  border-color: #4A90E2;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chord-item.selected {
  border-color: #4A90E2;
  background: #f0f7ff;
}

.chord-preview {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}

.chord-info {
  text-align: center;
}

.chord-name {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.chord-variation {
  font-size: 10px;
  color: #666;
}

.chord-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.chord-item:hover .chord-actions {
  opacity: 1;
}

.action-btn {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.insert-btn {
  background: #28a745;
  color: white;
}

.edit-btn {
  background: #ffc107;
  color: #333;
}

.delete-btn {
  background: #dc3545;
  color: white;
}

.chord-details {
  border-top: 1px solid #eee;
  padding-top: 16px;
}

.chord-details h4 {
  margin: 0 0 12px 0;
  color: #333;
  text-align: center;
}

.chord-large-preview {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.chord-properties {
  margin-bottom: 16px;
}

.property-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
}

.property-label {
  font-weight: 600;
  color: #555;
}

.property-value {
  color: #333;
}

.chord-actions-panel {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.primary-btn {
  background: #4A90E2;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 12px;
}

.secondary-btn {
  background: white;
  color: #4A90E2;
  border: 1px solid #4A90E2;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 12px;
}

.chord-editor-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.chord-editor {
  background: white;
  border-radius: 8px;
  padding: 20px;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  width: 90%;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
}

.editor-content {
  margin-bottom: 20px;
}

.control-group {
  margin-bottom: 16px;
}

.control-group label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #555;
  margin-bottom: 4px;
}

.control-group input,
.control-group select {
  width: 100%;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.fret-editor {
  margin: 20px 0;
}

.fret-controls {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.string-control {
  display: grid;
  grid-template-columns: 80px 1fr 1fr;
  gap: 8px;
  align-items: center;
}

.string-control label {
  font-size: 11px;
  font-weight: 600;
}

.string-control input {
  padding: 4px 8px;
  font-size: 11px;
}

.chord-preview-editor {
  text-align: center;
  margin: 20px 0;
}

.editor-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style> 