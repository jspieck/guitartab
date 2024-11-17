import { BaseModalHandler, ModalState } from './baseModalHandler';
import { MODALS } from './modalTypes';
import { Song } from '../songData';
import { svgDrawer } from '../svgDrawer';
import Helper from '../helper';
import { Chord } from '../songData';
import { modalManager } from './modalManager';

interface ChordManagerState extends ModalState {
    trackId?: number;
}

export class ChordManagerModalHandler extends BaseModalHandler {
    constructor() {
        super(MODALS.CHORD_MANAGER.id, MODALS.CHORD_MANAGER.name);
        this.modalState = {
            ...this.modalState
        } as ChordManagerState;
    }

    openModal(params: { trackId: number }): void {
        this.modalState.trackId = params.trackId;
        this.createChordManager(params.trackId);
        this.setupChordManagerButton();
        this.showModal();
    }

    protected setupModalContent(): void {
        if (this.modalState.trackId) {
            this.createChordManager(this.modalState.trackId);
        }
    }

    private createChordManager(trackId: number) {
        const container = document.getElementById('chordsContainer');
        if (!container) return;
        
        Helper.removeAllChildren(container);
        
        if (Song.chordsMap[trackId]) {
            Array.from(Song.chordsMap[trackId].entries())
                .forEach(([chordName, chord], index) => {
                    const chordBox = this.createChordBox(trackId, chordName, chord, index);
                    container.appendChild(chordBox);
                });
        }

        document.getElementById('addChordDiagram')?.addEventListener('click', () => {
            modalManager.toggleByModal(MODALS.ADD_CHORD, { trackId });
        });
    }

    private setupChordManagerButton() {
        this.setupSelectButton('chordDiagramSelectButton', () => {
            svgDrawer.redrawChordDiagrams();
            this.closeModal();
        });
    }

    private createChordBox(trackId: number, chordName: string, chord: Chord, chordCounter: number): HTMLElement {
        const chordBox = document.createElement('div');
        chordBox.className = 'chordBox';
        
        // Create chord name label
        const chordNameLabel = document.createElement('div');
        chordNameLabel.className = 'chordName';
        chordNameLabel.textContent = chordName;
        chordBox.appendChild(chordNameLabel);

        // Create SVG container for chord diagram
        const svgContainer = document.createElement('div');
        svgContainer.className = 'chordDiagram';
        svgContainer.id = `chord_${chordCounter}`;
        chordBox.appendChild(svgContainer);

        // Create chord diagram
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100');
        svg.setAttribute('height', '120');
        svgContainer.appendChild(svg);

        // Draw chord diagram
        this.drawChordDiagram(svg, chord);

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'chordButtons';

        // Edit button
        const editButton = document.createElement('button');
        editButton.className = 'editChord';
        editButton.textContent = 'Edit';
        editButton.onclick = () => {
            modalManager.toggleByModal(MODALS.ADD_CHORD, {
                trackId,
                existingChord: {
                    ...chord,
                    name: chordName
                }
            });
        };
        buttonContainer.appendChild(editButton);

        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'deleteChord';
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = () => {
            if (confirm(`Delete chord ${chordName}?`)) {
                Song.chordsMap[trackId].delete(chordName);
                this.createChordManager(trackId);
                svgDrawer.redrawChordDiagrams();
            }
        };
        buttonContainer.appendChild(deleteButton);

        // Toggle visibility button
        const visibilityButton = document.createElement('button');
        visibilityButton.className = 'toggleChordVisibility';
        visibilityButton.textContent = chord.display ? 'Hide' : 'Show';
        visibilityButton.onclick = () => {
            chord.display = !chord.display;
            visibilityButton.textContent = chord.display ? 'Hide' : 'Show';
            svgDrawer.redrawChordDiagrams();
        };
        buttonContainer.appendChild(visibilityButton);

        chordBox.appendChild(buttonContainer);
        return chordBox;
    }

    private drawChordDiagram(svg: SVGElement, chord: Chord): void {
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