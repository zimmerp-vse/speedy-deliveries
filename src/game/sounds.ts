// WebAudio sound manager — arcade racer style (Need for Speed turbo growl).
// Engine uses a granular pulse-train (mimics cylinder firing) so it has
// real "engine texture" instead of a sci-fi drone.

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  // ---------- engine nodes ----------
  private engineRunning = false;
  private engineBuffer?: AudioBuffer;     // short pulse-train sample
  private engineSrc?: AudioBufferSourceNode;
  private engineGain?: GainNode;
  private engineFilter?: BiquadFilterNode;
  private engineDist?: WaveShaperNode;

  private rumbleSrc?: AudioBufferSourceNode;
  private rumbleGain?: GainNode;
  private rumbleFilter?: BiquadFilterNode;

  private turboOsc?: OscillatorNode;
  private turboGain?: GainNode;
  private turboFilter?: BiquadFilterNode;

  // horn
  private hornNodes: { stop: () => void } | null = null;

  // screech
  private screechNodes: { stop: () => void } | null = null;

  ensureContext() {
    if (this.ctx) return;
    const Ctor: typeof AudioContext =
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      window.AudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
  }
  isMuted() { return this.muted; }

  // ===================================================================
  // ENGINE — granular pulse-train (NFS-style turbo growl)
  // ===================================================================
  private buildEnginePulseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    // ~200ms of a synthesised "engine cylinder firing pattern".
    // We layer many short sawtooth-like pulses with noise to get
    // a meaty growl. Played at variable playbackRate to change RPM.
    const sr = ctx.sampleRate;
    const dur = 0.2;
    const length = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, length, sr);
    const data = buf.getChannelData(0);

    // Fundamental "firing" frequency at 1.0 playback rate.
    const fundamental = 80; // Hz — gives meaty low-end at idle
    const samplesPerCycle = sr / fundamental;

    for (let i = 0; i < length; i++) {
      const cyclePos = (i % samplesPerCycle) / samplesPerCycle; // 0..1
      // Sharp asymmetric pulse — like a piston firing.
      // Strong attack, decay tail.
      const env = Math.exp(-cyclePos * 6) * (1 - cyclePos * 0.3);
      // Mix of saw + square + noise = aggressive growl
      const saw = (cyclePos * 2 - 1);
      const sqr = cyclePos < 0.5 ? 1 : -1;
      const noise = (Math.random() * 2 - 1) * 0.3;
      data[i] = env * (saw * 0.55 + sqr * 0.3 + noise * 0.4);
    }
    // Gentle DC removal & normalise
    let max = 0;
    for (let i = 0; i < length; i++) max = Math.max(max, Math.abs(data[i]));
    if (max > 0) for (let i = 0; i < length; i++) data[i] /= max;
    return buf;
  }

  private buildDistortionCurve(amount: number): Float32Array {
    const n = 1024;
    const curve = new Float32Array(n);
    const k = amount;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  startEngine() {
    if (!this.ctx || !this.master || this.engineRunning) return;
    const ctx = this.ctx;
    if (!this.engineBuffer) this.engineBuffer = this.buildEnginePulseBuffer();

    // ---- main engine pulse train (loops short pulse buffer) ----
    const src = ctx.createBufferSource();
    src.buffer = this.engineBuffer;
    src.loop = true;
    src.playbackRate.value = 0.6; // idle

    // Lowpass to keep the body warm — opens up at high RPM
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 1.5;

    // Soft clip for that aggressive turbo edge
    const dist = ctx.createWaveShaper();
    dist.curve = this.buildDistortionCurve(8) as unknown as Float32Array;
    dist.oversample = '4x';

    const gain = ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter);
    filter.connect(dist);
    dist.connect(gain);
    gain.connect(this.master);
    src.start();

    this.engineSrc = src;
    this.engineFilter = filter;
    this.engineDist = dist;
    this.engineGain = gain;

    // ---- low rumble layer (sub bass underneath) ----
    const rsrc = ctx.createBufferSource();
    rsrc.buffer = this.getNoiseBuffer();
    rsrc.loop = true;
    const rfilt = ctx.createBiquadFilter();
    rfilt.type = 'lowpass'; rfilt.frequency.value = 90; rfilt.Q.value = 4;
    const rgain = ctx.createGain();
    rgain.gain.value = 0;
    rsrc.connect(rfilt); rfilt.connect(rgain); rgain.connect(this.master);
    rsrc.start();
    this.rumbleSrc = rsrc;
    this.rumbleFilter = rfilt;
    this.rumbleGain = rgain;

    // ---- turbo whistle (kicks in at high RPM) ----
    const tosc = ctx.createOscillator();
    tosc.type = 'sine';
    tosc.frequency.value = 2000;
    const tfilt = ctx.createBiquadFilter();
    tfilt.type = 'bandpass'; tfilt.frequency.value = 3500; tfilt.Q.value = 8;
    const tgain = ctx.createGain();
    tgain.gain.value = 0;
    tosc.connect(tfilt); tfilt.connect(tgain); tgain.connect(this.master);
    tosc.start();
    this.turboOsc = tosc;
    this.turboFilter = tfilt;
    this.turboGain = tgain;

    this.engineRunning = true;
  }

  /** speed 0..1 */
  setEngineSpeed(speed: number) {
    if (!this.ctx || !this.engineSrc || !this.engineGain || !this.engineFilter) return;
    const t = this.ctx.currentTime;
    // Playback rate 0.55 (idle) → 3.2 (redline). Non-linear so it sounds aggressive at top.
    const rate = 0.55 + Math.pow(speed, 0.85) * 2.6;
    this.engineSrc.playbackRate.setTargetAtTime(rate, t, 0.07);

    // Filter opens with revs — adds bite
    this.engineFilter.frequency.setTargetAtTime(500 + speed * 5500, t, 0.08);
    this.engineFilter.Q.setTargetAtTime(1.5 + speed * 4, t, 0.1);

    const targetGain = speed < 0.02 ? 0.04 : 0.18 + speed * 0.25;
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.08);

    if (this.rumbleGain && this.rumbleFilter) {
      this.rumbleFilter.frequency.setTargetAtTime(60 + speed * 80, t, 0.1);
      this.rumbleGain.gain.setTargetAtTime(speed < 0.02 ? 0.05 : 0.12 + speed * 0.18, t, 0.1);
    }

    if (this.turboOsc && this.turboGain && this.turboFilter) {
      // Turbo only audible above ~50% throttle — whines higher with revs
      const turboFreq = 1800 + speed * 4500;
      this.turboFilter.frequency.setTargetAtTime(turboFreq, t, 0.1);
      this.turboOsc.frequency.setTargetAtTime(turboFreq, t, 0.1);
      const turboVol = speed > 0.45 ? (speed - 0.45) * 0.18 : 0;
      this.turboGain.gain.setTargetAtTime(turboVol, t, 0.12);
    }
  }

  stopEngine() {
    if (!this.engineRunning) return;
    try { this.engineSrc?.stop(); } catch { /* ignore */ }
    try { this.rumbleSrc?.stop(); } catch { /* ignore */ }
    try { this.turboOsc?.stop(); } catch { /* ignore */ }
    this.engineSrc = undefined;
    this.rumbleSrc = undefined;
    this.turboOsc = undefined;
    this.engineGain = undefined;
    this.engineFilter = undefined;
    this.engineDist = undefined;
    this.rumbleFilter = undefined;
    this.rumbleGain = undefined;
    this.turboFilter = undefined;
    this.turboGain = undefined;
    this.engineRunning = false;
  }

  // ===================================================================
  // HORN — dual-tone air horn
  // ===================================================================
  setHorn(active: boolean) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    if (active && !this.hornNodes) {
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 392;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 523;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 2500;
      const g = ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.02);
      o1.connect(filt); o2.connect(filt); filt.connect(g); g.connect(this.master);
      o1.start(); o2.start();
      this.hornNodes = {
        stop: () => {
          const t = ctx.currentTime;
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0, t + 0.05);
          setTimeout(() => { try { o1.stop(); o2.stop(); } catch { /* ignore */ } }, 80);
        }
      };
    } else if (!active && this.hornNodes) {
      this.hornNodes.stop();
      this.hornNodes = null;
    }
  }

  // ===================================================================
  // TIRE SCREECH — punchy chirp + harsh band layers
  // ===================================================================
  setScreech(active: boolean) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    if (active && !this.screechNodes) {
      const t0 = ctx.currentTime;

      // Layer 1: aggressive squeal — sawtooth oscillator with random pitch wobble
      // makes the actual "EEEEK" of rubber slipping, not just noise.
      const squeal = ctx.createOscillator();
      squeal.type = 'sawtooth';
      squeal.frequency.value = 1400;
      // Detune LFO for chaos
      const wob = ctx.createOscillator(); wob.type = 'triangle'; wob.frequency.value = 14;
      const wobAmt = ctx.createGain(); wobAmt.gain.value = 180;
      wob.connect(wobAmt); wobAmt.connect(squeal.frequency);

      const sFilt = ctx.createBiquadFilter();
      sFilt.type = 'bandpass'; sFilt.frequency.value = 2400; sFilt.Q.value = 5;
      const sDist = ctx.createWaveShaper();
      sDist.curve = this.buildDistortionCurve(6) as unknown as Float32Array;
      const sGain = ctx.createGain();
      sGain.gain.value = 0;
      sGain.gain.linearRampToValueAtTime(0.12, t0 + 0.03);

      squeal.connect(sFilt); sFilt.connect(sDist); sDist.connect(sGain); sGain.connect(this.master);

      // Layer 2: gritty rubber-rip noise (filtered)
      const ripple = ctx.createBufferSource();
      ripple.buffer = this.getNoiseBuffer(); ripple.loop = true;
      const rFilt = ctx.createBiquadFilter();
      rFilt.type = 'bandpass'; rFilt.frequency.value = 800; rFilt.Q.value = 2.5;
      const rGain = ctx.createGain(); rGain.gain.value = 0;
      rGain.gain.linearRampToValueAtTime(0.08, t0 + 0.04);
      ripple.connect(rFilt); rFilt.connect(rGain); rGain.connect(this.master);

      squeal.start(); wob.start(); ripple.start();

      this.screechNodes = {
        stop: () => {
          const t = ctx.currentTime;
          [sGain, rGain].forEach(g => {
            g.gain.cancelScheduledValues(t);
            g.gain.setValueAtTime(g.gain.value, t);
            g.gain.linearRampToValueAtTime(0, t + 0.07);
          });
          setTimeout(() => {
            try { squeal.stop(); wob.stop(); ripple.stop(); } catch { /* ignore */ }
          }, 100);
        }
      };
    } else if (!active && this.screechNodes) {
      this.screechNodes.stop();
      this.screechNodes = null;
    }
  }

  // ===================================================================
  // CRASH — boom + glass + angry shouting
  // ===================================================================
  playCrash() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Low boom
    const boom = ctx.createOscillator();
    boom.type = 'sawtooth';
    boom.frequency.setValueAtTime(180, t);
    boom.frequency.exponentialRampToValueAtTime(35, t + 0.7);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.55, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    const bDist = ctx.createWaveShaper(); bDist.curve = this.buildDistortionCurve(10) as unknown as Float32Array;
    boom.connect(bDist); bDist.connect(bg); bg.connect(this.master);
    boom.start(t); boom.stop(t + 0.85);

    // Metallic crunch
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();
    const nF = ctx.createBiquadFilter(); nF.type = 'bandpass'; nF.frequency.value = 1600; nF.Q.value = 0.8;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.5, t);
    nG.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    noise.connect(nF); nF.connect(nG); nG.connect(this.master);
    noise.start(t); noise.stop(t + 0.6);

    // Glass shatter
    const noise2 = ctx.createBufferSource();
    noise2.buffer = this.getNoiseBuffer();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    const n2g = ctx.createGain();
    n2g.gain.setValueAtTime(0.3, t + 0.05);
    n2g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    noise2.connect(hp); hp.connect(n2g); n2g.connect(this.master);
    noise2.start(t + 0.05); noise2.stop(t + 0.5);

    // Angry shout — starts after the bang
    this.playAngryShout(t + 0.5);
  }

  /**
   * Angry shouting — uses noisy glottal pulses + harsh formants + consonant noise.
   * No musical pitches — random rough vocal bursts that sound frustrated.
   */
  private playAngryShout(startTime: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const syllables = 3 + Math.floor(Math.random() * 3);
    let t = startTime;

    for (let i = 0; i < syllables; i++) {
      const dur = 0.18 + Math.random() * 0.22;
      // Pitch range like an angry female speaking — non-musical, jumps around
      const startPitch = 240 + Math.random() * 180;
      const endPitch = startPitch * (0.6 + Math.random() * 0.7); // can fall OR rise

      // Glottal-ish source: pulse-width-modulated saw with noise mixed in
      const carrier = ctx.createOscillator();
      carrier.type = 'sawtooth';
      carrier.frequency.setValueAtTime(startPitch, t);
      // Sharp pitch contour — natural shout, not melodic
      carrier.frequency.exponentialRampToValueAtTime(Math.max(80, endPitch), t + dur);

      // Add breath/grit noise to the voice
      const breath = ctx.createBufferSource();
      breath.buffer = this.getNoiseBuffer();
      const breathF = ctx.createBiquadFilter();
      breathF.type = 'highpass'; breathF.frequency.value = 1200;
      const breathG = ctx.createGain();
      breathG.gain.setValueAtTime(0, t);
      breathG.gain.linearRampToValueAtTime(0.18, t + 0.02);
      breathG.gain.linearRampToValueAtTime(0, t + dur);

      // Two formant filters for vowel quality — randomised per syllable
      // (like "AH", "EH", "UH" — frustrated open vowels)
      const vowels = [
        [780, 1100],  // AH
        [550, 1700],  // EH
        [640, 1190],  // AW
        [490, 1350],  // UH
      ];
      const v = vowels[Math.floor(Math.random() * vowels.length)];
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass'; f1.frequency.value = v[0]; f1.Q.value = 6;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass'; f2.frequency.value = v[1]; f2.Q.value = 7;

      // Distortion = vocal strain
      const strain = ctx.createWaveShaper();
      strain.curve = this.buildDistortionCurve(15) as unknown as Float32Array;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.42, t + 0.025);
      env.gain.linearRampToValueAtTime(0.36, t + dur - 0.06);
      env.gain.linearRampToValueAtTime(0, t + dur);

      // Wire: carrier → formants → strain → env, breath → env (parallel)
      carrier.connect(f1); f1.connect(f2); f2.connect(strain); strain.connect(env);
      breath.connect(breathF); breathF.connect(env);
      env.connect(this.master);

      carrier.start(t); breath.start(t);
      carrier.stop(t + dur + 0.02); breath.stop(t + dur + 0.02);

      // Optional consonant burst at start of syllable (T/K/P sound)
      if (Math.random() < 0.5) {
        const cons = ctx.createBufferSource();
        cons.buffer = this.getNoiseBuffer();
        const cf = ctx.createBiquadFilter();
        cf.type = 'highpass'; cf.frequency.value = 3000;
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.25, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        cons.connect(cf); cf.connect(cg); cg.connect(this.master);
        cons.start(t); cons.stop(t + 0.05);
      }

      // Variable gap — natural speech rhythm, not metronomic
      t += dur + 0.05 + Math.random() * 0.12;
    }
  }

  // ===================================================================
  // DELIVERY — arpeggio + champagne pop + cheer + KISS
  // ===================================================================
  playDelivery() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    // Triumphant arpeggio
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const t = t0 + i * 0.10;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
      osc.connect(g); g.connect(this.master!);
      osc.start(t); osc.stop(t + 0.35);
    });

    this.playChampagnePop(t0 + 0.55);
    this.playCheer(t0 + 0.85);
    this.playKiss(t0 + 1.9);
  }

  private playChampagnePop(t: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;

    // Sharp transient — short noise click + low thump
    const click = ctx.createBufferSource();
    click.buffer = this.getNoiseBuffer();
    const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1200; cf.Q.value = 1.5;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.7, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    click.connect(cf); cf.connect(cg); cg.connect(this.master);
    click.start(t); click.stop(t + 0.06);

    // Low pop body
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(280, t);
    thump.frequency.exponentialRampToValueAtTime(80, t + 0.12);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.6, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    thump.connect(tg); tg.connect(this.master);
    thump.start(t); thump.stop(t + 0.18);

    // Fizz tail — long sparkly bubbles
    const fizz = ctx.createBufferSource();
    fizz.buffer = this.getNoiseBuffer();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500;
    const fg = ctx.createGain();
    fg.gain.setValueAtTime(0, t + 0.05);
    fg.gain.linearRampToValueAtTime(0.22, t + 0.15);
    fg.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    fizz.connect(hp); hp.connect(fg); fg.connect(this.master);
    fizz.start(t + 0.05); fizz.stop(t + 1.5);
  }

  private playCheer(t: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(280, t);
    carrier.frequency.linearRampToValueAtTime(420, t + 0.6);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 900; f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2200; f2.Q.value = 5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.22, t + 0.15);
    env.gain.linearRampToValueAtTime(0.20, t + 0.55);
    env.gain.linearRampToValueAtTime(0, t + 0.85);
    carrier.connect(f1); f1.connect(f2); f2.connect(env); env.connect(this.master);
    carrier.start(t); carrier.stop(t + 0.9);

    const n = ctx.createBufferSource();
    n.buffer = this.getNoiseBuffer();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.10, t + 0.2);
    ng.gain.linearRampToValueAtTime(0, t + 0.9);
    n.connect(bp); bp.connect(ng); ng.connect(this.master);
    n.start(t); n.stop(t + 0.95);
  }

  /** A proper "MWAH!" — inward suck noise + smacking lip transient. */
  private playKiss(t: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;

    // Phase 1: short inward "suction" noise (the lip-puckering)
    const suck = ctx.createBufferSource();
    suck.buffer = this.getNoiseBuffer();
    const suckF = ctx.createBiquadFilter();
    suckF.type = 'bandpass'; suckF.frequency.value = 800; suckF.Q.value = 4;
    const suckG = ctx.createGain();
    suckG.gain.setValueAtTime(0, t);
    suckG.gain.linearRampToValueAtTime(0.18, t + 0.04);
    suckG.gain.linearRampToValueAtTime(0.05, t + 0.10);
    suck.connect(suckF); suckF.connect(suckG); suckG.connect(this.master);
    suck.start(t); suck.stop(t + 0.12);

    // Phase 2: SMACK — sharp wet click (high-passed noise burst)
    const smack = ctx.createBufferSource();
    smack.buffer = this.getNoiseBuffer();
    const smackF = ctx.createBiquadFilter();
    smackF.type = 'bandpass'; smackF.frequency.value = 1600; smackF.Q.value = 2;
    const smackG = ctx.createGain();
    smackG.gain.setValueAtTime(0.55, t + 0.10);
    smackG.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    smack.connect(smackF); smackF.connect(smackG); smackG.connect(this.master);
    smack.start(t + 0.10); smack.stop(t + 0.20);

    // Phase 3: pitched "MWAH" tail — voiced part, falling pitch
    const voice = ctx.createOscillator();
    voice.type = 'sine';
    voice.frequency.setValueAtTime(620, t + 0.12);
    voice.frequency.exponentialRampToValueAtTime(280, t + 0.32);
    const vF = ctx.createBiquadFilter();
    vF.type = 'lowpass'; vF.frequency.value = 1500;
    // Add a touch of formant warmth
    const vF2 = ctx.createBiquadFilter();
    vF2.type = 'bandpass'; vF2.frequency.value = 900; vF2.Q.value = 4;
    const vG = ctx.createGain();
    vG.gain.setValueAtTime(0, t + 0.12);
    vG.gain.linearRampToValueAtTime(0.45, t + 0.16);
    vG.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    voice.connect(vF); vF.connect(vF2); vF2.connect(vG); vG.connect(this.master);
    voice.start(t + 0.12); voice.stop(t + 0.45);
  }

  // ===================================================================
  // MALFUNCTION SFX
  // ===================================================================
  playMalfunction() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pop = ctx.createOscillator();
    pop.type = 'square';
    pop.frequency.setValueAtTime(180, t);
    pop.frequency.exponentialRampToValueAtTime(50, t + 0.15);
    const dist = ctx.createWaveShaper(); dist.curve = this.buildDistortionCurve(8) as unknown as Float32Array;
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.5, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    pop.connect(dist); dist.connect(pg); pg.connect(this.master);
    pop.start(t); pop.stop(t + 0.22);
    for (let i = 0; i < 4; i++) {
      const ts = t + 0.18 + i * 0.09;
      const n = ctx.createBufferSource();
      n.buffer = this.getNoiseBuffer();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 400 + Math.random() * 600; bp.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.28, ts);
      g.gain.exponentialRampToValueAtTime(0.001, ts + 0.08);
      n.connect(bp); bp.connect(g); g.connect(this.master);
      n.start(ts); n.stop(ts + 0.1);
    }
  }

  playWheelOff() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
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
