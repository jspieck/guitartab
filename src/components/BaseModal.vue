<template>
    <div class="modal" role="alert" :id="modalId">
      <div class="modalTopBar">
        <div class="modalTopBarLabel"><slot name="title"></slot></div>
        <button type="button" class="modal_close" aria-label="Close modal">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </span>
        </button>
      </div>
      <div class="modalBody">
        <slot></slot>
      </div>
    </div>
  </template>
  
  <script lang="ts">
  export default {
    name: "BaseModal",
    props: {
        modalId: {
            type: String,
            required: true
        }
    }
  };
  </script>
  