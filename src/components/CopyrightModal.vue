<template>
  <BaseModal :modal-id="DIALOGS.COPYRIGHT.id">
    <template #title>About SereneTab</template>
    <div class="modal-stack copyright-modal">
      <p class="modal-body-text">
        SereneTab is a free guitar tab editor and player that runs entirely in your browser: your songs and files
        stay on your device. Copyright 2018–{{ currentYear }} Jan Spieck, released under the MIT licence.
      </p>
      <p class="copyright-links">
        <a href="impressum.html" target="_blank" rel="noopener">Impressum</a>
        <a href="datenschutz.html" target="_blank" rel="noopener">Datenschutz / Privacy</a>
        <a href="https://github.com/jspieck/guitartab" target="_blank" rel="noopener">Source code</a>
        <a href="https://github.com/jspieck/guitartab/issues" target="_blank" rel="noopener">Report a problem</a>
      </p>
      <!-- Scrolls on its own, so keyboard users must be able to focus it. -->
      <div class="modal-surface-block copyright-table-wrap" tabindex="0" role="region" aria-label="Credits">
        <table id="sampleSourceList" class="copyright-table">
          <thead>
            <tr>
              <th>Credit</th>
              <th>Licence</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="credit in CREDITS" :key="credit.name">
              <td>
                <a v-if="credit.url" :href="credit.url" target="_blank" rel="noopener">{{ credit.name }}</a>
                <template v-else>{{ credit.name }}</template>
                <span class="copyright-use">{{ credit.use }}</span>
              </td>
              <td>{{ credit.licence }}</td>
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

/** Same list as THIRD_PARTY_NOTICES.md; keep both in step. */
const CREDITS = [
  {
    name: 'GeneralUser GS 2.0.3 by S. Christian Collins',
    url: 'https://github.com/mrbumpy409/GeneralUser-GS',
    licence: 'GeneralUser GS License v2.0',
    use: 'Instrument and drum sounds',
  },
  {
    name: 'Mutopia Project',
    url: 'https://www.mutopiaproject.org',
    licence: 'Public domain, CC BY-SA 2.0/2.5',
    use: 'Example songs (credits in each song\'s info)',
  },
  { name: 'Vue', url: 'https://vuejs.org', licence: 'MIT', use: 'User interface' },
  {
    name: 'VexFlow',
    url: 'https://www.vexflow.com',
    licence: 'MIT; music fonts SIL OFL 1.1',
    use: 'Classical notation',
  },
  { name: 'fflate, lz-string', url: null, licence: 'MIT', use: 'File compression' },
  { name: 'mitt, fastdom, tinycolor2', url: null, licence: 'MIT', use: 'Events, layout, colours' },
  { name: 'vanilla-picker', url: 'https://github.com/Sphinxxxx/vanilla-picker', licence: 'ISC', use: 'Colour picker' },
  { name: '@wasm-audio-decoders/ogg-vorbis', url: null, licence: 'MIT', use: 'Decoding compressed SoundFonts' },
  { name: 'Source Sans Pro (Adobe)', url: null, licence: 'SIL OFL 1.1', use: 'Text font' },
] as const
</script>

<style scoped>
/* Dialogs are at most 420 px wide (guitarTab.scss); same width as the example songs. */
.copyright-modal {
  width: min(386px, calc(100vw - 66px));
}

.copyright-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.copyright-use {
  display: block;
  color: var(--color-text-muted);
  font-size: 12px;
}

.copyright-links a,
.copyright-table a {
  color: var(--color-accent);
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
  line-height: 1.4;
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
