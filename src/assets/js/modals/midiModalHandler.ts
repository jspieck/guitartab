import { BaseModalHandler } from './baseModalHandler';

export class MidiModalHandler extends BaseModalHandler {
    constructor() {
        super('MidiModal', 'Midi');
    }

    public override openModal(): void {
        this.refreshMidiDevices();
    }

    private async refreshMidiDevices(): Promise<void> {
        const deviceList = document.getElementById('midiDeviceListBody');
        if (!deviceList) return;
        
        deviceList.innerHTML = '';
        
        if (navigator.requestMIDIAccess) {
            try {
                const midiAccess = await navigator.requestMIDIAccess();
                
                for (const input of midiAccess.inputs.values()) {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${input.name}</td>
                        <td>${input.manufacturer}</td>
                        <td>${input.state}</td>
                    `;
                    deviceList.appendChild(row);
                }
            } catch (err) {
                console.error('Failed to get MIDI access:', err);
            }
        } else {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="3">MIDI is not supported in this browser</td>';
            deviceList.appendChild(row);
        }
    }

    public override setupModalContent(): void {
        this.refreshMidiDevices();
    }
}
