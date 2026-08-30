export const TAB_SHEET = {
  START_OFFSET_WIDTH: 32,
  completeWidth: 31.5 * 37.795276,
  completeHeight: 44.55 * 37.795276,
  FIRST_PAGE_TOP_MARGIN: 90,
  heightPerString: 12,
  VEXFLOW_HEIGHT: 150,
  FOOTER_HEIGHT: 0,
  distanceBetweenPages: 0,
  DIA_WIDTH: 60,
  DIA_HEIGHT: 80,
  DIA_SPACING: 40,
  get PAGE_MARGIN_SIDE() {
    return this.completeWidth * (1 / 21)
  },
  get PAGE_MARGIN_TOP() {
    return this.completeHeight * (1 / 29.7)
  },
  get pageHeight() {
    return this.completeHeight
  },
}

let tabNumRows = 0
let scrollTopMC = 0

export function getTabNumRows(): number {
  return tabNumRows
}

export function setTabNumRows(numRows: number): void {
  tabNumRows = numRows
}

export function getScrollTop(): number {
  return scrollTopMC
}

export function setScrollTop(scrollTop: number): void {
  scrollTopMC = scrollTop
}

export function getAvailableRowWidth(): number {
  return TAB_SHEET.completeWidth - 2 * TAB_SHEET.PAGE_MARGIN_SIDE
}
