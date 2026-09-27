import { describe, expect, it, vi, beforeEach } from 'vitest'
import { buildChordThumbnailMarkers } from '../src/services/editor/chordThumbnailLayout'
import { buildJpegPdf } from '../src/services/pdfExport'
import { composeTabExportSvg, computeExportBounds } from '../src/services/tabExportSvg'
import type { Chord } from '../src/types/tab'

vi.mock('../src/assets/js/appManager', () => ({
  default: {
    showNotification: vi.fn(),
  },
}))

function chord(partial: Partial<Chord> & Pick<Chord, 'name' | 'frets'>): Chord {
  return {
    capo: 1,
    fingers: [0, 0, 0, 0, 0, 0],
    chordType: 'maj',
    chordRoot: 'C',
    display: true,
    ...partial,
  }
}

describe('chordThumbnailLayout', () => {
  it('marks open and fretted strings', () => {
    const markers = buildChordThumbnailMarkers(chord({
      name: 'Am',
      frets: [0, 0, 2, 2, 1, 0],
    }))
    expect(markers.filter((m) => m.kind === 'open')).toHaveLength(3)
    expect(markers.filter((m) => m.kind === 'finger')).toHaveLength(3)
  })

  it('marks muted strings as crosses', () => {
    const markers = buildChordThumbnailMarkers(chord({
      name: 'D',
      frets: [-1, -1, 0, 2, 3, 2],
    }))
    expect(markers.filter((m) => m.kind === 'cross')).toHaveLength(2)
  })
})

describe('userNotifications', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('routes errors through AppManager.showNotification', async () => {
    const { default: AppManager } = await import('../src/assets/js/appManager')
    const { showUserError } = await import('../src/services/userNotifications')
    showUserError('boom')
    await vi.waitFor(() => {
      expect(AppManager.showNotification).toHaveBeenCalledWith('boom', 'error')
    })
  })
})

describe('pdfExport', () => {
  it('builds a PDF blob from JPEG page bytes', () => {
    const jpeg = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9])
    const blob = buildJpegPdf([{ jpeg, widthPx: 1, heightPx: 1 }])
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(100)
  })

  it('reports missing tab SVG via error banner', async () => {
    const { default: AppManager } = await import('../src/assets/js/appManager')
    vi.mocked(AppManager.showNotification).mockClear()
    const { exportTabAsPdf } = await import('../src/services/pdfExport')
    await exportTabAsPdf()
    await vi.waitFor(() => {
      expect(AppManager.showNotification).toHaveBeenCalledWith(
        'No tab view found to export.',
        'error',
      )
    })
  })
})

describe('tabExportSvg', () => {
  it('expands bounds to fit classical layers', () => {
    const bounds = computeExportBounds(
      { width: 400, height: 200 },
      [{ left: 0, top: 180, width: 200, height: 80 }],
    )
    expect(bounds).toEqual({ width: 400, height: 260 })
  })

  it('returns null without a mounted tab view', () => {
    expect(composeTabExportSvg()).toBeNull()
  })
})
