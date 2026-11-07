import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isChunkLoadFailure,
  reportUnexpectedError,
  resetErrorBannerThrottle,
} from '../src/services/globalErrors'
import { hideNotification, notificationState } from '../src/stores/notificationState'

describe('global error banner', () => {
  beforeEach(() => {
    resetErrorBannerThrottle()
    hideNotification()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    hideNotification()
    vi.restoreAllMocks()
  })

  it('recognizes failed chunk loads in Chromium, Safari and Firefox wording', () => {
    expect(
      isChunkLoadFailure(new TypeError('Failed to fetch dynamically imported module: /assets/x.js')),
    ).toBe(true)
    expect(isChunkLoadFailure(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadFailure(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadFailure(new Error('x is undefined'))).toBe(false)
  })

  it('offers a reload when part of the app failed to load', () => {
    reportUnexpectedError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'), 1000)
    expect(notificationState.visible).toBe(true)
    expect(notificationState.kind).toBe('error')
    expect(notificationState.action?.label).toBe('Reload')
  })

  it('shows other errors with their message and no button', () => {
    reportUnexpectedError(new Error('boom'), 1000)
    expect(notificationState.text).toContain('boom')
    expect(notificationState.action).toBeNull()
  })

  it('shows at most one banner per ten seconds', () => {
    reportUnexpectedError(new Error('first'), 1000)
    reportUnexpectedError(new Error('second'), 5000)
    expect(notificationState.text).toContain('first')
    reportUnexpectedError(new Error('third'), 12_000)
    expect(notificationState.text).toContain('third')
  })

  it('ignores browser noise', () => {
    reportUnexpectedError(new Error('ResizeObserver loop completed with undelivered notifications.'), 1000)
    expect(notificationState.visible).toBe(false)
  })
})
