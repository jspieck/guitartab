import { BaseModalHandler } from './baseModalHandler'
import { MODALS, ModalDefinition } from './modalTypes'
import fastdom from 'fastdom'
import interact from 'interactjs'

interface ResizeOptions {
  left: boolean
  right: boolean
  bottom: boolean
  top: boolean
}

export interface InteractEvent {
  target: HTMLElement
  dx: number
  dy: number
}

export class ModalManager {
  private windows: Map<string, number> = new Map()
  private handlers: Map<string, BaseModalHandler>

  constructor() {
    // Initialize handlers using modal definitions
    this.handlers = new Map(
      Object.values(MODALS).map((modal) => {
        return [modal.id, new modal.handlerClass()]
      }),
    )

    this.setupTopBarHandlers()
  }

  private setupTopBarHandlers() {
    document.querySelectorAll('.hideTopBar, .eyeToggle').forEach((elem) => {
      elem.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement
        const modal = target?.parentNode?.parentNode as HTMLElement
        if (modal) {
          this.toggleTopBar(modal)
        }
      })
    })
  }

  // Window Management Methods
  displayModal(id: string, name: string) {
    if (this.windows.has(id)) {
      return
    }

    const modal = document.getElementById(id)
    if (modal == null) {
      // The modal windows mount lazily (ModalsContainer). Opening one before that used to
      // mark it open without showing it, so the next toggle "closed" an invisible window.
      this.displayWhenMounted(id, name)
      return
    }

    this.windows.set(id, new Date().getTime())
    document.getElementById('content')?.classList.add('blurFilter')
    modal.classList.add('active')
    this.setupModalPosition(modal)
    this.setupModalListeners(modal, id, name)
  }

  private pendingDisplays = new Set<string>()

  private displayWhenMounted(id: string, name: string, timeoutMs = 10_000) {
    if (this.pendingDisplays.has(id)) return
    this.pendingDisplays.add(id)
    const finish = () => {
      observer.disconnect()
      clearTimeout(timer)
      this.pendingDisplays.delete(id)
    }
    const observer = new MutationObserver(() => {
      if (document.getElementById(id) == null) return
      finish()
      this.displayModal(id, name)
    })
    const timer = setTimeout(finish, timeoutMs)
    observer.observe(document.body, { childList: true, subtree: true })
  }

  closeModal(id: string) {
    fastdom.mutate(() => {
      this.windows.delete(id)
      this.removeWindowMarker(id)
      const modal = document.getElementById(id)
      if (modal) {
        modal.removeEventListener('mousedown', () => this.moveToFront(id))
        modal.classList.remove('active')
      }
    })
  }

  // Public API Methods
  getHandler<T extends BaseModalHandler>(type: string): T {
    const handler = this.handlers.get(type)
    if (!handler) {
      throw new Error(`No handler found for type: ${type}`)
    }
    return handler as T
  }

  toggleModal(id: string, name: string) {
    if (this.windows.has(id)) {
      this.closeModal(id)
    } else {
      this.displayModal(id, name)
    }
  }

  closeAllModals() {
    Array.from(this.windows.keys()).forEach((id) => {
      this.closeModal(id)
    })
    document.getElementById('content')?.classList.remove('blurFilter')
  }

  isModalOpen(id: string): boolean {
    return this.windows.has(id)
  }

  isAnyModalOpen(): boolean {
    return this.windows.size > 0
  }

  // Private Helper Methods
  /** Moves an open modal back inside the window, e.g. after its content grew. */
  keepInViewport(id: string) {
    const modal = document.getElementById(id)
    if (modal == null) {
      return
    }
    const rect = modal.getBoundingClientRect()
    const margin = 12
    const x = Math.max(margin, Math.min(rect.left, window.innerWidth - rect.width - margin))
    const y = Math.max(margin, Math.min(rect.top, window.innerHeight - rect.height - margin))
    if (x === rect.left && y === rect.top) {
      return
    }
    // left/top are applied before the modal's translateY offset, so shift by the delta.
    const left = parseFloat(modal.style.left || '0') + (x - rect.left)
    const top = parseFloat(modal.style.top || '0') + (y - rect.top)
    modal.style.left = `${left}px`
    modal.style.top = `${top}px`
    modal.setAttribute('data-x', left.toString())
    modal.setAttribute('data-y', top.toString())
  }

  private setupModalPosition(modal: HTMLElement) {
    const { height, width } = modal.getBoundingClientRect()
    const x = window.innerWidth / 2 - width / 2
    const y = window.innerHeight / 2 - height / 2

    modal.style.left = `${x}px`
    modal.style.top = `${y}px`
    modal.setAttribute('data-x', x.toString())
    modal.setAttribute('data-y', y.toString())
  }

  private setupModalListeners(modal: HTMLElement, id: string, name: string) {
    modal.querySelector('.modal_close')?.addEventListener('click', () => {
      this.closeModal(id)
    })
    this.addDragging(id)
    this.orderWindows()
    modal.addEventListener('mousedown', () => this.moveToFront(id))
    this.addWindowMarker(id, name)
  }

  protected moveToFront(id: string) {
    this.windows.set(id, new Date().getTime())
    this.orderWindows()
  }

  protected orderWindows() {
    const sortFunc = (a: [string, number], b: [string, number]) => a[1] - b[1]
    const windowOrder = new Map([...this.windows.entries()].sort(sortFunc))
    let zIndex = 200
    for (const key of windowOrder.keys()) {
      document.getElementById(key)!.style.zIndex = zIndex.toString()
      zIndex += 1
    }
  }

  private dragMoveListener(event: InteractEvent) {
    const target = event.target
    if (target != null) {
      const x = (parseFloat(target.getAttribute('data-x')!) || 0) + event.dx
      const y = (parseFloat(target.getAttribute('data-y')!) || 0) + event.dy

      target.style.left = `${x}px`
      target.style.top = `${y}px`

      target.setAttribute('data-x', x.toString())
      target.setAttribute('data-y', y.toString())
    }
  }

  protected addDragging(id: string) {
    interact(`#${id}`)
      .draggable({
        allowFrom: '.modalTopBar',
        onmove: this.dragMoveListener,
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'window',
            elementRect: { top: 0, left: 0, bottom: 1, right: 1 },
          }),
        ],
      })
      .pointerEvents({
        allowFrom: '.modalTopBar',
      })

    if (id === 'mixerModal' || id === 'infoModal' || id === 'chordManagerModal' || id === 'pianoModal') {
      this.addResizable(id, {
        left: true,
        right: true,
        bottom: false,
        top: false,
      })
    } else if (id === 'guitarModal') {
      this.addResizable(id, {
        left: true,
        right: true,
        bottom: true,
        top: false,
      })
    }
  }

  private addWindowMarker(id: string, name: string) {
    const area = document.getElementById('openWindowArea')!
    const footerBlock = document.createElement('div')
    footerBlock.setAttribute('id', `${id}Marker`)
    footerBlock.setAttribute('class', 'footerBlock')
    const openWindow = document.createElement('div')
    openWindow.setAttribute('class', 'openWindows')
    openWindow.setAttribute('draggable', 'false')
    openWindow.textContent = name
    footerBlock.appendChild(openWindow)
    area.appendChild(footerBlock)
    footerBlock.addEventListener('mousedown', () => {
      this.moveToFront(id)
    })
  }

  private removeWindowMarker(id: string) {
    const block = document.getElementById(`${id}Marker`)
    if (block?.parentNode) {
      block.parentNode.removeChild(block)
    } else {
      console.error('Window Marker not existent!')
    }
  }

  protected addResizable(id: string, options: ResizeOptions) {
    interact(`#${id}`)
      .resizable({
        margin: 20,
        edges: options,
        modifiers: [
          interact.modifiers.restrictSize({
            min: { width: 185, height: 50 },
          }),
        ],
        inertia: true,
      })
      .on('resizemove', (event) => {
        const { target } = event
        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.deltaRect.left
        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.deltaRect.top

        // update the element's style
        target.style.width = `${event.rect.width}px`
        if (options.bottom || options.top) target.style.height = `${event.rect.height}px`

        target.style.left = `${x}px`
        target.style.top = `${y}px`

        target.setAttribute('data-x', x.toString())
        target.setAttribute('data-y', y.toString())
      })
  }

  private toggleTopBar(modal: HTMLElement) {
    modal.querySelector('.hideTopBar')?.classList.toggle('active')
  }

  toggleModalByType<T extends keyof typeof MODALS>(type: T) {
    const config = this.getModalConfig(type)
    this.toggleModal(config.id, config.name)
  }

  private getModalConfig<T extends keyof typeof MODALS>(type: T): ModalDefinition {
    return MODALS[type]
  }

  toggleByModal(modal: ModalDefinition, params?: unknown) {
    const handler = this.getHandler(modal.id)
    if (this.windows.has(modal.id)) {
      this.closeModal(modal.id)
    } else {
      this.displayModal(modal.id, modal.name)
      if (params) {
        handler.openModal(params)
      } else {
        handler.openModal()
      }
    }
  }
}

export const modalManager = new ModalManager()
