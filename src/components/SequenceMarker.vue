<template>
    <svg :style="markerStyle">
      <rect :x="0" :y="0" :width="markerWidth" :height="height"
            fill="#adadad" stroke-width="1" stroke="rgba(62, 173, 255, 0.19)" />
    </svg>
  </template>
  
  <script lang="ts">
  export default {
    props: {
      blockStart: {
        type: Number,
        required: true,
      },
      blockEnd: {
        type: Number,
        required: true,
      },
      height: {
        type: Number,
        required: true,
      },
    },
    computed: {
      markerStyle() {
        return {
          left: `${this.blockStart * 30}px`,
          width: `${30 * (this.blockEnd - this.blockStart + 1)}px`,
          top: '0px',
          height: `${this.height}px`,
        };
      },
      markerWidth() {
        return 30 * (this.blockEnd - this.blockStart + 1);
      },
    },
  };
  </script>