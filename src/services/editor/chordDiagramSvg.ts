import type { Chord } from '../../types/tab'
import { createCircle, createPath, createRect, createText } from '../../utils/svgPrimitives'
import { TAB_SHEET } from '../../utils/tabSheetConstants'

export function createChordDiagramSvg(chord: Chord): SVGGElement {
  const { frets, capo, name } = chord
  const chordDiagram = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  const rect = createRect(0, 0, TAB_SHEET.DIA_WIDTH, TAB_SHEET.DIA_HEIGHT, '#111', '1', 'white')
  chordDiagram.appendChild(rect)

  const pathEl = createPath(`M-0.5 0H${TAB_SHEET.DIA_WIDTH + 0.5}`, 'rgb(0, 0, 0)', '3', 'none')
  chordDiagram.appendChild(pathEl)

  const HOSTEPS = 5
  for (let i = 1; i < HOSTEPS; i += 1) {
    const fretPath = createPath(
      `M0 ${(i * TAB_SHEET.DIA_HEIGHT) / HOSTEPS}H${TAB_SHEET.DIA_WIDTH}`,
      'rgb(180, 180, 180)',
      '1',
      'none',
    )
    fretPath.setAttribute('class', 'gridLine')
    chordDiagram.appendChild(fretPath)
  }

  const NUMSTRINGS = 6
  for (let i = 0; i < NUMSTRINGS; i += 1) {
    const stringPath = createPath(
      `M${(i * TAB_SHEET.DIA_WIDTH) / (NUMSTRINGS - 1)} 1.5V${TAB_SHEET.DIA_HEIGHT - 0.5}`,
      'rgb(60, 60, 60)',
      '1',
      'none',
    )
    stringPath.setAttribute('class', 'strongGridLine')
    chordDiagram.appendChild(stringPath)
  }

  const capoText = capo > 1 ? capo - 1 : capo
  const capoNum = createText(-14, 10, capoText.toString(), '12px', '', 'Source Sans Pro')
  chordDiagram.appendChild(capoNum)

  if (capo > 1) {
    const drawnCapo = createRect(-3, 5, TAB_SHEET.DIA_WIDTH + 6, 5, '#000', '0', '#000')
    drawnCapo.setAttribute('rx', '3')
    drawnCapo.setAttribute('ry', '3')
    chordDiagram.appendChild(drawnCapo)
  }

  const chordName = createText(TAB_SHEET.DIA_WIDTH / 2, -18, name, '14px', '', 'Source Sans Pro')
  chordName.setAttribute('text-anchor', 'middle')
  chordDiagram.appendChild(chordName)

  for (let i = 0; i < NUMSTRINGS; i += 1) {
    const xPos = (i * TAB_SHEET.DIA_WIDTH) / (NUMSTRINGS - 1)
    const fretVal = frets[5 - i]
    if (fretVal === -1 || fretVal === undefined) {
      const cross = createPath(
        `M${xPos - 3} -13L${xPos + 3} -5M${xPos + 3} -13L${xPos - 3} -5`,
        '#333',
        '1',
        'none',
      )
      cross.setAttribute('class', 'chordCross')
      chordDiagram.appendChild(cross)
    } else if (fretVal - (capo - 1) !== 0) {
      const fret = capo > 1 ? fretVal - capo + 1 : fretVal - capo
      const yPos = TAB_SHEET.DIA_HEIGHT / (2 * HOSTEPS) + (TAB_SHEET.DIA_HEIGHT / HOSTEPS) * (fret - 1)
      const circle = createCircle(xPos, yPos, 4, 'none', '1', 'black')
      chordDiagram.appendChild(circle)
    } else {
      const circle = createCircle(xPos, -9, 4, '#333333', '1', 'white')
      chordDiagram.appendChild(circle)
    }
  }

  return chordDiagram
}
