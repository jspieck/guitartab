<template>
    <div :id="volumeFaderId" class="volumeFader">
        <canvas :id="volumeControlId" class="volumeControl" width="90" height="30" ref="volumeControl"></canvas>
        <div id="player">
            <div class="volume">
                <!-- Slider component to be created (either MasterSlider or TrackSlider) -->
            </div>
        </div>
    </div>
</template>
  
<script lang="ts">
import { defineComponent, ref, onMounted, Ref } from "vue";
import audioEngine from "../assets/js/audioEngine";
import Settings from "../assets/js/settingManager";
import Song from "../assets/js/songData";

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
            value: Song.playBackInstrument[k].volume,
            range: 'min',
            slide(event: Event) {
                const value = parseInt((event.target as HTMLInputElement).value);
                Song.playBackInstrument[k].volume = value;
                audioEngine.busses[k].volume.gain.value = value / 100.0;
            },
        });
    }
}

export default defineComponent({
    props: {
        index: {Number, default: 0},
    },
    setup(props) {
        const volumeFaderId = ref(props.index === 0 ? "masterVolume" : "");
        const volumeControlId = ref(
        props.index === 0 ? "masterVolumeCanvas" : `volumeControl${props.index - 1}`
        );
        const volumeControl: Ref<HTMLCanvasElement | null> = ref(null);
        const context: Ref<CanvasRenderingContext2D | null> = ref(null);

        onMounted(() => {
            context.value = volumeControl.value!.getContext("2d");
            // Add slider component to volumeDiv (either MasterSlider or TrackSlider)
            if (props.index === 0) {
                MasterSlider.create(volumeControl.value!);

            } else {
                TrackSlider.create(volumeControl.value!, props.index - 1);
            }
        });

        return { volumeFaderId, volumeControlId, volumeControl, context };
    },
});
</script>