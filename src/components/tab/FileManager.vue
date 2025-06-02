<template>
  <div class="file-manager">
    <div class="file-header">
      <h3>File Manager</h3>
      <div class="file-actions">
        <button @click="newFile" class="action-btn new-btn">
          📄 New
        </button>
        <button @click="openFile" class="action-btn open-btn">
          📁 Open
        </button>
        <button @click="saveFile" class="action-btn save-btn" :disabled="!hasUnsavedChanges">
          💾 Save
        </button>
        <button @click="saveAsFile" class="action-btn save-as-btn">
          💾 Save As
        </button>
        <button @click="exportFile" class="action-btn export-btn">
          📤 Export
        </button>
        <button @click="showImportDialog" class="action-btn import-btn">
          📥 Import
        </button>
      </div>
    </div>
    
    <!-- Current File Info -->
    <div class="current-file-info" v-if="currentFile">
      <div class="file-details">
        <div class="file-name">
          {{ currentFile.name }}
          <span v-if="hasUnsavedChanges" class="unsaved-indicator">*</span>
        </div>
        <div class="file-path">{{ currentFile.path || 'Untitled' }}</div>
        <div class="file-metadata">
          <span>Modified: {{ formatDate(currentFile.lastModified) }}</span>
          <span>Size: {{ formatFileSize(currentFile.size) }}</span>
          <span>Format: {{ currentFile.format }}</span>
        </div>
      </div>
      <div class="file-preview">
        <button @click="showFileInfo" class="info-btn">ℹ️</button>
      </div>
    </div>
    
    <!-- Recent Files -->
    <div class="recent-files" v-if="recentFiles.length > 0">
      <h4>Recent Files</h4>
      <div class="recent-list">
        <div 
          v-for="file in recentFiles"
          :key="file.id"
          class="recent-item"
          @click="openRecentFile(file)"
          @contextmenu.prevent="showRecentContextMenu(file, $event)"
        >
          <div class="recent-icon">{{ getFileIcon(file.format) }}</div>
          <div class="recent-info">
            <div class="recent-name">{{ file.name }}</div>
            <div class="recent-path">{{ file.path }}</div>
            <div class="recent-date">{{ file.lastOpened ? formatDate(file.lastOpened) : 'Never opened' }}</div>
          </div>
          <button 
            @click.stop="removeFromRecent(file.id)"
            class="remove-recent-btn"
          >
            ×
          </button>
        </div>
      </div>
    </div>
    
    <!-- Import Dialog -->
    <div v-if="showImport" class="import-dialog-overlay" @click="closeImportDialog">
      <div class="import-dialog" @click.stop>
        <div class="dialog-header">
          <h3>Import File</h3>
          <button @click="closeImportDialog" class="close-btn">×</button>
        </div>
        
        <div class="import-options">
          <div class="import-method">
            <h4>Import Method</h4>
            <div class="method-tabs">
              <button 
                @click="importMethod = 'file'"
                class="method-tab"
                :class="{ active: importMethod === 'file' }"
              >
                📁 From File
              </button>
              <button 
                @click="importMethod = 'url'"
                class="method-tab"
                :class="{ active: importMethod === 'url' }"
              >
                🌐 From URL
              </button>
              <button 
                @click="importMethod = 'text'"
                class="method-tab"
                :class="{ active: importMethod === 'text' }"
              >
                📝 From Text
              </button>
            </div>
          </div>
          
          <div class="import-content">
            <!-- File Import -->
            <div v-if="importMethod === 'file'" class="file-import">
              <div class="file-drop-zone" @drop="handleFileDrop" @dragover.prevent @dragenter.prevent>
                <div class="drop-content">
                  <div class="drop-icon">📁</div>
                  <div class="drop-text">
                    <p>Drop files here or click to browse</p>
                    <p class="drop-hint">Supported: .gp3, .gp4, .gp5, .gpx, .ptb, .mid, .json</p>
                  </div>
                  <button @click="selectFile" class="browse-btn">Browse Files</button>
                </div>
              </div>
              
              <div v-if="selectedFiles.length > 0" class="selected-files">
                <h5>Selected Files:</h5>
                <div 
                  v-for="(file, index) in selectedFiles"
                  :key="index"
                  class="selected-file"
                >
                  <span class="file-icon">{{ getFileIcon(getFileExtension(file.name)) }}</span>
                  <span class="file-name">{{ file.name }}</span>
                  <span class="file-size">{{ formatFileSize(file.size) }}</span>
                  <button @click="removeSelectedFile(index)" class="remove-file-btn">×</button>
                </div>
              </div>
            </div>
            
            <!-- URL Import -->
            <div v-if="importMethod === 'url'" class="url-import">
              <label>File URL:</label>
              <input 
                v-model="importUrl"
                type="url"
                placeholder="https://example.com/song.gp5"
                class="url-input"
              />
              <div class="url-options">
                <label>
                  <input type="checkbox" v-model="followRedirects" />
                  Follow redirects
                </label>
                <label>
                  <input type="checkbox" v-model="validateSSL" />
                  Validate SSL certificate
                </label>
              </div>
            </div>
            
            <!-- Text Import -->
            <div v-if="importMethod === 'text'" class="text-import">
              <label>Paste tab content:</label>
              <textarea 
                v-model="importText"
                placeholder="Paste Guitar Pro, PowerTab, or ASCII tab content here..."
                class="text-input"
                rows="10"
              ></textarea>
              <div class="text-format">
                <label>Format:</label>
                <select v-model="textFormat">
                  <option value="auto">Auto-detect</option>
                  <option value="ascii">ASCII Tab</option>
                  <option value="chord">Chord Chart</option>
                  <option value="json">JSON</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="import-settings">
            <h4>Import Settings</h4>
            <div class="settings-grid">
              <label>
                <input type="checkbox" v-model="mergeWithCurrent" />
                Merge with current tab
              </label>
              <label>
                <input type="checkbox" v-model="preserveFormatting" />
                Preserve original formatting
              </label>
              <label>
                <input type="checkbox" v-model="importEffects" />
                Import effects and techniques
              </label>
              <label>
                <input type="checkbox" v-model="importTempo" />
                Import tempo changes
              </label>
            </div>
          </div>
        </div>
        
        <div class="dialog-actions">
          <button 
            @click="performImport"
            class="primary-btn"
            :disabled="!canImport"
          >
            Import
          </button>
          <button @click="closeImportDialog" class="secondary-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
    
    <!-- Export Dialog -->
    <div v-if="showExport" class="export-dialog-overlay" @click="closeExportDialog">
      <div class="export-dialog" @click.stop>
        <div class="dialog-header">
          <h3>Export File</h3>
          <button @click="closeExportDialog" class="close-btn">×</button>
        </div>
        
        <div class="export-options">
          <div class="export-format">
            <h4>Export Format</h4>
            <div class="format-grid">
              <div 
                v-for="format in exportFormats"
                :key="format.id"
                class="format-option"
                :class="{ selected: exportFormat === format.id }"
                @click="exportFormat = format.id"
              >
                <div class="format-icon">{{ format.icon }}</div>
                <div class="format-info">
                  <div class="format-name">{{ format.name }}</div>
                  <div class="format-desc">{{ format.description }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="export-settings">
            <h4>Export Settings</h4>
            <div class="settings-sections">
              <div class="setting-section">
                <h5>Content</h5>
                <label>
                  <input type="checkbox" v-model="exportSettings.includeTabs" />
                  Include tablature
                </label>
                <label>
                  <input type="checkbox" v-model="exportSettings.includeStandard" />
                  Include standard notation
                </label>
                <label>
                  <input type="checkbox" v-model="exportSettings.includeChords" />
                  Include chord diagrams
                </label>
                <label>
                  <input type="checkbox" v-model="exportSettings.includeLyrics" />
                  Include lyrics
                </label>
              </div>
              
              <div class="setting-section">
                <h5>Quality</h5>
                <label>
                  Quality:
                  <select v-model="exportSettings.quality">
                    <option value="draft">Draft</option>
                    <option value="good">Good</option>
                    <option value="high">High</option>
                    <option value="best">Best</option>
                  </select>
                </label>
                <label v-if="['pdf', 'png', 'svg'].includes(exportFormat)">
                  DPI:
                  <select v-model="exportSettings.dpi">
                    <option value="72">72</option>
                    <option value="150">150</option>
                    <option value="300">300</option>
                    <option value="600">600</option>
                  </select>
                </label>
              </div>
              
              <div class="setting-section">
                <h5>Layout</h5>
                <label>
                  <input type="checkbox" v-model="exportSettings.multiPage" />
                  Multi-page layout
                </label>
                <label>
                  Page size:
                  <select v-model="exportSettings.pageSize">
                    <option value="letter">Letter</option>
                    <option value="a4">A4</option>
                    <option value="legal">Legal</option>
                    <option value="tabloid">Tabloid</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
        
        <div class="dialog-actions">
          <button @click="performExport" class="primary-btn">
            Export
          </button>
          <button @click="closeExportDialog" class="secondary-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
    
    <!-- File Info Dialog -->
    <div v-if="showInfo" class="info-dialog-overlay" @click="closeInfoDialog">
      <div class="info-dialog" @click.stop>
        <div class="dialog-header">
          <h3>File Information</h3>
          <button @click="closeInfoDialog" class="close-btn">×</button>
        </div>
        
        <div class="file-info-content" v-if="currentFile">
          <div class="info-section">
            <h4>File Details</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Name:</span>
                <span class="info-value">{{ currentFile.name }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Path:</span>
                <span class="info-value">{{ currentFile.path || 'Untitled' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Format:</span>
                <span class="info-value">{{ currentFile.format }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Size:</span>
                <span class="info-value">{{ formatFileSize(currentFile.size) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Created:</span>
                <span class="info-value">{{ formatDate(currentFile.created) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Modified:</span>
                <span class="info-value">{{ formatDate(currentFile.lastModified) }}</span>
              </div>
            </div>
          </div>
          
          <div class="info-section">
            <h4>Content Statistics</h4>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-value">{{ currentFile.stats?.tracks || 0 }}</span>
                <span class="stat-label">Tracks</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ currentFile.stats?.measures || 0 }}</span>
                <span class="stat-label">Measures</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ currentFile.stats?.notes || 0 }}</span>
                <span class="stat-label">Notes</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ currentFile.stats?.duration || '0:00' }}</span>
                <span class="stat-label">Duration</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Progress Indicator -->
    <div v-if="isProcessing" class="progress-overlay">
      <div class="progress-content">
        <div class="progress-spinner"></div>
        <div class="progress-text">{{ progressText }}</div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'

// File interface
interface TabFile {
  id: string
  name: string
  path?: string
  format: string
  size: number
  created: Date
  lastModified: Date
  lastOpened?: Date
  content?: any
  stats?: {
    tracks: number
    measures: number
    notes: number
    duration: string
  }
}

// Props
interface Props {
  currentSong?: any
  hasUnsavedChanges?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hasUnsavedChanges: false
})

// Emits
const emit = defineEmits([
  'fileOpened',
  'fileSaved',
  'fileExported',
  'fileImported',
  'newFile'
])

// State
const currentFile = ref<TabFile | null>(null)
const recentFiles = ref<TabFile[]>([])
const showImport = ref(false)
const showExport = ref(false)
const showInfo = ref(false)
const isProcessing = ref(false)
const progressText = ref('')
const progressPercent = ref(0)

// Import state
const importMethod = ref('file')
const selectedFiles = ref<File[]>([])
const importUrl = ref('')
const importText = ref('')
const textFormat = ref('auto')
const followRedirects = ref(true)
const validateSSL = ref(true)
const mergeWithCurrent = ref(false)
const preserveFormatting = ref(true)
const importEffects = ref(true)
const importTempo = ref(true)

// Export state
const exportFormat = ref('gp5')
const exportSettings = reactive({
  includeTabs: true,
  includeStandard: false,
  includeChords: true,
  includeLyrics: false,
  quality: 'high',
  dpi: '300',
  multiPage: true,
  pageSize: 'letter'
})

// Export formats
const exportFormats = [
  { id: 'gp5', name: 'Guitar Pro 5', description: 'Native Guitar Pro format', icon: '🎸' },
  { id: 'gpx', name: 'Guitar Pro 6+', description: 'Modern Guitar Pro format', icon: '🎸' },
  { id: 'midi', name: 'MIDI', description: 'Musical Instrument Digital Interface', icon: '🎵' },
  { id: 'pdf', name: 'PDF', description: 'Portable Document Format', icon: '📄' },
  { id: 'png', name: 'PNG Image', description: 'Portable Network Graphics', icon: '🖼️' },
  { id: 'svg', name: 'SVG', description: 'Scalable Vector Graphics', icon: '🎨' },
  { id: 'ascii', name: 'ASCII Tab', description: 'Plain text tablature', icon: '📝' },
  { id: 'json', name: 'JSON', description: 'JavaScript Object Notation', icon: '💾' }
]

// Computed
const canImport = computed(() => {
  switch (importMethod.value) {
    case 'file':
      return selectedFiles.value.length > 0
    case 'url':
      return importUrl.value.trim() !== ''
    case 'text':
      return importText.value.trim() !== ''
    default:
      return false
  }
})

// Methods
function newFile() {
  if (props.hasUnsavedChanges) {
    if (!confirm('You have unsaved changes. Create new file anyway?')) {
      return
    }
  }
  
  currentFile.value = {
    id: Date.now().toString(),
    name: 'Untitled',
    format: 'internal',
    size: 0,
    created: new Date(),
    lastModified: new Date()
  }
  
  emit('newFile')
}

function openFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.gp3,.gp4,.gp5,.gpx,.ptb,.mid,.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      loadFile(file)
    }
  }
  input.click()
}

function saveFile() {
  if (!currentFile.value) return
  
  if (!currentFile.value.path) {
    saveAsFile()
    return
  }
  
  performSave()
}

function saveAsFile() {
  const filename = prompt('Enter filename:', currentFile.value?.name || 'untitled.gp5')
  if (!filename) return
  
  if (currentFile.value) {
    currentFile.value.name = filename
    currentFile.value.path = filename
  }
  
  performSave()
}

function performSave() {
  if (!currentFile.value) return
  
  isProcessing.value = true
  progressText.value = 'Saving file...'
  progressPercent.value = 0
  
  // Simulate save progress
  const interval = setInterval(() => {
    progressPercent.value += 10
    if (progressPercent.value >= 100) {
      clearInterval(interval)
      isProcessing.value = false
      
      currentFile.value!.lastModified = new Date()
      emit('fileSaved', currentFile.value)
      addToRecentFiles(currentFile.value!)
    }
  }, 100)
}

function exportFile() {
  showExport.value = true
}

function performExport() {
  isProcessing.value = true
  progressText.value = `Exporting as ${exportFormat.value.toUpperCase()}...`
  progressPercent.value = 0
  
  // Simulate export progress
  const interval = setInterval(() => {
    progressPercent.value += 10
    if (progressPercent.value >= 100) {
      clearInterval(interval)
      isProcessing.value = false
      showExport.value = false
      
      // Create download link
      const filename = `${currentFile.value?.name || 'export'}.${exportFormat.value}`
      const blob = new Blob(['Exported content placeholder'], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      
      emit('fileExported', { format: exportFormat.value, settings: exportSettings })
    }
  }, 150)
}

function showImportDialog() {
  showImport.value = true
}

function performImport() {
  isProcessing.value = true
  progressText.value = 'Importing file...'
  progressPercent.value = 0
  
  // Simulate import progress
  const interval = setInterval(() => {
    progressPercent.value += 10
    if (progressPercent.value >= 100) {
      clearInterval(interval)
      isProcessing.value = false
      showImport.value = false
      
      // Create imported file object
      const importedFile: TabFile = {
        id: Date.now().toString(),
        name: selectedFiles.value[0]?.name || 'Imported File',
        format: getFileExtension(selectedFiles.value[0]?.name || ''),
        size: selectedFiles.value[0]?.size || 0,
        created: new Date(),
        lastModified: new Date()
      }
      
      currentFile.value = importedFile
      addToRecentFiles(importedFile)
      emit('fileImported', importedFile)
      
      // Reset import state
      selectedFiles.value = []
      importUrl.value = ''
      importText.value = ''
    }
  }, 120)
}

function loadFile(file: File) {
  isProcessing.value = true
  progressText.value = 'Loading file...'
  progressPercent.value = 0
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const loadedFile: TabFile = {
      id: Date.now().toString(),
      name: file.name,
      path: file.name,
      format: getFileExtension(file.name),
      size: file.size,
      created: new Date(file.lastModified),
      lastModified: new Date(file.lastModified),
      lastOpened: new Date(),
      content: e.target?.result
    }
    
    currentFile.value = loadedFile
    addToRecentFiles(loadedFile)
    emit('fileOpened', loadedFile)
    
    isProcessing.value = false
  }
  
  reader.readAsArrayBuffer(file)
}

function openRecentFile(file: TabFile) {
  if (props.hasUnsavedChanges) {
    if (!confirm('You have unsaved changes. Open file anyway?')) {
      return
    }
  }
  
  currentFile.value = { ...file, lastOpened: new Date() }
  updateRecentFile(file.id)
  emit('fileOpened', currentFile.value)
}

function addToRecentFiles(file: TabFile) {
  const existing = recentFiles.value.findIndex(f => f.path === file.path)
  if (existing > -1) {
    recentFiles.value.splice(existing, 1)
  }
  
  recentFiles.value.unshift(file)
  
  // Keep only 10 recent files
  if (recentFiles.value.length > 10) {
    recentFiles.value = recentFiles.value.slice(0, 10)
  }
  
  saveRecentFiles()
}

function updateRecentFile(fileId: string) {
  const file = recentFiles.value.find(f => f.id === fileId)
  if (file) {
    file.lastOpened = new Date()
    // Move to front
    recentFiles.value = [file, ...recentFiles.value.filter(f => f.id !== fileId)]
    saveRecentFiles()
  }
}

function removeFromRecent(fileId: string) {
  recentFiles.value = recentFiles.value.filter(f => f.id !== fileId)
  saveRecentFiles()
}

function saveRecentFiles() {
  localStorage.setItem('guitarTabRecentFiles', JSON.stringify(recentFiles.value))
}

function loadRecentFiles() {
  const saved = localStorage.getItem('guitarTabRecentFiles')
  if (saved) {
    try {
      recentFiles.value = JSON.parse(saved)
    } catch {
      console.warn('Failed to load recent files')
    }
  }
}

function selectFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = '.gp3,.gp4,.gp5,.gpx,.ptb,.mid,.json'
  input.onchange = (e) => {
    const files = Array.from((e.target as HTMLInputElement).files || [])
    selectedFiles.value = files
  }
  input.click()
}

function handleFileDrop(event: DragEvent) {
  event.preventDefault()
  const files = Array.from(event.dataTransfer?.files || [])
  selectedFiles.value = files
}

function removeSelectedFile(index: number) {
  selectedFiles.value.splice(index, 1)
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

function getFileIcon(format: string): string {
  const icons: { [key: string]: string } = {
    'gp3': '🎸', 'gp4': '🎸', 'gp5': '🎸', 'gpx': '🎸',
    'ptb': '🎼', 'mid': '🎵', 'midi': '🎵',
    'json': '💾', 'pdf': '📄', 'png': '🖼️', 'svg': '🎨',
    'ascii': '📝', 'txt': '📝'
  }
  return icons[format] || '📄'
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat().format(new Date(date))
}

function showFileInfo() {
  showInfo.value = true
}

function closeImportDialog() {
  showImport.value = false
  selectedFiles.value = []
  importUrl.value = ''
  importText.value = ''
}

function closeExportDialog() {
  showExport.value = false
}

function closeInfoDialog() {
  showInfo.value = false
}

function showRecentContextMenu(file: TabFile, event: MouseEvent) {
  // Context menu implementation would go here
  console.log('Context menu for file:', file, event)
}

// Lifecycle
import { onMounted } from 'vue'
onMounted(() => {
  loadRecentFiles()
})
</script>

<style scoped>
.file-manager {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
}

.file-header h3 {
  margin: 0;
  color: #333;
}

.file-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover:not(:disabled) {
  background: #e9ecef;
  border-color: #4A90E2;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.new-btn:hover { border-color: #28a745; }
.open-btn:hover { border-color: #17a2b8; }
.save-btn:hover { border-color: #ffc107; }
.export-btn:hover { border-color: #fd7e14; }
.import-btn:hover { border-color: #6f42c1; }

.current-file-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f0f7ff;
  border-bottom: 1px solid #ddd;
}

.file-details {
  flex: 1;
}

.file-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.unsaved-indicator {
  color: #dc3545;
  font-weight: bold;
}

.file-path {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.file-metadata {
  font-size: 11px;
  color: #999;
  display: flex;
  gap: 12px;
}

.info-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
}

.info-btn:hover {
  background: #e9ecef;
}

.recent-files {
  padding: 16px;
}

.recent-files h4 {
  margin: 0 0 12px 0;
  color: #333;
}

.recent-list {
  display: grid;
  gap: 8px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.recent-item:hover {
  background: #f8f9fa;
  border-color: #4A90E2;
}

.recent-icon {
  font-size: 20px;
}

.recent-info {
  flex: 1;
  min-width: 0;
}

.recent-name {
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-path {
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-date {
  font-size: 11px;
  color: #999;
}

.remove-recent-btn {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.recent-item:hover .remove-recent-btn {
  opacity: 1;
}

.remove-recent-btn:hover {
  background: #f8d7da;
}

/* Dialog Styles */
.import-dialog-overlay,
.export-dialog-overlay,
.info-dialog-overlay {
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

.import-dialog,
.export-dialog,
.info-dialog {
  background: white;
  border-radius: 8px;
  padding: 20px;
  max-width: 700px;
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

.dialog-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
}

.method-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
}

.method-tab {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.method-tab:hover {
  background: #f5f5f5;
}

.method-tab.active {
  background: #4A90E2;
  color: white;
  border-color: #4A90E2;
}

.file-drop-zone {
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  margin-bottom: 16px;
  transition: all 0.2s ease;
}

.file-drop-zone:hover {
  border-color: #4A90E2;
  background: #f0f7ff;
}

.drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.drop-icon {
  font-size: 48px;
  opacity: 0.5;
}

.drop-text p {
  margin: 4px 0;
}

.drop-hint {
  font-size: 12px;
  color: #666;
}

.browse-btn {
  background: #4A90E2;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
}

.selected-files {
  margin-top: 16px;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 8px;
}

.file-icon {
  font-size: 16px;
}

.file-name {
  flex: 1;
  font-size: 14px;
}

.file-size {
  font-size: 12px;
  color: #666;
}

.remove-file-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 3px;
  width: 20px;
  height: 20px;
  font-size: 12px;
  cursor: pointer;
}

.url-input,
.text-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 14px;
}

.text-input {
  font-family: 'Courier New', monospace;
  resize: vertical;
}

.format-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.format-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.format-option:hover {
  border-color: #4A90E2;
}

.format-option.selected {
  border-color: #4A90E2;
  background: #f0f7ff;
}

.format-icon {
  font-size: 24px;
}

.format-info {
  flex: 1;
}

.format-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.format-desc {
  font-size: 12px;
  color: #666;
}

.settings-sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.setting-section h5 {
  margin: 0 0 8px 0;
  color: #333;
}

.setting-section label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
}

.info-grid {
  display: grid;
  gap: 8px;
  margin-bottom: 20px;
}

.info-item {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  align-items: center;
}

.info-label {
  font-weight: 600;
  color: #555;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: #4A90E2;
}

.stat-label {
  font-size: 12px;
  color: #666;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.primary-btn {
  background: #4A90E2;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn {
  background: white;
  color: #4A90E2;
  border: 1px solid #4A90E2;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
}

.progress-overlay {
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

.progress-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  min-width: 300px;
}

.progress-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e9ecef;
  border-top: 4px solid #4A90E2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.progress-text {
  margin-bottom: 16px;
  color: #333;
  font-weight: 500;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4A90E2;
  transition: width 0.3s ease;
}
</style> 