import interact from 'interactjs';
import Helper from './helper';
import Settings from './settingManager';
import knobFactory from './knob';
import { SvgDrawer } from './svgDrawer';

interface InteractEvent {
  target: HTMLElement,
  dx: number,
  dy: number
}

class Equalizer {
  CANVAS_WIDTH: number;

  DECIBEL_WIDTH: number;

  CANVAS_HEIGHT: number;

  FREQUENCY_HEIGHT: number;

  frequencyLines: number[];

  decibelLines: number[];

  ctx: CanvasRenderingContext2D;

  equalizerOverlay: HTMLElement;

  currentNode: number;

  logarithmicMin: number;

  logarithmicMax: number;

  lowshelf: BiquadFilterNode;

  mid: BiquadFilterNode;

  highshelf: BiquadFilterNode;

  lowshelfFrequency: number;

  midFrequency: number;

  highshelfFrequency: number;

  equalizerNodes: BiquadFilterNode[];

  quality: {start: number, min: number, max: number};

  reTimeOut: any;

  SAMPLERATE: number;

  constructor(audioCtx: AudioContext) {
    this.CANVAS_WIDTH = 600;
    this.DECIBEL_WIDTH = 20;
    this.CANVAS_HEIGHT = 300;
    this.FREQUENCY_HEIGHT = 20;
    this.frequencyLines = [
      20,
      50,
      100,
      200,
      500,
      1000,
      2000,
      5000,
      10000,
      20000,
    ];
    this.decibelLines = [-18, -12, -6, 0, 6, 12, 18];
    const canvas = document.getElementById('equalizerCanvas') as HTMLCanvasElement;
    // TODO this.ctx = canvas.getContext('2d')!;
    // canvas.width = this.CANVAS_WIDTH + this.DECIBEL_WIDTH;
    // canvas.height = this.CANVAS_HEIGHT + this.FREQUENCY_HEIGHT;
    // this.equalizerOverlay = document.getElementById('equalizerOverlay')!;
    this.currentNode = -1;
    this.logarithmicMin = 0;
    this.logarithmicMax = 0;
    this.lowshelf = audioCtx.createBiquadFilter();
    this.mid = audioCtx.createBiquadFilter();
    this.highshelf = audioCtx.createBiquadFilter();
    this.lowshelfFrequency = 40;
    this.midFrequency = 1000;
    this.highshelfFrequency = 15000;
    this.equalizerNodes = [];
    this.quality = { start: 1, min: 0.5, max: 20 };
    this.reTimeOut = null;
    this.SAMPLERATE = 44100; // TODO get it
  }

  insertBetween(audioNodeBefore: AudioNode, audioNodeAfter: AudioNode) {
    this.equalizerNodes[0] = this.lowshelf;
    this.equalizerNodes[1] = this.mid;
    this.equalizerNodes[2] = this.highshelf;

    this.lowshelf.type = 'lowshelf';
    this.mid.type = 'peaking';
    this.highshelf.type = 'highshelf';

    this.lowshelf.frequency.value = this.lowshelfFrequency;
    this.mid.frequency.value = this.midFrequency;
    this.highshelf.frequency.value = this.highshelfFrequency;

    audioNodeBefore.connect(this.lowshelf);
    this.lowshelf.connect(this.mid);
    this.mid.connect(this.highshelf);
    this.highshelf.connect(audioNodeAfter);
  }

  setCurrentNode(id: number) {
    this.currentNode = id;
    if (this.reTimeOut != null) {
      clearTimeout(this.reTimeOut);
    }
    this.reTimeOut = setTimeout(() => {
      this.currentNode = -1;
      this.redraw();
    }, 1000);
  }

  qualityKnobRotate(angle: number, knobId: string, parentId: string) {
    const circumference = knobFactory.getCircumference();
    document.getElementById(`outerRing${parentId}`)?.setAttribute(
      'stroke-dashoffset',
      (circumference - (circumference * angle) / 360).toString(),
    );
    const scaled = (angle / 360) * (this.quality.max - this.quality.min) + this.quality.min;
    if (knobId === '1') {
      // low
      this.lowshelf.Q.value = scaled;
      document.getElementById('qualityLabel1')!.textContent = scaled.toFixed(2);
    } else if (knobId === '2') {
      // mid
      this.mid.Q.value = scaled;
      document.getElementById('qualityLabel2')!.textContent = scaled.toFixed(2);
    } else if (knobId === '3') {
      // high
      this.highshelf.Q.value = scaled;
      document.getElementById('qualityLabel3')!.textContent = scaled.toFixed(2);
    }
    this.setCurrentNode(parseInt(knobId, 10) - 1);
    this.redraw();
  }

  initEqualizer() {
    this.currentNode = -1;
    Helper.removeAllChildren(this.equalizerOverlay);
    this.equalizerOverlay!.style.width = `${this.CANVAS_WIDTH + this.DECIBEL_WIDTH}px`;
    this.equalizerOverlay!.style.height = `${this.CANVAS_HEIGHT + this.FREQUENCY_HEIGHT}px`;

    this.logarithmicMin = Math.log(this.frequencyLines[0]) / Math.LN10;
    this.logarithmicMax = Math.log(this.frequencyLines[this.frequencyLines.length - 1]) / Math.LN10;

    const equalizerModeSelect1 = document.getElementById('equalizerModeSelect1') as HTMLSelectElement;
    const equalizerModeSelect2 = document.getElementById('equalizerModeSelect2') as HTMLSelectElement;
    const equalizerModeSelect3 = document.getElementById('equalizerModeSelect3') as HTMLSelectElement;
    equalizerModeSelect1.value = 'lowshelf';
    equalizerModeSelect2.value = 'peaking';
    equalizerModeSelect3.value = 'highshelf';
    equalizerModeSelect1.onchange = () => {
      this.lowshelf.type = equalizerModeSelect1.value as BiquadFilterType;
      this.setCurrentNode(0);
      this.redraw();
    };
    equalizerModeSelect2.onchange = () => {
      this.mid.type = equalizerModeSelect2.value as BiquadFilterType;
      this.setCurrentNode(1);
      this.redraw();
    };
    equalizerModeSelect3.onchange = () => {
      this.highshelf.type = equalizerModeSelect3.value as BiquadFilterType;
      this.setCurrentNode(2);
      this.redraw();
    };
    const qCont1 = document.getElementById('qualityContainer1');
    qCont1!.appendChild(
      knobFactory.createKnob('qKnob1', 1,
        (a: number, k: string, b: string) => {
          this.qualityKnobRotate(a, k, b);
        }, this.quality, false),
    );
    const qCont2 = document.getElementById('qualityContainer2');
    qCont2!.appendChild(
      knobFactory.createKnob('qKnob2', 2,
        (a: number, k: string, b: string) => {
          this.qualityKnobRotate(a, k, b);
        }, this.quality, false),
    );
    const qCont3 = document.getElementById('qualityContainer3');
    qCont3!.appendChild(
      knobFactory.createKnob('qKnob3', 3,
        (a: number, k: string, b: string) => {
          this.qualityKnobRotate(a, k, b);
        }, this.quality, false),
    );
    this.clearCanvas();
    this.drawLabels();
    this.drawFrequencyLines();
    this.drawEqualizerNodes();
  }

  drawLine(xStart: number, yStart: number, xEnd: number, yEnd: number) {
    if (this.ctx != null) {
      if (Settings.darkMode) {
        this.ctx.strokeStyle = 'rgb(79, 79, 79)';
      } else {
        this.ctx.strokeStyle = 'rgb(179, 179, 179)';
      }
      this.ctx.beginPath();
      this.ctx.moveTo(xStart, yStart);
      this.ctx.lineTo(xEnd, yEnd);
      this.ctx.stroke();
    }
  }

  drawText(xPos: number, yPos: number, text: string, align: string) {
    const textNode = SvgDrawer.createText(
      xPos,
      yPos,
      text,
      '12px',
      '',
      'Source Sans Pro',
    );
    textNode.style.fill = '#222';
    textNode.setAttribute('text-anchor', align.toString());
    if (Settings.darkMode) {
      textNode.style.fill = '#fff';
    }
    this.equalizerOverlay.appendChild(textNode);
  }

  frequencyToXPos(freq: number): number {
    const logarithmicValue = Math.log(freq) / Math.LN10;
    return (
      ((logarithmicValue - this.logarithmicMin)
        / (this.logarithmicMax - this.logarithmicMin))
      * this.CANVAS_WIDTH
    );
  }

  xPosToFrequency(xPos: number): number {
    const val = (xPos / this.CANVAS_WIDTH) * (this.logarithmicMax - this.logarithmicMin)
      + this.logarithmicMin;
    return 10 ** val;
  }

  yPosToDb(yPos: number): number {
    return (
      ((yPos - this.FREQUENCY_HEIGHT - this.CANVAS_HEIGHT / 2) / (this.CANVAS_HEIGHT / 2))
      * -18
    );
  }

  drawLabels() {
    for (let i = 0; i < this.frequencyLines.length; i += 1) {
      const xPos = this.frequencyToXPos(this.frequencyLines[i]);
      let align = 'middle';
      if (i === 0) {
        align = 'start';
      } else if (i === this.frequencyLines.length - 1) {
        align = 'end';
      }
      if (this.frequencyLines[i] < 1000) {
        this.drawText(xPos, 13, this.frequencyLines[i].toString(), align);
      } else {
        this.drawText(xPos, 13, `${this.frequencyLines[i] / 1000}k`, align);
      }
    }
    for (let i = 0; i < this.decibelLines.length - 1; i += 1) {
      const yPos = this.FREQUENCY_HEIGHT + (this.CANVAS_HEIGHT * i)
        / (this.decibelLines.length - 1);
      this.drawText(
        this.CANVAS_WIDTH + 5,
        yPos + 4,
        this.decibelLines[this.decibelLines.length - 1 - i].toString(),
        'center',
      ); // 4 to center
    }
    this.drawText(
      this.CANVAS_WIDTH + 5,
      this.FREQUENCY_HEIGHT + this.CANVAS_HEIGHT,
      this.decibelLines[0].toString(),
      'center',
    );
  }

  drawFrequencyLines(): void {
    for (let i = 0; i < this.frequencyLines.length; i += 1) {
      const xPos = this.frequencyToXPos(this.frequencyLines[i]);
      this.drawLine(xPos, this.FREQUENCY_HEIGHT, xPos, this.CANVAS_HEIGHT + this.FREQUENCY_HEIGHT);
    }
    for (let i = 0; i < this.decibelLines.length; i += 1) {
      const yPos = this.FREQUENCY_HEIGHT + (this.CANVAS_HEIGHT * i)
        / (this.decibelLines.length - 1);
      this.drawLine(0, yPos, this.CANVAS_WIDTH, yPos);
    }
  }

  clearCanvas(): void {
    if (Settings.darkMode) {
      this.ctx.fillStyle = '#202020';
    } else {
      this.ctx.fillStyle = '#ffffff';
    }
    this.ctx.fillRect(
      0,
      0,
      this.CANVAS_WIDTH + this.DECIBEL_WIDTH,
      this.CANVAS_HEIGHT + this.FREQUENCY_HEIGHT,
    );
    if (Settings.darkMode) {
      this.ctx.fillStyle = '#212121';
    } else {
      this.ctx.fillStyle = '#fff';
    }
    this.ctx.fillRect(
      0,
      this.FREQUENCY_HEIGHT,
      this.CANVAS_WIDTH,
      this.CANVAS_HEIGHT + this.FREQUENCY_HEIGHT,
    );
  }

  moveEqualizerNode(event: InteractEvent) {
    const target = event.target as HTMLElement;
    if (target != null) {
      let x = (parseFloat(target.getAttribute('data-x')!) || 0) + event.dx;
      let y = (parseFloat(target.getAttribute('data-y')!) || 0) + event.dy;
      x = Math.min(594, Math.max(x, 7));
      y = Math.min(314, Math.max(y, 7));
      // translate the element
      target.setAttribute('cx', x.toString());
      target.setAttribute('cy', y.toString());

      // compute new values
      const id = parseInt(target.getAttribute('data-id')!, 10);
      // console.log(x+" "+xPosToFrequency(x) +"Hz");
      const frequency = this.xPosToFrequency(x);
      const db = this.yPosToDb(y);
      // const gain = 2 ** (db / 6);
      this.equalizerNodes[id].frequency.value = frequency;
      this.equalizerNodes[id].gain.value = db;

      let intFreq = Math.round(frequency);
      let intFreqString = intFreq.toString();
      if (intFreq > 1000) {
        intFreq = Math.round(intFreq / 100);
        intFreqString = `${intFreq / 10}k`;
      }
      document.getElementById('eqCurrentFreq')!.textContent = `${intFreqString} Hz`;
      document.getElementById('eqCurrentGain')!.textContent = `${db.toFixed(2)} db`;
      this.setCurrentNode(id);
      this.redraw();
      // update the posiion attributes
      target.setAttribute('data-x', x.toString());
      target.setAttribute('data-y', y.toString());
    }
  }

  drawCircle(
    id: number, cx: number, cy: number, radius: number, fillColor: string,
    borderColor: string,
  ) {
    const circle = SvgDrawer.createCircle(
      cx,
      cy,
      radius,
      borderColor,
      '1',
      fillColor,
    );
    circle.setAttribute('data-x', cx.toString());
    circle.setAttribute('data-y', cy.toString());
    circle.setAttribute('data-id', id.toString());
    interact(circle).draggable({
      modifiers: [
        interact.modifiers.restrictRect({
          restriction: 'equalizerOverlay',
        }),
      ],
      // restriction: 'equalizerOverlay',
      onmove: (e) => { this.moveEqualizerNode(e); },
    });
    this.equalizerOverlay.appendChild(circle);
  }

  drawEqualizerNodes(): void {
    const yPos = this.FREQUENCY_HEIGHT + this.CANVAS_HEIGHT / 2;
    const lowX = this.frequencyToXPos(this.lowshelfFrequency);
    const midX = this.frequencyToXPos(this.midFrequency);
    const highX = this.frequencyToXPos(this.highshelfFrequency);

    this.drawCircle(0, lowX, yPos, 7, '#89ca78', '#89ca78');
    this.drawCircle(1, midX, yPos, 7, '#ef596f', '#ef596f');
    this.drawCircle(2, highX, yPos, 7, '#e5c07b', '#e5c07b');

    this.drawAttenuationCurve();
  }

  computeAttenuationPoints(
    frequencies: Float32Array, magnitudes: Float32Array,
  ): {x: number, y: number}[] {
    const points = [];
    for (let i = 0; i < frequencies.length; i += 1) {
      const x = this.frequencyToXPos(frequencies[i]);
      const y = this.FREQUENCY_HEIGHT
        + this.CANVAS_HEIGHT / 2
        - ((this.CANVAS_HEIGHT / 2) * magnitudes[i]) / 18;
      points[i] = { x, y };
    }
    return points;
  }

  drawAttenuationCurve(): void {
    const RESOLUTION = 200;
    const frequencyArray = new Float32Array(RESOLUTION);
    // Set the frequencies at the given points
    for (let i = 0; i < RESOLUTION; i += 1) {
      frequencyArray[i] = this.xPosToFrequency(
        (i / (RESOLUTION - 1)) * this.CANVAS_WIDTH,
      );
      if (i > 0) {
        if (
          frequencyArray[i] >= this.equalizerNodes[0].frequency.value
          && frequencyArray[i - 1] < this.equalizerNodes[0].frequency.value
        ) {
          frequencyArray[i] = this.equalizerNodes[0].frequency.value;
        }
        if (
          frequencyArray[i] >= this.equalizerNodes[1].frequency.value
          && frequencyArray[i - 1] < this.equalizerNodes[1].frequency.value
        ) {
          frequencyArray[i] = this.equalizerNodes[1].frequency.value;
        }
        if (
          frequencyArray[i] >= this.equalizerNodes[2].frequency.value
          && frequencyArray[i - 1] < this.equalizerNodes[2].frequency.value
        ) {
          frequencyArray[i] = this.equalizerNodes[2].frequency.value;
        }
      }
    }

    const magAccumulated = new Float32Array(RESOLUTION);
    const numNodes = this.equalizerNodes.length;
    for (let j = 0; j < numNodes; j += 1) {
      const magResponseOutput = new Float32Array(RESOLUTION);
      const phaseResponseOutput = new Float32Array(RESOLUTION);
      this.equalizerNodes[j].getFrequencyResponse(
        frequencyArray,
        magResponseOutput,
        phaseResponseOutput,
      );
      // console.log(magResponseOutput);
      for (let i = 0; i < RESOLUTION; i += 1) {
        /* to a db value
                var difference = magResponseOutput[i];
                if(difference < 1){
                    difference = -1/difference +1;
                }else{
                    difference--;
                }

                magAccumulated[i] += 3*difference; */
        magAccumulated[i] += 9 * Math.log(magResponseOutput[i]);
      }
    }

    this.ctx.strokeStyle = 'none';
    this.ctx.strokeStyle = '#2196F3'; // rgba(51, 142, 32, 0.66)';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    const points = this.computeAttenuationPoints(frequencyArray, magAccumulated);
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < RESOLUTION - 1; i += 1) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    this.ctx.stroke();
    this.ctx.closePath();
    this.ctx.lineWidth = 1;
    // console.log(magResponseOutput);
  }

  drawLocalAttenuationCurve(id: number) {
    // console.log(id);
    const RESOLUTION = 50;
    const frequencyArray = new Float32Array(RESOLUTION);
    // Set the frequencies at the given points
    for (let i = 0; i < RESOLUTION; i += 1) {
      frequencyArray[i] = this.xPosToFrequency(
        (i / (RESOLUTION - 1)) * this.CANVAS_WIDTH,
      );
      if (
        i > 0
        && frequencyArray[i] >= this.equalizerNodes[0].frequency.value
        && frequencyArray[i - 1] < this.equalizerNodes[0].frequency.value
      ) {
        frequencyArray[i] = this.equalizerNodes[0].frequency.value;
      }
      if (
        i > 0
        && frequencyArray[i] >= this.equalizerNodes[1].frequency.value
        && frequencyArray[i - 1] < this.equalizerNodes[1].frequency.value
      ) {
        frequencyArray[i] = this.equalizerNodes[1].frequency.value;
      }
      if (
        i > 0
        && frequencyArray[i] >= this.equalizerNodes[2].frequency.value
        && frequencyArray[i - 1] < this.equalizerNodes[2].frequency.value
      ) {
        frequencyArray[i] = this.equalizerNodes[2].frequency.value;
      }
    }
    const magAccumulated = new Float32Array(RESOLUTION);
    const magResponseOutput = new Float32Array(RESOLUTION);
    const phaseResponseOutput = new Float32Array(RESOLUTION);
    this.equalizerNodes[id].getFrequencyResponse(
      frequencyArray,
      magResponseOutput,
      phaseResponseOutput,
    );
    // console.log(magResponseOutput);
    for (let i = 0; i < RESOLUTION; i += 1) {
      /* to a db value
            var difference = magResponseOutput[i];
            if(difference < 1){
                difference = -1/difference +1;
            }else{
                difference--;
            }

            magAccumulated[i] += 3*difference; */
      magAccumulated[i] = 9 * Math.log(magResponseOutput[i]);
    }
    // console.log(magAccumulated);

    // NOW DRAW CURVE
    this.ctx.strokeStyle = 'none';
    if (id === 0) {
      this.ctx.strokeStyle = 'rgb(116, 176, 103)'; // rgba(51, 142, 32, 0.66)';
    } else if (id === 1) {
      this.ctx.strokeStyle = 'rgb(213, 107, 107)';
    } else {
      this.ctx.strokeStyle = 'rgb(234, 191, 114)';
    }
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    const points = this.computeAttenuationPoints(frequencyArray, magAccumulated);
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < RESOLUTION - 1; i += 1) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    this.ctx.stroke();
    this.ctx.closePath();
    this.ctx.lineWidth = 1;
    // console.log(magResponseOutput);
  }

  redraw(): void {
    this.clearCanvas();
    this.drawFrequencyLines();
    if (this.currentNode !== -1) {
      this.drawLocalAttenuationCurve(this.currentNode);
    }
    this.drawAttenuationCurve();
  }

  pointToXY(points: Uint8Array, index: number): {x: number, y: number} {
    const fftSize = points.length;
    const y = this.FREQUENCY_HEIGHT
      + this.CANVAS_HEIGHT
      - ((this.CANVAS_HEIGHT / 2) * points[index]) / 256; // set it to 0 db
    let x = (index * this.SAMPLERATE) / fftSize;

    if (
      x < this.frequencyLines[0]
      || x > this.frequencyLines[this.frequencyLines.length - 1]
    ) {
      return { x: -1, y: -1 };
    }
    // logarithmize
    x = this.frequencyToXPos(x);
    // console.log(index, x, y);
    return { x, y };
  }

  drawSpectrum(frequencyArray: Uint8Array) {
    this.redraw();

    const points = [];
    for (let i = 0; i < frequencyArray.length; i += 1) {
      const pointValue = this.pointToXY(frequencyArray, i);
      if (pointValue.x !== -1 && pointValue.y !== -1) {
        points.push(pointValue);
      }
    }
    this.ctx.strokeStyle = 'rgba(49, 88, 193, 0.5)';
    this.ctx.fillStyle = 'rgba(49, 88, 193, 0.5)';
    this.ctx.beginPath();
    this.ctx.moveTo(0, points[0].y);
    this.ctx.lineTo(points[0].x, points[0].y);
    let i;
    for (i = 1; i < points.length - 2; i += 1) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    // curve through the last two points
    this.ctx.quadraticCurveTo(
      points[i].x,
      points[i].y,
      points[i + 1].x,
      points[i + 1].y,
    );
    this.ctx.lineTo(this.CANVAS_WIDTH, points[i + 1].y);
    this.ctx.lineTo(this.CANVAS_WIDTH, this.CANVAS_HEIGHT + this.FREQUENCY_HEIGHT);
    this.ctx.lineTo(0, this.CANVAS_HEIGHT + this.FREQUENCY_HEIGHT);
    this.ctx.stroke();
    this.ctx.fill();
  }
}

export default Equalizer;
