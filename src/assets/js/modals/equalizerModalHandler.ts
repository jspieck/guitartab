import { BaseModalHandler } from './baseModalHandler';
import audioEngine from '../audioEngine';
import Settings from '../settingManager';
import { ref, Ref } from 'vue';

export class EqualizerModalHandler extends BaseModalHandler {
    private audioCtx!: AudioContext;
    private lowshelf!: BiquadFilterNode;
    private mid!: BiquadFilterNode;
    private highshelf!: BiquadFilterNode;

    // Constants
    public readonly CANVAS_WIDTH = 700;
    public readonly DECIBEL_WIDTH = 20;
    public readonly CANVAS_HEIGHT = 350;
    public readonly FREQUENCY_HEIGHT = 20;
    public readonly SAMPLERATE = 44100;

    public readonly frequencyLines = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    public readonly decibelLines = [-18, -12, -6, 0, 6, 12, 18];
    public readonly circleColors = ['#89ca78', '#ef596f', '#e5c07b'];
    public readonly quality = { start: 1, min: 0.5, max: 20 };

    // Reactive state
    public readonly equalizerMode1 = ref("highpass");
    public readonly equalizerMode2 = ref("peaking");
    public readonly equalizerMode3 = ref("lowpass");
    public readonly eqGain = ref(0.0);
    public readonly eqCurrentFreq = ref('0.0');

    // Public properties
    public equalizerNodes: BiquadFilterNode[] = [];
    public readonly equalizerNodeFrequencies = ref<number[]>([]);

    // Private state
    private currentNode: number = -1;
    private reTimeOut: number | null = null;
    private logarithmicMin: number = 0;
    private logarithmicMax: number = 0;

    private ctx!: CanvasRenderingContext2D;

    constructor() {
        super('equalizerModal', 'Equalizer');
    }

    public getEqualizer(): BiquadFilterNode[] {
        return this.equalizerNodes;
    }

    public initializeAudio(): void {
        this.audioCtx = audioEngine.context;

        // Initialize filter nodes
        this.lowshelf = this.audioCtx.createBiquadFilter();
        this.mid = this.audioCtx.createBiquadFilter();
        this.highshelf = this.audioCtx.createBiquadFilter();

        this.equalizerNodes = [this.lowshelf, this.mid, this.highshelf];
        this.equalizerNodeFrequencies.value = [40, 1000, 15000];

        this.logarithmicMin = Math.log(this.frequencyLines[0]) / Math.LN10;
        this.logarithmicMax = Math.log(this.frequencyLines[this.frequencyLines.length - 1]) / Math.LN10;

        this.initializeNodes();
    }

    setAudioContext(audioCtx: AudioContext): void {
        this.audioCtx = audioCtx;
    }

    private initializeNodes(): void {
        this.lowshelf.type = this.equalizerMode1.value as BiquadFilterType;
        this.mid.type = this.equalizerMode2.value as BiquadFilterType;
        this.highshelf.type = this.equalizerMode3.value as BiquadFilterType;

        // Set initial frequencies
        this.lowshelf.frequency.value = this.equalizerNodeFrequencies.value[0];
        this.mid.frequency.value = this.equalizerNodeFrequencies.value[1];
        this.highshelf.frequency.value = this.equalizerNodeFrequencies.value[2];

        // Set initial Q values
        this.lowshelf.Q.value = this.quality.start;
        this.mid.Q.value = this.quality.start;
        this.highshelf.Q.value = this.quality.start;

        // Set initial gains to 0
        this.lowshelf.gain.value = 0;
        this.mid.gain.value = 0;
        this.highshelf.gain.value = 0;
    }

    public getNodePosition(index: number): { x: number, y: number } {
        const frequency = this.equalizerNodes[index].frequency.value;
        const gain = this.equalizerNodes[index].gain.value;
        return {
            x: this.frequencyToXPos(frequency),
            y: this.FREQUENCY_HEIGHT + this.CANVAS_HEIGHT / 2 - (gain * this.CANVAS_HEIGHT) / 36
        };
    }

    public setCurrentNode(id: number): void {
        this.currentNode = id;
        if (this.reTimeOut != null) {
            clearTimeout(this.reTimeOut);
        }
        this.reTimeOut = window.setTimeout(() => {
            this.currentNode = -1;
        }, 1000);
    }

    public getCurrentNode(): number {
        return this.currentNode;
    }

    public frequencyToXPos(freq: number): number {
        const logarithmicValue = Math.log(freq) / Math.LN10;
        return (
            ((logarithmicValue - this.logarithmicMin)
                / (this.logarithmicMax - this.logarithmicMin))
            * this.CANVAS_WIDTH
        );
    }

    public xPosToFrequency(xPos: number): number {
        const val = (xPos / this.CANVAS_WIDTH) * (this.logarithmicMax - this.logarithmicMin)
            + this.logarithmicMin;
        return 10 ** val;
    }

    public yPosToDb(yPos: number): number {
        return (
            ((yPos - this.FREQUENCY_HEIGHT - this.CANVAS_HEIGHT / 2) / (this.CANVAS_HEIGHT / 2))
            * -18
        );
    }

    public updateNodePosition(nodeIndex: number, x: number, y: number): void {
        const frequency = this.xPosToFrequency(x);
        const db = this.yPosToDb(y);

        this.setNodeFrequencyAndGain(nodeIndex, frequency, db);

        let intFreq = Math.round(frequency);
        let intFreqString = intFreq.toString();
        if (intFreq > 1000) {
            intFreq = Math.round(intFreq / 100);
            intFreqString = `${intFreq / 10}k`;
        }

        this.eqCurrentFreq.value = intFreqString;
        this.eqGain.value = Number(db.toFixed(2));
    }

    public setNodeType(nodeIndex: number, type: BiquadFilterType): void {
        this.equalizerNodes[nodeIndex].type = type;
    }

    public setNodeQuality(nodeIndex: number, quality: number): void {
        this.equalizerNodes[nodeIndex].Q.value = quality;
    }

    public setNodeFrequencyAndGain(nodeIndex: number, frequency: number, gain: number): void {
        this.equalizerNodes[nodeIndex].frequency.value = frequency;
        this.equalizerNodes[nodeIndex].gain.value = gain;
    }

    public insertBetween(audioNodeBefore: AudioNode, audioNodeAfter: AudioNode): void {
        audioNodeBefore.connect(this.lowshelf);
        this.lowshelf.connect(this.mid);
        this.mid.connect(this.highshelf);
        this.highshelf.connect(audioNodeAfter);
    }

    private drawLine(ctx: CanvasRenderingContext2D, xStart: number, yStart: number, xEnd: number, yEnd: number) {
        if (ctx != null) {
            ctx.strokeStyle = Settings.darkMode ? 'rgb(79, 79, 79)' : '#e5e7eb';
            ctx.beginPath();
            ctx.moveTo(xStart, yStart);
            ctx.lineTo(xEnd, yEnd);
            ctx.stroke();
        }
    }

    public drawFrequencyLines(ctx: CanvasRenderingContext2D): void {
        for (const freq of this.frequencyLines) {
            const xPos = this.frequencyToXPos(freq);
            this.drawLine(ctx, xPos, this.FREQUENCY_HEIGHT, xPos, this.CANVAS_HEIGHT + this.FREQUENCY_HEIGHT);
        }
        for (let i = 0; i < this.decibelLines.length; i++) {
            const yPos = this.FREQUENCY_HEIGHT + (this.CANVAS_HEIGHT * i) / (this.decibelLines.length - 1);
            this.drawLine(ctx, 0, yPos, this.CANVAS_WIDTH, yPos);
        }
    }

    public drawLocalAttenuationCurve(ctx: CanvasRenderingContext2D, id: number) {
        const RESOLUTION = 50;
        const frequencyArray = new Float32Array(RESOLUTION);

        for (let i = 0; i < RESOLUTION; i++) {
            frequencyArray[i] = this.xPosToFrequency((i / (RESOLUTION - 1)) * this.CANVAS_WIDTH);
        }

        const magResponseOutput = new Float32Array(RESOLUTION);
        const phaseResponseOutput = new Float32Array(RESOLUTION);
        this.equalizerNodes[id].getFrequencyResponse(frequencyArray, magResponseOutput, phaseResponseOutput);

        const magAccumulated = new Float32Array(RESOLUTION);
        for (let i = 0; i < RESOLUTION; i++) {
            magAccumulated[i] = 9 * Math.log(magResponseOutput[i]);
        }

        ctx.strokeStyle = this.circleColors[id];
        ctx.lineWidth = 3;
        ctx.beginPath();

        const points = this.computeAttenuationPoints(frequencyArray, magAccumulated);
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 0; i < RESOLUTION - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }

        ctx.stroke();
        ctx.lineWidth = 1;
    }


    public clearCanvas(ctx: CanvasRenderingContext2D): void {
        console.log(Settings.darkMode);
        ctx.fillStyle = Settings.darkMode ? '#202020' : '#ffffff';
        ctx.fillRect(
            0, 0,
            this.CANVAS_WIDTH + this.DECIBEL_WIDTH,
            this.CANVAS_HEIGHT + this.FREQUENCY_HEIGHT
        );

        ctx.fillStyle = Settings.darkMode ? '#212121' : '#fff';
        ctx.fillRect(
            0,
            this.FREQUENCY_HEIGHT,
            this.CANVAS_WIDTH,
            this.CANVAS_HEIGHT + this.FREQUENCY_HEIGHT
        );
    }

    public computeAttenuationPoints(frequencyArray: Float32Array, magArray: Float32Array) {
        const points = [];
        for (let i = 0; i < frequencyArray.length; i++) {
            points.push({
                x: this.frequencyToXPos(frequencyArray[i]),
                y: this.FREQUENCY_HEIGHT + this.CANVAS_HEIGHT / 2 - (magArray[i] * this.CANVAS_HEIGHT) / 36
            });
        }
        return points;
    }

    public drawAttenuationCurve(ctx: CanvasRenderingContext2D): void {
        const RESOLUTION = 200;
        const frequencyArray = new Float32Array(RESOLUTION);

        // Set frequencies at given points
        for (let i = 0; i < RESOLUTION; i++) {
            frequencyArray[i] = this.xPosToFrequency((i / (RESOLUTION - 1)) * this.CANVAS_WIDTH);
        }

        const magAccumulated = new Float32Array(RESOLUTION);
        this.equalizerNodes.forEach(node => {
            const magResponseOutput = new Float32Array(RESOLUTION);
            const phaseResponseOutput = new Float32Array(RESOLUTION);
            node.getFrequencyResponse(frequencyArray, magResponseOutput, phaseResponseOutput);

            for (let i = 0; i < RESOLUTION; i++) {
                magAccumulated[i] += 9 * Math.log(magResponseOutput[i]);
            }
        });

        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 3;
        ctx.beginPath();

        const points = this.computeAttenuationPoints(frequencyArray, magAccumulated);
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 0; i < RESOLUTION - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }

        ctx.stroke();
        ctx.lineWidth = 1;
    }

    private redraw(ctx: CanvasRenderingContext2D): void {
        this.clearCanvas(ctx);
        this.drawFrequencyLines(ctx);
        if (this.getCurrentNode() !== -1) {
            this.drawLocalAttenuationCurve(ctx, this.getCurrentNode());
        }
        this.drawAttenuationCurve(ctx);
    }

    private pointToXY(points: Uint8Array, index: number): { x: number, y: number } {
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

    public setCanvasContext(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    public drawSpectrum(frequencyArray: Uint8Array) {
        if (this.ctx == null) return;
        
        this.redraw(this.ctx);

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

    openModal(params?: any): void {
        this.showModal();
    }

    setupModalContent(): void {
        // Add any specific setup needed for equalizer modal
    }
} 