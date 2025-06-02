<template>
  <div class="tab-toolbar" :class="{ visible: isVisible }">
    <div class="toolbar-section">
      <h4>Note Effects</h4>
      <div class="button-group">
        <button @click="applyEffect('vibrato')" :class="{ active: hasEffect('vibrato') }">
          Vibrato
        </button>
        <button @click="applyEffect('bend')" :class="{ active: hasEffect('bend') }">
          Bend
        </button>
        <button @click="applyEffect('slide')" :class="{ active: hasEffect('slide') }">
          Slide
        </button>
        <button @click="applyEffect('ghost')" :class="{ active: hasEffect('ghost') }">
          Ghost
        </button>
        <button @click="applyEffect('hammer')" :class="{ active: hasEffect('hammer') }">
          Hammer
        </button>
        <button @click="applyEffect('pull')" :class="{ active: hasEffect('pull') }">
          Pull-off
        </button>
      </div>
    </div>
    
    <div class="toolbar-section">
      <h4>Note Duration</h4>
      <div class="button-group">
        <button @click="setDuration('whole')" :class="{ active: currentDuration === 'whole' }">
          Whole
        </button>
        <button @click="setDuration('half')" :class="{ active: currentDuration === 'half' }">
          Half
        </button>
        <button @click="setDuration('quarter')" :class="{ active: currentDuration === 'quarter' }">
          Quarter
        </button>
        <button @click="setDuration('eighth')" :class="{ active: currentDuration === 'eighth' }">
          8th
        </button>
        <button @click="setDuration('sixteenth')" :class="{ active: currentDuration === 'sixteenth' }">
          16th
        </button>
      </div>
    </div>
    
    <div class="toolbar-section">
      <h4>Tools</h4>
      <div class="button-group">
        <button @click="clearSelection">
          Clear
        </button>
        <button @click="copySelection">
          Copy
        </button>
        <button @click="pasteSelection">
          Paste
        </button>
        <button @click="deleteSelection">
          Delete
        </button>
      </div>
    </div>
    
    <div class="toolbar-section">
      <h4>Bend Settings</h4>
      <div v-if="showBendControls" class="bend-controls">
        <label>
          Amount:
          <select v-model="bendAmount" @change="updateBendAmount">
            <option value="0.5">1/2 step</option>
            <option value="1">Full step</option>
            <option value="1.5">1.5 steps</option>
            <option value="2">2 steps</option>
          </select>
        </label>
        <label>
          Type:
          <select v-model="bendType" @change="updateBendType">
            <option value="bend">Bend</option>
            <option value="release">Release</option>
            <option value="prebend">Pre-bend</option>
          </select>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

// Props
interface Props {
  selectedNote?: any
  isVisible: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: false
})

// Emits
const emit = defineEmits([
  'applyEffect',
  'setDuration', 
  'clearSelection',
  'copySelection',
  'pasteSelection',
  'deleteSelection'
])

// State
const bendAmount = ref('1')
const bendType = ref('bend')

// Computed
const currentDuration = computed(() => {
  return props.selectedNote?.duration || 'quarter'
})

const showBendControls = computed(() => {
  return hasEffect('bend') || bendType.value !== 'bend'
})

// Methods
function hasEffect(effectName: string): boolean {
  if (!props.selectedNote) return false
  return !!props.selectedNote[effectName]
}

function applyEffect(effectName: string) {
  const currentValue = props.selectedNote?.[effectName]
  const newValue = !currentValue
  
  if (effectName === 'bend') {
    emit('applyEffect', effectName, {
      active: newValue,
      amount: bendAmount.value,
      type: bendType.value
    })
  } else {
    emit('applyEffect', effectName, newValue)
  }
}

function setDuration(duration: string) {
  emit('setDuration', duration)
}

function updateBendAmount() {
  if (hasEffect('bend')) {
    emit('applyEffect', 'bend', {
      active: true,
      amount: bendAmount.value,
      type: bendType.value
    })
  }
}

function updateBendType() {
  if (hasEffect('bend')) {
    emit('applyEffect', 'bend', {
      active: true,
      amount: bendAmount.value,
      type: bendType.value
    })
  }
}

function clearSelection() {
  emit('clearSelection')
}

function copySelection() {
  emit('copySelection')
}

function pasteSelection() {
  emit('pasteSelection')
}

function deleteSelection() {
  emit('deleteSelection')
}

// Watch for changes in selected note
watch(() => props.selectedNote, (newNote) => {
  if (newNote?.bend) {
    bendAmount.value = newNote.bend.amount || '1'
    bendType.value = newNote.bend.type || 'bend'
  }
})
</script>

<style scoped>
.tab-toolbar {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 280px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 16px;
  transform: translateX(100%);
  transition: transform 0.3s ease-in-out;
  z-index: 1000;
  max-height: 80vh;
  overflow-y: auto;
}

.tab-toolbar.visible {
  transform: translateX(0);
}

.toolbar-section {
  margin-bottom: 20px;
}

.toolbar-section:last-child {
  margin-bottom: 0;
}

.toolbar-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.button-group button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button-group button:hover {
  background: #f5f5f5;
  border-color: #bbb;
}

.button-group button.active {
  background: #4A90E2;
  color: white;
  border-color: #4A90E2;
}

.bend-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bend-controls label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.bend-controls select {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}
</style> 