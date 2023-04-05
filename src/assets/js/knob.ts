import { SvgDrawer } from './svgDrawer';

class KnobFactory {
  cx: number;

  cy: number;

  radiusInner: number;

  radiusOuter: number;

  strokeInner: string;

  strokeOuter: string;

  fillInner: string;

  pointerFill: string;

  pointerWidth: number;

  pointerHeight: number;

  functionToExecuteOnRotate: (angle: number, dataId: string, targetId: string) => void;

  functionParameters: MouseEvent | null;

  previousAngle: number;

  moveFuncTmp: (e: MouseEvent) => void;

  mouseUpFuncTmp: (e: MouseEvent) => void;

  constructor() {
    this.cx = 11;
    this.cy = 11;
    this.radiusInner = 10;
    this.radiusOuter = 12;
    this.strokeInner = 'transparent';
    this.strokeOuter = '#226aa9';
    this.fillInner = '#3e3e3e';
    this.pointerFill = '#ffffff';
    this.pointerWidth = 2;
    this.pointerHeight = 3;
    // helper
    this.functionToExecuteOnRotate = () => {};
    this.moveFuncTmp = () => {};
    this.mouseUpFuncTmp = () => {};
    this.functionParameters = null;
    this.previousAngle = 0;
  }

  getCircumference(): number {
    return 2 * this.radiusOuter * Math.PI;
  }

  createKnob(
    id: string,
    dataId: number,
    rotateFunc: (angle: number, dataIdFunc: string, targetId: string) => void,
    { start, min, max }: { start: number, min: number, max: number },
    midKnob: boolean,
  ) {
    const startAngle = ((start - min) / (max - min)) * 360;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', id);
    svg.setAttribute('data-id', dataId.toString());
    svg.setAttribute('class', 'knobRing');
    const innerCircle = SvgDrawer.createCircle(
      this.cx, this.cy, this.radiusInner, this.strokeInner, '1', this.fillInner,
    );
    const pointerY = midKnob ? 3 : 14;
    const pointer = SvgDrawer.createRect(
      this.cx - 1, pointerY, this.pointerWidth, this.pointerHeight, 'none', 'none', this.pointerFill,
    );
    pointer.setAttribute('id', `${id}Pointer`);
    pointer.setAttribute('rx', '1');
    pointer.setAttribute('ry', '1');
    const outerRing = SvgDrawer.createCircle(
      this.cx, this.cy, this.radiusOuter, this.strokeOuter, '2', 'transparent',
    );
    const dashValue = 2 * this.radiusOuter * Math.PI;
    outerRing.setAttribute('id', `outerRing${id}`);
    outerRing.setAttribute('stroke-dasharray', `${dashValue} ${dashValue}`);
    if (midKnob) {
      const strokeDashOffset = dashValue - dashValue * ((startAngle - 180) / 360);
      outerRing.setAttribute('stroke-dashoffset', strokeDashOffset.toString());
    } else {
      const strokeDashOffset = dashValue - dashValue * (startAngle / 360);
      outerRing.setAttribute('stroke-dashoffset', strokeDashOffset.toString());
    }
    svg.appendChild(innerCircle);
    svg.appendChild(pointer);
    svg.appendChild(outerRing);

    // Now init it
    svg.addEventListener('mousedown', (e: MouseEvent) => {
      this.knobRotateFunc(rotateFunc, e);
    });
    svg.setAttribute('data-angle', startAngle.toString());
    pointer.setAttribute('transform', `rotate(${startAngle - 90}, ${this.cx}, ${this.cy})`);
    return svg;
  }

  removeEventListeners() {
    document.body.classList.remove('disableMouseEffects');
    document.removeEventListener('mousemove', this.moveFuncTmp);
    document.removeEventListener('mouseup', this.mouseUpFuncTmp);
  }

  knobRotationHandler(e: MouseEvent) {
    if (this.functionParameters != null) {
      const domTarget: HTMLElement = this.functionParameters.target as HTMLElement;
      const dataId = domTarget.getAttribute('data-id')!;
      const initYPos = this.functionParameters.pageY;
      const mouseYnew = e.pageY;

      let angle = this.previousAngle + (initYPos - mouseYnew) * 3;
      angle = Math.min(angle, 360);
      angle = Math.max(angle, 0);

      this.functionToExecuteOnRotate(angle, dataId, domTarget.id);

      domTarget.setAttribute('data-angle', angle.toString());
      const pointerDom = document.getElementById(`${domTarget.id}Pointer`);
      pointerDom?.setAttribute('transform', `rotate(${angle - 90}, 11, 11)`);
    }
  }

  knobRotateFunc(
    functionToExecute: (angle: number, dataId: string, targetId: string) => void,
    functionEvent: MouseEvent,
  ) {
    console.log(functionToExecute, functionEvent);
    document.body.classList.add('disableMouseEffects');
    // while mousedown if mousemoves then compare the coordinates and rotate the knob accordingly
    this.functionToExecuteOnRotate = functionToExecute;
    this.functionParameters = functionEvent;
    const target = this.functionParameters.target as HTMLElement;
    const previousAngleStr = target.getAttribute('data-angle');
    if (previousAngleStr == null) {
      this.previousAngle = 0;
    } else {
      this.previousAngle = parseInt(previousAngleStr, 10);
    }

    this.moveFuncTmp = this.knobRotationHandler.bind(this);
    this.mouseUpFuncTmp = this.removeEventListeners.bind(this);

    document.addEventListener('mousemove', this.moveFuncTmp);
    document.addEventListener('mouseup', this.mouseUpFuncTmp);
  }
}

const knobFactory = new KnobFactory();
export default knobFactory;
