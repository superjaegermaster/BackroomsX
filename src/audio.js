// All audio synthesized at runtime — zero audio downloads.
// 60 Hz fluorescent hum + tape hiss bed, 3D neon buzz panned at the exit and
// two corridors, flicker buzz swells, door creak, music crossfades via <audio>.
const ACtx = window.AudioContext || window.webkitAudioContext;

export class AudioBed {
  constructor() { this.ctx = null; this.ready = false; }

  start() { // must be called from a user gesture
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new ACtx();
    const master = this.master = ctx.createGain();
    master.gain.value = 0.9; master.connect(ctx.destination);

    // --- hum bed: 60/120/180 Hz + slow AM breathing ---
    const humMix = ctx.createGain(); humMix.gain.value = 0.02;
    humMix.connect(master);
    for (const [f, g] of [[60, 0.5], [120, 0.2], [180, 0.06]]) {
      const o = ctx.createOscillator(); o.frequency.value = f; o.type = "sine";
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og); og.connect(humMix); o.start();
    }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.25;
    const lg = ctx.createGain(); lg.gain.value = 0.018;
    lfo.connect(lg); lg.connect(humMix.gain); lfo.start();

    // VHS tape hiss and the brown room-noise layer are intentionally absent.
    // Keep only the quiet fluorescent ballast hum plus spatial neon buzz.
    this.humMix = humMix;

    // --- neon buzz buffer (120 Hz stack + fizz + crackle) ---
    this.neonBuf = this._makeNeonBuffer(ctx);
    this.ready = true;
  }

  _makeNeonBuffer(ctx) {
    const sr = ctx.sampleRate, dur = 4, N = sr * dur;
    const buf = ctx.createBuffer(1, N, sr), d = buf.getChannelData(0);
    let seed = 1337;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let k = 1; k < 42; k += 2) {
      const amp = 0.30 / Math.pow(k, 1.4), w = 2 * Math.PI * 120 * k / sr;
      for (let i = 0; i < N; i++) d[i] += amp * Math.sin(w * i);
    }
    let prev = 0;
    for (let i = 0; i < N; i++) {
      const wn = rnd() * 2 - 1; d[i] += 0.05 * (wn - prev); prev = wn;
      d[i] += 0.10 * Math.sin(2 * Math.PI * 60 * i / sr);
    }
    for (let p = 0; p < 26; p++) {
      const pos = 4000 + Math.floor(rnd() * (N - 8200)), amp = 0.25 + rnd() * 0.45;
      for (let j = 0; j < 140; j++)
        d[pos + j] += amp * Math.exp(-j / 18) * (j % 2 ? -0.6 : 0.6);
    }
    for (let i = 0; i < N; i++) {
      const t = i / sr;
      d[i] *= 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.5 * t) + 0.08 * Math.sin(4 * Math.PI * t + 0.7);
    }
    let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(d[i]));
    for (let i = 0; i < N; i++) d[i] = d[i] / peak * 0.5;
    // seamless seam
    const X = Math.floor(sr * 0.2);
    for (let i = 0; i < X; i++) { const w = i / X; d[i] = d[i] * w + d[N - X + i] * (1 - w); }
    return buf;
  }

  placeNeon(pos, gain = 0.10, pitch = 1) {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.neonBuf; src.loop = true;
    src.playbackRate.value = pitch;
    const pan = ctx.createPanner();
    pan.panningModel = "HRTF"; pan.distanceModel = "inverse";
    pan.refDistance = 2; pan.maxDistance = 16; pan.rolloffFactor = 1.2;
    pan.positionX.value = pos.x; pan.positionY.value = pos.y; pan.positionZ.value = pos.z;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(pan); pan.connect(this.master);
    src.start();
    return { src, gain: g, base: gain };
  }

  buzzSurge(node) {
    if (!node) return;
    const t = this.ctx.currentTime, g = node.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(node.base * 3.2, t + 0.05);
    g.linearRampToValueAtTime(node.base, t + 1.2);
  }

  humSurge() { // dying-ballast buzz with corridor flicker
    if (!this.ready) return;
    const t = this.ctx.currentTime, g = this.humMix.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.075, t + 0.06);
    g.linearRampToValueAtTime(0.02, t + 1.3);
  }

  doorCreak() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(95, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 340; f.Q.value = 4;
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.65);
    // hinge thud at the end
    const o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.frequency.value = 62;
    g2.gain.setValueAtTime(0.0001, t + 0.52);
    g2.gain.exponentialRampToValueAtTime(0.12, t + 0.56);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o2.connect(g2); g2.connect(this.master);
    o2.start(t + 0.52); o2.stop(t + 0.95);
  }

  step() { // footstep tick, called ~2/s while moving
    if (!this.ready || this._stepMute) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const b = ctx.createBuffer(1, 1200, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 900);
    src.buffer = b;
    const g = ctx.createGain(); g.gain.value = 0.02;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
}

export class Music {
  constructor(tracks) {
    this.el = tracks.map((src) => { const a = new Audio(src); a.loop = true; a.volume = 0; return a; });
    this.cur = -1; this.gains = this.el.map(() => 0);
    this.master = 0.16;
    this._fade = null;
  }
  start(rng = Math) { this.pick(rng); }
  pick(rng = Math) {
    let next = (rng.random() * this.el.length) | 0;
    if (this.el.length > 1 && next === this.cur) next = (next + 1) % this.el.length;
    const prev = this.cur; this.cur = next;
    const el = this.el[next];
    try { el.play(); } catch (e) { void e; }
    const t0 = performance.now(), dur = 3500;
    if (this._fade) cancelAnimationFrame(this._fade);
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      this.gains[next] = k; el.volume = this.master * k;
      if (prev >= 0) { this.gains[prev] = 1 - k; this.el[prev].volume = this.master * (1 - k);
        if (k === 1) this.el[prev].pause(); }
      if (k < 1) this._fade = requestAnimationFrame(step);
    };
    step();
  }
}

export class MysteryMusic {
  constructor() { this.started = false; this.nodes = []; }
  start(bed) {
    if (this.started || !bed?.ctx) return;
    this.started = true;
    const ctx = bed.ctx, out = ctx.createGain(); out.gain.value = 0.12;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 420; filter.Q.value = 0.7;
    out.connect(filter); filter.connect(bed.master);
    // Slow, unresolved minor intervals: mysterious without becoming melodic.
    for (const [freq, gain, detune] of [[55, 0.32, -4], [82.41, 0.18, 3], [110, 0.13, -2], [146.83, 0.07, 5]]) {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq; o.detune.value = detune;
      const g = ctx.createGain(); g.gain.value = gain;
      o.connect(g); g.connect(out); o.start(); this.nodes.push(o);
    }
    const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.035;
    const lg = ctx.createGain(); lg.gain.value = 0.045;
    lfo.connect(lg); lg.connect(out.gain); lfo.start(); this.nodes.push(lfo);
    const drift = ctx.createOscillator(); drift.type = "sine"; drift.frequency.value = 0.011;
    const dg = ctx.createGain(); dg.gain.value = 36;
    drift.connect(dg); dg.connect(filter.frequency); drift.start(); this.nodes.push(drift);
  }
}