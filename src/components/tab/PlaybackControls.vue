<template>
  <div class="playback-controls">
    <div class="controls-header">
      <h3>Playback</h3>
      <button @click="toggleSettings" class="settings-btn">
        ⚙️
      </button>
    </div>
    
    <!-- Main Transport Controls -->
    <div class="transport-controls">
      <button 
        @click="stop"
        class="transport-btn stop-btn"
        :disabled="!isPlaying && !isPaused"
        title="Stop"
      >
        ⏹️
      </button>
      
      <button 
        @click="togglePlayPause"
        class="transport-btn play-pause-btn"
        :class="{ playing: isPlaying }"
        title="Play/Pause"
      >
        {{ isPlaying ? '⏸️' : '▶️' }}
      </button>
      
      <button 
        @click="record"
        class="transport-btn record-btn"
        :class="{ recording: isRecording }"
        :disabled="isPlaying"
        title="Record"
      >
        ⏺️
      </button>
      
      <button 
        @click="rewind"
        class="transport-btn rewind-btn"
        title="Rewind"
      >
        ⏪
      </button>
      
      <button 
        @click="fastForward"
        class="transport-btn ff-btn"
        title="Fast Forward"
      >
        ⏩
      </button>
    </div>
    
    <!-- Position Display -->
    <div class="position-display">
      <div class="time-display">
        <span class="current-time">{{ formatTime(currentTime) }}</span>
        <span class="separator">/</span>
        <span class="total-time">{{ formatTime(totalTime) }}</span>
      </div>
      
      <div class="measure-display">
        <span class="current-measure">{{ currentMeasure }}.{{ currentBeat }}</span>
        <span class="separator">/</span>
        <span class="total-measures">{{ totalMeasures }}</span>
      </div>
    </div>
    
    <!-- Progress Bar -->
    <div class="progress-container">
      <input 
        type="range" 
        min="0" 
        :max="totalTime" 
        v-model="currentTime"
        @input="seekTo"
        class="progress-bar"
        :disabled="!canSeek"
      />
      <div class="progress-markers">
        <div 
          v-for="marker in progressMarkers"
          :key="marker.id"
          class="progress-marker"
          :style="{ left: marker.position + '%' }"
          :title="marker.label"
        />
      </div>
    </div>
    
    <!-- Speed and Volume Controls -->
    <div class="speed-volume-controls">
      <div class="speed-control">
        <label>Speed:</label>
        <select v-model="playbackSpeed" @change="updateSpeed">
          <option value="0.25">0.25x</option>
          <option value="0.5">0.5x</option>
          <option value="0.75">0.75x</option>
          <option value="1">1x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
      </div>
      
      <div class="volume-control">
        <label>Volume:</label>
        <input 
          type="range" 
          min="0" 
          max="100" 
          v-model="volume"
          @input="updateVolume"
          class="volume-slider"
        />
        <span class="volume-value">{{ volume }}%</span>
      </div>
    </div>
    
    <!-- Loop Controls -->
    <div class="loop-controls">
      <button 
        @click="toggleLoop"
        class="loop-btn"
        :class="{ active: isLooping }"
        title="Loop"
      >
        🔁
      </button>
      
      <button 
        @click="setLoopStart"
        class="loop-btn"
        :disabled="!isPlaying && !isPaused"
        title="Set Loop Start"
      >
        📍 Start
      </button>
      
      <button 
        @click="setLoopEnd"
        class="loop-btn"
        :disabled="!isPlaying && !isPaused"
        title="Set Loop End"
      >
        📍 End
      </button>
      
      <div v-if="loopStart !== null || loopEnd !== null" class="loop-display">
        <span>Loop: {{ loopStart?.measure || '?' }}.{{ loopStart?.beat || '?' }} - {{ loopEnd?.measure || '?' }}.{{ loopEnd?.beat || '?' }}</span>
        <button @click="clearLoop" class="clear-loop-btn">×</button>
      </div>
    </div>
    
    <!-- Metronome Controls -->
    <div class="metronome-controls">
      <button 
        @click="toggleMetronome"
        class="metronome-btn"
        :class="{ active: metronomeEnabled, beating: metronomeBeating }"
        title="Metronome"
      >
        🎯
      </button>
      
      <div class="bpm-control">
        <label>BPM:</label>
        <input 
          type="number" 
          min="40" 
          max="300" 
          v-model.number="bpm"
          @change="updateBpm"
          class="bpm-input"
        />
        <div class="bpm-presets">
          <button 
            v-for="preset in bpmPresets"
            :key="preset"
            @click="setBpm(preset)"
            class="bpm-preset"
            :class="{ active: bpm === preset }"
          >
            {{ preset }}
          </button>
        </div>
      </div>
      
      <div class="metronome-settings">
        <label>
          <input type="checkbox" v-model="metronomeCountIn" />
          Count-in (2 bars)
        </label>
        <label>
          <input type="checkbox" v-model="metronomeAccents" />
          Beat accents
        </label>
      </div>
    </div>
    
    <!-- Advanced Settings Panel -->
    <div v-if="showSettings" class="settings-panel">
      <div class="settings-section">
        <h4>Audio Settings</h4>
        <div class="setting-group">
          <label>Audio Engine:</label>
          <select v-model="audioEngine" @change="updateAudioEngine">
            <option value="web-audio">Web Audio API</option>
            <option value="midi">MIDI Output</option>
            <option value="soundfont">SoundFont Player</option>
          </select>
        </div>
        
        <div class="setting-group">
          <label>Sample Rate:</label>
          <select v-model="sampleRate" @change="updateSampleRate">
            <option value="22050">22.05 kHz</option>
            <option value="44100">44.1 kHz</option>
            <option value="48000">48 kHz</option>
            <option value="96000">96 kHz</option>
          </select>
        </div>
        
        <div class="setting-group">
          <label>Buffer Size:</label>
          <select v-model="bufferSize" @change="updateBufferSize">
            <option value="128">128 samples</option>
            <option value="256">256 samples</option>
            <option value="512">512 samples</option>
            <option value="1024">1024 samples</option>
          </select>
        </div>
      </div>
      
      <div class="settings-section">
        <h4>Playback Settings</h4>
        <div class="setting-group">
          <label>
            <input type="checkbox" v-model="playClickTrack" />
            Click track during playback
          </label>
        </div>
        
        <div class="setting-group">
          <label>
            <input type="checkbox" v-model="soloMode" />
            Solo mode (mute other tracks)
          </label>
        </div>
        
        <div class="setting-group">
          <label>
            <input type="checkbox" v-model="autoScroll" />
            Auto-scroll during playback
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// Props
interface Props {
  tracks: any[]
  currentTrack: number
  totalMeasures: number
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits([
  'play',
  'pause', 
  'stop',
  'seek',
  'speedChange',
  'volumeChange',
  'loopChange',
  'metronomeToggle',
  'bpmChange'
])

// State
const isPlaying = ref(false)
const isPaused = ref(false)
const isRecording = ref(false)
const currentTime = ref(0)
const totalTime = ref(240) // 4 minutes default
const currentMeasure = ref(1)
const currentBeat = ref(1)
const playbackSpeed = ref(1)
const volume = ref(80)
const isLooping = ref(false)
const loopStart = ref<{ measure: number; beat: number } | null>(null)
const loopEnd = ref<{ measure: number; beat: number } | null>(null)
const metronomeEnabled = ref(false)
const metronomeBeating = ref(false)
const bpm = ref(120)
const metronomeCountIn = ref(true)
const metronomeAccents = ref(true)
const showSettings = ref(false)

// Settings
const audioEngine = ref('web-audio')
const sampleRate = ref(44100)
const bufferSize = ref(512)
const playClickTrack = ref(true)
const soloMode = ref(false)
const autoScroll = ref(true)

// Constants
const bpmPresets = [60, 80, 100, 120, 140, 160, 180, 200]

// Computed
const canSeek = computed(() => !isRecording.value)

const progressMarkers = computed(() => {
  // Create markers for measure divisions
  const markers = []
  const measuresPerMarker = Math.max(1, Math.floor(props.totalMeasures / 20))
  
  for (let i = 1; i <= props.totalMeasures; i += measuresPerMarker) {
    markers.push({
      id: i,
      position: (i / props.totalMeasures) * 100,
      label: `Measure ${i}`
    })
  }
  
  return markers
})

// Methods
function togglePlayPause() {
  if (isPlaying.value) {
    pause()
  } else {
    play()
  }
}

function play() {
  isPlaying.value = true
  isPaused.value = false
  emit('play', {
    time: currentTime.value,
    measure: currentMeasure.value,
    beat: currentBeat.value
  })
}

function pause() {
  isPlaying.value = false
  isPaused.value = true
  emit('pause', {
    time: currentTime.value,
    measure: currentMeasure.value,
    beat: currentBeat.value
  })
}

function stop() {
  isPlaying.value = false
  isPaused.value = false
  currentTime.value = 0
  currentMeasure.value = 1
  currentBeat.value = 1
  emit('stop')
}

function record() {
  if (isRecording.value) {
    isRecording.value = false
  } else {
    stop()
    isRecording.value = true
  }
}

function rewind() {
  const newTime = Math.max(0, currentTime.value - 10)
  seekTo(newTime)
}

function fastForward() {
  const newTime = Math.min(totalTime.value, currentTime.value + 10)
  seekTo(newTime)
}

function seekTo(time: number | Event) {
  const seekTime = typeof time === 'number' ? time : parseFloat((time.target as HTMLInputElement).value)
  currentTime.value = seekTime
  
  // Calculate measure and beat from time
  const secondsPerBeat = 60 / bpm.value
  const beatsPerMeasure = 4 // Assume 4/4 time for now
  const totalBeats = seekTime / secondsPerBeat
  
  currentMeasure.value = Math.floor(totalBeats / beatsPerMeasure) + 1
  currentBeat.value = (Math.floor(totalBeats) % beatsPerMeasure) + 1
  
  emit('seek', { time: seekTime, measure: currentMeasure.value, beat: currentBeat.value })
}

function updateSpeed() {
  emit('speedChange', playbackSpeed.value)
}

function updateVolume() {
  emit('volumeChange', volume.value)
}

function toggleLoop() {
  isLooping.value = !isLooping.value
  emit('loopChange', {
    enabled: isLooping.value,
    start: loopStart.value,
    end: loopEnd.value
  })
}

function setLoopStart() {
  loopStart.value = {
    measure: currentMeasure.value,
    beat: currentBeat.value
  }
  updateLoopEmit()
}

function setLoopEnd() {
  loopEnd.value = {
    measure: currentMeasure.value,
    beat: currentBeat.value
  }
  updateLoopEmit()
}

function clearLoop() {
  loopStart.value = null
  loopEnd.value = null
  isLooping.value = false
  updateLoopEmit()
}

function updateLoopEmit() {
  emit('loopChange', {
    enabled: isLooping.value,
    start: loopStart.value,
    end: loopEnd.value
  })
}

function toggleMetronome() {
  metronomeEnabled.value = !metronomeEnabled.value
  emit('metronomeToggle', metronomeEnabled.value)
  
  if (metronomeEnabled.value) {
    startMetronomeVisual()
  } else {
    stopMetronomeVisual()
  }
}

function updateBpm() {
  emit('bpmChange', bpm.value)
}

function setBpm(preset: number) {
  bpm.value = preset
  updateBpm()
}

function updateAudioEngine() {
  // Implementation for audio engine change
  console.log('Audio engine changed to:', audioEngine.value)
}

function updateSampleRate() {
  // Implementation for sample rate change
  console.log('Sample rate changed to:', sampleRate.value)
}

function updateBufferSize() {
  // Implementation for buffer size change
  console.log('Buffer size changed to:', bufferSize.value)
}

function toggleSettings() {
  showSettings.value = !showSettings.value
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Metronome visual feedback
let metronomeInterval: number | null = null

function startMetronomeVisual() {
  stopMetronomeVisual()
  const interval = (60 / bpm.value) * 1000 // Convert to milliseconds
  
  metronomeInterval = window.setInterval(() => {
    metronomeBeating.value = true
    setTimeout(() => {
      metronomeBeating.value = false
    }, 100)
  }, interval)
}

function stopMetronomeVisual() {
  if (metronomeInterval) {
    clearInterval(metronomeInterval)
    metronomeInterval = null
  }
  metronomeBeating.value = false
}

// Lifecycle
onMounted(() => {
  // Initialize audio context or playback engine
  console.log('Playback controls mounted')
})

onUnmounted(() => {
  stopMetronomeVisual()
})

// Watch for BPM changes to update metronome
import { watch } from 'vue'
watch(bpm, () => {
  if (metronomeEnabled.value) {
    startMetronomeVisual()
  }
})
</script>

<style scoped>
.playback-controls {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.controls-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.controls-header h3 {
  margin: 0;
  color: #333;
}

.settings-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.settings-btn:hover {
  background: #e9ecef;
}

.transport-controls {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.transport-btn {
  width: 40px;
  height: 40px;
  border: 2px solid #dee2e6;
  background: white;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.transport-btn:hover:not(:disabled) {
  background: #f8f9fa;
  transform: translateY(-1px);
}

.transport-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.play-pause-btn.playing {
  background: #28a745;
  color: white;
  border-color: #28a745;
}

.record-btn.recording {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.position-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.time-display, .measure-display {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #333;
}

.separator {
  color: #666;
  margin: 0 4px;
}

.progress-container {
  position: relative;
  margin-bottom: 16px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #e9ecef;
  border-radius: 3px;
  outline: none;
}

.progress-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #4A90E2;
  cursor: pointer;
}

.progress-bar::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #4A90E2;
  cursor: pointer;
  border: none;
}

.progress-markers {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  pointer-events: none;
}

.progress-marker {
  position: absolute;
  width: 2px;
  height: 6px;
  background: #666;
  opacity: 0.5;
}

.speed-volume-controls {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  align-items: center;
}

.speed-control, .volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-control label, .volume-control label {
  font-size: 12px;
  font-weight: 600;
  color: #555;
  min-width: 50px;
}

.speed-control select {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.volume-slider {
  width: 100px;
}

.volume-value {
  font-size: 12px;
  color: #666;
  min-width: 35px;
}

.loop-controls {
  margin-bottom: 16px;
}

.loop-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
  transition: all 0.2s ease;
}

.loop-btn:hover:not(:disabled) {
  background: #f5f5f5;
}

.loop-btn.active {
  background: #4A90E2;
  color: white;
  border-color: #4A90E2;
}

.loop-display {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #666;
}

.clear-loop-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 10px;
  cursor: pointer;
}

.metronome-controls {
  border-top: 1px solid #dee2e6;
  padding-top: 16px;
}

.metronome-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  margin-bottom: 12px;
  transition: all 0.2s ease;
}

.metronome-btn.active {
  background: #ffc107;
  border-color: #ffc107;
}

.metronome-btn.beating {
  transform: scale(1.1);
  background: #ff8800;
}

.bpm-control {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.bpm-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.bpm-presets {
  display: flex;
  gap: 4px;
}

.bpm-preset {
  padding: 4px 8px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bpm-preset:hover {
  background: #f5f5f5;
}

.bpm-preset.active {
  background: #4A90E2;
  color: white;
  border-color: #4A90E2;
}

.metronome-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metronome-settings label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #555;
}

.settings-panel {
  border-top: 1px solid #dee2e6;
  padding-top: 16px;
  margin-top: 16px;
}

.settings-section {
  margin-bottom: 16px;
}

.settings-section h4 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 14px;
}

.setting-group {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-group label {
  font-size: 12px;
  color: #555;
  min-width: 100px;
}

.setting-group select,
.setting-group input[type="number"] {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.setting-group input[type="checkbox"] {
  margin-right: 6px;
}
</style> 