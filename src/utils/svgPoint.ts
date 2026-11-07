/**
 * A pointer position in an SVG's own units (its viewBox), so editors keep working when the
 * SVG is scaled to fit a narrow screen. `viewWidth`/`viewHeight` are the viewBox size.
 */
export function svgPointFromEvent(
  svg: Element,
  event: { clientX: number; clientY: number },
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  const scaleX = rect.width > 0 ? viewWidth / rect.width : 1
  const scaleY = rect.height > 0 ? viewHeight / rect.height : 1
  return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY }
}
