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

  setEnabled(on) { this.enabled = on; }

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
