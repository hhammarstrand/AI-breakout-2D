// Tiny WebAudio synth — every sound is generated, no asset files.
const SOUNDS = {
  blip:    [{ freq: 880, dur: 0.025, type: "square", vol: 0.04 }],
  step:    [{ freq: 120, to: 70, dur: 0.04, type: "triangle", vol: 0.05 }],
  select:  [{ freq: 520, dur: 0.05, type: "square", vol: 0.06 }],
  confirm: [{ freq: 660, dur: 0.06, type: "square", vol: 0.07 },
            { freq: 990, dur: 0.08, type: "square", vol: 0.07, delay: 0.06 }],
  stamp:   [{ freq: 200, to: 90, dur: 0.09, type: "sawtooth", vol: 0.08 }],
  door:    [{ freq: 90, to: 360, dur: 0.25, type: "sawtooth", vol: 0.07 },
            { freq: 720, dur: 0.06, type: "square", vol: 0.05, delay: 0.24 }],
  denied:  [{ freq: 180, dur: 0.12, type: "square", vol: 0.08 },
            { freq: 140, dur: 0.18, type: "square", vol: 0.08, delay: 0.13 }],
  error:   [{ freq: 300, to: 80, dur: 0.35, type: "sawtooth", vol: 0.1 }],
  success: [{ freq: 523, dur: 0.09, type: "square", vol: 0.07 },
            { freq: 659, dur: 0.09, type: "square", vol: 0.07, delay: 0.09 },
            { freq: 784, dur: 0.09, type: "square", vol: 0.07, delay: 0.18 },
            { freq: 1047, dur: 0.25, type: "square", vol: 0.07, delay: 0.27 }],
  alarm:   [{ freq: 880, to: 440, dur: 0.3, type: "sawtooth", vol: 0.07 },
            { freq: 880, to: 440, dur: 0.3, type: "sawtooth", vol: 0.07, delay: 0.35 }],
  toast:   [{ freq: 1200, dur: 0.04, type: "sine", vol: 0.06 },
            { freq: 1600, dur: 0.06, type: "sine", vol: 0.06, delay: 0.05 }],
  boot:    [{ freq: 60, to: 600, dur: 0.6, type: "triangle", vol: 0.06 }],
  spark:   [{ freq: 2400, to: 900, dur: 0.05, type: "square", vol: 0.025 },
            { freq: 3100, to: 1200, dur: 0.04, type: "square", vol: 0.02, delay: 0.05 }],
  drone:   [{ freq: 1400, to: 1900, dur: 0.05, type: "sine", vol: 0.04 },
            { freq: 1900, to: 1500, dur: 0.06, type: "sine", vol: 0.04, delay: 0.06 }],
  iris:    [{ freq: 400, to: 80, dur: 0.4, type: "triangle", vol: 0.07 }],
  gameover:[{ freq: 440, to: 40, dur: 1.4, type: "sawtooth", vol: 0.1 }],
};

export class Sfx {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.ctx = null;
    // Browsers only allow audio after a user gesture; unlock on the first key/click.
    const unlock = () => { this._ensure(); };
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("pointerdown", unlock, { once: true });
  }

  _ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this._stopAmbient();
    else if (this._ambientMode) this.setAmbient(this._ambientMode);
  }

  // Background building hum; "alarm" adds a slow siren on top.
  setAmbient(mode) {
    this._ambientMode = mode;
    if (!this.enabled || !mode) { this._stopAmbient(); return; }
    const ctx = this._ensure();
    if (!ctx) return;
    if (!this._ambient) {
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 180;
      filter.connect(master);
      const hum = ctx.createOscillator();
      hum.type = "sawtooth";
      hum.frequency.value = 50;
      hum.connect(filter);
      const hum2 = ctx.createOscillator();
      hum2.type = "sine";
      hum2.frequency.value = 100.6;
      hum2.connect(filter);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.15;
      lfoGain.gain.value = 60;
      lfo.connect(lfoGain).connect(filter.frequency);
      const siren = ctx.createOscillator();
      const sirenGain = ctx.createGain();
      const sirenLfo = ctx.createOscillator();
      const sirenDepth = ctx.createGain();
      siren.type = "triangle";
      siren.frequency.value = 620;
      sirenLfo.frequency.value = 0.5;
      sirenDepth.gain.value = 180;
      sirenLfo.connect(sirenDepth).connect(siren.frequency);
      sirenGain.gain.value = 0;
      siren.connect(sirenGain).connect(master);
      for (const o of [hum, hum2, lfo, siren, sirenLfo]) o.start();
      this._ambient = { master, sirenGain, nodes: [hum, hum2, lfo, siren, sirenLfo] };
    }
    const now = ctx.currentTime;
    this._ambient.master.gain.setTargetAtTime(0.05, now, 0.5);
    this._ambient.sirenGain.gain.setTargetAtTime(mode === "alarm" ? 0.05 : 0, now, 0.5);
  }

  _stopAmbient() {
    if (!this._ambient) return;
    const amb = this._ambient;
    this._ambient = null;
    const now = this.ctx.currentTime;
    amb.master.gain.setTargetAtTime(0, now, 0.15);
    for (const o of amb.nodes) o.stop(now + 0.6);
  }

  play(name) {
    if (!this.enabled) return;
    const notes = SOUNDS[name];
    const ctx = notes && this._ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const n of notes) {
      const t0 = now + (n.delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type;
      osc.frequency.setValueAtTime(n.freq, t0);
      if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t0 + n.dur);
      gain.gain.setValueAtTime(n.vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.02);
    }
  }
}
