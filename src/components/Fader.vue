<template>
    <div :id="computedVolumeFaderId" class="volumeFader">
        <canvas :id="computedVolumeControlId" class="volumeControl" width="90" height="30" ref="volumeCanvasRef"></canvas>
        <div id="player">
            <div class="volume" ref="volumeSliderContainerRef">
                <!-- Slider component will be created here by script -->
            </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { previewTrackVolume, setTrackVolume } from "../services/editor/songSettingsCommands";
import audioEngine from "../assets/js/audioEngine";
import Settings from '../stores/settingsState';
import Song from "../assets/js/songData";

// These Slider classes are legacy and ideally should be refactored into Vue components
// For now, their direct DOM manipulation is kept.
interface SliderOptions {
    min: number;
    max: number;
    value: number;
    range: 'min';
    slide(event: Event): void;
    /** Drag finished (the input's change event). */
    change?(event: Event): void;
}

class Slider {
    static create(container: HTMLElement, options: SliderOptions) {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = options.min.toString();
        slider.max = options.max.toString();
        slider.value = options.value.toString();
        slider.addEventListener('input', options.slide);
        if (options.change) slider.addEventListener('change', options.change);
        container.appendChild(slider);
        return slider;
    }
}

class MasterSlider {
    static create(container: HTMLElement) {
        Slider.create(container, {
            min: 0,
            max: 127,
            value: Settings.masterVolume * 127,
            range: 'min',
            slide(event: Event) {
                const value = parseInt((event.target as HTMLInputElement).value);
                audioEngine.setMasterGain(value / 127);
            },
        });
    }
}

class TrackSlider {
    static create(container: HTMLElement, k: number) {
        let volumeBefore: number | null = null;
        const slider = Slider.create(container, {
            min: 0,
            max: 127,
            value: trackVolume(k),
            range: 'min',
            slide(event: Event) {
                volumeBefore ??= trackVolume(k);
                previewTrackVolume(k, parseInt((event.target as HTMLInputElement).value));
            },
            change(event: Event) {
                // One undo step per drag, recorded on release.
                setTrackVolume(k, parseInt((event.target as HTMLInputElement).value), volumeBefore ?? undefined);
                volumeBefore = null;
            },
        });
        // Follow undo/redo and loaded songs.
        return watch(() => trackVolume(k), (volume) => {
            slider.value = volume.toString();
        });
    }
}

function trackVolume(trackId: number): number {
    return Song.playBackInstrument[trackId]?.volume ?? 60;
}

// 'faderId' 0 is the master fader; tracks are 1-based here.
const props = defineProps<{ faderId: number }>();

const volumeCanvasRef = ref<HTMLCanvasElement | null>(null);
const volumeSliderContainerRef = ref<HTMLElement | null>(null);
const canvasContext = ref<CanvasRenderingContext2D | null>(null);

const computedVolumeFaderId = computed(() =>
    props.faderId === 0 ? "masterVolume" : `trackVolume-${props.faderId}`
);
const computedVolumeControlId = computed(() =>
    props.faderId === 0 ? "masterVolumeCanvas" : `volumeControlCanvas${props.faderId -1}`
);

let stopVolumeWatch: (() => void) | null = null;

onBeforeUnmount(() => stopVolumeWatch?.());

onMounted(() => {
    if (volumeCanvasRef.value) {
        canvasContext.value = volumeCanvasRef.value.getContext("2d");
    }
    if (volumeSliderContainerRef.value) {
        if (props.faderId === 0) {
            MasterSlider.create(volumeSliderContainerRef.value);
        } else {
            stopVolumeWatch = TrackSlider.create(volumeSliderContainerRef.value, props.faderId - 1);
        }
    } else {
        console.error('Could not find .volume div for slider creation in Fader.vue');
    }
});

// Sequencer registers each fader's canvas as a volume meter (stores/sequencerState.ts).
defineExpose({
    context: canvasContext,
    id: props.faderId,
});
</script>
