/**
 * DOM Utilities
 * 
 * Common DOM manipulation functions extracted from various parts of the codebase.
 * Provides type-safe, reusable DOM operations.
 */

import fastdom from 'fastdom'

// =============================================================================
// Element Manipulation
// =============================================================================

/**
 * Remove all children from a DOM element
 */
export function removeAllChildren(element: HTMLElement | SVGElement | null): void {
  if (!element) return
  while (element.lastChild) {
    element.removeChild(element.lastChild)
  }
}

/**
 * Safely remove an element from its parent
 */
export function removeElement(element: HTMLElement | SVGElement | null): void {
  if (element?.parentNode) {
    element.parentNode.removeChild(element)
  }
}

/**
 * Create an SVG element with the correct namespace
 */
export function createSVGElement<K extends keyof SVGElementTagNameMap>(
  tagName: K,
  attributes?: Record<string, string | number>
): SVGElementTagNameMap[K] {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tagName)
  
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, String(value))
    }
  }
  
  return element
}

/**
 * Create an HTML element with optional attributes and content
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options?: {
    attributes?: Record<string, string | number>
    className?: string
    textContent?: string
    innerHTML?: string
  }
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName)
  
  if (options?.attributes) {
    for (const [key, value] of Object.entries(options.attributes)) {
      element.setAttribute(key, String(value))
    }
  }
  
  if (options?.className) {
    element.className = options.className
  }
  
  if (options?.textContent) {
    element.textContent = options.textContent
  }
  
  if (options?.innerHTML) {
    element.innerHTML = options.innerHTML
  }
  
  return element
}

// =============================================================================
// Query Helpers
// =============================================================================

/**
 * Type-safe querySelector
 */
export function $(selector: string): HTMLElement | null {
  return document.querySelector(selector)
}

/**
 * Type-safe querySelectorAll
 */
export function $$(selector: string): NodeListOf<HTMLElement> {
  return document.querySelectorAll(selector)
}

/**
 * Get element by ID with type
 */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null
}

// =============================================================================
// Style Helpers
// =============================================================================

/**
 * Set multiple CSS styles on an element
 */
export function setStyles(
  element: HTMLElement | SVGElement,
  styles: Partial<CSSStyleDeclaration>
): void {
  Object.assign(element.style, styles)
}

/**
 * Toggle visibility of an element
 */
export function toggleVisibility(element: HTMLElement | null, visible: boolean): void {
  if (!element) return
  element.style.display = visible ? '' : 'none'
}

/**
 * Show an element
 */
export function show(element: HTMLElement | null): void {
  toggleVisibility(element, true)
}

/**
 * Hide an element
 */
export function hide(element: HTMLElement | null): void {
  toggleVisibility(element, false)
}

// =============================================================================
// Class Manipulation
// =============================================================================

/**
 * Add multiple classes to an element
 */
export function addClasses(element: HTMLElement | SVGElement | null, ...classes: string[]): void {
  if (!element) return
  element.classList.add(...classes)
}

/**
 * Remove multiple classes from an element
 */
export function removeClasses(element: HTMLElement | SVGElement | null, ...classes: string[]): void {
  if (!element) return
  element.classList.remove(...classes)
}

/**
 * Toggle a class on an element
 */
export function toggleClass(
  element: HTMLElement | SVGElement | null,
  className: string,
  force?: boolean
): void {
  if (!element) return
  element.classList.toggle(className, force)
}

// =============================================================================
// Event Helpers
// =============================================================================

/**
 * Add event listener with automatic cleanup function
 */
export function addListener<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | Window | Document | null,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions
): () => void {
  if (!element) return () => {}
  
  element.addEventListener(event, handler as EventListener, options)
  
  return () => {
    element.removeEventListener(event, handler as EventListener, options)
  }
}

/**
 * One-time event listener
 */
export function once<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | null,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void
): void {
  if (!element) return
  element.addEventListener(event, handler as EventListener, { once: true })
}

// =============================================================================
// Animation Helpers
// =============================================================================

/**
 * Easing function for smooth animations
 */
export function easeInOutQuad(t: number, b: number, c: number, d: number): number {
  let t2 = t / (d / 2)
  if (t2 < 1) {
    return (c / 2) * t2 * t2 + b
  }
  t2 -= 1
  return (-c / 2) * (t2 * (t2 - 2) - 1) + b
}

/**
 * Smooth scroll to a position
 */
export function smoothScrollTo(
  element: HTMLElement,
  from: number,
  to: number,
  duration: number
): void {
  const start = from
  const change = to - start
  const startTime = Date.now()
  const increment = 20

  const animateScroll = () => {
    const currentTime = Date.now() - startTime
    const val = easeInOutQuad(currentTime, start, change, duration)
    
    fastdom.mutate(() => {
      element.scrollTop = val
    })
    
    if (currentTime < duration) {
      setTimeout(animateScroll, increment)
    }
  }
  
  animateScroll()
}

/**
 * Request animation frame with automatic cancellation
 */
export function animationFrame(callback: FrameRequestCallback): () => void {
  const id = requestAnimationFrame(callback)
  return () => cancelAnimationFrame(id)
}

// =============================================================================
// Measurement Helpers
// =============================================================================

/**
 * Get element's bounding rect
 */
export function getBounds(element: HTMLElement | SVGElement | null): DOMRect | null {
  return element?.getBoundingClientRect() ?? null
}

/**
 * Check if element is in viewport
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

/**
 * Get scroll position
 */
export function getScrollPosition(): { x: number; y: number } {
  return {
    x: window.pageXOffset || document.documentElement.scrollLeft,
    y: window.pageYOffset || document.documentElement.scrollTop
  }
}

// =============================================================================
// Input Helpers
// =============================================================================

/**
 * Get input value safely
 */
export function getInputValue(selector: string): string {
  const element = document.querySelector(selector) as HTMLInputElement | null
  return element?.value ?? ''
}

/**
 * Set input value safely
 */
export function setInputValue(selector: string, value: string): void {
  const element = document.querySelector(selector) as HTMLInputElement | null
  if (element) {
    element.value = value
  }
}

/**
 * Check if an input element is focused
 */
export function isInputFocused(): boolean {
  const active = document.activeElement
  const inputs = ['INPUT', 'SELECT', 'TEXTAREA']
  return active !== null && inputs.includes(active.tagName)
}
