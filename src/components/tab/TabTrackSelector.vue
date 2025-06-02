<template>
  <div class="track-selector">
    <div class="track-header">
      <h3>Tracks</h3>
      <button @click="addTrack" class="add-track-btn">
        <span>+</span> Add Track
      </button>
    </div>
    
    <div class="track-list">
      <div 
        v-for="track in tracks" 
        :key="track.id"
        class="track-item"
        :class="{ 
          active: track.id === selectedTrackId,
          muted: track.muted,
          solo: track.solo
        }"
        @click="selectTrack(track.id)"
      >
        <div class="track-info">
          <div class="track-name">
            <input 
              v-if="editingTrack === track.id"
              v-model="track.name"
              @blur="stopEditing"
              @keydown.enter="stopEditing"
              @keydown.escape="cancelEditing"
              class="track-name-input"
              ref="trackNameInput"
            />
            <span 
              v-else
              @dblclick="startEditing(track.id)"
              class="track-name-text"
            >
              {{ track.name }}
            </span>
          </div>
          
          <div class="track-details">
            <span class="track-instrument">{{ getInstrumentName(track.instrument) }}</span>
            <span class="track-tuning">{{ getTuningDisplay(track.tuning) }}</span>
          </div>
        </div>
        
        <div class="track-controls">
          <button 
            @click.stop="toggleMute(track.id)"
            class="control-btn"
            :class="{ active: track.muted }"
            title="Mute"
          >
            M
          </button>
          
          <button 
            @click.stop="toggleSolo(track.id)"
            class="control-btn"
            :class="{ active: track.solo }"
            title="Solo"
          >
            S
          </button>
          
          <div class="volume-control">
            <input 
              type="range" 
              min="0" 
              max="100" 
              v-model="track.volume"
              @input="updateVolume(track.id, $event)"
              class="volume-slider"
              title="Volume"
            />
            <span class="volume-value">{{ track.volume }}</span>
          </div>
          
          <button 
            @click.stop="removeTrack(track.id)"
            class="control-btn delete-btn"
            title="Delete Track"
            v-if="tracks.length > 1"
          >
            ×
          </button>
        </div>
      </div>
    </div>
    
    <!-- Track Properties Panel -->
    <div v-if="selectedTrack" class="track-properties">
      <h4>Track Properties</h4>
      
      <div class="property-group">
        <label>Instrument:</label>
        <select v-model="selectedTrack.instrument" @change="updateTrackInstrument">
          <option value="25">Acoustic Guitar (steel)</option>
          <option value="26">Electric Guitar (jazz)</option>
          <option value="27">Electric Guitar (clean)</option>
          <option value="28">Electric Guitar (muted)</option>
          <option value="29">Overdriven Guitar</option>
          <option value="30">Distortion Guitar</option>
          <option value="31">Guitar harmonics</option>
          <option value="33">Acoustic Bass</option>
          <option value="34">Electric Bass (finger)</option>
          <option value="35">Electric Bass (pick)</option>
        </select>
      </div>
      
      <div class="property-group">
        <label>Tuning:</label>
        <div class="tuning-controls">
          <div 
            v-for="(note, stringIndex) in selectedTrack.tuning" 
            :key="stringIndex"
            class="tuning-string"
          >
            <label>{{ stringIndex + 1 }}:</label>
            <select v-model="selectedTrack.tuning[stringIndex]" @change="updateTuning">
              <option v-for="noteOption in noteOptions" :key="noteOption.value" :value="noteOption.value">
                {{ noteOption.name }}
              </option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="property-group">
        <label>Capo:</label>
        <input 
          type="number" 
          min="0" 
          max="12" 
          v-model.number="selectedTrack.capo"
          @change="updateCapo"
          class="capo-input"
        />
        <span class="capo-label">fret</span>
      </div>
      
      <div class="property-group">
        <label>Number of Strings:</label>
        <select v-model.number="selectedTrack.numStrings" @change="updateStringCount">
          <option :value="4">4 (Bass)</option>
          <option :value="5">5 (Bass)</option>
          <option :value="6">6 (Guitar)</option>
          <option :value="7">7 (Guitar)</option>
          <option :value="8">8 (Guitar)</option>
          <option :value="12">12 (Guitar)</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'

// Props
interface Props {
  tracks: any[]
  selectedTrackId: number
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits([
  'selectTrack',
  'addTrack',
  'removeTrack',
  'updateTrack',
  'toggleMute',
  'toggleSolo',
  'updateVolume'
])

// State
const editingTrack = ref<number | null>(null)
const originalTrackName = ref('')
const trackNameInput = ref<HTMLInputElement>()

// Note options for tuning
const noteOptions = [
  { value: 40, name: 'E2' }, { value: 41, name: 'F2' }, { value: 42, name: 'F#2' },
  { value: 43, name: 'G2' }, { value: 44, name: 'G#2' }, { value: 45, name: 'A2' },
  { value: 46, name: 'A#2' }, { value: 47, name: 'B2' }, { value: 48, name: 'C3' },
  { value: 49, name: 'C#3' }, { value: 50, name: 'D3' }, { value: 51, name: 'D#3' },
  { value: 52, name: 'E3' }, { value: 53, name: 'F3' }, { value: 54, name: 'F#3' },
  { value: 55, name: 'G3' }, { value: 56, name: 'G#3' }, { value: 57, name: 'A3' },
  { value: 58, name: 'A#3' }, { value: 59, name: 'B3' }, { value: 60, name: 'C4' },
  { value: 61, name: 'C#4' }, { value: 62, name: 'D4' }, { value: 63, name: 'D#4' },
  { value: 64, name: 'E4' }, { value: 65, name: 'F4' }, { value: 66, name: 'F#4' },
  { value: 67, name: 'G4' }, { value: 68, name: 'G#4' }, { value: 69, name: 'A4' },
  { value: 70, name: 'A#4' }, { value: 71, name: 'B4' }, { value: 72, name: 'C5' }
]

// Computed
const selectedTrack = computed(() => {
  return props.tracks.find(track => track.id === props.selectedTrackId)
})

// Methods
function selectTrack(trackId: number) {
  emit('selectTrack', trackId)
}

function addTrack() {
  emit('addTrack')
}

function removeTrack(trackId: number) {
  emit('removeTrack', trackId)
}

function toggleMute(trackId: number) {
  emit('toggleMute', trackId)
}

function toggleSolo(trackId: number) {
  emit('toggleSolo', trackId)
}

function updateVolume(trackId: number, event: Event) {
  const volume = parseInt((event.target as HTMLInputElement).value)
  emit('updateVolume', trackId, volume)
}

function startEditing(trackId: number) {
  const track = props.tracks.find(t => t.id === trackId)
  if (track) {
    originalTrackName.value = track.name
    editingTrack.value = trackId
    nextTick(() => {
      trackNameInput.value?.focus()
      trackNameInput.value?.select()
    })
  }
}

function stopEditing() {
  if (editingTrack.value !== null) {
    const track = props.tracks.find(t => t.id === editingTrack.value)
    if (track) {
      emit('updateTrack', editingTrack.value, { name: track.name })
    }
    editingTrack.value = null
  }
}

function cancelEditing() {
  if (editingTrack.value !== null) {
    const track = props.tracks.find(t => t.id === editingTrack.value)
    if (track) {
      track.name = originalTrackName.value
    }
    editingTrack.value = null
  }
}

function updateTrackInstrument() {
  if (selectedTrack.value) {
    emit('updateTrack', selectedTrack.value.id, { 
      instrument: selectedTrack.value.instrument 
    })
  }
}

function updateTuning() {
  if (selectedTrack.value) {
    emit('updateTrack', selectedTrack.value.id, { 
      tuning: selectedTrack.value.tuning 
    })
  }
}

function updateCapo() {
  if (selectedTrack.value) {
    emit('updateTrack', selectedTrack.value.id, { 
      capo: selectedTrack.value.capo 
    })
  }
}

function updateStringCount() {
  if (selectedTrack.value) {
    // Update tuning array to match string count
    const newTuning = [...selectedTrack.value.tuning]
    const targetLength = selectedTrack.value.numStrings
    
    if (targetLength > newTuning.length) {
      // Add strings (default to standard tuning pattern)
      const standardTuning = [64, 59, 55, 50, 45, 40] // E, B, G, D, A, E
      while (newTuning.length < targetLength) {
        const stringIndex = newTuning.length
        newTuning.push(standardTuning[stringIndex] || 40)
      }
    } else if (targetLength < newTuning.length) {
      // Remove strings
      newTuning.splice(targetLength)
    }
    
    emit('updateTrack', selectedTrack.value.id, { 
      numStrings: selectedTrack.value.numStrings,
      tuning: newTuning
    })
  }
}

function getInstrumentName(instrumentId: number): string {
  const instruments: { [key: number]: string } = {
    25: 'Acoustic Guitar',
    26: 'Electric Jazz',
    27: 'Electric Clean',
    28: 'Electric Muted',
    29: 'Overdriven',
    30: 'Distortion',
    31: 'Harmonics',
    33: 'Acoustic Bass',
    34: 'Electric Bass',
    35: 'Bass Pick'
  }
  return instruments[instrumentId] || 'Unknown'
}

function getTuningDisplay(tuning: number[]): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return tuning.map(note => {
    const noteIndex = (note - 12) % 12
    return noteNames[noteIndex]
  }).join('-')
}
</script>

<style scoped>
.track-selector {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 16px;
  max-height: 600px;
  overflow-y: auto;
}

.track-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.track-header h3 {
  margin: 0;
  color: #333;
}

.add-track-btn {
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

.add-track-btn:hover {
  background: #218838;
}

.track-list {
  margin-bottom: 20px;
}

.track-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.track-item:hover {
  border-color: #4A90E2;
}

.track-item.active {
  border-color: #4A90E2;
  background: #f0f7ff;
}

.track-item.muted {
  opacity: 0.6;
}

.track-item.solo {
  border-color: #ffc107;
  background: #fff8e1;
}

.track-info {
  flex: 1;
}

.track-name-text {
  font-weight: 600;
  color: #333;
}

.track-name-input {
  background: transparent;
  border: none;
  font-weight: 600;
  color: #333;
  outline: none;
  width: 100%;
}

.track-details {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

.track-instrument, .track-tuning {
  margin-right: 8px;
}

.track-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.control-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover {
  background: #f5f5f5;
}

.control-btn.active {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

.control-btn.active[title="Solo"] {
  background: #ffc107;
  color: #333;
  border-color: #ffc107;
}

.delete-btn {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 8px;
}

.volume-slider {
  width: 60px;
  height: 20px;
}

.volume-value {
  font-size: 10px;
  color: #666;
  min-width: 20px;
}

.track-properties {
  border-top: 1px solid #dee2e6;
  padding-top: 16px;
}

.track-properties h4 {
  margin: 0 0 12px 0;
  color: #333;
}

.property-group {
  margin-bottom: 12px;
}

.property-group label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #555;
  margin-bottom: 4px;
}

.property-group select,
.property-group input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.tuning-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
}

.tuning-string {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tuning-string label {
  font-size: 10px;
  text-align: center;
}

.tuning-string select {
  font-size: 10px;
  padding: 2px 4px;
}

.capo-input {
  width: 60px !important;
  display: inline-block;
  margin-right: 8px;
}

.capo-label {
  font-size: 12px;
  color: #666;
}
</style> 