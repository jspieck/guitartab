import { reactive } from 'vue'

// Web MIDI types; this TypeScript version's DOM lib does not have them yet.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- global type namespace, no runtime code
  namespace WebMidi {
    interface MIDIAccess {
      inputs: Map<string, MIDIInput>
      outputs: Map<string, MIDIOutput>
      onstatechange: ((event: MIDIConnectionEvent) => void) | null
    }

    interface MIDIPort {
      id: string
      manufacturer: string
      name: string
      connection: string
      state: string
      type: string
    }

    interface MIDIInput extends MIDIPort {
      onmidimessage: ((event: MIDIMessageEvent) => void) | null
      close(): void
    }

    type MIDIOutput = MIDIPort

    interface MIDIMessageEvent {
      data: Uint8Array
      timeStamp: number
    }

    interface MIDIConnectionEvent {
      port: MIDIInput | MIDIOutput
    }
  }

  interface Navigator {
    requestMIDIAccess(options?: { sysex?: boolean }): Promise<WebMidi.MIDIAccess>
  }
}

/** One MIDI input as the MIDI dialog lists it. */
export interface MidiDevice {
  id: string
  name: string
  manufacturer: string
  state: string
  /** Notes from this device are played and entered. */
  connected: boolean
}

export const midiState = reactive({
  supported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
  devices: [] as MidiDevice[],
  /** Set when the browser refused access. */
  error: '',
})

type MessageHandler = (event: WebMidi.MIDIMessageEvent) => void

let access: WebMidi.MIDIAccess | null = null
let onMessage: MessageHandler = () => {}
const connectedIds = new Set<string>()

/** What happens with incoming messages (the MIDI engine's note on/off). */
export function setMidiMessageHandler(handler: MessageHandler): void {
  onMessage = handler
}

function listDevices(): void {
  if (access == null) return
  midiState.devices = [...access.inputs.values()].map((input) => ({
    id: input.id,
    name: input.name ?? 'Unknown device',
    manufacturer: input.manufacturer ?? '',
    state: input.state,
    connected: connectedIds.has(input.id),
  }))
}

/**
 * Asks for MIDI access (the browser may prompt the first time) and lists the
 * inputs. Called when the MIDI dialog opens, not at startup.
 */
export async function refreshMidiDevices(): Promise<void> {
  if (!midiState.supported) return
  try {
    if (access == null) {
      access = await navigator.requestMIDIAccess({ sysex: false })
      access.onstatechange = listDevices
    }
    midiState.error = ''
    listDevices()
  } catch (error) {
    midiState.error = 'The browser did not allow access to MIDI devices.'
    console.warn('MIDI access refused', error)
  }
}

/** Connects or disconnects one input. */
export function toggleMidiDevice(id: string): void {
  const input = access?.inputs.get(id)
  if (input == null) return
  if (connectedIds.has(id)) {
    connectedIds.delete(id)
    input.onmidimessage = null
  } else {
    connectedIds.add(id)
    input.onmidimessage = (event) => onMessage(event)
  }
  listDevices()
}
