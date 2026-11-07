// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { composeTabExportSvg } from '../src/services/tabExportSvg'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('composeTabExportSvg', () => {
  it('leaves the playhead, cursor, range overlay and click areas out of the export', () => {
    document.body.innerHTML = `
      <div class="guitar-tab-view">
        <svg class="tab-svg" width="400" height="200" xmlns="http://www.w3.org/2000/svg">
          <g class="tab-row">
            <text class="fret">7</text>
            <g class="range-selection-overlay"><rect style="fill: var(--tab-range)" /></g>
            <g class="selection-indicator"><rect style="fill: var(--tab-cursor)" /></g>
            <rect class="string-click-area" fill="transparent" />
          </g>
          <g id="playBackBarGroup0"><rect style="fill: var(--tab-playhead)" /></g>
        </svg>
      </div>`

    const markup = composeTabExportSvg()!.svgMarkup

    expect(markup).toContain('class="tab-row"')
    expect(markup).toContain('>7<')
    expect(markup).not.toMatch(
      /range-selection-overlay|selection-indicator|string-click-area|playBackBarGroup0/,
    )
    expect(markup).not.toContain('var(--')
  })

  it('inlines the style-sheet look, which a standalone SVG drawn as an image would lose', () => {
    document.body.innerHTML = `
      <style>.tab-string-line { stroke: rgb(1, 2, 3); stroke-width: 2px } .hidden { display: none }</style>
      <div class="guitar-tab-view">
        <svg class="tab-svg" width="400" height="200" xmlns="http://www.w3.org/2000/svg">
          <line class="tab-string-line" x1="0" x2="100" />
          <text class="hidden">editor only</text>
          <text class="tab-empty-hint">This track is empty.</text>
        </svg>
      </div>`

    const markup = composeTabExportSvg()!.svgMarkup

    expect(markup).toMatch(/<line[^>]*style="[^"]*stroke: rgb\(1, 2, 3\)/)
    expect(markup).not.toContain('editor only')
    expect(markup).not.toContain('This track is empty')
  })
})
