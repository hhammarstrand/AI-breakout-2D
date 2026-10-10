import { gameState, penalize, scaledPenalty } from "../state.js";
import { music } from "../audio/music.js";

// R2 — tune the signal. Match HALCYON's carrier wave by adjusting frequency, amplitude and phase,
// then transmit. Round 2 adds noise to the target; round 3 only shows it in flickering bursts.
const ROUNDS = [
  { noise: 0, flicker: false, phaseSteps: 8 },
  { noise: 0.35, flicker: false, phaseSteps: 8 },
  { noise: 0.2, flicker: true, phaseSteps: 16 },
];
const PARAMS = ["FREQ", "AMP", "PHASE"];
const RANGES = { FREQ: [1, 6], AMP: [1, 5] };
const TIME_PENALTY = 20;
const DONE_TIME = 1.5;

const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

export class SignalScene {
  constructor({ hud, sfx, fx, onResult }) {
    this.hints = ["Match FREQ first: count how many red peaks cross the screen.", "Then AMP: how tall the red wave is, from 1 to 5.", "PHASE last: slide your wave sideways until the peaks line up exactly."];
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this.round = 0;
    this._t = 0;
    this._load();
  }

  onEnter() { document.body.classList.add("no-objective", "in-puzzle"); music.play("sector"); music.setIntensity(0); }
  onExit() { document.body.classList.remove("no-objective", "in-puzzle"); }

  _load() {
    const r = ROUNDS[this.round];
    this.target = { FREQ: rnd(1, 6), AMP: rnd(2, 5), PHASE: rnd(0, r.phaseSteps - 1) };
    do {
      this.mine = { FREQ: rnd(1, 6), AMP: rnd(1, 5), PHASE: rnd(0, r.phaseSteps - 1) };
    } while (this._matches());
    this.sel = 0;
    this.done = 0;
    this.message = null;
    this.noiseSeed = Math.random() * 100;
  }

  _matches() { return PARAMS.every((p) => this.mine[p] === this.target[p]); }

  update(dt, input) {
    this._t += dt;
    this.hud.update(dt);
    if (this.message) { this.message.time -= dt; if (this.message.time <= 0) this.message = null; }
    if (this.done > 0) {
      this.done -= dt;
      if (this.done <= 0) this._next();
      return;
    }
    if (input.wasPressed("pause")) { this.onResult({ success: false, aborted: true }); return; }
    if (input.wasPressed("left")) { this.sel = (this.sel + 2) % 3; this.sfx.play("select"); }
    if (input.wasPressed("right")) { this.sel = (this.sel + 1) % 3; this.sfx.play("select"); }
    const p = PARAMS[this.sel];
    const step = input.wasPressed("up") ? 1 : input.wasPressed("down") ? -1 : 0;
    if (step) {
      if (p === "PHASE") {
        const n = ROUNDS[this.round].phaseSteps;
        this.mine.PHASE = (this.mine.PHASE + step + n) % n;
      } else {
        const [lo, hi] = RANGES[p];
        this.mine[p] = Math.max(lo, Math.min(hi, this.mine[p] + step));
      }
      this.sfx.play("blip");
    }
    if (input.wasPressed("submit")) this._transmit(); // only Enter commits: Space must never cost time
  }

  _transmit() {
    if (this._matches()) {
      this.done = DONE_TIME;
      this.sfx.play("success");
      this.fx.flash("#4ae6ff");
      return;
    }
    penalize(TIME_PENALTY);
    this.sfx.play("error");
    this.fx.shake();
    this.message = { text: `CARRIER REJECTED — HALCYON heard a stranger. (-${scaledPenalty(TIME_PENALTY)}s)`, time: 2.4 };
  }

  _next() {
    this.round++;
    if (this.round < ROUNDS.length) { this.sfx.play("door"); this.fx.glitch(); this._load(); return; }
    this.onResult({
      success: true,
      aborted: false,
      report: [
        "[R2] You're on HALCYON's carrier. The containment lab thinks you're one of its sentinels.",
        "Tech... there were two voices on that wave. HALCYON's, and an older copy of ECHO's.",
        "R3 is open. Kofi says the AURORA chip is under the coolant canisters in there.",
      ],
    });
  }

  _wave(params, x, phaseSteps) {
    const ph = (params.PHASE / phaseSteps) * Math.PI * 2;
    return params.AMP * Math.sin(x * params.FREQ * Math.PI * 2 + ph);
  }

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    const r = ROUNDS[this.round];
    renderer.fillRect(0, 0, w, h, "#03060c");
    renderer.fillRect(0, 0, w, 24, "#081626");
    renderer.fillRect(0, 22, w, 2, "#4ae6ff");
    renderer.text(`R2 // TUNE THE SIGNAL — CARRIER ${this.round + 1}/${ROUNDS.length}`, 8, 12, { color: "#cffcff", size: 11, weight: "bold", baseline: "middle" });

    // oscilloscope
    const ox = 30, oy = 40, ow = w - 60, oh = 170, mid = oy + oh / 2, scale = oh / 12;
    renderer.fillRect(ox, oy, ow, oh, "#020a10");
    renderer.strokeRect(ox, oy, ow, oh, "#1a4a5a", 1);
    for (let gx = 0; gx <= 10; gx++) renderer.fillRect(ox + (ow / 10) * gx, oy, 1, oh, "rgba(74,230,255,0.08)");
    for (let gy = 0; gy <= 6; gy++) renderer.fillRect(ox, oy + (oh / 6) * gy, ow, 1, "rgba(74,230,255,0.08)");

    const visible = !r.flicker || Math.sin(this._t * 3.1) + Math.sin(this._t * 7.3) > 0.4;
    const scroll = this._t * 0.15;
    if (visible || this.done > 0) {
      ctx.strokeStyle = "rgba(255,70,90,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= ow; i += 2) {
        const x = i / ow + scroll;
        const noise = r.noise ? (Math.sin(i * 0.9 + this.noiseSeed) * Math.sin(i * 0.37 + this._t * 9)) * r.noise * 3 : 0;
        const y = mid - (this._wave(this.target, x, r.phaseSteps) + noise) * scale;
        if (i === 0) ctx.moveTo(ox + i, y); else ctx.lineTo(ox + i, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = this.done > 0 ? "#0aff7a" : "#4ae6ff";
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let i = 0; i <= ow; i += 2) {
      const y = mid - this._wave(this.mine, i / ow + scroll, r.phaseSteps) * scale;
      if (i === 0) ctx.moveTo(ox + i, y); else ctx.lineTo(ox + i, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    renderer.text("HALCYON", ox + 6, oy + 6, { color: "#ff5a6a", size: 8, weight: "bold" });
    renderer.text("YOU", ox + 6, oy + 16, { color: "#4ae6ff", size: 8, weight: "bold" });
    if (r.flicker) renderer.text("SIGNAL UNSTABLE", ox + ow - 6, oy + 6, { color: "#ffaa3a", size: 8, align: "right" });

    // dials
    PARAMS.forEach((p, i) => {
      const dx = 70 + i * 140, dy = 236;
      const sel = i === this.sel;
      renderer.fillRect(dx - 50, dy - 6, 100, 40, sel ? "#0a2230" : "#060e14");
      renderer.strokeRect(dx - 50, dy - 6, 100, 40, sel ? "#4ae6ff" : "#1a3a4a", sel ? 2 : 1);
      renderer.text(p, dx, dy + 4, { color: sel ? "#cffcff" : "#4a8a9a", size: 9, align: "center", baseline: "middle", weight: "bold" });
      const val = p === "PHASE" ? `${Math.round((this.mine.PHASE / r.phaseSteps) * 360)}°` : String(this.mine[p]);
      renderer.text(val, dx, dy + 21, { color: sel ? "#ffffff" : "#8acada", size: 14, align: "center", baseline: "middle", weight: "bold" });
      if (sel) renderer.text("▲▼", dx + 38, dy + 21, { color: "#4ae6ff", size: 8, align: "center", baseline: "middle" });
    });

    if (this.message) renderer.text(this.message.text, w / 2, 222, { color: "#ff5a5a", size: 8, align: "center", baseline: "middle", weight: "bold" });
    if (this.done > 0) renderer.text("CARRIER LOCKED", w / 2, 222, { color: "#0aff7a", size: 11, align: "center", baseline: "middle", weight: "bold" });

    renderer.fillRect(0, h - 22, w, 22, "#081626");
    renderer.fillRect(0, h - 22, w, 1, "#4ae6ff");
    renderer.text("[←→] choose dial   [↑↓] adjust   [enter] transmit   [esc] exit", 8, h - 11, { color: "#4a8a9a", size: 8, baseline: "middle" });
  }
}
