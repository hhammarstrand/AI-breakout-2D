// Procedural soundtrack: a small WebAudio step sequencer playing chord progressions with pads,
// bass, arpeggios and bells. Every track has a "tension" layer (drums, driving bass, high arp)
// whose volume follows setIntensity(), so the music swells when a sentinel is closing in.

const STEPS_PER_BAR = 16;
const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const FADE = 1.2;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// chords are MIDI triads around octave 3-4; one chord per bar
const TRACKS = {
  title: {
    bpm: 68, chords: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]],
    pad: 1.1, bells: 0.8, bass: "x...............", arp: { pattern: [0, 1, 2, 1], every: 4, vol: 0.04, pluck: true }, tension: null,
  },
  lobby: {
    bpm: 86, chords: [[57, 60, 64], [53, 57, 60], [52, 55, 60], [55, 59, 62]],
    pad: 0.38, bells: 0.12, bass: "x.......x.....x.", arp: { pattern: [0, 2, 1, 2, 0, 2, 1, 2], every: 2, vol: 0.06 },
    tension: { kick: "x...x...x...x...", hat: "..x...x...x...x.", snare: "....x.......x...", bass8: true, arp16: true },
  },
  sector: {
    bpm: 100, chords: [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]],
    pad: 0.28, bells: 0.0, bass: "x...x...x...x.x.", arp: { pattern: [0, 1, 2, 1, 2, 1, 0, 2], every: 2, vol: 0.09, pluck: true },
    tension: { kick: "x.......x.......", hat: "..x...x...x...x.", snare: null, bass8: false, arp16: true },
  },
  research: {
    bpm: 92, chords: [[54, 57, 61], [50, 54, 57], [57, 61, 64], [52, 56, 59]],
    pad: 0.34, bells: 0.18, bass: "x.....x.....x...", arp: { pattern: [0, 2, 1, 2, 1, 0], every: 2, vol: 0.06, pluck: true },
    tension: { kick: "x...x...x...x...", hat: "..x...x...x...x.", snare: "....x.......x...", bass8: true, arp16: true },
  },
  core: {
    bpm: 104, chords: [[48, 51, 55], [44, 48, 51], [46, 50, 53], [43, 47, 50]],
    pad: 0.36, bells: 0.0, bass: "x..x..x.x..x..x.", arp: { pattern: [0, 1, 2, 1], every: 2, vol: 0.05 },
    tension: { kick: "x.......x...x...", hat: "x.x.x.x.x.x.x.x.", snare: "....x.......x...", bass8: true, arp16: true },
    minIntensity: 0.3,
  },
  finale: {
    bpm: 122, chords: [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]],
    pad: 0.3, bells: 0.0, bass: "x.x.x.x.x.x.x.x.", arp: { pattern: [0, 1, 2, 1], every: 1, vol: 0.05 },
    tension: { kick: "x...x...x...x...", hat: "x.x.x.x.x.x.x.x.", snare: "....x.......x...", bass8: true, arp16: false },
    minIntensity: 0.75,
  },
  dawn: {
    bpm: 74, chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
    pad: 0.45, bells: 0.3, bass: "x...............", arp: { pattern: [0, 1, 2, 1], every: 2, vol: 0.05, pluck: true }, tension: null,
  },
  standby: {
    bpm: 60, chords: [[57, 60, 64], [52, 55, 59], [53, 57, 60], [52, 56, 59]],
    pad: 0.45, bells: 0.22, bass: "x...............", arp: null, tension: null,
  },
};

export class Music {
  constructor() {
    this.enabled = true;
    this.muted = false;
    this.current = null;
    this.wanted = null;
    this.intensity = 0;
  }

  attach(sfx) { this.sfx = sfx; }

  setEnabled(on) { this.enabled = on; this._apply(); }
  setMuted(muted) { this.muted = muted; this._apply(); }

  play(name) {
    this.wanted = name;
    if (this.current?.name === name) return;
    this._apply(true);
  }

  stop() { this.wanted = null; this._apply(); }

  setIntensity(v) {
    this.intensity = v;
    const s = this.current;
    if (!s || !s.tensionGain) return;
    const target = Math.max(v, TRACKS[s.name].minIntensity ?? 0);
    s.tensionGain.gain.setTargetAtTime(target * 0.9, s.ctx.currentTime, 0.4);
  }

  _apply(restart = false) {
    const audible = this.enabled && !this.muted && this.wanted;
    if (!audible) { this._fadeOut(); return; }
    if (restart || !this.current) {
      this._fadeOut();
      this._start(this.wanted);
    }
  }

  _fadeOut() {
    const s = this.current;
    if (!s) return;
    this.current = null;
    s.master.gain.cancelScheduledValues(s.ctx.currentTime);
    s.master.gain.setTargetAtTime(0, s.ctx.currentTime, FADE / 4);
    setTimeout(() => { clearInterval(s.timer); s.master.disconnect(); }, FADE * 1000 + 200);
  }

  _start(name) {
    const ctx = this.sfx?._ensure();
    if (!ctx) return;
    const track = TRACKS[name];
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    master.gain.setTargetAtTime(0.55, ctx.currentTime, FADE / 3);

    const base = ctx.createGain();
    base.connect(master);
    let tensionGain = null;
    if (track.tension) {
      tensionGain = ctx.createGain();
      tensionGain.gain.value = (track.minIntensity ?? 0) * 0.9;
      tensionGain.connect(master);
    }
    // echo send for arps and bells
    const delay = ctx.createDelay(1);
    delay.delayTime.value = (60 / track.bpm) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(master);

    const s = {
      name, ctx, master, base, tensionGain, delay, track,
      step: 0, nextTime: ctx.currentTime + 0.1,
      stepDur: 60 / track.bpm / 4,
    };
    s.timer = setInterval(() => this._schedule(s), TICK_MS);
    this.current = s;
    this.setIntensity(this.intensity);
  }

  _schedule(s) {
    while (s.nextTime < s.ctx.currentTime + LOOKAHEAD) {
      this._playStep(s, s.step, s.nextTime);
      s.step++;
      s.nextTime += s.stepDur;
    }
  }

  _playStep(s, step, t) {
    const tr = s.track;
    const inBar = step % STEPS_PER_BAR;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const chord = tr.chords[bar % tr.chords.length];
    const barDur = s.stepDur * STEPS_PER_BAR;

    if (inBar === 0 && tr.pad) for (const n of chord) this._pad(s, mtof(n), t, barDur * 1.05, tr.pad / chord.length);
    if (tr.bass && tr.bass[inBar] === "x") this._bass(s, s.base, mtof(chord[0] - 24), t, s.stepDur * 2.5, 0.22);
    if (tr.arp && step % tr.arp.every === 0) {
      const idx = tr.arp.pattern[(step / tr.arp.every) % tr.arp.pattern.length];
      this._pluck(s, s.base, mtof(chord[idx] + 12), t, tr.arp.vol, tr.arp.pluck);
    }
    if (tr.bells && inBar === 0 && bar % 2 === 0) {
      this._bell(s, mtof(chord[(bar / 2) % chord.length] + 24), t + s.stepDur * 2, tr.bells);
    }

    const ten = tr.tension;
    if (!ten || !s.tensionGain) return;
    if (ten.kick?.[inBar] === "x") this._kick(s, t);
    if (ten.hat?.[inBar] === "x") this._noise(s, t, 0.03, 8000, 0.08);
    if (ten.snare?.[inBar] === "x") this._noise(s, t, 0.12, 1800, 0.14);
    if (ten.bass8 && inBar % 2 === 0) this._bass(s, s.tensionGain, mtof(chord[0] - 12), t, s.stepDur * 1.6, 0.12);
    if (ten.arp16) this._pluck(s, s.tensionGain, mtof(chord[inBar % 3] + 24), t, 0.03, true);
  }

  // --- voices --------------------------------------------------------------------

  _env(s, dest, t, attack, dur, peak) {
    const g = s.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest);
    return g;
  }

  _pad(s, f, t, dur, vol) {
    const ctx = s.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const g = this._env(s, s.base, t, dur * 0.3, dur, vol * 0.5);
    filter.connect(g);
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(filter);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  _bass(s, dest, f, t, dur, vol) {
    const ctx = s.ctx;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const sq = ctx.createOscillator();
    sq.type = "square";
    sq.frequency.value = f;
    const sqg = ctx.createGain();
    sqg.gain.value = 0.15;
    const g = this._env(s, dest, t, 0.01, dur, vol);
    o.connect(g);
    sq.connect(sqg).connect(g);
    for (const osc of [o, sq]) { osc.start(t); osc.stop(t + dur + 0.05); }
  }

  _pluck(s, dest, f, t, vol, soft) {
    const ctx = s.ctx;
    const o = ctx.createOscillator();
    o.type = soft ? "sine" : "square";
    o.frequency.value = f;
    const dur = soft ? 0.35 : 0.18;
    const g = this._env(s, dest, t, 0.005, dur, vol);
    g.connect(s.delay);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _bell(s, f, t, vol) {
    const ctx = s.ctx;
    for (const [mult, v] of [[1, 1], [2.76, 0.3], [5.4, 0.12]]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f * mult;
      const g = this._env(s, s.base, t, 0.005, 2.6 / mult, vol * v * 0.3);
      g.connect(s.delay);
      o.connect(g);
      o.start(t);
      o.stop(t + 2.7);
    }
  }

  _kick(s, t) {
    const ctx = s.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const g = this._env(s, s.tensionGain, t, 0.002, 0.25, 0.5);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.3);
  }

  _noise(s, t, dur, cutoff, vol) {
    const ctx = s.ctx;
    if (!this._noiseBuf) {
      this._noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = cutoff;
    const g = this._env(s, s.tensionGain, t, 0.001, dur, vol);
    src.connect(f).connect(g);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

export const music = new Music();
