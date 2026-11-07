import { shallowRef } from 'vue'
import { hideDialog, isDialogOpen, showDialog } from '../../stores/dialogState'
import type { DialogDefinition } from './dialogs'

/**
 * What a dialog reads and writes. `openModal` fills the handler's reactive state from the
 * song and shows the window; the Vue component renders that state (no DOM access here).
 */
export abstract class BaseModalHandler {
  constructor(
    readonly modalId: string,
    readonly modalName: string,
  ) {}

  abstract openModal(params?: unknown): void

  protected showModal() {
    showDialog(this.modalId, this.modalName)
  }

  public closeModal() {
    hideDialog(this.modalId)
  }

  get isOpen(): boolean {
    return isDialogOpen(this.modalId)
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
}

/** A handler class (constructed without arguments, as the registry expects) for a plain dialog. */
export function definePlainModal<TParams = undefined>(dialog: DialogDefinition) {
  return class extends PlainModalHandler<TParams> {
    constructor() {
      super(dialog.id, dialog.name)
    }
  }
}
