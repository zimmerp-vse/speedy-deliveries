// Lightweight WebAudio sound manager.
// All SFX are synthesized at runtime — no asset downloads, no licensing.
// Designed for the OutRun-style delivery game: engine drone, horn, tire screech,
// crash, delivery jingle, countdown ticks.

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  // Persistent engine nodes
  private engineOsc?: OscillatorNode;
  private engineSubOsc?: OscillatorNode;
  private engineGain?: GainNode;
  private engineFilter?: BiquadFilterNode;
  private engineRunning = false;

  private hornOsc?: OscillatorNode;
  private hornGain?: GainNode;

  private screechSrc?: AudioBufferSourceNode;
  private screechGain?: GainNode;

  /** Initialise on first user interaction (browsers require a gesture). */
  ensureContext() {
    if (this.ctx) return;
    const Ctor: typeof AudioContext =
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      window.AudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.6;
  }
  isMuted() { return this.muted; }

  // ---------- ENGINE (looped) ----------
  startEngine() {
    if (!this.ctx || !this.master || this.engineRunning) return;
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;

    const sub = ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 30;

    const gain = ctx.createGain();
    gain.gain.value = 0.0;

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    sub.start();

    this.engineOsc = osc;
    this.engineSubOsc = sub;
    this.engineGain = gain;
    this.engineFilter = filter;
    this.engineRunning = true;
  }

  /** speed is 0..1 (relative to max). */
  setEngineSpeed(speed: number) {
    if (!this.ctx || !this.engineOsc || !this.engineSubOsc || !this.engineGain || !this.engineFilter) return;
    const t = this.ctx.currentTime;
    const baseFreq = 55 + speed * 220;
    this.engineOsc.frequency.setTargetAtTime(baseFreq, t, 0.08);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(400 + speed * 1800, t, 0.1);
    const targetGain = speed < 0.02 ? 0 : 0.06 + speed * 0.12;
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.1);
  }

  stopEngine() {
    if (!this.engineRunning) return;
    try { this.engineOsc?.stop(); } catch { /* ignore */ }
    try { this.engineSubOsc?.stop(); } catch { /* ignore */ }
    this.engineOsc = undefined;
    this.engineSubOsc = undefined;
    this.engineGain = undefined;
    this.engineFilter = undefined;
    this.engineRunning = false;
  }

  // ---------- HORN (held while pressed) ----------
  setHorn(active: boolean) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    if (active && !this.hornOsc) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 440;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      this.hornOsc = osc;
      this.hornGain = gain;
    } else if (!active && this.hornOsc && this.hornGain) {
      const t = ctx.currentTime;
      this.hornGain.gain.cancelScheduledValues(t);
      this.hornGain.gain.setValueAtTime(this.hornGain.gain.value, t);
      this.hornGain.gain.linearRampToValueAtTime(0, t + 0.05);
      const osc = this.hornOsc;
      setTimeout(() => { try { osc.stop(); } catch { /* ignore */ } }, 80);
      this.hornOsc = undefined;
      this.hornGain = undefined;
    }
  }

  // ---------- TIRE SCREECH (held) ----------
  setScreech(active: boolean) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    if (active && !this.screechSrc) {
      const buffer = this.getNoiseBuffer();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2200;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.04);
      src.connect(filter); filter.connect(gain); gain.connect(this.master);
      src.start();
      this.screechSrc = src;
      this.screechGain = gain;
    } else if (!active && this.screechSrc && this.screechGain) {
      const t = ctx.currentTime;
      this.screechGain.gain.cancelScheduledValues(t);
      this.screechGain.gain.setValueAtTime(this.screechGain.gain.value, t);
      this.screechGain.gain.linearRampToValueAtTime(0, t + 0.08);
      const src = this.screechSrc;
      setTimeout(() => { try { src.stop(); } catch { /* ignore */ } }, 120);
      this.screechSrc = undefined;
      this.screechGain = undefined;
    }
  }

  // ---------- ONE-SHOT SFX ----------
  playCrash() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Low boom
    const boomOsc = ctx.createOscillator();
    boomOsc.type = 'sawtooth';
    boomOsc.frequency.setValueAtTime(160, t);
    boomOsc.frequency.exponentialRampToValueAtTime(40, t + 0.6);
    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(0.5, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    boomOsc.connect(boomGain); boomGain.connect(this.master);
    boomOsc.start(t); boomOsc.stop(t + 0.75);
    // Noise burst (debris)
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass'; nFilter.frequency.value = 1200; nFilter.Q.value = 0.7;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.45, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(this.master);
    noise.start(t); noise.stop(t + 0.6);
  }

  playDelivery() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    // Triumphant 3-note jingle (C major arpeggio)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g); g.connect(this.master!);
      osc.start(t); osc.stop(t + 0.4);
    });
  }

  playTick(highPitch = false) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = highPitch ? 1200 : 800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.1);
  }

  playUiClick() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.12);
  }

  // ---------- helpers ----------
  private noiseBuffer?: AudioBuffer;
  private getNoiseBuffer(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }
}

export const sounds = new SoundManager();
