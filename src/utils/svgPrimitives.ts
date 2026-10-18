export function createRect(
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: string,
  strokeWidth: string,
  fill: string,
): SVGRectElement {
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('x', x.toString())
  rect.setAttribute('y', y.toString())
  rect.style.width = width.toString()
  rect.style.height = height.toString()
  rect.style.stroke = stroke
  rect.style.strokeWidth = strokeWidth
  rect.style.fill = fill
  return rect
}

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
  pathElem.setAttribute('stroke', stroke)
  pathElem.setAttribute('stroke-width', strokeWidth)
  pathElem.setAttribute('fill', fill)
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
  circle.setAttribute('stroke', stroke)
  circle.setAttribute('stroke-width', strokeWidth)
  circle.setAttribute('fill', fill)
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
  const pointElem = createCircle(xPos + paddingLeft, yPos + paddingTop, radius, 'none', '1', '#123e74')
  group.appendChild(pointElem)
  if (text != null) {
    group.appendChild(createText(xPos - 3, yPos + paddingTop + 4, text, '13px', '#fff', 'Source Sans Pro'))
  }
  return group
}

export function connectPoints(pointA: SVGElement, pointB: SVGElement, svgElem: SVGElement): SVGPathElement {
  const pathStr = `M${pointA.getAttribute('cx')} ${pointA.getAttribute('cy')}L${pointB.getAttribute('cx')} ${pointB.getAttribute('cy')}`
  const pathEl = createPath(pathStr, '#123e74', '2', 'none')
  pathEl.setAttribute('class', 'pointConnectionLine')
  svgElem.appendChild(pathEl)
  return pathEl
}
