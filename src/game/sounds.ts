// Lightweight WebAudio sound manager.
// All SFX are synthesized at runtime — no asset downloads, no licensing.
// Designed for the OutRun-style delivery game: Ferrari V12 engine drone,
// tire screech, horn, crash + angry blonde passenger shouting,
// delivery celebration with champagne pop + kiss + cheer, countdown ticks.

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  // Persistent engine nodes (Ferrari V12-ish: multiple detuned oscillators)
  private engineOscs: OscillatorNode[] = [];
  private engineGain?: GainNode;
  private engineFilter?: BiquadFilterNode;
  private engineHighGain?: GainNode;
  private engineHighOsc?: OscillatorNode;
  private engineRunning = false;

  private hornOsc?: OscillatorNode;
  private hornOsc2?: OscillatorNode;
  private hornGain?: GainNode;

  private screechSrc?: AudioBufferSourceNode;
  private screechSrc2?: AudioBufferSourceNode;
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

  // ---------- ENGINE (Ferrari V12) ----------
  startEngine() {
    if (!this.ctx || !this.master || this.engineRunning) return;
    const ctx = this.ctx;

    // Lowpass shapes the body of the engine
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    filter.Q.value = 4;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    filter.connect(gain);
    gain.connect(this.master);

    // Stack of detuned sawtooth oscillators — emulates 12 cylinders / harmonic richness
    // Frequencies are relative multipliers; all driven by setEngineSpeed.
    const harmonics = [
      { mult: 1,    type: 'sawtooth' as OscillatorType, detune:  -7, gain: 0.55 },
      { mult: 1,    type: 'sawtooth' as OscillatorType, detune:   7, gain: 0.55 },
      { mult: 0.5,  type: 'square'   as OscillatorType, detune:   0, gain: 0.45 }, // sub
      { mult: 2,    type: 'sawtooth' as OscillatorType, detune: -12, gain: 0.30 }, // 2nd harmonic
      { mult: 2,    type: 'sawtooth' as OscillatorType, detune:  12, gain: 0.30 },
      { mult: 3,    type: 'triangle' as OscillatorType, detune:   0, gain: 0.18 }, // 3rd harmonic colour
      { mult: 4,    type: 'sawtooth' as OscillatorType, detune:   0, gain: 0.10 }, // upper bite
    ];

    this.engineOscs = harmonics.map(h => {
      const osc = ctx.createOscillator();
      osc.type = h.type;
      osc.detune.value = h.detune;
      // store multiplier on the node for setEngineSpeed
      (osc as OscillatorNode & { __mult: number; __gain: number }).__mult = h.mult;
      (osc as OscillatorNode & { __mult: number; __gain: number }).__gain = h.gain;
      const g = ctx.createGain();
      g.gain.value = h.gain;
      osc.connect(g);
      g.connect(filter);
      osc.start();
      return osc;
    });

    // Subtle "exhaust hiss" shimmer at high RPM
    const highOsc = ctx.createOscillator();
    highOsc.type = 'sawtooth';
    highOsc.frequency.value = 0;
    const highGain = ctx.createGain();
    highGain.gain.value = 0;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1500;
    highOsc.connect(hp); hp.connect(highGain); highGain.connect(this.master);
    highOsc.start();
    this.engineHighOsc = highOsc;
    this.engineHighGain = highGain;

    this.engineGain = gain;
    this.engineFilter = filter;
    this.engineRunning = true;
  }

  /** speed is 0..1 (relative to max). */
  setEngineSpeed(speed: number) {
    if (!this.ctx || !this.engineGain || !this.engineFilter || this.engineOscs.length === 0) return;
    const t = this.ctx.currentTime;
    // Ferrari V12 idle ~700 RPM, redline ~8500. Map to perceptible audible range.
    const baseFreq = 70 + speed * 380; // 70Hz idle → ~450Hz redline (fundamental)
    for (const osc of this.engineOscs) {
      const mult = (osc as OscillatorNode & { __mult: number }).__mult;
      osc.frequency.setTargetAtTime(baseFreq * mult, t, 0.06);
    }
    // Filter opens up with revs — brighter at high RPM
    this.engineFilter.frequency.setTargetAtTime(500 + speed * 4500, t, 0.08);
    const targetGain = speed < 0.02 ? 0 : 0.10 + speed * 0.18;
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.1);

    if (this.engineHighOsc && this.engineHighGain) {
      this.engineHighOsc.frequency.setTargetAtTime(baseFreq * 6, t, 0.1);
      this.engineHighGain.gain.setTargetAtTime(speed > 0.5 ? (speed - 0.5) * 0.06 : 0, t, 0.1);
    }
  }

  stopEngine() {
    if (!this.engineRunning) return;
    for (const osc of this.engineOscs) {
      try { osc.stop(); } catch { /* ignore */ }
    }
    try { this.engineHighOsc?.stop(); } catch { /* ignore */ }
    this.engineOscs = [];
    this.engineHighOsc = undefined;
    this.engineHighGain = undefined;
    this.engineGain = undefined;
    this.engineFilter = undefined;
    this.engineRunning = false;
  }

  // ---------- HORN (held while pressed) — dual-tone Italian airhorn ----------
  setHorn(active: boolean) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    if (active && !this.hornOsc) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 392; // G4
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 523; // C5 — fifth above-ish, classic dual horn
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.02);
      osc.connect(gain); osc2.connect(gain);
      gain.connect(this.master);
      osc.start(); osc2.start();
      this.hornOsc = osc;
      this.hornOsc2 = osc2;
      this.hornGain = gain;
    } else if (!active && this.hornOsc && this.hornGain) {
      const t = ctx.currentTime;
      this.hornGain.gain.cancelScheduledValues(t);
      this.hornGain.gain.setValueAtTime(this.hornGain.gain.value, t);
      this.hornGain.gain.linearRampToValueAtTime(0, t + 0.05);
      const osc = this.hornOsc, osc2 = this.hornOsc2;
      setTimeout(() => {
        try { osc?.stop(); } catch { /* ignore */ }
        try { osc2?.stop(); } catch { /* ignore */ }
      }, 80);
      this.hornOsc = undefined;
      this.hornOsc2 = undefined;
      this.hornGain = undefined;
    }
  }

  // ---------- TIRE SCREECH (held) — gritty, dual-band ----------
  setScreech(active: boolean) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    if (active && !this.screechSrc) {
      const buffer = this.getNoiseBuffer();
      // High squeal band
      const src = ctx.createBufferSource();
      src.buffer = buffer; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 6;
      // Low rubber-rip band
      const src2 = ctx.createBufferSource();
      src2.buffer = buffer; src2.loop = true;
      const bp2 = ctx.createBiquadFilter();
      bp2.type = 'bandpass'; bp2.frequency.value = 700; bp2.Q.value = 3;

      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.04);

      src.connect(bp); bp.connect(gain);
      src2.connect(bp2); bp2.connect(gain);
      gain.connect(this.master);
      src.start(); src2.start();
      this.screechSrc = src;
      this.screechSrc2 = src2;
      this.screechGain = gain;
    } else if (!active && this.screechSrc && this.screechGain) {
      const t = ctx.currentTime;
      this.screechGain.gain.cancelScheduledValues(t);
      this.screechGain.gain.setValueAtTime(this.screechGain.gain.value, t);
      this.screechGain.gain.linearRampToValueAtTime(0, t + 0.08);
      const src = this.screechSrc, src2 = this.screechSrc2;
      setTimeout(() => {
        try { src?.stop(); } catch { /* ignore */ }
        try { src2?.stop(); } catch { /* ignore */ }
      }, 120);
      this.screechSrc = undefined;
      this.screechSrc2 = undefined;
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
    // Metallic crunch (filtered noise)
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass'; nFilter.frequency.value = 1800; nFilter.Q.value = 0.7;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.45, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(this.master);
    noise.start(t); noise.stop(t + 0.6);
    // Glass shatter shimmer
    const noise2 = ctx.createBufferSource();
    noise2.buffer = this.getNoiseBuffer();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 4000;
    const n2g = ctx.createGain();
    n2g.gain.setValueAtTime(0.25, t + 0.05);
    n2g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    noise2.connect(hp); hp.connect(n2g); n2g.connect(this.master);
    noise2.start(t + 0.05); noise2.stop(t + 0.55);

    // Angry blonde passenger shouting (formant-style bursts)
    this.playAngryShout(t + 0.35);
  }

  /** Funny indistinct angry shouting — 3-4 vowel-like bursts with rising pitch. */
  private playAngryShout(startTime: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    // Random length 3-5 syllables
    const syllables = 3 + Math.floor(Math.random() * 3);
    let t = startTime;
    // Female-ish formant pitches (higher pitch)
    const basePitches = [320, 380, 440, 520, 480, 600];
    for (let i = 0; i < syllables; i++) {
      const dur = 0.12 + Math.random() * 0.14;
      const pitch = basePitches[(i + Math.floor(Math.random() * 2)) % basePitches.length] * (1 + Math.random() * 0.15);

      // Carrier (vocal cord-ish): sawtooth with vibrato
      const carrier = ctx.createOscillator();
      carrier.type = 'sawtooth';
      carrier.frequency.setValueAtTime(pitch, t);
      carrier.frequency.linearRampToValueAtTime(pitch * (0.85 + Math.random() * 0.3), t + dur);

      // Vibrato LFO
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5 + Math.random() * 3;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = pitch * 0.04;
      lfo.connect(lfoGain); lfoGain.connect(carrier.frequency);

      // Two formant bandpass filters → vowel-like quality
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = 700 + Math.random() * 400; // F1: 700-1100
      f1.Q.value = 8;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.value = 1500 + Math.random() * 1200; // F2
      f2.Q.value = 8;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.35, t + 0.02);
      env.gain.linearRampToValueAtTime(0.30, t + dur - 0.04);
      env.gain.linearRampToValueAtTime(0, t + dur);

      carrier.connect(f1); f1.connect(f2); f2.connect(env); env.connect(this.master);
      carrier.start(t); lfo.start(t);
      carrier.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);

      t += dur + 0.04 + Math.random() * 0.05;
    }
  }

  /** Delivery celebration: champagne pop + cheer + kiss. */
  playDelivery() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    // 1) Quick triumphant arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.10;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.20, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
      osc.connect(g); g.connect(this.master!);
      osc.start(t); osc.stop(t + 0.35);
    });

    // 2) Champagne POP at t0 + 0.5
    this.playChampagnePop(t0 + 0.5);

    // 3) Crowd "Yeahhh!" cheer (filtered noise swell) at t0 + 0.7
    this.playCheer(t0 + 0.7);

    // 4) Smooch / kiss at t0 + 1.6
    this.playKiss(t0 + 1.6);
  }

  private playChampagnePop(t: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    // Cork "thock": short pitched click
    const pop = ctx.createOscillator();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(900, t);
    pop.frequency.exponentialRampToValueAtTime(120, t + 0.06);
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.45, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    pop.connect(pg); pg.connect(this.master);
    pop.start(t); pop.stop(t + 0.12);

    // Fizzy bubbles afterwards: highpassed noise tail
    const fizz = ctx.createBufferSource();
    fizz.buffer = this.getNoiseBuffer();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 5000;
    const fg = ctx.createGain();
    fg.gain.setValueAtTime(0, t + 0.05);
    fg.gain.linearRampToValueAtTime(0.18, t + 0.12);
    fg.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    fizz.connect(hp); hp.connect(fg); fg.connect(this.master);
    fizz.start(t + 0.05); fizz.stop(t + 1.05);
  }

  private playCheer(t: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    // "Yeahhh" — vowel-ish swell
    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(280, t);
    carrier.frequency.linearRampToValueAtTime(420, t + 0.6);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass'; f1.frequency.value = 900; f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass'; f2.frequency.value = 2200; f2.Q.value = 5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.22, t + 0.15);
    env.gain.linearRampToValueAtTime(0.20, t + 0.55);
    env.gain.linearRampToValueAtTime(0, t + 0.85);
    carrier.connect(f1); f1.connect(f2); f2.connect(env); env.connect(this.master);
    carrier.start(t); carrier.stop(t + 0.9);

    // Crowd shimmer (noise) under the cheer
    const n = ctx.createBufferSource();
    n.buffer = this.getNoiseBuffer();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.10, t + 0.2);
    ng.gain.linearRampToValueAtTime(0, t + 0.9);
    n.connect(bp); bp.connect(ng); ng.connect(this.master);
    n.start(t); n.stop(t + 0.95);
  }

  private playKiss(t: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    // Smooch: short noise burst → quick pitched chirp upward (the "muah!")
    const n = ctx.createBufferSource();
    n.buffer = this.getNoiseBuffer();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(hp); hp.connect(ng); ng.connect(this.master);
    n.start(t); n.stop(t + 0.06);

    // The "muah" pitched part
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.18);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + 0.04);
    g.gain.linearRampToValueAtTime(0.28, t + 0.07);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(lp); lp.connect(g); g.connect(this.master);
    osc.start(t + 0.04); osc.stop(t + 0.24);
  }

  // ---------- MALFUNCTION SFX ----------
  /** Engine sputter / backfire — pop + wheezing. */
  playMalfunction() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Backfire pop
    const pop = ctx.createOscillator();
    pop.type = 'square';
    pop.frequency.setValueAtTime(180, t);
    pop.frequency.exponentialRampToValueAtTime(50, t + 0.15);
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.45, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    pop.connect(pg); pg.connect(this.master);
    pop.start(t); pop.stop(t + 0.22);
    // Sputter (multiple short noise clicks)
    for (let i = 0; i < 4; i++) {
      const ts = t + 0.18 + i * 0.09;
      const n = ctx.createBufferSource();
      n.buffer = this.getNoiseBuffer();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 400 + Math.random() * 600; bp.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, ts);
      g.gain.exponentialRampToValueAtTime(0.001, ts + 0.08);
      n.connect(bp); bp.connect(g); g.connect(this.master);
      n.start(ts); n.stop(ts + 0.1);
    }
  }

  /** Wheel falling off — clang + roll. */
  playWheelOff() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Metallic clang
    const clang = ctx.createOscillator();
    clang.type = 'square';
    clang.frequency.setValueAtTime(420, t);
    clang.frequency.exponentialRampToValueAtTime(180, t + 0.35);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.4, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 2;
    clang.connect(bp); bp.connect(cg); cg.connect(this.master);
    clang.start(t); clang.stop(t + 0.42);
    // Rolling rumble
    const n = ctx.createBufferSource();
    n.buffer = this.getNoiseBuffer();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18, t + 0.1);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    n.connect(lp); lp.connect(ng); ng.connect(this.master);
    n.start(t + 0.1); n.stop(t + 1.45);
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
