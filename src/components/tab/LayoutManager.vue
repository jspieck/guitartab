<template>
  <div class="layout-manager">
    <div class="layout-header">
      <h3>Workspace Layout</h3>
      <div class="layout-controls">
        <button @click="resetLayout" class="layout-btn">
          🔄 Reset
        </button>
        <button @click="saveLayout" class="layout-btn">
          💾 Save
        </button>
        <button @click="loadLayout" class="layout-btn">
          📁 Load
        </button>
        <select v-model="selectedPreset" @change="applyPreset" class="preset-select">
          <option value="">Custom Layout</option>
          <option v-for="preset in layoutPresets" :key="preset.id" :value="preset.id">
            {{ preset.name }}
          </option>
        </select>
      </div>
    </div>
    
    <!-- Layout Grid -->
    <div class="layout-grid" :style="gridStyles">
      <!-- Panel Areas -->
      <div 
        v-for="panel in panels"
        :key="panel.id"
        class="layout-panel"
        :class="{ 
          active: panel.visible,
          docked: panel.docked,
          floating: panel.floating,
          minimized: panel.minimized
        }"
        :style="getPanelStyles(panel)"
        @mousedown="startDrag(panel, $event)"
      >
        <div class="panel-header">
          <div class="panel-title">
            <span class="panel-icon">{{ panel.icon }}</span>
            {{ panel.title }}
          </div>
          <div class="panel-controls">
            <button 
              @click="togglePanel(panel.id)"
              class="panel-control-btn"
              :title="panel.visible ? 'Hide' : 'Show'"
            >
              {{ panel.visible ? '👁️' : '👁️‍🗨️' }}
            </button>
            <button 
              @click="minimizePanel(panel.id)"
              class="panel-control-btn"
              title="Minimize"
              v-if="panel.visible"
            >
              🗕
            </button>
            <button 
              @click="toggleDock(panel.id)"
              class="panel-control-btn"
              :title="panel.docked ? 'Float' : 'Dock'"
            >
              {{ panel.docked ? '📌' : '🔓' }}
            </button>
            <button 
              @click="closePanel(panel.id)"
              class="panel-control-btn close-btn"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
        
        <div class="panel-content" v-if="panel.visible && !panel.minimized">
          <component 
            :is="panel.component"
            v-bind="panel.props"
            @panel-event="handlePanelEvent"
          />
        </div>
        
        <!-- Resize Handles -->
        <div 
          v-if="panel.resizable && panel.visible"
          class="resize-handles"
        >
          <div class="resize-handle resize-n" @mousedown="startResize(panel, 'n', $event)"></div>
          <div class="resize-handle resize-s" @mousedown="startResize(panel, 's', $event)"></div>
          <div class="resize-handle resize-e" @mousedown="startResize(panel, 'e', $event)"></div>
          <div class="resize-handle resize-w" @mousedown="startResize(panel, 'w', $event)"></div>
          <div class="resize-handle resize-ne" @mousedown="startResize(panel, 'ne', $event)"></div>
          <div class="resize-handle resize-nw" @mousedown="startResize(panel, 'nw', $event)"></div>
          <div class="resize-handle resize-se" @mousedown="startResize(panel, 'se', $event)"></div>
          <div class="resize-handle resize-sw" @mousedown="startResize(panel, 'sw', $event)"></div>
        </div>
      </div>
    </div>
    
    <!-- Panel Tabs for Minimized Panels -->
    <div class="minimized-tabs" v-if="minimizedPanels.length > 0">
      <button 
        v-for="panel in minimizedPanels"
        :key="`tab-${panel.id}`"
        @click="restorePanel(panel.id)"
        class="minimized-tab"
      >
        <span class="tab-icon">{{ panel.icon }}</span>
        {{ panel.title }}
      </button>
    </div>
    
    <!-- Add Panel Menu -->
    <div class="add-panel-menu" v-if="showAddMenu">
      <h4>Add Panel</h4>
      <div class="available-panels">
        <button 
          v-for="availablePanel in availablePanels"
          :key="availablePanel.id"
          @click="addPanel(availablePanel)"
          class="add-panel-btn"
        >
          <span class="panel-icon">{{ availablePanel.icon }}</span>
          {{ availablePanel.name }}
        </button>
      </div>
    </div>
    
    <!-- Layout Save/Load Dialog -->
    <div v-if="showLayoutDialog" class="layout-dialog-overlay" @click="closeLayoutDialog">
      <div class="layout-dialog" @click.stop>
        <div class="dialog-header">
          <h3>{{ layoutDialogMode === 'save' ? 'Save Layout' : 'Load Layout' }}</h3>
          <button @click="closeLayoutDialog" class="close-btn">×</button>
        </div>
        
        <div class="dialog-content">
          <div v-if="layoutDialogMode === 'save'" class="save-layout">
            <label>Layout Name:</label>
            <input v-model="newLayoutName" placeholder="Enter layout name" />
            <label>Description:</label>
            <textarea v-model="newLayoutDescription" placeholder="Optional description"></textarea>
          </div>
          
          <div v-if="layoutDialogMode === 'load'" class="load-layout">
            <div class="saved-layouts">
              <div 
                v-for="layout in savedLayouts"
                :key="layout.id"
                class="saved-layout-item"
                @click="selectSavedLayout(layout)"
                :class="{ selected: selectedSavedLayout?.id === layout.id }"
              >
                <div class="layout-preview">
                  <div class="preview-thumbnail">
                    <!-- Simple visual representation -->
                    <div 
                      v-for="panel in layout.panels"
                      :key="panel.id"
                      class="preview-panel"
                      :style="getPreviewPanelStyle(panel)"
                    ></div>
                  </div>
                </div>
                <div class="layout-info">
                  <div class="layout-name">{{ layout.name }}</div>
                  <div class="layout-description">{{ layout.description }}</div>
                  <div class="layout-date">{{ formatDate(layout.created) }}</div>
                </div>
                <button 
                  @click.stop="deleteSavedLayout(layout.id)"
                  class="delete-layout-btn"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="dialog-actions">
          <button 
            v-if="layoutDialogMode === 'save'"
            @click="confirmSaveLayout"
            class="primary-btn"
            :disabled="!newLayoutName"
          >
            Save Layout
          </button>
          <button 
            v-if="layoutDialogMode === 'load'"
            @click="confirmLoadLayout"
            class="primary-btn"
            :disabled="!selectedSavedLayout"
          >
            Load Layout
          </button>
          <button @click="closeLayoutDialog" class="secondary-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'

// Panel interface
interface Panel {
  id: string
  title: string
  icon: string
  component: string
  props: any
  visible: boolean
  docked: boolean
  floating: boolean
  minimized: boolean
  resizable: boolean
  position: {
    x: number
    y: number
    width: number
    height: number
  }
  gridArea?: string
  zIndex: number
}

// Props
interface Props {
  initialLayout?: string
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits([
  'layoutChanged',
  'panelAdded',
  'panelRemoved',
  'panelEvent'
])

// State
const panels = ref<Panel[]>([])
const selectedPreset = ref('')
const showAddMenu = ref(false)
const showLayoutDialog = ref(false)
const layoutDialogMode = ref<'save' | 'load'>('save')
const newLayoutName = ref('')
const newLayoutDescription = ref('')
const selectedSavedLayout = ref<any>(null)
const dragState = reactive({
  dragging: false,
  panel: null as Panel | null,
  startX: 0,
  startY: 0,
  startPanelX: 0,
  startPanelY: 0
})
const resizeState = reactive({
  resizing: false,
  panel: null as Panel | null,
  direction: '',
  startX: 0,
  startY: 0,
  startWidth: 0,
  startHeight: 0
})

// Layout presets
const layoutPresets = [
  {
    id: 'default',
    name: 'Default',
    description: 'Standard layout with track selector, tab view, and toolbar',
    panels: [
      { id: 'track-selector', gridArea: '1 / 1 / 3 / 2' },
      { id: 'tab-view', gridArea: '1 / 2 / 2 / 4' },
      { id: 'toolbar', gridArea: '2 / 2 / 3 / 3' },
      { id: 'properties', gridArea: '2 / 3 / 3 / 4' }
    ]
  },
  {
    id: 'composer',
    name: 'Composer',
    description: 'Layout optimized for composition work',
    panels: [
      { id: 'tab-view', gridArea: '1 / 1 / 2 / 3' },
      { id: 'chord-library', gridArea: '1 / 3 / 2 / 4' },
      { id: 'track-selector', gridArea: '2 / 1 / 3 / 2' },
      { id: 'playback-controls', gridArea: '2 / 2 / 3 / 4' }
    ]
  },
  {
    id: 'learning',
    name: 'Learning',
    description: 'Layout for learning and practice',
    panels: [
      { id: 'tab-view', gridArea: '1 / 1 / 2 / 3' },
      { id: 'chord-library', gridArea: '1 / 3 / 3 / 4' },
      { id: 'playback-controls', gridArea: '2 / 1 / 3 / 2' },
      { id: 'metronome', gridArea: '2 / 2 / 3 / 3' }
    ]
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, distraction-free layout',
    panels: [
      { id: 'tab-view', gridArea: '1 / 1 / 2 / 2' }
    ]
  }
]

// Available panels that can be added
const availablePanels = [
  { id: 'track-selector', name: 'Track Selector', icon: '🎸', component: 'TabTrackSelector' },
  { id: 'tab-view', name: 'Tab View', icon: '🎼', component: 'GuitarTabView' },
  { id: 'toolbar', name: 'Toolbar', icon: '🔧', component: 'TabToolbar' },
  { id: 'chord-library', name: 'Chord Library', icon: '📚', component: 'ChordLibrary' },
  { id: 'playback-controls', name: 'Playback', icon: '▶️', component: 'PlaybackControls' },
  { id: 'properties', name: 'Properties', icon: '⚙️', component: 'PropertiesPanel' },
  { id: 'effects', name: 'Effects', icon: '🎛️', component: 'EffectsPanel' },
  { id: 'mixer', name: 'Mixer', icon: '🎚️', component: 'MixerPanel' },
  { id: 'browser', name: 'File Browser', icon: '📁', component: 'FileBrowser' },
  { id: 'inspector', name: 'Inspector', icon: '🔍', component: 'Inspector' }
]

const savedLayouts = ref<any[]>([])

// Computed
const minimizedPanels = computed(() => 
  panels.value.filter(panel => panel.minimized)
)

const gridStyles = computed(() => ({
  gridTemplateColumns: 'repeat(4, 1fr)',
  gridTemplateRows: 'repeat(3, 1fr)',
  gap: '8px'
}))

// Methods
function getPanelStyles(panel: Panel) {
  const styles: any = {
    zIndex: panel.zIndex
  }
  
  if (panel.docked && panel.gridArea) {
    styles.gridArea = panel.gridArea
  } else if (panel.floating) {
    styles.position = 'absolute'
    styles.left = panel.position.x + 'px'
    styles.top = panel.position.y + 'px'
    styles.width = panel.position.width + 'px'
    styles.height = panel.position.height + 'px'
  }
  
  return styles
}

function togglePanel(panelId: string) {
  const panel = panels.value.find(p => p.id === panelId)
  if (panel) {
    panel.visible = !panel.visible
    emitLayoutChanged()
  }
}

function minimizePanel(panelId: string) {
  const panel = panels.value.find(p => p.id === panelId)
  if (panel) {
    panel.minimized = true
    emitLayoutChanged()
  }
}

function restorePanel(panelId: string) {
  const panel = panels.value.find(p => p.id === panelId)
  if (panel) {
    panel.minimized = false
    emitLayoutChanged()
  }
}

function toggleDock(panelId: string) {
  const panel = panels.value.find(p => p.id === panelId)
  if (panel) {
    panel.docked = !panel.docked
    panel.floating = !panel.docked
    emitLayoutChanged()
  }
}

function closePanel(panelId: string) {
  const index = panels.value.findIndex(p => p.id === panelId)
  if (index > -1) {
    panels.value.splice(index, 1)
    emit('panelRemoved', panelId)
    emitLayoutChanged()
  }
}

function addPanel(panelConfig: any) {
  const newPanel: Panel = {
    id: panelConfig.id + '-' + Date.now(),
    title: panelConfig.name,
    icon: panelConfig.icon,
    component: panelConfig.component,
    props: {},
    visible: true,
    docked: false,
    floating: true,
    minimized: false,
    resizable: true,
    position: {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 400,
      height: 300
    },
    zIndex: getMaxZIndex() + 1
  }
  
  panels.value.push(newPanel)
  emit('panelAdded', newPanel)
  emitLayoutChanged()
  showAddMenu.value = false
}

function getMaxZIndex(): number {
  return Math.max(...panels.value.map(p => p.zIndex), 0)
}

function startDrag(panel: Panel, event: MouseEvent) {
  if (!panel.floating) return
  
  dragState.dragging = true
  dragState.panel = panel
  dragState.startX = event.clientX
  dragState.startY = event.clientY
  dragState.startPanelX = panel.position.x
  dragState.startPanelY = panel.position.y
  
  // Bring to front
  panel.zIndex = getMaxZIndex() + 1
  
  event.preventDefault()
}

function startResize(panel: Panel, direction: string, event: MouseEvent) {
  resizeState.resizing = true
  resizeState.panel = panel
  resizeState.direction = direction
  resizeState.startX = event.clientX
  resizeState.startY = event.clientY
  resizeState.startWidth = panel.position.width
  resizeState.startHeight = panel.position.height
  
  event.preventDefault()
  event.stopPropagation()
}

function handleMouseMove(event: MouseEvent) {
  if (dragState.dragging && dragState.panel) {
    const deltaX = event.clientX - dragState.startX
    const deltaY = event.clientY - dragState.startY
    
    dragState.panel.position.x = dragState.startPanelX + deltaX
    dragState.panel.position.y = dragState.startPanelY + deltaY
  }
  
  if (resizeState.resizing && resizeState.panel) {
    const deltaX = event.clientX - resizeState.startX
    const deltaY = event.clientY - resizeState.startY
    
    const panel = resizeState.panel
    const direction = resizeState.direction
    
    if (direction.includes('e')) {
      panel.position.width = Math.max(200, resizeState.startWidth + deltaX)
    }
    if (direction.includes('w')) {
      const newWidth = Math.max(200, resizeState.startWidth - deltaX)
      const widthDiff = panel.position.width - newWidth
      panel.position.width = newWidth
      panel.position.x += widthDiff
    }
    if (direction.includes('s')) {
      panel.position.height = Math.max(150, resizeState.startHeight + deltaY)
    }
    if (direction.includes('n')) {
      const newHeight = Math.max(150, resizeState.startHeight - deltaY)
      const heightDiff = panel.position.height - newHeight
      panel.position.height = newHeight
      panel.position.y += heightDiff
    }
  }
}

function handleMouseUp() {
  if (dragState.dragging || resizeState.resizing) {
    emitLayoutChanged()
  }
  
  dragState.dragging = false
  dragState.panel = null
  resizeState.resizing = false
  resizeState.panel = null
}

function applyPreset() {
  const preset = layoutPresets.find(p => p.id === selectedPreset.value)
  if (!preset) return
  
  // Reset panels to preset configuration
  // This is a simplified implementation
  panels.value.forEach(panel => {
    const presetPanel = preset.panels.find(p => p.id === panel.id)
    if (presetPanel) {
      panel.gridArea = presetPanel.gridArea
      panel.docked = true
      panel.floating = false
      panel.visible = true
    }
  })
  
  emitLayoutChanged()
}

function resetLayout() {
  selectedPreset.value = 'default'
  applyPreset()
}

function saveLayout() {
  layoutDialogMode.value = 'save'
  showLayoutDialog.value = true
  newLayoutName.value = ''
  newLayoutDescription.value = ''
}

function loadLayout() {
  layoutDialogMode.value = 'load'
  showLayoutDialog.value = true
  selectedSavedLayout.value = null
}

function closeLayoutDialog() {
  showLayoutDialog.value = false
}

function confirmSaveLayout() {
  const layoutData = {
    id: Date.now().toString(),
    name: newLayoutName.value,
    description: newLayoutDescription.value,
    created: new Date(),
    panels: panels.value.map(p => ({ ...p }))
  }
  
  savedLayouts.value.push(layoutData)
  localStorage.setItem('guitarTabLayouts', JSON.stringify(savedLayouts.value))
  
  closeLayoutDialog()
}

function confirmLoadLayout() {
  if (!selectedSavedLayout.value) return
  
  panels.value = selectedSavedLayout.value.panels.map((p: Panel) => ({ ...p }))
  emitLayoutChanged()
  closeLayoutDialog()
}

function selectSavedLayout(layout: any) {
  selectedSavedLayout.value = layout
}

function deleteSavedLayout(layoutId: string) {
  const index = savedLayouts.value.findIndex(l => l.id === layoutId)
  if (index > -1) {
    savedLayouts.value.splice(index, 1)
    localStorage.setItem('guitarTabLayouts', JSON.stringify(savedLayouts.value))
  }
}

function getPreviewPanelStyle(panel: Panel) {
  return {
    gridArea: panel.gridArea,
    backgroundColor: '#4A90E2',
    border: '1px solid #ddd',
    borderRadius: '2px'
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat().format(new Date(date))
}

function handlePanelEvent(event: any) {
  emit('panelEvent', event)
}

function emitLayoutChanged() {
  emit('layoutChanged', {
    panels: panels.value,
    preset: selectedPreset.value
  })
}

// Lifecycle
onMounted(() => {
  // Load saved layouts
  const saved = localStorage.getItem('guitarTabLayouts')
  if (saved) {
    savedLayouts.value = JSON.parse(saved)
  }
  
  // Initialize default layout
  if (props.initialLayout) {
    selectedPreset.value = props.initialLayout
    applyPreset()
  }
  
  // Event listeners
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<style scoped>
.layout-manager {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.layout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #ddd;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.layout-header h3 {
  margin: 0;
  color: #333;
}

.layout-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.layout-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.layout-btn:hover {
  background: #f5f5f5;
  border-color: #4A90E2;
}

.preset-select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background: white;
}

.layout-grid {
  flex: 1;
  display: grid;
  padding: 16px;
  position: relative;
  overflow: hidden;
}

.layout-panel {
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  min-height: 150px;
}

.layout-panel.floating {
  position: absolute;
  z-index: 100;
}

.layout-panel.minimized {
  display: none;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  cursor: move;
  user-select: none;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #333;
}

.panel-icon {
  font-size: 14px;
}

.panel-controls {
  display: flex;
  gap: 4px;
}

.panel-control-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.panel-control-btn:hover {
  background: #e9ecef;
}

.close-btn:hover {
  background: #dc3545;
  color: white;
}

.panel-content {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.resize-handles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.resize-handle {
  position: absolute;
  pointer-events: all;
  background: transparent;
}

.resize-n, .resize-s {
  height: 4px;
  left: 0;
  right: 0;
  cursor: ns-resize;
}

.resize-e, .resize-w {
  width: 4px;
  top: 0;
  bottom: 0;
  cursor: ew-resize;
}

.resize-n { top: -2px; }
.resize-s { bottom: -2px; }
.resize-e { right: -2px; }
.resize-w { left: -2px; }

.resize-ne, .resize-nw, .resize-se, .resize-sw {
  width: 8px;
  height: 8px;
}

.resize-ne { top: -4px; right: -4px; cursor: ne-resize; }
.resize-nw { top: -4px; left: -4px; cursor: nw-resize; }
.resize-se { bottom: -4px; right: -4px; cursor: se-resize; }
.resize-sw { bottom: -4px; left: -4px; cursor: sw-resize; }

.minimized-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  background: #f8f9fa;
  border-top: 1px solid #ddd;
}

.minimized-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.minimized-tab:hover {
  background: #e9ecef;
  border-color: #4A90E2;
}

.layout-dialog-overlay {
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

.layout-dialog {
  background: white;
  border-radius: 8px;
  padding: 20px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  width: 90%;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.dialog-content {
  margin-bottom: 20px;
}

.save-layout label,
.load-layout label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}

.save-layout input,
.save-layout textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 16px;
}

.saved-layouts {
  display: grid;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.saved-layout-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.saved-layout-item:hover {
  border-color: #4A90E2;
}

.saved-layout-item.selected {
  border-color: #4A90E2;
  background: #f0f7ff;
}

.layout-preview {
  width: 80px;
  height: 60px;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.preview-thumbnail {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 1px;
  background: #f5f5f5;
}

.preview-panel {
  background: #4A90E2;
}

.layout-info {
  flex: 1;
}

.layout-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.layout-description {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.layout-date {
  font-size: 11px;
  color: #999;
}

.delete-layout-btn {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
}

.delete-layout-btn:hover {
  background: #f8d7da;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
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

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
</style> 