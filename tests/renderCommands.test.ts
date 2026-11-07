import { describe, expect, it } from 'vitest'
import {
  requestBlockRender,
  requestBlocksRender,
  requestChordDiagramsRender,
  requestTrackDeleteRender,
} from '../src/services/editor/renderCommands'
import { barVersion, renderVersionState } from '../src/stores/renderVersionState'

describe('renderCommands', () => {
  it('bump the version of the bars they name and of the song', () => {
    const song = renderVersionState.song
    requestBlockRender(1, 2, 0)
    expect(barVersion(1, 2)).toBe(1)
    requestBlocksRender(1, [2, 3], 0)
    expect([barVersion(1, 2), barVersion(1, 3), barVersion(0, 2)]).toEqual([2, 1, 0])
    expect(renderVersionState.song).toBe(song + 2)
  })

  it('bump the chord version for chord library changes', () => {
    const chords = renderVersionState.chords
    const song = renderVersionState.song
    requestChordDiagramsRender()
    expect(renderVersionState.chords).toBe(chords + 1)
    expect(renderVersionState.song).toBe(song + 1)
  })

  it('redraw everything for a deleted track', () => {
    const song = renderVersionState.song
    requestTrackDeleteRender(2)
    expect(renderVersionState.song).toBe(song + 1)
  })
})
