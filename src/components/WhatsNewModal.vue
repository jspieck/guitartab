<template>
  <BaseModal :modal-id="DIALOGS.WHATS_NEW.id">
    <template #title>What's new</template>
    <div class="modal-stack whats-new">
      <!-- Scrolls on its own, so keyboard users must be able to focus it. -->
      <div class="whats-new__entries" tabindex="0" role="region" aria-label="Changes">
        <section v-for="entry in entries" :key="entry.title" class="whats-new__entry">
          <h3 class="whats-new__title">{{ entry.title }}</h3>
          <p v-for="(paragraph, index) in entry.intro" :key="index" class="modal-body-text">
            <InlineText :text="paragraph" />
          </p>
          <ul class="whats-new__items">
            <li v-for="(item, index) in entry.items" :key="index"><InlineText :text="item" /></li>
          </ul>
        </section>
      </div>
      <p class="whats-new__links">
        <a :href="GETTING_STARTED_URL" target="_blank" rel="noopener">Getting started guide</a>
      </p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { defineComponent, h } from 'vue'
import BaseModal from './BaseModal.vue'
import { DIALOGS } from '../services/dialogs/dialogs'
import { GETTING_STARTED_URL } from '../services/whatsNew'
import { inlineParts, parseChangelog } from '../utils/changelog'
import changelog from '../../CHANGELOG.md?raw'

// Older entries stay readable, but the newest few are what people open this for.
const entries = parseChangelog(changelog).slice(0, 5)

/** A changelog line with its **bold** and `code` parts, without v-html. */
const InlineText = defineComponent({
  props: { text: { type: String, required: true } },
  setup(props) {
    return () =>
      inlineParts(props.text).map((part) =>
        part.strong ? h('strong', part.text) : part.code ? h('code', part.text) : part.text,
      )
  },
})
</script>

<style scoped>
.whats-new {
  /* Same width as the About dialog: the window sizes to its content. */
  width: min(386px, calc(100vw - 66px));
}

.whats-new__entries {
  max-height: min(60vh, 460px);
  overflow-y: auto;
}

.whats-new__entry + .whats-new__entry {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.whats-new__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
}

.whats-new__items {
  margin: 8px 0 0;
  padding-left: 20px;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.45;
}

.whats-new__items li + li {
  margin-top: 4px;
}

.whats-new__links {
  margin: 0;
}

.whats-new__links a {
  color: var(--color-accent);
}
</style>
