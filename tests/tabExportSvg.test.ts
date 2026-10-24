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
})
