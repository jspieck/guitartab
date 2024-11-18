<template>
  <BaseModal :modal-id="MODALS.CHORD_MANAGER.id">
    <template #title>Chord Manager</template>
    <div class="chord-manager">
      <label>Chord diagrams to display:</label>
      <div class="chord-overview">
        <div class="chords-grid">
          <div 
            v-for="[name, chord] in chords" 
            :key="name" 
            class="chord-box"
          >
            <div class="chord-name">{{ name }}</div>
            <svg 
              class="chord-diagram" 
              width="100" 
              height="120" 
              ref="chordRefs"
            ></svg>
            <div class="chord-buttons">
              <button 
                class="edit-chord"
                @click="editChord(name, chord)"
              >
                Edit
              </button>
              <button 
                class="delete-chord"
                @click="deleteChord(name)"
              >
                Delete
              </button>
              <button 
                class="toggle-visibility"
                @click="toggleChordVisibility(chord)"
              >
                {{ chord.display ? 'Hide' : 'Show' }}
              </button>
            </div>
          </div>
        </div>
        <button 
          class="add-chord"
          @click="addNewChord"
          title="Add Chord Diagram"
        >
          +
        </button>
      </div>
    </div>
    <SubmitButton @submitInfo="handleSubmit" />
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import BaseModal from "./BaseModal.vue";
import SubmitButton from "./SubmitButton.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
import { modalManager } from "../assets/js/modals/modalManager";
import { ChordManagerModalHandler } from "../assets/js/modals/chordManagerModalHandler";
import { Song, Chord } from "../assets/js/songData";
import { svgDrawer } from "../assets/js/svgDrawer";

const handler = modalManager.getHandler(MODALS.CHORD_MANAGER.id) as ChordManagerModalHandler;
const chordRefs = ref<SVGElement[]>([]);
const chords = ref<Map<string, Chord>>(new Map());

const drawChordDiagram = (svg: SVGElement, chord: Chord) => {
  handler.drawChordDiagram(svg, chord);
};

const updateChordDiagrams = () => {
  if (!chordRefs.value.length) return;
  
  chordRefs.value.forEach((svg, index) => {
    const chord = Array.from(chords.value.values())[index];
    if (chord && svg) {
      svg.innerHTML = '';
      drawChordDiagram(svg, chord);
    }
  });
};

const editChord = (name: string, chord: Chord) => {
  modalManager.toggleByModal(MODALS.ADD_CHORD, {
    trackId: handler.getTrackId(),
    existingChord: { ...chord, name }
  });
};

const deleteChord = async (name: string) => {
  if (await confirm(`Delete chord ${name}?`)) {
    Song.chordsMap[handler.getTrackId()].delete(name);
    chords.value = new Map(Song.chordsMap[handler.getTrackId()]);
    svgDrawer.redrawChordDiagrams();
  }
};

const toggleChordVisibility = (chord: Chord) => {
  chord.display = !chord.display;
  svgDrawer.redrawChordDiagrams();
};

const addNewChord = () => {
  modalManager.toggleByModal(MODALS.ADD_CHORD, { 
    trackId: handler.getTrackId() 
  });
};

const handleSubmit = () => {
  svgDrawer.redrawChordDiagrams();
  handler.closeModal();
};

watch(() => chords.value, updateChordDiagrams, { deep: true });

onMounted(() => {
  chords.value = Song.chordsMap[handler.getTrackId()];
  updateChordDiagrams();
});
</script>

<style scoped>
.chord-manager {
  padding: 1rem;
}

.chord-overview {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chords-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.chord-box {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chord-name {
  font-weight: 500;
  text-align: center;
}

.chord-diagram {
  align-self: center;
}

.chord-buttons {
  display: flex;
  gap: 0.5rem;
}

.chord-buttons button {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.edit-chord {
  background: #e3f2fd;
}

.delete-chord {
  background: #ffebee;
}

.toggle-visibility {
  background: #f5f5f5;
}

.add-chord {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px dashed #ccc;
  background: none;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  transition: all 0.2s;
}

.add-chord:hover {
  border-color: #999;
  background: #f5f5f5;
}

button:hover {
  filter: brightness(0.95);
}
</style>