/**
 * A pointer position in an SVG's own units (its viewBox), so editors keep working when the
 * SVG is scaled to fit a narrow screen. `viewWidth`/`viewHeight` are the viewBox size.
 *
 * Uses the SVG's screen transform where the browser has one: when the element's box and its
 * viewBox differ in aspect ratio, the drawing is scaled uniformly and centred (preserveAspectRatio
 * "xMidYMid meet"), which a plain box-to-viewBox stretch gets wrong by the empty band.
 */
export function svgPointFromEvent(
  svg: Element,
  event: { clientX: number; clientY: number },
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number } {
  const ctm = (svg as SVGGraphicsElement).getScreenCTM?.()
  if (ctm) {
    const m = ctm.inverse()
    return {
      x: m.a * event.clientX + m.c * event.clientY + m.e,
      y: m.b * event.clientX + m.d * event.clientY + m.f,
    }
  }
  const rect = svg.getBoundingClientRect()
  const scaleX = rect.width > 0 ? viewWidth / rect.width : 1
  const scaleY = rect.height > 0 ? viewHeight / rect.height : 1
  // The viewBox may start left of or above 0 (room for axis labels).
  const origin = (svg as SVGSVGElement).viewBox?.baseVal
  return {
    x: (origin?.x ?? 0) + (event.clientX - rect.left) * scaleX,
    y: (origin?.y ?? 0) + (event.clientY - rect.top) * scaleY,
  }
}
