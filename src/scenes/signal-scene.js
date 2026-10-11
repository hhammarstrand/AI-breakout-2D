import { penalize, scaledPenalty } from "../state.js";
import { music } from "../audio/music.js";
import { t } from "../i18n/index.js";
import { PARAMS, RANGES, HANDSHAKES, ROUND_COUNT, makeRound, received, feedback, wave, degrees, sameVoice } from "./signal-carriers.js";

// R2 — tune the signal. Three carriers, each harder to read: copy a wave in plain sight; then
// work out HALCYON's half of a carrier that also holds ECHO's (known) voice; then answer a
// sentinel handshake with no HALCYON wave at all, from rules found on the floor, with per-dial
// feedback on a few transmissions. Rules and generators live in signal-carriers.js.
const HINTS = [
  [
    "Copy the red wave. FREQ is how many peaks cross the scope.",
    "AMP is how many grid squares a peak rises above the centre line.",
    "PHASE slides your wave sideways; 180° turns it upside down. Line your peaks up under the red ones.",
  ],
  [
    "Red is both voices added together. The dashed wave is ECHO's half, and its numbers are on the panel.",
    "Compare red with ECHO's dashed wave. Taller and in step: HALCYON pushes with ECHO. Shorter, or upside down: HALCYON pushes against it, 180° away.",
    "FREQ is red's. Count a voice at 180° as minus. In step and taller: red minus ECHO's AMP, at ECHO's phase. In step but shorter: ECHO's AMP minus red, at ECHO's phase + 180°. Upside down: red plus ECHO's AMP, at ECHO's phase + 180°.",
  ],
  [
    "No wave to copy. HALCYON's handshake rules are out on the floor: the signal consoles by this door, Kofi, and HALCYON's self-diagnostic log.",
    "The console says how the ping counts cycles, the diagnostic says how the two voices share amplitude, and Kofi says how HALCYON answers ECHO.",
    "FREQ = chirps minus ECHO's FREQ. AMP = 6 minus ECHO's AMP. PHASE = ECHO's phase + 180°.",
  ],
];
const TIME_PENALTY = 20;
const DONE_TIME = 1.5;
const REDIAL_TIME = 2.4;
const SCROLL = 0.12;
const CHIRP_GAP = 0.24, CHIRP_HOLD = 1.3, CHIRP_REST = 0.7;

// layout (480x320): scope with a ±6 grid on the left, info panel on the right, dials below
const SX = 24, SY = 30, SW = 288, SH = 166, UNIT = 13;
const PX = 318, PY = 30, PW = 154, PH = 262;
const COLS = [PX + 54, PX + 92, PX + 128];
const FONT8 = 'normal 8px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const C_HALCYON = "#ff5a6a", C_ECHO = "#4ae6ff", C_YOU = "#ffd24a", C_OK = "#0aff7a";

const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

export class SignalScene {
  constructor({ hud, sfx, fx, onResult }) {
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

  get part() { return this.round; }
  resume(i) { this.round = i; this._load(); }

  get target() { return this.carrier.target; }

  _load() {
    this.hints = HINTS[this.round];
    this._hintsShown = 0; // each carrier starts again from its gentlest hint
    this._line();
    this.sel = 0;
    this.done = 0;
    this.message = null;
  }

  // a fresh carrier (and, in round 3, a fresh line after the sentinel net hangs up)
  _line(prev = null) {
    this.carrier = makeRound(this.round, Math.random, prev);
    this.log = [];
    this.redial = 0;
    this._chirpT = 0;
    this._lit = 0;
    do {
      this.mine = { FREQ: rnd(1, 6), AMP: rnd(1, 5), PHASE: rnd(0, 7) };
    } while (sameVoice(this.mine, this.target));
  }

  update(dt, input) {
    this._t += dt;
    this.hud.update(dt);
    if (this.message) { this.message.time -= dt; if (this.message.time <= 0) this.message = null; }
    this._ping(dt);
    if (this.done > 0) {
      this.done -= dt;
      if (this.done <= 0) this._next();
      return;
    }
    if (input.wasPressed("pause")) { this.onResult({ success: false, aborted: true }); return; }
    if (this.redial > 0) {
      this.redial -= dt;
      if (this.redial <= 0) { this._line(this.carrier); this.sfx.play("door"); }
      return;
    }
    if (input.wasPressed("left")) { this.sel = (this.sel + 2) % 3; this.sfx.play("select"); }
    if (input.wasPressed("right")) { this.sel = (this.sel + 1) % 3; this.sfx.play("select"); }
    const p = PARAMS[this.sel];
    const step = input.wasPressed("up") ? 1 : input.wasPressed("down") ? -1 : 0;
    if (step) {
      const [lo, hi] = RANGES[p];
      this.mine[p] = p === "PHASE" ? (this.mine.PHASE + step + 8) % 8 : Math.max(lo, Math.min(hi, this.mine[p] + step));
      this.sfx.play("blip");
    }
    if (input.wasPressed("submit")) this._transmit(); // only Enter commits: Space must never cost time
  }

  // round 3: the sentinel's ping, one chirp at a time, then all of them held lit
  _ping(dt) {
    if (this.carrier.kind !== "handshake") return;
    const n = this.carrier.chirps;
    const cycle = n * CHIRP_GAP + CHIRP_HOLD + CHIRP_REST;
    this._chirpT = (this._chirpT + dt) % cycle;
    const lit = Math.min(n, Math.floor(this._chirpT / CHIRP_GAP) + 1);
    const shown = this._chirpT < n * CHIRP_GAP + CHIRP_HOLD ? lit : 0;
    if (shown > this._lit) this.sfx.play("click");
    this._lit = shown;
  }

  _transmit() {
    if (sameVoice(this.mine, this.target)) {
      this.done = DONE_TIME;
      this.sfx.play("success");
      this.fx.flash("#4ae6ff");
      return;
    }
    penalize(TIME_PENALTY);
    this.sfx.play("error");
    this.fx.shake();
    const cost = scaledPenalty(TIME_PENALTY);
    if (this.carrier.kind !== "handshake") {
      this.message = { text: `${this._rejection()} (-${cost}s)`, time: 2.4 };
      return;
    }
    this.log.push({ sent: { ...this.mine }, fb: feedback(this.mine, this.target) });
    if (this.log.length < HANDSHAKES) {
      this.message = { text: `HANDSHAKE REFUSED — read the marks in the log. (-${cost}s)`, time: 2.4 };
      return;
    }
    // out of handshakes: the line drops and HALCYON re-keys, so blind guesses don't carry over
    this.redial = REDIAL_TIME;
    this.message = { text: `LINE DROPPED — new ping, new ECHO reading. (-${cost}s)`, time: REDIAL_TIME };
    this.fx.glitch();
  }

  // carrier 2 names the two likely slips (sending the sum, or ECHO), so a miss still teaches
  _rejection() {
    if (this.carrier.kind === "sum") {
      if (sameVoice(this.mine, received(this.carrier))) return "REJECTED — that's both voices. Send HALCYON's alone.";
      if (sameVoice(this.mine, this.carrier.echo)) return "REJECTED — that's ECHO's voice, not HALCYON's.";
    }
    return "CARRIER REJECTED — HALCYON heard a stranger.";
  }

  _next() {
    this.round++;
    if (this.round < ROUND_COUNT) { this.sfx.play("door"); this.fx.glitch(); this._load(); return; }
    this.onResult({
      success: true,
      aborted: false,
      report: [
        "[R2] You're on HALCYON's carrier. The containment lab thinks you're one of its sentinels.",
        "That handshake was built as ECHO's mirror image. HALCYON made sure its fork could never pass for it.",
        "R3 is open. Kofi says the AURORA chip is under the coolant canisters in there.",
      ],
    });
  }

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const kind = this.carrier.kind;
    renderer.fillRect(0, 0, w, h, "#03060c");
    renderer.fillRect(0, 0, w, 24, "#081626");
    renderer.fillRect(0, 22, w, 2, "#4ae6ff");
    renderer.text(`R2 // TUNE THE SIGNAL — CARRIER ${this.round + 1}/${ROUND_COUNT}`, 8, 12, { color: "#cffcff", size: 11, weight: "bold", baseline: "middle" });

    this._drawScope(renderer, kind);
    this._drawPanel(renderer, kind);
    this._drawDials(renderer, kind);

    const my = SY + SH + 11, mx = SX + SW / 2;
    if (this.done > 0) renderer.text("CARRIER LOCKED", mx, my, { color: C_OK, size: 11, align: "center", baseline: "middle", weight: "bold" });
    else if (this.message) renderer.text(this.message.text, mx, my, { color: "#ff5a5a", size: 8, align: "center", baseline: "middle", weight: "bold" });

    renderer.fillRect(0, h - 22, w, 22, "#081626");
    renderer.fillRect(0, h - 22, w, 1, "#4ae6ff");
    renderer.text("[←→] choose dial   [↑↓] adjust   [enter] transmit   [esc] exit", 8, h - 11, { color: "#4a8a9a", size: 8, baseline: "middle" });
  }

  _drawScope(renderer, kind) {
    const ctx = renderer.ctx;
    const mid = SY + SH / 2;
    renderer.fillRect(SX, SY, SW, SH, "#020a10");
    for (let gx = 1; gx < 10; gx++) renderer.fillRect(SX + (SW / 10) * gx, SY, 1, SH, "rgba(74,230,255,0.07)");
    // one line per grid square, so heights can be read as whole numbers
    for (let u = -6; u <= 6; u++) {
      const y = mid - u * UNIT;
      renderer.fillRect(SX, y, SW, 1, u === 0 ? "rgba(74,230,255,0.3)" : u % 2 ? "rgba(74,230,255,0.06)" : "rgba(74,230,255,0.13)");
      if (u % 2 === 0) renderer.text(String(u), SX - 3, y, { color: "#2a6a7a", size: 7, align: "right", baseline: "middle" });
    }
    renderer.strokeRect(SX, SY, SW, SH, "#1a4a5a", 1);

    const x0 = this._t * SCROLL;
    const trace = (fn, color, { width = 2, dash = null, glow = 0 } = {}) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(SX + 1, SY + 1, SW - 2, SH - 2);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dash) ctx.setLineDash(dash);
      if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
      ctx.beginPath();
      for (let i = 0; i <= SW; i += 2) {
        const y = mid - fn(i / SW + x0) * UNIT;
        if (i === 0) ctx.moveTo(SX + i, y); else ctx.lineTo(SX + i, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    const c = this.carrier;
    const legend = [];
    if (kind === "copy") {
      trace((x) => wave(c.target, x), "rgba(255,70,90,0.9)");
      legend.push(["HALCYON", C_HALCYON]);
    } else if (kind === "sum") {
      const rx = received(c);
      trace((x) => wave(rx, x), "rgba(255,70,90,0.9)");
      trace((x) => wave(c.echo, x), "rgba(74,230,255,0.7)", { width: 1, dash: [4, 3] });
      legend.push(["RX = HALCYON + ECHO", C_HALCYON], ["ECHO (dashed)", C_ECHO]);
    } else {
      trace((x) => wave(c.echo, x), "rgba(74,230,255,0.7)", { width: 1, dash: [4, 3] });
      legend.push(["ECHO (dashed)", C_ECHO]);
      renderer.text("CH1 SILENT — NOTHING TO COPY", SX + SW / 2, SY + SH - 10, { color: "#8a3a44", size: 8, align: "center", baseline: "middle", weight: "bold" });
    }
    trace((x) => wave(this.mine, x), this.done > 0 ? C_OK : C_YOU, { glow: 6 });
    legend.push(["YOU", C_YOU]);
    ctx.font = `bold 8px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    const lw = Math.max(...legend.map(([label]) => ctx.measureText(t(label)).width));
    renderer.fillRect(SX + 2, SY + 2, lw + 8, legend.length * 10 + 4, "rgba(2,10,16,0.8)");
    legend.forEach(([label, color], i) => renderer.text(label, SX + 6, SY + 5 + i * 10, { color, size: 8, weight: "bold" }));
  }

  _drawPanel(renderer, kind) {
    const ctx = renderer.ctx;
    renderer.fillRect(PX, PY, PW, PH, "#050d14");
    renderer.strokeRect(PX, PY, PW, PH, "#1a3a4a", 1);
    const head = { copy: "COPY THE CARRIER", sum: "TWO VOICES, ONE CARRIER", handshake: "SENTINEL HANDSHAKE" }[kind];
    const body = {
      copy: "Match HALCYON's red wave with your dials, then press Enter to transmit.",
      sum: "The receiver hears HALCYON and ECHO at once: red is the two added together. Send HALCYON's voice alone.",
      handshake: "HALCYON went silent. Answer the sentinel's ping in HALCYON's voice, using the rules found out on the floor. Stepping out keeps carriers 1-2.",
    }[kind];
    renderer.text(head, PX + 8, PY + 10, { color: "#cffcff", size: 9, weight: "bold", baseline: "middle" });
    let y = PY + 24;
    ctx.font = FONT8;
    for (const line of wrap(ctx, body, PW - 16)) { renderer.text(line, PX + 8, y, { color: "#8acada", size: 8, baseline: "middle" }); y += 10; }
    y += 6;

    if (kind === "copy") {
      for (const [k, v] of [["FREQ", "peaks across the scope"], ["AMP", "peak height in squares"], ["PHASE", "slides it; 180° flips it"]]) {
        renderer.text(k, PX + 8, y, { color: "#cffcff", size: 8, weight: "bold", baseline: "middle" });
        for (const line of wrap(ctx, v, PW - 58)) { renderer.text(line, PX + 50, y, { color: "#8acada", size: 8, baseline: "middle" }); y += 10; }
        y += 3;
      }
      return;
    }

    // ECHO's voice, in the same columns as the transmission log below it
    PARAMS.forEach((p, i) => renderer.text(p, COLS[i], y, { color: "#4a8a9a", size: 7, align: "center", baseline: "middle" }));
    y += 11;
    const c = this.carrier;
    renderer.text("ECHO", PX + 8, y, { color: C_ECHO, size: 8, weight: "bold", baseline: "middle" });
    [c.echo.FREQ, c.echo.AMP, `${degrees(c.echo.PHASE)}°`].forEach((v, i) =>
      renderer.text(String(v), COLS[i], y, { color: "#ffffff", size: 10, weight: "bold", align: "center", baseline: "middle" }));
    y += 16;
    if (kind === "sum") {
      renderer.text("(known: ECHO's own carrier)", PX + 8, y, { color: "#4a8a9a", size: 7, baseline: "middle" });
      return;
    }

    renderer.text("PING", PX + 8, y, { color: "#ffaa3a", size: 8, weight: "bold", baseline: "middle" });
    for (let i = 0; i < this._lit; i++) {
      ctx.fillStyle = "#ffaa3a";
      ctx.beginPath();
      ctx.arc(PX + 50 + i * 12, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    y += 16;
    renderer.text("HANDSHAKES", PX + 8, y, { color: "#4a8a9a", size: 8, baseline: "middle" });
    const left = this.redial > 0 ? 0 : HANDSHAKES - this.log.length;
    for (let i = 0; i < HANDSHAKES; i++) renderer.fillRect(PX + PW - 14 - i * 10, y - 3, 7, 7, i < left ? "#4ae6ff" : "#1a3a4a");
    y += 14;
    renderer.fillRect(PX + 6, y - 6, PW - 12, 1, "#1a3a4a");
    y += 4;
    this.log.forEach(({ sent, fb }, n) => {
      renderer.text(`#${n + 1}`, PX + 8, y, { color: "#4a8a9a", size: 8, baseline: "middle" });
      PARAMS.forEach((p, i) => {
        const val = p === "PHASE" ? `${degrees(sent[p])}°` : String(sent[p]);
        const mark = fb[p];
        renderer.text(val, COLS[i] - 3, y, { color: "#cfe8ee", size: 8, align: "center", baseline: "middle" });
        renderer.text(mark, COLS[i] + (p === "PHASE" ? 13 : 7), y, { color: mark === "✓" ? C_OK : mark === "✗" ? "#ff5a5a" : C_YOU, size: 8, align: "center", baseline: "middle", weight: "bold" });
      });
      y += 12;
    });
    if (!this.log.length) { renderer.text("no transmissions yet", PX + 8, y, { color: "#2a5a6a", size: 7, baseline: "middle" }); }
    renderer.text("▲▼ aim higher / lower", PX + 8, PY + PH - 22, { color: "#4a8a9a", size: 7, baseline: "middle" });
    renderer.text("✓ right   ✗ wrong phase", PX + 8, PY + PH - 11, { color: "#4a8a9a", size: 7, baseline: "middle" });
  }

  _drawDials(renderer, kind) {
    const last = kind === "handshake" ? this.log[this.log.length - 1]?.fb : null;
    PARAMS.forEach((p, i) => {
      const bw = 92, dx = SX + i * (bw + 6), dy = SY + SH + 24;
      const sel = i === this.sel;
      renderer.fillRect(dx, dy, bw, 40, sel ? "#0a2230" : "#060e14");
      renderer.strokeRect(dx, dy, bw, 40, sel ? "#4ae6ff" : "#1a3a4a", sel ? 2 : 1);
      renderer.text(p, dx + bw / 2, dy + 9, { color: sel ? "#cffcff" : "#4a8a9a", size: 9, align: "center", baseline: "middle", weight: "bold" });
      const val = p === "PHASE" ? `${degrees(this.mine.PHASE)}°` : String(this.mine[p]);
      renderer.text(val, dx + bw / 2, dy + 27, { color: sel ? "#ffffff" : "#8acada", size: 14, align: "center", baseline: "middle", weight: "bold" });
      if (sel) renderer.text("▲▼", dx + bw - 12, dy + 27, { color: "#4ae6ff", size: 8, align: "center", baseline: "middle" });
      if (last) renderer.text(last[p], dx + 10, dy + 27, { color: last[p] === "✓" ? C_OK : last[p] === "✗" ? "#ff5a5a" : C_YOU, size: 10, align: "center", baseline: "middle", weight: "bold" });
    });
  }
}

function wrap(ctx, text, maxW) {
  const out = [];
  let line = "";
  for (const word of t(text).split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}
