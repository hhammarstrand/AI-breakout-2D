// Tiny WebAudio synth — every sound is generated, no asset files. A sound is a list of layers:
// oscillator tones ({ freq, to, dur, type, vol, delay }) and filtered noise transients
// ({ noise: "lowpass"|"bandpass"|"highpass", freq, to, q, dur, vol, delay }). Each play gets a
// small random pitch shift and a send into the shared room reverb.
import { bus, jitter } from "./bus.js";

const SOUNDS = {
  blip:    [{ freq: 880, dur: 0.025, type: "square", vol: 0.04 }],
  step:    [{ freq: 120, to: 70, dur: 0.04, type: "triangle", vol: 0.04 },
            { noise: "lowpass", freq: 900, dur: 0.05, vol: 0.05 }],
  select:  [{ freq: 520, dur: 0.05, type: "square", vol: 0.06 },
            { noise: "highpass", freq: 6000, dur: 0.012, vol: 0.03 }],
  confirm: [{ freq: 660, dur: 0.06, type: "square", vol: 0.07 },
            { freq: 990, dur: 0.08, type: "square", vol: 0.07, delay: 0.06 },
            { noise: "highpass", freq: 5000, dur: 0.015, vol: 0.03 }],
  stamp:   [{ freq: 200, to: 90, dur: 0.09, type: "sawtooth", vol: 0.07 },
            { freq: 80, to: 40, dur: 0.16, type: "sine", vol: 0.12 },
            { noise: "lowpass", freq: 2400, to: 200, dur: 0.16, vol: 0.16 }],
  door:    [{ freq: 90, to: 360, dur: 0.25, type: "sawtooth", vol: 0.06 },
            { noise: "bandpass", freq: 500, to: 2600, q: 1.2, dur: 0.28, vol: 0.09 },
            { freq: 720, dur: 0.06, type: "square", vol: 0.05, delay: 0.24 },
            { noise: "lowpass", freq: 600, dur: 0.08, vol: 0.1, delay: 0.25 }],
  denied:  [{ freq: 180, dur: 0.12, type: "square", vol: 0.08 },
            { freq: 140, dur: 0.18, type: "square", vol: 0.08, delay: 0.13 },
            { noise: "bandpass", freq: 900, q: 2, dur: 0.05, vol: 0.04 }],
  error:   [{ freq: 300, to: 80, dur: 0.35, type: "sawtooth", vol: 0.09 },
            { noise: "lowpass", freq: 1500, to: 150, dur: 0.3, vol: 0.08 }],
  success: [{ freq: 523, dur: 0.09, type: "square", vol: 0.07 },
            { freq: 659, dur: 0.09, type: "square", vol: 0.07, delay: 0.09 },
            { freq: 784, dur: 0.09, type: "square", vol: 0.07, delay: 0.18 },
            { freq: 1047, dur: 0.25, type: "square", vol: 0.07, delay: 0.27 }],
  alarm:   [{ freq: 880, to: 440, dur: 0.3, type: "sawtooth", vol: 0.07 },
            { freq: 880, to: 440, dur: 0.3, type: "sawtooth", vol: 0.07, delay: 0.35 }],
  toast:   [{ freq: 1200, dur: 0.04, type: "sine", vol: 0.06 },
            { freq: 1600, dur: 0.06, type: "sine", vol: 0.06, delay: 0.05 }],
  boot:    [{ freq: 60, to: 600, dur: 0.6, type: "triangle", vol: 0.06 },
            { noise: "bandpass", freq: 200, to: 4000, q: 3, dur: 0.6, vol: 0.05 }],
  spark:   [{ freq: 2400, to: 900, dur: 0.05, type: "square", vol: 0.02 },
            { freq: 3100, to: 1200, dur: 0.04, type: "square", vol: 0.015, delay: 0.05 },
            { noise: "highpass", freq: 4000, dur: 0.07, vol: 0.06 },
            { noise: "highpass", freq: 5000, dur: 0.03, vol: 0.05, delay: 0.05 }],
  drone:   [{ freq: 1400, to: 1900, dur: 0.05, type: "sine", vol: 0.04 },
            { freq: 1900, to: 1500, dur: 0.06, type: "sine", vol: 0.04, delay: 0.06 }],
  iris:    [{ freq: 400, to: 80, dur: 0.4, type: "triangle", vol: 0.06 },
            { noise: "lowpass", freq: 3000, to: 200, dur: 0.4, vol: 0.06 }],
  click:   [{ freq: 1800, dur: 0.02, type: "square", vol: 0.04 },
            { freq: 900, dur: 0.02, type: "square", vol: 0.03, delay: 0.03 },
            { noise: "highpass", freq: 3000, dur: 0.015, vol: 0.05 },
            { noise: "highpass", freq: 2000, dur: 0.015, vol: 0.04, delay: 0.03 }],
  detect:  [{ freq: 500, to: 1100, dur: 0.18, type: "triangle", vol: 0.08 }],
  zap:     [{ freq: 1800, to: 60, dur: 0.5, type: "sawtooth", vol: 0.1 },
            { freq: 90, dur: 0.4, type: "square", vol: 0.06, delay: 0.05 },
            { noise: "bandpass", freq: 3500, to: 300, q: 1.5, dur: 0.45, vol: 0.14 }],
  pa:      [{ freq: 330, dur: 0.18, type: "sine", vol: 0.07 },
            { freq: 262, dur: 0.3, type: "sine", vol: 0.07, delay: 0.2 }],
  paBlip:  [{ freq: 140, dur: 0.03, type: "sawtooth", vol: 0.03 }],
  item:    [{ freq: 784, dur: 0.1, type: "square", vol: 0.07 },
            { freq: 988, dur: 0.1, type: "square", vol: 0.07, delay: 0.11 },
            { freq: 1175, dur: 0.1, type: "square", vol: 0.07, delay: 0.22 },
            { freq: 1568, dur: 0.35, type: "square", vol: 0.07, delay: 0.33 }],
  bump:    [{ freq: 90, to: 60, dur: 0.07, type: "square", vol: 0.05 },
            { noise: "lowpass", freq: 500, dur: 0.06, vol: 0.09 }],
  menu:    [{ freq: 1046, dur: 0.04, type: "square", vol: 0.05 },
            { freq: 1318, dur: 0.05, type: "square", vol: 0.05, delay: 0.04 }],
  gameover:[{ freq: 440, to: 40, dur: 1.4, type: "sawtooth", vol: 0.09 },
            { noise: "lowpass", freq: 900, to: 80, dur: 1.3, vol: 0.08 }],
};

// footsteps follow the floor: lobby carpet, research tiles, core steel grating
const STEPS = {
  lobby: SOUNDS.step,
  research: [{ freq: 160, to: 90, dur: 0.03, type: "triangle", vol: 0.03 },
             { noise: "bandpass", freq: 2500, q: 1.5, dur: 0.03, vol: 0.06 }],
  core:     [{ freq: 120, to: 70, dur: 0.04, type: "triangle", vol: 0.03 },
             { noise: "bandpass", freq: 3800, q: 4, dur: 0.06, vol: 0.05 },
             { freq: 340, to: 310, dur: 0.07, type: "square", vol: 0.01 }],
};

// musical cues keep their tuning (they play over the score); everything else wobbles ±4%
const STEADY = new Set(["success", "item", "menu", "confirm", "pa", "toast"]);
const SEND = { door: 0.3, zap: 0.35, stamp: 0.25, alarm: 0.3, pa: 0.4, gameover: 0.4, success: 0.25, item: 0.25, step: 0.05, blip: 0.04, paBlip: 0.05 };

// Ambience layers per floor (gain multipliers): mains hum, HVAC air, distant machinery,
// fluorescent buzz, and wind howling through the core's shafts.
const FLOOR_MIX = {
  lobby:    { hum: 1, air: 1, machine: 0.3, buzz: 0, wind: 0 },
  research: { hum: 0.9, air: 0.5, machine: 0.8, buzz: 1, wind: 0 },
  core:     { hum: 1.2, air: 0.2, machine: 1, buzz: 0.2, wind: 1 },
};

export class Sfx {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.ctx = null;
    this.floor = "lobby";
    // Browsers only allow audio after a user gesture; unlock on the first key/click.
    const unlock = () => { this._ensure(); };
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("pointerdown", unlock, { once: true });
  }

  _ensure() {
    if (this.broken) return null;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === "suspended") this.ctx.resume()?.catch?.(() => {});
    } catch (err) {
      // blocked or exhausted Web Audio: play on in silence rather than fail to boot
      console.warn("audio unavailable", err);
      this.broken = true;
      this.ctx = null;
      return null;
    }
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this._stopAmbient();
    else if (this._ambientMode) this.setAmbient(this._ambientMode);
  }

  // Called by the music when a floor's track starts: picks footsteps and ambience layers.
  setFloor(floor) {
    if (!FLOOR_MIX[floor] || floor === this.floor) return;
    this.floor = floor;
    if (this._ambient) this._mixAmbient(this.ctx.currentTime);
  }

  // Background building ambience for the current floor; "alarm" adds a slow siren on top.
  setAmbient(mode) {
    this._ambientMode = mode;
    if (!this.enabled || !mode) { this._stopAmbient(); return; }
    const ctx = this._ensure();
    if (!ctx) return;
    if (!this._ambient) this._ambient = this._buildAmbient(ctx);
    this._mixAmbient(ctx.currentTime);
  }

  _buildAmbient(ctx) {
    const b = bus(ctx);
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(b.out);
    const nodes = [];
    const sources = [];
    const gains = {};
    const osc = (type, freq) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; sources.push(o); return o; };
    const noise = (offset) => {
      const n = ctx.createBufferSource();
      n.buffer = b.noise;
      n.loop = true;
      n.offset = offset; // different start points so the layers don't correlate
      sources.push(n);
      return n;
    };
    const filter = (type, freq, q = 1) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; nodes.push(f); return f; };
    const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; nodes.push(g); return g; };
    const layer = (name) => { const g = gain(0); g.connect(master); gains[name] = g; return g; };
    // slow LFO wobbling an AudioParam around its value
    const lfo = (rate, depth, param) => { const o = osc("sine", rate); o.connect(gain(depth)).connect(param); };

    // mains hum through a breathing lowpass
    const humF = filter("lowpass", 180);
    humF.connect(layer("hum"));
    osc("sawtooth", 50).connect(humF);
    osc("sine", 100.6).connect(humF);
    lfo(0.15, 60, humF.frequency);
    // HVAC air: soft lowpassed noise
    noise(0).connect(filter("lowpass", 450)).connect(layer("air"));
    // distant machinery: a low noise band pumping like a compressor, plus a slow 37 Hz throb
    const machAmp = gain(0.6);
    noise(0.5).connect(filter("bandpass", 140, 2.5)).connect(machAmp).connect(layer("machine"));
    lfo(0.4, 0.45, machAmp.gain);
    osc("sine", 37).connect(gain(0.25)).connect(machAmp);
    // fluorescent tube buzz
    osc("sawtooth", 120).connect(filter("bandpass", 2400, 6)).connect(gain(0.25)).connect(layer("buzz"));
    // wind: a resonant noise band sweeping slowly up and down, with gusts
    const windF = filter("bandpass", 420, 1.4);
    const gust = gain(0.7);
    noise(1.1).connect(windF).connect(gust).connect(layer("wind"));
    lfo(0.07, 260, windF.frequency);
    lfo(0.11, 0.3, gust.gain);
    // purge siren
    const siren = osc("triangle", 620);
    lfo(0.5, 180, siren.frequency);
    siren.connect(layer("siren"));

    for (const s of sources) s.offset === undefined ? s.start() : s.start(0, s.offset);
    return { master, gains, sources, nodes };
  }

  _mixAmbient(now) {
    const amb = this._ambient;
    const mix = FLOOR_MIX[this.floor] ?? FLOOR_MIX.lobby;
    // per-layer levels so the hum stays where it was and the rest sits under it
    const LEVEL = { hum: 1, air: 0.5, machine: 0.6, buzz: 0.05, wind: 0.9 };
    for (const k of Object.keys(LEVEL)) amb.gains[k].gain.setTargetAtTime(mix[k] * LEVEL[k], now, 0.8);
    amb.gains.siren.gain.setTargetAtTime(this._ambientMode === "alarm" ? 0.5 : 0, now, 0.5);
    amb.master.gain.setTargetAtTime(0.03, now, 0.5);
  }

  _stopAmbient() {
    if (!this._ambient) return;
    const amb = this._ambient;
    this._ambient = null;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    amb.master.gain.setTargetAtTime(0, now, 0.15);
    for (const o of amb.sources) o.stop(now + 0.6);
    setTimeout(() => { amb.master.disconnect(); for (const n of amb.nodes) n.disconnect(); }, 900);
  }

  play(name) {
    if (!this.enabled) return;
    const ctx = SOUNDS[name] && this._ensure();
    if (!ctx) return;
    this.render(ctx, name, ctx.currentTime);
  }

  // Schedules one sound at time t (also used offline by the level-check script).
  render(ctx, name, t) {
    const layers = name === "step" ? STEPS[this.floor] ?? SOUNDS.step : SOUNDS[name];
    const b = bus(ctx);
    if (!this._out || this._out.context !== ctx) {
      // shared dry bus + room send, built once per context
      this._out = ctx.createGain();
      this._out.connect(b.out);
    }
    const pitch = jitter(STEADY.has(name) ? 0.01 : 0.04);
    const send = SEND[name] ?? 0.12;
    for (const n of layers) {
      const t0 = t + (n.delay || 0);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(n.vol, t0 + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      gain.connect(this._out);
      const room = ctx.createGain();
      room.gain.value = send;
      gain.connect(room).connect(b.reverb);
      let src;
      if (n.noise) {
        src = ctx.createBufferSource();
        src.buffer = b.noise;
        src.playbackRate.value = pitch;
        const f = ctx.createBiquadFilter();
        f.type = n.noise;
        f.Q.value = n.q ?? 0.8;
        f.frequency.setValueAtTime(n.freq * pitch, t0);
        if (n.to) f.frequency.exponentialRampToValueAtTime(n.to * pitch, t0 + n.dur);
        src.connect(f).connect(gain);
        src.start(t0, Math.random() * 1.5);
      } else {
        src = ctx.createOscillator();
        src.type = n.type;
        src.frequency.setValueAtTime(n.freq * pitch, t0);
        if (n.to) src.frequency.exponentialRampToValueAtTime(n.to * pitch, t0 + n.dur);
        src.connect(gain);
        src.start(t0);
      }
      src.stop(t0 + n.dur + 0.02);
    }
  }
}
