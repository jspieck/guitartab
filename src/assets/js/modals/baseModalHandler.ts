import { modalManager } from './modalManager';

export interface ModalState {
    bound: boolean;
    modalId: string;
    modalName: string;
    [key: string]: any;
}

export abstract class BaseModalHandler {
    protected modalState: ModalState;

    constructor(modalId: string, modalName: string) {
        this.modalState = {
            bound: false,
            modalId,
            modalName
        };
    }

    abstract openModal(params?: any): void;

    protected abstract setupModalContent(): void;

    protected showModal() {
        this.initializeIfNeeded(() => {
            this.setupModalContent();
        });
        modalManager.displayModal(this.modalState.modalId, this.modalState.modalName);
    }

    public closeModal() {
        modalManager.closeModal(this.modalState.modalId);
    }

    protected initializeIfNeeded(initFunction: () => void) {
        if (!this.modalState.bound) {
            initFunction();
            this.modalState.bound = true;
        }
    }

    protected setupSelectButton(
        buttonId: string,
        onSelect: () => void
    ) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.onclick = () => {
                onSelect();
                this.closeModal();
            };
        }
    }

    protected setupSelect(
        selectId: string,
        onChange: (value: string) => void
    ) {
        const select = document.getElementById(selectId) as HTMLSelectElement;
        if (select) {
            select.onchange = () => {
                const value = select.options[select.selectedIndex].value;
                onChange(value);
            };
        }
    }

    get modalId() {
        return this.modalState.modalId;
    }

    get modalName() {
        return this.modalState.modalName;
    }
} 