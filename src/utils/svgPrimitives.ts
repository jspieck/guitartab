// Colours are set as inline styles, not presentation attributes: only styles accept var(--token),
// so the editors follow the light/dark theme.

export function createText(
  x: number,
  y: number,
  text: string,
  fontSize: string,
  fill: string,
  fontFamily = 'Source Sans Pro',
): SVGTextElement {
  if (!isFinite(x)) {
    console.warn(`Invalid x coordinate for text element: ${x}, using default position`)
    x = 0
  }
  if (!isFinite(y)) {
    console.warn(`Invalid y coordinate for text element: ${y}, using default position`)
    y = 20
  }

  const textElem = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  textElem.setAttribute('x', x.toString())
  textElem.setAttribute('y', y.toString())
  textElem.textContent = text
  textElem.style.fontSize = fontSize
  textElem.style.fill = fill
  textElem.setAttribute('font-family', fontFamily)
  return textElem
}

export function createPath(path: string, stroke: string, strokeWidth: string, fill: string): SVGPathElement {
  const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  pathElem.setAttribute('d', path)
  pathElem.style.stroke = stroke
  pathElem.style.strokeWidth = strokeWidth
  pathElem.style.fill = fill
  return pathElem
}

export function createCircle(
  cx: number,
  cy: number,
  radius: number,
  stroke: string,
  strokeWidth: string,
  fill: string,
): SVGCircleElement {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  circle.setAttribute('cx', cx.toString())
  circle.setAttribute('cy', cy.toString())
  circle.setAttribute('r', radius.toString())
  circle.style.stroke = stroke
  circle.style.strokeWidth = strokeWidth
  circle.style.fill = fill
  return circle
}

export function drawPoint(
  xPos: number,
  yPos: number,
  paddingTop: number,
  paddingLeft: number,
  radius: number,
  svgParent: SVGElement,
  text: string,
): SVGGElement {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  svgParent.appendChild(group)
  const pointElem = createCircle(
    xPos + paddingLeft,
    yPos + paddingTop,
    radius,
    'none',
    '1',
    'var(--editor-point)',
  )
  group.appendChild(pointElem)
  if (text != null) {
    group.appendChild(
      createText(xPos - 3, yPos + paddingTop + 4, text, '13px', 'var(--editor-on-point)', 'Source Sans Pro'),
    )
  }
  return group
}

export function connectPoints(pointA: SVGElement, pointB: SVGElement, svgElem: SVGElement): SVGPathElement {
  const pathStr = `M${pointA.getAttribute('cx')} ${pointA.getAttribute('cy')}L${pointB.getAttribute('cx')} ${pointB.getAttribute('cy')}`
  const pathEl = createPath(pathStr, 'var(--editor-point)', '2', 'none')
  pathEl.setAttribute('class', 'pointConnectionLine')
  svgElem.appendChild(pathEl)
  return pathEl
}
