export function setLoadingWheelVisible(isVisible: boolean): void {
  const loadingWheel = document.getElementById('loadingWheel')
  if (loadingWheel instanceof HTMLElement) {
    loadingWheel.style.display = isVisible ? 'block' : 'none'
  }
}

export function setTrackSignIcon(iconSrc: string): void {
  const trackSign = document.getElementById('trackSignImg')
  if (trackSign instanceof HTMLImageElement) {
    trackSign.src = iconSrc
  }
}