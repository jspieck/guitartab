<template>
    <!-- A window, not a modal: several can be open and the page behind stays usable.
         Open/closed and the stacking order come from stores/dialogState; Escape closes the
         front window (ModalsContainer); the focus moves in on opening and back on closing. -->
    <div
      :id="modalId"
      ref="root"
      class="modal"
      :class="{ active: open }"
      role="dialog"
      :aria-labelledby="`${modalId}Title`"
      tabindex="-1"
      :style="windowStyle"
      :data-resized="resizedHeight ? '' : undefined"
      @pointerdown.capture="bringDialogToFront(modalId)"
    >
      <div class="modalTopBar" :class="{ 'modal-draggable': !layoutModeState.compact }" @pointerdown="startDrag">
        <div :id="`${modalId}Title`" class="modalTopBarLabel" role="heading" aria-level="2"><slot name="title"></slot></div>
        <div v-if="$slots['title-actions']" class="modalTopBarActions"><slot name="title-actions"></slot></div>
        <button type="button" class="modal_close" aria-label="Close" :aria-describedby="`${modalId}Title`" @click="hideDialog(modalId)">
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
      <template v-if="resize != null && !layoutModeState.compact">
        <div class="modal-resize-edge modal-resize-left" aria-hidden="true" @pointerdown="startResize($event, 'left')"></div>
        <div class="modal-resize-edge modal-resize-right" aria-hidden="true" @pointerdown="startResize($event, 'right')"></div>
        <div
          v-if="resize === 'xy'"
          class="modal-resize-edge modal-resize-bottom"
          aria-hidden="true"
          @pointerdown="startResize($event, 'bottom')"
        ></div>
      </template>
    </div>
  </template>

  <script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
  import {
    bringDialogToFront,
    dialogElement,
    dialogZIndex,
    frontDialogId,
    hideDialog,
    isDialogOpen,
    registerDialogElement,
  } from '../stores/dialogState'
  import { layoutModeState } from '../stores/layoutModeState'
  import { focusInto, restoreFocus } from '../services/a11y/dialogFocus'

  const props = defineProps<{
    modalId: string
    /** Edges the window can be resized by: 'x' left and right, 'xy' also the bottom. */
    resize?: 'x' | 'xy'
  }>()

  const MARGIN = 12
  const MIN_WIDTH = 185
  const MIN_HEIGHT = 50

  const root = ref<HTMLElement | null>(null)
  const open = computed(() => isDialogOpen(props.modalId))
  // Position and size on the desktop (a bottom sheet on phones ignores them, compact.css).
  const box = reactive({ left: 0, top: 0, width: 0, height: 0 })
  const resizedWidth = ref(false)
  const resizedHeight = ref(false)

  const windowStyle = computed(() => {
    const style: Record<string, string> = { zIndex: String(dialogZIndex(props.modalId)) }
    if (layoutModeState.compact) return style
    style.left = `${box.left}px`
    style.top = `${box.top}px`
    if (resizedWidth.value) style.width = `${box.width}px`
    if (resizedHeight.value) {
      style.height = `${box.height}px`
      // the body then fills the chosen height instead of its default maximum
      style.maxHeight = 'none'
    }
    return style
  })

  /** Centred in the window each time it opens, as before. */
  function centre() {
    const element = root.value
    if (element == null || layoutModeState.compact) return
    const { width, height } = element.getBoundingClientRect()
    box.left = window.innerWidth / 2 - width / 2
    box.top = window.innerHeight / 2 - height / 2
  }

  /** Moves the window back inside the viewport, e.g. after its content grew. */
  function keepInViewport() {
    const element = root.value
    if (element == null || layoutModeState.compact || !open.value) return
    const rect = element.getBoundingClientRect()
    const x = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - rect.width - MARGIN))
    const y = Math.max(MARGIN, Math.min(rect.top, window.innerHeight - rect.height - MARGIN))
    // left/top apply before the window's translateY offset, so shift by the difference.
    box.left += x - rect.left
    box.top += y - rect.top
  }

  let returnFocus: HTMLElement | undefined
  let sizeObserver: ResizeObserver | null = null

  watch(
    open,
    async (isOpen, wasOpen) => {
      if (isOpen) {
        const focused = document.activeElement
        returnFocus = focused instanceof HTMLElement && focused !== document.body ? focused : undefined
        await nextTick()
        centre()
        if (root.value != null) focusInto(root.value, layoutModeState.compact)
        return
      }
      if (!wasOpen || root.value == null) return
      // Checked once it is hidden: the focus inside a hidden element drops to <body>.
      const hadFocus = root.value.contains(document.activeElement) || document.activeElement === document.body
      if (hadFocus) restoreFocus(returnFocus, dialogElement(frontDialogId()))
      returnFocus = undefined
    },
    { immediate: true, flush: 'post' },
  )

  onMounted(() => {
    registerDialogElement(props.modalId, root.value)
    if (typeof ResizeObserver === 'function' && root.value != null) {
      sizeObserver = new ResizeObserver(() => keepInViewport())
      sizeObserver.observe(root.value)
    }
  })

  onBeforeUnmount(() => {
    registerDialogElement(props.modalId, null)
    sizeObserver?.disconnect()
    stopPointer()
  })

  // ---- Dragging and resizing (pointer events; not on phones, where windows are sheets) ----

  let stopPointer = () => {}

  function track(event: PointerEvent, move: (dx: number, dy: number) => void, done?: () => void) {
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture?.(event.pointerId)
    let lastX = event.clientX
    let lastY = event.clientY
    const onMove = (moveEvent: PointerEvent) => {
      move(moveEvent.clientX - lastX, moveEvent.clientY - lastY)
      lastX = moveEvent.clientX
      lastY = moveEvent.clientY
    }
    const onUp = () => stopPointer()
    stopPointer = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      stopPointer = () => {}
      done?.()
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  function startDrag(event: PointerEvent) {
    if (layoutModeState.compact || event.button !== 0) return
    if ((event.target as Element).closest('button') != null) return
    event.preventDefault()
    track(event, (dx, dy) => {
      const rect = root.value!.getBoundingClientRect()
      // The whole window stays on screen.
      box.left += Math.max(-rect.left, Math.min(dx, window.innerWidth - rect.right))
      box.top += Math.max(-rect.top, Math.min(dy, window.innerHeight - rect.bottom))
    })
  }

  function startResize(event: PointerEvent, edge: 'left' | 'right' | 'bottom') {
    if (event.button !== 0 || root.value == null) return
    event.preventDefault()
    event.stopPropagation()
    const rect = root.value.getBoundingClientRect()
    box.width = rect.width
    box.height = rect.height
    if (edge === 'bottom') resizedHeight.value = true
    else resizedWidth.value = true
    // The drag starts inside the dialog's content; it shouldn't select text on the page.
    document.body.classList.add('modal-resizing')
    track(
      event,
      (dx, dy) => {
        if (edge === 'bottom') {
          box.height = Math.max(MIN_HEIGHT, box.height + dy)
        } else if (edge === 'right') {
          box.width = Math.max(MIN_WIDTH, box.width + dx)
        } else {
          const width = Math.max(MIN_WIDTH, box.width - dx)
          box.left += box.width - width
          box.width = width
        }
      },
      () => {
        document.body.classList.remove('modal-resizing')
        window.getSelection()?.removeAllRanges()
      },
    )
  }
  </script>

  <style scoped>
  /* The title bar moves the window (not on phones, where windows are sheets). */
  .modal-draggable {
    cursor: move;
  }

  .modal-draggable .modal_close {
    cursor: pointer;
  }

  .modal-resize-edge {
    position: absolute;
    z-index: 3;
    touch-action: none;
  }

  .modal-resize-left,
  .modal-resize-right {
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: ew-resize;
  }

  .modal-resize-left {
    left: 0;
  }

  .modal-resize-right {
    right: 0;
  }

  .modal-resize-bottom {
    right: 0;
    bottom: 0;
    left: 0;
    height: 8px;
    cursor: ns-resize;
  }
  </style>
