import { describe, expect, it, vi } from 'vitest'

function fakeInput(id: string, name: string) {
  return { id, name, manufacturer: 'Acme', state: 'connected', onmidimessage: null as unknown }
}

describe('midi devices', () => {
  it('lists inputs on request, connects and disconnects them, and forwards their messages', async () => {
    vi.resetModules()
    const keys = fakeInput('a', 'Keys')
    const pads = fakeInput('b', 'Pads')
    const access = {
      inputs: new Map([
        ['a', keys],
        ['b', pads],
      ]),
      onstatechange: null as unknown,
    }
    const requestMIDIAccess = vi.fn(async () => access)
    vi.stubGlobal('navigator', { requestMIDIAccess })

    const { midiState, refreshMidiDevices, setMidiMessageHandler, toggleMidiDevice } =
      await import('../src/services/midi/devices')
    expect(requestMIDIAccess).not.toHaveBeenCalled() // nothing at import time

    await refreshMidiDevices()
    expect(midiState.devices.map((device) => device.name)).toEqual(['Keys', 'Pads'])

    const handler = vi.fn()
    setMidiMessageHandler(handler)
    toggleMidiDevice('a')
    expect(midiState.devices[0].connected).toBe(true)
    ;(keys.onmidimessage as (event: unknown) => void)({ data: [144, 60, 100] })
    expect(handler).toHaveBeenCalledTimes(1)

    toggleMidiDevice('a')
    expect(keys.onmidimessage).toBeNull()
    expect(midiState.devices[0].connected).toBe(false)

    await refreshMidiDevices()
    expect(requestMIDIAccess).toHaveBeenCalledTimes(1) // access is asked for once
    vi.unstubAllGlobals()
  })

  it('reports a refused permission', async () => {
    vi.resetModules()
    vi.stubGlobal('navigator', { requestMIDIAccess: vi.fn(async () => Promise.reject(new Error('denied'))) })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { midiState, refreshMidiDevices } = await import('../src/services/midi/devices')
    await refreshMidiDevices()
    expect(midiState.error).toMatch(/did not allow/)
    vi.unstubAllGlobals()
  })
})
