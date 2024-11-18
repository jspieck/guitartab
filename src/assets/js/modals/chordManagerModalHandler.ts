import { BaseModalHandler, ModalState } from './baseModalHandler';
import { MODALS } from './modalTypes';
import { Chord } from '../songData';

interface ChordManagerState extends ModalState {
    trackId: number;
}

export class ChordManagerModalHandler extends BaseModalHandler {
    constructor() {
        super(MODALS.CHORD_MANAGER.id, MODALS.CHORD_MANAGER.name);
        this.modalState = {
            ...this.modalState,
            trackId: 0
        } as ChordManagerState;
    }

    protected setupModalContent(): void {}

    openModal(params: { trackId: number }): void {
        this.modalState.trackId = params.trackId;
        this.showModal();
    }

    public getTrackId(): number {
        return this.modalState.trackId;
    }

    public drawChordDiagram(svg: SVGElement, chord: Chord): void {
        const width = 80;
        const height = 100;
        const stringSpacing = height / 5;
        const fretSpacing = width / 4;
        const padding = 10;

        // Draw frets
        for (let i = 0; i <= 5; i++) {
            const y = padding + i * stringSpacing;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding.toString());
            line.setAttribute('y1', y.toString());
            line.setAttribute('x2', (width + padding).toString());
            line.setAttribute('y2', y.toString());
            line.setAttribute('stroke', '#000');
            line.setAttribute('stroke-width', i === 0 ? '2' : '1');
            svg.appendChild(line);
        }

        // Draw strings
        for (let i = 0; i < 6; i++) {
            const x = padding + i * fretSpacing;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x.toString());
            line.setAttribute('y1', padding.toString());
            line.setAttribute('x2', x.toString());
            line.setAttribute('y2', (height + padding).toString());
            line.setAttribute('stroke', '#000');
            line.setAttribute('stroke-width', '1');
            svg.appendChild(line);
        }

        // Draw capo if present
        if (chord.capo > 0) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', '5');
            text.setAttribute('y', '15');
            text.setAttribute('font-size', '12');
            text.textContent = chord.capo.toString();
            svg.appendChild(text);
        }

        // Draw fret positions
        chord.frets.forEach((fret: number, index: number) => {
            if (fret === -1) {
                // Draw X for muted string
                const x = padding + index * fretSpacing;
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', (x - 3).toString());
                text.setAttribute('y', '8');
                text.setAttribute('font-size', '12');
                text.textContent = 'x';
                svg.appendChild(text);
            } else if (fret === 0) {
                // Draw O for open string
                const x = padding + index * fretSpacing;
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x.toString());
                circle.setAttribute('cy', '8');
                circle.setAttribute('r', '3');
                circle.setAttribute('stroke', '#000');
                circle.setAttribute('fill', 'none');
                svg.appendChild(circle);
            } else {
                // Draw finger position
                const x = padding + index * fretSpacing;
                const y = padding + (fret - 0.5) * stringSpacing;
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x.toString());
                circle.setAttribute('cy', y.toString());
                circle.setAttribute('r', '5');
                circle.setAttribute('fill', '#000');
                svg.appendChild(circle);

                // Draw finger number if available
                if (chord.fingers?.[index]) {
                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    text.setAttribute('x', (x - 3).toString());
                    text.setAttribute('y', (y + 4).toString());
                    text.setAttribute('font-size', '10');
                    text.setAttribute('fill', '#fff');
                    text.textContent = chord.fingers[index]?.toString() ?? '';
                    svg.appendChild(text);
                }
            }
        });
    }
} 