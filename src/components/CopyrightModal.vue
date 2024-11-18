<template>
  <BaseModal :modal-id="MODALS.COPYRIGHT.id">
    <template #title>Copyright</template>
    <label>
      Copyright 201823 Jan Spieck The samples that were used for the instruments
      come from different sources. If the usage of any of the samples, is
      against the will of the respective owner the sample will be removed
      immediately. No copyright infringement is intended.
    </label>
    <table id="sampleSourceList">
      <thead>
        <tr>
          <th>Sample Source</th>
          <th>URL</th>
          <th>Instruments</th>
        </tr>
      </thead>
      <tbody id="midiDeviceListBody">
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
            Pan Flute, Blown Bottle, Whistle, Ocarina, SynthBrass 1/2, Muted
            Tumpret, Brass Section, Synth Strings, Orchestra Hit,
            GuitarFretNoise, Breath Noise, Seashore, Bird Tweet, Telephone Ring,
            Helicopter, Applause, Gunshot, Tinkle Bell, Steel Drum, Taiko,
            Melodic Tom, Synth Drum, Reverse Cymbal, Sitar, Shamisen, Koto,
            Kalimba, Bagpipe, Fiddle, Shanai
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
            VoicesAah, VoicesOoh, EGuitar, Session Drums, Vibraphone, Agogo,
            Woodblock
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
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";
import { MODALS } from "../assets/js/modals/modalTypes";
</script>
