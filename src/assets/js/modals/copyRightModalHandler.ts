import { BaseModalHandler } from "./baseModalHandler";
import { MODALS } from "./modalTypes";

export class CopyrightModalHandler extends BaseModalHandler {
    constructor() {
        super(MODALS.COPYRIGHT.id, MODALS.COPYRIGHT.name);
    }

    openModal(): void {
        this.showModal();
    }

    setupModalContent(): void {}
}
