<template>
  <BaseModal :modal-id="DIALOGS.COPYRIGHT.id">
    <template #title>Copyright</template>
    <div class="modal-stack copyright-modal">
      <p class="modal-body-text">
        Copyright 2018–{{ currentYear }} Jan Spieck. The samples used for the instruments come from different sources.
        If the usage of any sample is against the will of the respective owner, the sample will be removed immediately.
        No copyright infringement is intended.
      </p>
      <!-- Scrolls on its own, so keyboard users must be able to focus it. -->
      <div class="modal-surface-block copyright-table-wrap" tabindex="0" role="region" aria-label="Sample sources">
        <table id="sampleSourceList" class="copyright-table">
          <thead>
            <tr>
              <th>Sample Source</th>
              <th>URL</th>
              <th>Instruments</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sampled from AmpleSound Guitar VSTs</td>
              <td>http://www.amplesound.net/en/index.asp</td>
              <td>Nylon/Western Guitar, Muted Guitar, Overdrive Guitar, Bass</td>
            </tr>
            <tr>
              <td>Hammondman</td>
              <td>https://freesound.org/people/hammondman/packs/18842/</td>
              <td>Accordeon</td>
            </tr>
            <tr>
              <td>bigcat saxophone collection</td>
              <td>
                http://bigcatinstruments.blogspot.de/2014/03/bigcat-saxophone-collection.html
              </td>
              <td>Tenor/Soprano/Bartitone Sax</td>
            </tr>
            <tr>
              <td>bigcat general midi instruments</td>
              <td>
                http://bigcatinstruments.blogspot.de/2014/08/gm-midi-instruments-for-kontakt.html
              </td>
              <td>
                Pan Flute, Blown Bottle, Whistle, Ocarina, SynthBrass 1/2, Muted Tumpret, Brass Section, Synth Strings, Orchestra Hit,
                GuitarFretNoise, Breath Noise, Seashore, Bird Tweet, Telephone Ring, Helicopter, Applause, Gunshot, Tinkle Bell, Steel Drum, Taiko,
                Melodic Tom, Synth Drum, Reverse Cymbal, Sitar, Shamisen, Koto, Kalimba, Bagpipe, Fiddle, Shanai
              </td>
            </tr>
            <tr>
              <td>Sampled from Orchestral Companion VST</td>
              <td>
                https://sonivoxmi.com/products/details/orchestral-companion-strings
              </td>
              <td>Tremolo Strings, Pizzicato Strings, Violin</td>
            </tr>
            <tr>
              <td>Kontakt Factory Library</td>
              <td>
                https://www.native-instruments.com/de/products/komplete/samplers/kontakt-5/
              </td>
              <td>
                VoicesAah, VoicesOoh, EGuitar, Session Drums, Vibraphone, Agogo, Woodblock
              </td>
            </tr>
            <tr>
              <td>Leeds Organ</td>
              <td>
                https://www.samplephonics.com/products/free/sampler-instruments/the-leeds-town-hall-organ
              </td>
              <td>
                Organ, Percussive Organ, Church Organ, Rock organ, Reed Organ,
              </td>
            </tr>
            <tr>
              <td>Don's General Midi Sample Set</td>
              <td>http://midkar.com/soundfonts/</td>
              <td>
                Piano, Bright Piano, Electric Grand, HonkyTonk, EPiano1, Epiano2,
                Harpsichord, Clavinet, Shakuhachi, Marimba, Tubular Bells, Dulcimer,
                MusicBox, Celesta, Harmonica, Bandoneon, Cabasa & several other drum
                sounds, Leads, Pads, FX
              </td>
            </tr>
            <tr>
              <td>Sonatina</td>
              <td>https://sso.mattiaswestlund.net/</td>
              <td>
                Piccolo, Strings, Alto Sax, Clarinet, Flute, Xylophone, Harp,
                Glockenspiel, Banjo
              </td>
            </tr>
            <tr>
              <td>Versilian Orchestra</td>
              <td>http://vis.versilstudios.net/vsco-2.html</td>
              <td>Cello, Contrabass</td>
            </tr>
            <tr>
              <td>Philarmonia Orchestra</td>
              <td>http://www.philharmonia.co.uk/explore/sound_samples</td>
              <td>Tuba, Trumpet, Trombone, French/English Horn</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import { DIALOGS } from "../services/dialogs/dialogs"

// Read when the dialog mounts, so the range always ends at the current year.
const currentYear = new Date().getFullYear();
</script>

<style scoped>
.copyright-modal {
  width: min(640px, calc(100vw - 32px));
}

.copyright-table-wrap {
  padding: 0;
  overflow: auto;
  max-height: min(50vh, 420px);
}

.copyright-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.copyright-table th,
.copyright-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-divider);
  text-align: left;
  vertical-align: top;
}

.copyright-table th {
  position: sticky;
  top: 0;
  background: var(--color-surface-sunken);
  color: var(--color-text);
  font-weight: 600;
}
</style>
