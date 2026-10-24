/**
 * The playback tick: a worker posts 'tick' every `interval` ms ('start'/'stop', `{ interval }`).
 * A worker, because timers on the page are throttled in background tabs; the scheduler on
 * the page still does the work.
 */
function workerBody(this: { onmessage: (e: MessageEvent) => void }) {
  let timerID: ReturnType<typeof setInterval> | null = null
  let interval = 100

  this.onmessage = (e: MessageEvent) => {
    if (e.data === 'start') {
      timerID = setInterval(() => postMessage('tick'), interval)
    } else if (e.data.interval) {
      interval = e.data.interval
      if (timerID != null) {
        clearInterval(timerID)
        timerID = setInterval(() => postMessage('tick'), interval)
      }
    } else if (e.data === 'stop') {
      if (timerID != null) clearInterval(timerID)
      timerID = null
    }
  }
}

export function createTimerWorker(): Worker {
  const source = `(${workerBody.toString()})()`
  return new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })))
}
