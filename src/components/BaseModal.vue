<template>
    <div class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel"><slot name="title"></slot></label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <slot></slot>
      </div>
    </div>
  </template>
  
  <script lang="ts">
  export default {
    name: "BaseModal",
  };
  </script>
  