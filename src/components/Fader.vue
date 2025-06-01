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
  
<script lang="ts">
import { defineComponent, ref, onMounted, Ref, computed } from "vue";
import audioEngine from "../assets/js/audioEngine";
import Settings from "../assets/js/settingManager";
import Song from "../assets/js/songData";

// These Slider classes are legacy and ideally should be refactored into Vue components
// For now, their direct DOM manipulation is kept.
interface SliderOptions {
    min: number;
    max: number;
    value: number;
    range: 'min';
    slide(event: Event): void;
}

class Slider {
    static create(container: HTMLElement, options: SliderOptions) {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = options.min.toString();
        slider.max = options.max.toString();
        slider.value = options.value.toString();
        slider.addEventListener('input', options.slide);
        container.appendChild(slider);
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
        Slider.create(container, {
            min: 0,
            max: 127,
            value: Song.playBackInstrument[k] ? Song.playBackInstrument[k].volume : 60,
            range: 'min',
            slide(event: Event) {
                const value = parseInt((event.target as HTMLInputElement).value);
                if (Song.playBackInstrument[k]) {
                    Song.playBackInstrument[k].volume = value;
                }
                if (audioEngine.busses[k] && audioEngine.busses[k].volume) {
                    audioEngine.busses[k].volume.gain.value = value / 100.0;
                } else {
                    // console.warn(`Audio bus not ready for track ${k}`);
                }
            },
        });
    }
}

export default defineComponent({
    props: {
        // Renaming to 'faderId' to be clear it's an identifier for the fader, not strictly track index
        // The logic to differentiate master (0) vs tracks (1-based in old system, index here) needs care
        faderId: { type: Number, required: true },
    },
    setup(props, { expose }) {
        const volumeCanvasRef: Ref<HTMLCanvasElement | null> = ref(null);
        const volumeSliderContainerRef: Ref<HTMLElement | null> = ref(null);
        const canvasContext: Ref<CanvasRenderingContext2D | null> = ref(null);

        const computedVolumeFaderId = computed(() => 
            props.faderId === 0 ? "masterVolume" : `trackVolume-${props.faderId}`
        );
        const computedVolumeControlId = computed(() =>
            props.faderId === 0 ? "masterVolumeCanvas" : `volumeControlCanvas${props.faderId -1}`
        );

        onMounted(() => {
            if (volumeCanvasRef.value) {
                canvasContext.value = volumeCanvasRef.value.getContext("2d");
            }
            if (volumeSliderContainerRef.value) {
                if (props.faderId === 0) {
                    MasterSlider.create(volumeSliderContainerRef.value);
                } else {
                    TrackSlider.create(volumeSliderContainerRef.value, props.faderId - 1); 
                }
            } else {
                console.error('Could not find .volume div for slider creation in Fader.vue');
            }
        });
        
        expose({
            context: canvasContext,
            id: props.faderId 
        });

        return { 
            computedVolumeFaderId, 
            computedVolumeControlId, 
            volumeCanvasRef,
            volumeSliderContainerRef 
        };
    },
});
</script>