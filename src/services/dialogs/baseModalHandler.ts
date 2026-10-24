import { shallowRef } from 'vue'
import { modalManager } from './modalManager'

export interface ModalState {
  bound: boolean
  modalId: string
  modalName: string
  // each dialog keeps its own fields here (typing them per dialog: BaseModalHandler<State>)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export abstract class BaseModalHandler {
  protected modalState: ModalState

  constructor(modalId: string, modalName: string) {
    this.modalState = {
      bound: false,
      modalId,
      modalName,
    }
  }

  abstract openModal(params?: unknown): void

  protected abstract setupModalContent(): void

  protected showModal() {
    this.initializeIfNeeded(() => {
      this.setupModalContent()
    })
    modalManager.displayModal(this.modalState.modalId, this.modalState.modalName)
  }

  public closeModal() {
    modalManager.closeModal(this.modalState.modalId)
  }

  protected initializeIfNeeded(initFunction: () => void) {
    if (!this.modalState.bound) {
      initFunction()
      this.modalState.bound = true
    }
  }

  protected setupSelectButton(buttonId: string, onSelect: () => void) {
    const button = document.getElementById(buttonId)
    if (button) {
      button.onclick = () => {
        onSelect()
        this.closeModal()
      }
    }
  }

  protected setupSelect(selectId: string, onChange: (value: string) => void) {
    const select = document.getElementById(selectId) as HTMLSelectElement
    if (select) {
      select.onchange = () => {
        const value = select.options[select.selectedIndex].value
        onChange(value)
      }
    }
  }

  get modalId() {
    return this.modalState.modalId
  }

  get modalName() {
    return this.modalState.modalName
  }
}

/**
 * A dialog whose Vue component does all the work. `params` (reactive) holds
 * what it was last opened with, e.g. `{ trackId }` for the chord manager.
 */
export class PlainModalHandler<TParams = undefined> extends BaseModalHandler {
  readonly params = shallowRef<TParams | undefined>(undefined)

  openModal(params?: TParams) {
    this.params.value = params
    this.showModal()
  }

  protected setupModalContent(): void {}
}

/** A handler class (constructed without arguments, as `modalTypes` expects) for a plain dialog. */
export function definePlainModal<TParams = undefined>(id: string, name: string) {
  return class extends PlainModalHandler<TParams> {
    constructor() {
      super(id, name)
    }
  }
}
