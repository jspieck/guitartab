function workerFunction(this: {
  onmessage: (e: MessageEvent) => void
}) {
  let timerID: ReturnType<typeof setInterval> | null = null;
  let interval = 100;

  this.onmessage = function onm(e: MessageEvent) {
    if (e.data === 'start') {
      console.log('starting');
      timerID = setInterval(() => { postMessage('tick'); }, interval);
    } else if (e.data.interval) {
      console.log('setting interval');
      interval = e.data.interval;
      console.log(`interval=${interval}`);
      if (timerID != null) {
        clearInterval(timerID);
        timerID = setInterval(() => { postMessage('tick'); }, interval);
      }
    } else if (e.data === 'stop') {
      console.log('stopping');
      if (timerID != null) {
        clearInterval(timerID);
      }
      timerID = null;
    }
  };
}
// This is in case of normal worker start
// "window" is not defined in web worker
// so if you load this file directly using `new Worker`
// the worker code will still execute properly

// if (window !== this) {
//   workerFunction();
// }

export default workerFunction;
