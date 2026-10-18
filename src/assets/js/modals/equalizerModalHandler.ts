import { BaseModalHandler } from './baseModalHandler';
import Settings from '../settingManager';
import { ref } from 'vue';

export interface EqBand {
    type: BiquadFilterType;
    frequency: number;
    gain: number;
    q: number;
    enabled: boolean;
}

export const EQ_BAND_COLORS = ['#ff8a65', '#ffd54f', '#4dd0e1', '#b388ff'];
export const EQ_MIN_FREQ = 20;
export const EQ_MAX_FREQ = 20000;
export const EQ_MAX_GAIN = 18;
export const EQ_Q_RANGE = { min: 0.1, max: 18 };

const STORAGE_KEY = 'gt.equalizer.v1';

/** Filter types whose `gain` parameter has an audible effect. */
export function eqTypeUsesGain(type: BiquadFilterType): boolean {
    return type === 'peaking' || type === 'lowshelf' || type === 'highshelf';
}

export function createDefaultEqBands(): EqBand[] {
    return [
        { type: 'lowshelf', frequency: 100, gain: 0, q: 0.71, enabled: true },
        { type: 'peaking', frequency: 500, gain: 0, q: 1, enabled: true },
        { type: 'peaking', frequency: 2500, gain: 0, q: 1, enabled: true },
        { type: 'highshelf', frequency: 8000, gain: 0, q: 0.71, enabled: true },
    ];
}

function loadStoredBands(): EqBand[] {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (raw == null) return createDefaultEqBands();
        const parsed = JSON.parse(raw) as EqBand[];
        if (!Array.isArray(parsed) || parsed.length !== EQ_BAND_COLORS.length) return createDefaultEqBands();
        return parsed.map((band, index) => ({ ...createDefaultEqBands()[index], ...band }));
    } catch {
        return createDefaultEqBands();
    }
}

export class EqualizerModalHandler extends BaseModalHandler {
    // Canvas geometry in CSS pixels. The plot leaves room for dB labels on the
    // right and frequency labels at the bottom.
    public readonly WIDTH = 640;
    public readonly HEIGHT = 250;
    public readonly PLOT_WIDTH = 640 - 30;
    public readonly PLOT_HEIGHT = 250 - 20;

    public readonly frequencyLines = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    public readonly decibelLines = [18, 12, 6, 0, -6, -12, -18];

    public readonly bands = ref<EqBand[]>(loadStoredBands());
    public readonly selectedBand = ref(-1);

    public equalizerNodes: BiquadFilterNode[] = [];

    private audioCtx: AudioContext | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private lastSpectrum: Uint8Array | null = null;
    private persistTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly logMin = Math.log10(EQ_MIN_FREQ);
    private readonly logMax = Math.log10(EQ_MAX_FREQ);

    constructor() {
        super('equalizerModal', 'Equalizer');
    }

    public getEqualizer(): BiquadFilterNode[] {
        return this.equalizerNodes;
    }

    /**
     * Creates the filter chain for `audioCtx`. Calling it again with the same
     * context keeps the existing (already wired) nodes, so the panel mounting
     * after `audioEngine.createBusses()` doesn't detach the EQ from the signal.
     */
    setAudioContext(audioCtx: AudioContext): void {
        if (this.equalizerNodes.length > 0 && this.audioCtx === audioCtx) {
            return;
        }
        this.audioCtx = audioCtx;
        this.equalizerNodes = this.bands.value.map(() => audioCtx.createBiquadFilter());
        this.bands.value.forEach((_, index) => this.applyBand(index));
    }

    public insertBetween(audioNodeBefore: AudioNode, audioNodeAfter: AudioNode): void {
        let previous = audioNodeBefore;
        for (const node of this.equalizerNodes) {
            previous.connect(node);
            previous = node;
        }
        previous.connect(audioNodeAfter);
    }

    public setBand(index: number, patch: Partial<EqBand>): void {
        const band = this.bands.value[index];
        if (band == null) return;
        Object.assign(band, patch);
        band.frequency = Math.min(EQ_MAX_FREQ, Math.max(EQ_MIN_FREQ, band.frequency));
        band.gain = Math.min(EQ_MAX_GAIN, Math.max(-EQ_MAX_GAIN, band.gain));
        band.q = Math.min(EQ_Q_RANGE.max, Math.max(EQ_Q_RANGE.min, band.q));
        this.applyBand(index);
        this.redraw();
        this.schedulePersist();
    }

    public resetBands(): void {
        createDefaultEqBands().forEach((band, index) => this.setBand(index, band));
    }

    public isFlat(): boolean {
        return this.bands.value.every((band) => !band.enabled
            || (eqTypeUsesGain(band.type) && Math.abs(band.gain) < 0.05));
    }

    private applyBand(index: number): void {
        const node = this.equalizerNodes[index];
        const band = this.bands.value[index];
        if (node == null || band == null) return;
        // A disabled band becomes an all-pass: flat magnitude, no rewiring needed.
        node.type = band.enabled ? band.type : 'allpass';
        node.frequency.value = band.frequency;
        node.gain.value = band.enabled ? band.gain : 0;
        node.Q.value = band.q;
    }

    private schedulePersist(): void {
        if (this.persistTimer != null) clearTimeout(this.persistTimer);
        this.persistTimer = globalThis.setTimeout(() => {
            this.persistTimer = null;
            try {
                globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.bands.value));
            } catch {
                // Storage full or blocked: the EQ still works for this session.
            }
        }, 300);
    }

    // ---- Geometry ---------------------------------------------------------

    public frequencyToXPos(freq: number): number {
        if (!Number.isFinite(freq) || freq <= 0) return 0;
        return ((Math.log10(freq) - this.logMin) / (this.logMax - this.logMin)) * this.PLOT_WIDTH;
    }

    public xPosToFrequency(xPos: number): number {
        return 10 ** ((xPos / this.PLOT_WIDTH) * (this.logMax - this.logMin) + this.logMin);
    }

    public dbToYPos(db: number): number {
        return this.PLOT_HEIGHT / 2 - (db / EQ_MAX_GAIN) * (this.PLOT_HEIGHT / 2);
    }

    public yPosToDb(yPos: number): number {
        return ((this.PLOT_HEIGHT / 2 - yPos) / (this.PLOT_HEIGHT / 2)) * EQ_MAX_GAIN;
    }

    /** Where a band's handle sits: its gain for peaking/shelf types, else 0 dB. */
    public handlePosition(index: number): { x: number, y: number } {
        const band = this.bands.value[index];
        return {
            x: this.frequencyToXPos(band.frequency),
            y: this.dbToYPos(eqTypeUsesGain(band.type) ? band.gain : 0),
        };
    }

    // ---- Drawing ----------------------------------------------------------

    public attachCanvas(canvas: HTMLCanvasElement): void {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(this.WIDTH * dpr);
        canvas.height = Math.round(this.HEIGHT * dpr);
        const ctx = canvas.getContext('2d');
        if (ctx == null) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx = ctx;
        this.redraw();
    }

    public detachCanvas(): void {
        this.ctx = null;
    }

    /** Called every frame by the audio engine while the song plays. */
    public drawSpectrum(frequencyData: Uint8Array): void {
        this.lastSpectrum = frequencyData;
        this.redraw();
    }

    public redraw(): void {
        const ctx = this.ctx;
        if (ctx == null) return;
        ctx.clearRect(0, 0, this.WIDTH, this.HEIGHT);
        ctx.fillStyle = '#0d1015';
        ctx.fillRect(0, 0, this.PLOT_WIDTH, this.PLOT_HEIGHT);
        this.drawGrid(ctx);
        if (Settings.songPlaying && this.lastSpectrum != null) {
            this.drawSpectrumArea(ctx, this.lastSpectrum);
        }
        if (this.equalizerNodes.length === 0) return;
        this.bands.value.forEach((band, index) => {
            if (band.enabled) this.drawBandCurve(ctx, index, index === this.selectedBand.value);
        });
        this.drawSumCurve(ctx);
    }

    private drawGrid(ctx: CanvasRenderingContext2D): void {
        ctx.lineWidth = 1;
        ctx.font = '600 10px "Source Sans Pro", "Segoe UI", sans-serif';
        ctx.textBaseline = 'middle';
        for (const freq of this.frequencyLines) {
            const x = Math.round(this.frequencyToXPos(freq)) + 0.5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.PLOT_HEIGHT);
            ctx.stroke();
            const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
            ctx.fillStyle = '#6b7484';
            ctx.textAlign = freq === EQ_MIN_FREQ ? 'left' : freq === EQ_MAX_FREQ ? 'right' : 'center';
            ctx.fillText(label, Math.min(Math.max(x, 2), this.PLOT_WIDTH - 2), this.PLOT_HEIGHT + 10);
        }
        for (const db of this.decibelLines) {
            const y = Math.round(this.dbToYPos(db)) + 0.5;
            ctx.strokeStyle = db === 0 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.06)';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.PLOT_WIDTH, y);
            ctx.stroke();
            ctx.fillStyle = '#6b7484';
            ctx.textAlign = 'left';
            const labelY = Math.min(Math.max(y, 6), this.PLOT_HEIGHT - 6);
            ctx.fillText(db > 0 ? `+${db}` : `${db}`, this.PLOT_WIDTH + 6, labelY);
        }
    }

    private drawSpectrumArea(ctx: CanvasRenderingContext2D, data: Uint8Array): void {
        const sampleRate = this.audioCtx?.sampleRate ?? 44100;
        // Bin k of an AnalyserNode covers k * sampleRate / fftSize, and fftSize is
        // twice the number of bins.
        const hzPerBin = sampleRate / (data.length * 2);
        const STEP = 3;
        ctx.beginPath();
        ctx.moveTo(0, this.PLOT_HEIGHT);
        for (let x = 0; x <= this.PLOT_WIDTH; x += STEP) {
            const lowBin = Math.max(1, Math.floor(this.xPosToFrequency(x) / hzPerBin));
            const highBin = Math.max(lowBin, Math.floor(this.xPosToFrequency(x + STEP) / hzPerBin));
            let peak = 0;
            for (let bin = lowBin; bin <= highBin && bin < data.length; bin += 1) {
                peak = Math.max(peak, data[bin]);
            }
            ctx.lineTo(x, this.PLOT_HEIGHT - (peak / 255) * this.PLOT_HEIGHT * 0.9);
        }
        ctx.lineTo(this.PLOT_WIDTH, this.PLOT_HEIGHT);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(0, 0, 0, this.PLOT_HEIGHT);
        gradient.addColorStop(0, 'rgba(90, 162, 255, 0.35)');
        gradient.addColorStop(1, 'rgba(90, 162, 255, 0.04)');
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    private responseDb(nodes: BiquadFilterNode[], frequencies: Float32Array): Float32Array {
        const total = new Float32Array(frequencies.length);
        const magnitude = new Float32Array(frequencies.length);
        const phase = new Float32Array(frequencies.length);
        for (const node of nodes) {
            node.getFrequencyResponse(frequencies, magnitude, phase);
            for (let i = 0; i < frequencies.length; i += 1) {
                total[i] += 20 * Math.log10(Math.max(magnitude[i], 1e-6));
            }
        }
        return total;
    }

    private sampleFrequencies(resolution: number): Float32Array {
        const frequencies = new Float32Array(resolution);
        for (let i = 0; i < resolution; i += 1) {
            frequencies[i] = this.xPosToFrequency((i / (resolution - 1)) * this.PLOT_WIDTH);
        }
        return frequencies;
    }

    private tracePath(ctx: CanvasRenderingContext2D, frequencies: Float32Array, db: Float32Array): void {
        ctx.beginPath();
        for (let i = 0; i < frequencies.length; i += 1) {
            const x = this.frequencyToXPos(frequencies[i]);
            const y = Math.min(this.PLOT_HEIGHT + 2, Math.max(-2, this.dbToYPos(db[i])));
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
    }

    private drawBandCurve(ctx: CanvasRenderingContext2D, index: number, selected: boolean): void {
        const frequencies = this.sampleFrequencies(160);
        const db = this.responseDb([this.equalizerNodes[index]], frequencies);
        const color = EQ_BAND_COLORS[index];
        this.tracePath(ctx, frequencies, db);
        ctx.lineTo(this.PLOT_WIDTH, this.PLOT_HEIGHT / 2);
        ctx.lineTo(0, this.PLOT_HEIGHT / 2);
        ctx.closePath();
        ctx.fillStyle = `${color}${selected ? '30' : '14'}`;
        ctx.fill();
        if (selected) {
            this.tracePath(ctx, frequencies, db);
            ctx.strokeStyle = `${color}aa`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    private drawSumCurve(ctx: CanvasRenderingContext2D): void {
        const frequencies = this.sampleFrequencies(320);
        const db = this.responseDb(this.equalizerNodes, frequencies);
        this.tracePath(ctx, frequencies, db);
        ctx.strokeStyle = '#f5f7fa';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(90, 162, 255, 0.6)';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    openModal(): void {
        this.showModal();
    }

    setupModalContent(): void {
        // The Vue component renders everything.
    }
}
